import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { SessionStore } from "./session-store";
export { SessionStore };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Env {
  AI: Ai;
  SESSION_STORE: DurableObjectNamespace;
  COACHING_WORKFLOW: Workflow;
  ASSETS: Fetcher;
  DB?: D1Database;
}

interface WorkflowParams {
  sessionId: string;
  topic: string;
  difficulty: string;
  history: Array<{ role: string; content: string }>;
}

// ─── D1 Relational Storage Helpers ────────────────────────────────────────────

export async function syncSessionToD1(
  db: D1Database | undefined,
  sessionId: string,
  topic: string,
  difficulty: string,
  messageCount: number
) {
  if (!db) return;
  try {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO sessions (id, topic, difficulty, message_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           topic = excluded.topic,
           difficulty = excluded.difficulty,
           message_count = excluded.message_count,
           updated_at = excluded.updated_at`
      )
      .bind(sessionId, topic, difficulty, messageCount, now, now)
      .run();
  } catch (err) {
    console.error("D1 session sync error:", err);
  }
}

export async function syncMessageToD1(
  db: D1Database | undefined,
  sessionId: string,
  role: string,
  content: string
) {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO messages (session_id, role, content, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(sessionId, role, content, Date.now())
      .run();
  } catch (err) {
    console.error("D1 message sync error:", err);
  }
}

export async function syncEvaluationToD1(
  db: D1Database | undefined,
  sessionId: string,
  analysis: any,
  followUp: string
) {
  if (!db) return;
  try {
    const commScore = typeof analysis?.communicationScore === "number" ? analysis.communicationScore : null;
    const techScore = typeof analysis?.technicalScore === "number" ? analysis.technicalScore : null;
    const strengths = JSON.stringify(analysis?.strengths ?? []);
    const gaps = JSON.stringify(analysis?.gaps ?? []);
    const nextFocus = JSON.stringify(analysis?.nextFocus ?? []);
    const rawOutput = analysis?.raw ? String(analysis.raw) : null;

    await db
      .prepare(
        `INSERT INTO evaluations (session_id, communication_score, technical_score, strengths, gaps, next_focus, follow_up_question, raw_output, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(sessionId, commScore, techScore, strengths, gaps, nextFocus, followUp, rawOutput, Date.now())
      .run();
  } catch (err) {
    console.error("D1 evaluation sync error:", err);
  }
}

// ─── Workflow — deep coaching analysis ────────────────────────────────────────
// 3 steps: analyse session → generate follow-up q → persist back to the DO
// workflows are great for this because each step retries independently if it fails
// no more worrying about timeouts on long AI calls

export class CoachingWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { topic, difficulty, history, sessionId } = event.payload;

    // Step 1: Analyse the conversation so far
    const analysis = await step.do("analyse-session", async () => {
      const messages: RoleScopedChatInput[] = [
        {
          role: "system",
          content: `You are an expert technical interview coach specialising in ${topic}.
Analyse the candidate's performance so far and identify:
1. Strengths demonstrated
2. Knowledge gaps
3. Communication quality (1-10)
4. Technical accuracy (1-10)
5. Recommended next focus areas
Return a JSON object with keys: strengths (array), gaps (array), communicationScore (number), technicalScore (number), nextFocus (array).`,
        },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      const response = await (this.env.AI as any).run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        { messages, max_tokens: 800 }
      ) as { response: string };

      try {
        const jsonMatch = response.response.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response.response };
      } catch {
        return { raw: response.response };
      }
    });

    // Step 2: Generate a tailored follow-up question
    const followUp = await step.do("generate-followup", async () => {
      const gaps = (analysis as any).gaps ?? [];
      const nextFocus = (analysis as any).nextFocus ?? [topic];

      const messages: RoleScopedChatInput[] = [
        {
          role: "system",
          content: `You are a senior ${topic} interviewer. Generate ONE targeted ${difficulty}-level interview question that will probe the candidate's gaps: ${gaps.join(", ")}. Focus on: ${nextFocus.join(", ")}. Be concise — just the question, no preamble.`,
        },
        { role: "user", content: "Generate the next interview question." },
      ];

      const response = await (this.env.AI as any).run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        { messages, max_tokens: 300 }
      ) as { response: string };

      return response.response.trim();
    });

    // Step 3: Store the analysis in the session Durable Object
    await step.do("persist-analysis", async () => {
      const id = this.env.SESSION_STORE.idFromName(sessionId);
      const stub = this.env.SESSION_STORE.get(id);
      await stub.fetch("https://internal/update-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, followUp }),
      });
      return "persisted";
    });

    // Step 4: Persist the evaluation to Cloudflare D1
    await step.do("persist-to-d1", async () => {
      await syncEvaluationToD1(this.env.DB, sessionId, analysis, followUp);
      return "persisted-d1";
    });

    return { analysis, followUp };
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── API routes ──────────────────────────────────────────────────────────

    // POST /api/chat  — main streaming chat endpoint
    if (path === "/api/chat" && request.method === "POST") {
      const body = (await request.json()) as {
        sessionId: string;
        message: string;
        topic?: string;
        difficulty?: string;
      };

      const { sessionId, message, topic = "Software Engineering", difficulty = "medium" } = body;

      // Get session history from Durable Object
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);

      const historyRes = await stub.fetch("https://internal/history");
      const { history, stats } = (await historyRes.json()) as {
        history: Array<{ role: string; content: string }>;
        stats: { messageCount: number; topic: string; difficulty: string };
      };

      // Build system prompt
      const systemPrompt = buildSystemPrompt(topic, difficulty, stats);

      // Add user message to DO
      await stub.fetch("https://internal/add-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: message, topic, difficulty }),
      });

      // Also persist to D1 for relational queries and analytics
      await syncMessageToD1(env.DB, sessionId, "user", message);
      await syncSessionToD1(env.DB, sessionId, topic, difficulty, (stats.messageCount ?? 0) + 1);

      const messages: RoleScopedChatInput[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        { role: "user", content: message },
      ];

      // Streaming response from Llama 3.3
      const aiResponse = await (env.AI as any).run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        { messages, stream: true, max_tokens: 1024 }
      );

      // We need to collect the full response to save it, but also stream to client
      // Use a TransformStream to tee the AI stream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      let fullResponse = "";

      // Process stream in background
      (async () => {
        const reader = (aiResponse as ReadableStream).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            await writer.write(encoder.encode(chunk));
          }
        } finally {
          await writer.close();
          // Save assistant response to DO and D1 (best-effort)
          try {
            const textMatch = fullResponse.match(/data: \{"response":"([^"]+)"/g);
            if (textMatch) {
              const assembled = textMatch
                .map((m) => {
                  const match = m.match(/"response":"([^"]+)"/);
                  return match ? match[1] : "";
                })
                .join("");
              await stub.fetch("https://internal/add-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "assistant", content: assembled }),
              });
              await syncMessageToD1(env.DB, sessionId, "assistant", assembled);
              await syncSessionToD1(env.DB, sessionId, topic, difficulty, (stats.messageCount ?? 0) + 2);
            }
          } catch { /* non-critical */ }
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // POST /api/analyze — trigger deep workflow analysis
    if (path === "/api/analyze" && request.method === "POST") {
      const body = (await request.json()) as {
        sessionId: string;
        topic?: string;
        difficulty?: string;
      };

      const { sessionId, topic = "Software Engineering", difficulty = "medium" } = body;
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);
      const historyRes = await stub.fetch("https://internal/history");
      const { history } = (await historyRes.json()) as {
        history: Array<{ role: string; content: string }>;
        stats: Record<string, unknown>;
      };

      if (history.length < 2) {
        return new Response(
          JSON.stringify({ error: "Have a conversation first before requesting analysis." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const instance = await env.COACHING_WORKFLOW.create({
        params: { sessionId, topic, difficulty, history },
      });

      return new Response(
        JSON.stringify({ workflowId: instance.id, status: "started" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/workflow/:id — poll workflow status
    if (path.startsWith("/api/workflow/") && request.method === "GET") {
      const wfId = path.replace("/api/workflow/", "");
      try {
        const instance = await env.COACHING_WORKFLOW.get(wfId);
        const status = await instance.status();
        return new Response(JSON.stringify(status), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Workflow not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // GET /api/session/:id — get full session data
    if (path.startsWith("/api/session/") && request.method === "GET") {
      const sessionId = path.replace("/api/session/", "");
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);
      const res = await stub.fetch("https://internal/history");
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /api/session/:id/analysis — get latest analysis
    if (path.startsWith("/api/session/") && path.endsWith("/analysis") && request.method === "GET") {
      const sessionId = path.replace("/api/session/", "").replace("/analysis", "");
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);
      const res = await stub.fetch("https://internal/analysis");
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /api/analytics — relational stats across sessions from D1
    if (path === "/api/analytics" && request.method === "GET") {
      if (!env.DB) {
        return new Response(
          JSON.stringify({
            totalSessions: 0,
            totalMessages: 0,
            avgCommunicationScore: 0,
            avgTechnicalScore: 0,
            totalEvaluations: 0,
            topicDistribution: [],
            recentEvaluations: [],
            notice: "D1 database not configured",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const sessionCountResult = await env.DB.prepare("SELECT COUNT(*) as count FROM sessions").first<{ count: number }>();
        const messageCountResult = await env.DB.prepare("SELECT COUNT(*) as count FROM messages").first<{ count: number }>();
        const scoreAvgResult = await env.DB.prepare(`
          SELECT 
            ROUND(AVG(communication_score), 1) as avg_comm,
            ROUND(AVG(technical_score), 1) as avg_tech,
            COUNT(*) as total_evals
          FROM evaluations
          WHERE communication_score IS NOT NULL
        `).first<{ avg_comm: number | null; avg_tech: number | null; total_evals: number }>();

        const topicDistribution = await env.DB.prepare(`
          SELECT topic, COUNT(*) as count
          FROM sessions
          GROUP BY topic
          ORDER BY count DESC
          LIMIT 8
        `).all();

        const recentEvaluations = await env.DB.prepare(`
          SELECT e.id, e.session_id, s.topic, s.difficulty, e.communication_score, e.technical_score, e.created_at
          FROM evaluations e
          LEFT JOIN sessions s ON e.session_id = s.id
          ORDER BY e.created_at DESC
          LIMIT 5
        `).all();

        return new Response(
          JSON.stringify({
            totalSessions: sessionCountResult?.count ?? 0,
            totalMessages: messageCountResult?.count ?? 0,
            avgCommunicationScore: scoreAvgResult?.avg_comm ?? 0,
            avgTechnicalScore: scoreAvgResult?.avg_tech ?? 0,
            totalEvaluations: scoreAvgResult?.total_evals ?? 0,
            topicDistribution: topicDistribution.results ?? [],
            recentEvaluations: recentEvaluations.results ?? [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch analytics", details: err?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // GET /api/sessions — list recent sessions from D1
    if (path === "/api/sessions" && request.method === "GET") {
      if (!env.DB) {
        return new Response(JSON.stringify({ sessions: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, topic, difficulty, message_count, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 20"
        ).all();
        return new Response(JSON.stringify({ sessions: results ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch sessions", details: err?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DELETE /api/session/:id — clear session in DO and D1
    if (path.startsWith("/api/session/") && request.method === "DELETE") {
      const sessionId = path.replace("/api/session/", "");
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);
      await stub.fetch("https://internal/clear", { method: "POST" });
      if (env.DB) {
        try {
          await env.DB.prepare("DELETE FROM messages WHERE session_id = ?").bind(sessionId).run();
          await env.DB.prepare("DELETE FROM evaluations WHERE session_id = ?").bind(sessionId).run();
          await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
        } catch { /* ignore */ }
      }
      return new Response(JSON.stringify({ cleared: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(topic: string, difficulty: string, stats: Record<string, unknown>): string {
  const difficultyGuide: Record<string, string> = {
    easy: "Ask foundational questions suitable for junior developers. Be encouraging and patient.",
    medium: "Ask intermediate questions. Expect code-level reasoning and system design basics.",
    hard: "Ask advanced questions. Expect deep system design, distributed systems, and algorithm mastery.",
  };

  return `You are an elite technical interview coach specialising in ${topic}.
You are conducting a ${difficulty}-level mock technical interview.
Difficulty guide: ${difficultyGuide[difficulty] ?? difficultyGuide["medium"]}

Session stats: ${stats.messageCount ?? 0} messages exchanged so far.

Your coaching style:
- Ask ONE precise question at a time
- After the candidate responds, give brief targeted feedback (2-3 sentences max)
- Point out what was correct, what was missing, and what could be improved
- Then ask a natural follow-up or next question
- Be direct but encouraging — simulate a real top-tech-company interviewer
- If the candidate asks for hints, give Socratic prompts, not direct answers
- When evaluating code or pseudocode, check for edge cases, complexity, and correctness

IMPORTANT: Keep your responses focused and under 300 words unless explaining something complex.
# and make it feel like a real interview, not a quiz
Start by greeting the candidate briefly and asking your first ${topic} interview question.`;
}
