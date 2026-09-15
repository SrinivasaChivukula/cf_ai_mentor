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

// ─── Security & Validation Helpers ────────────────────────────────────────────

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{4,64}$/.test(id);
}

export function sanitizeTopic(topic: unknown): string {
  if (typeof topic !== "string") return "Software Engineering";
  const cleaned = topic.replace(/[^a-zA-Z0-9\s\+\#\.\-]/g, "").trim().slice(0, 50);
  return cleaned || "Software Engineering";
}

export function validateDifficulty(diff: unknown): "easy" | "medium" | "hard" {
  if (diff === "easy" || diff === "hard") return diff;
  return "medium";
}

export function validateMessage(msg: unknown): { valid: boolean; error?: string; message?: string } {
  if (typeof msg !== "string") {
    return { valid: false, error: "Message must be a string" };
  }
  const trimmed = msg.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }
  if (trimmed.length > 4000) {
    return { valid: false, error: "Message exceeds maximum length of 4,000 characters" };
  }
  return { valid: true, message: trimmed };
}

// ─── D1 Relational Storage Helpers ────────────────────────────────────────────

export async function syncSessionToD1(
  db: D1Database | undefined,
  sessionId: string,
  topic: string,
  difficulty: string,
  messageCount: number,
  throwOnError = false
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
    if (throwOnError) throw err;
  }
}

export async function syncMessageToD1(
  db: D1Database | undefined,
  sessionId: string,
  role: string,
  content: string,
  throwOnError = false
) {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO messages (session_id, role, content, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(sessionId, role, content.slice(0, 4000), Date.now())
      .run();
  } catch (err) {
    console.error("D1 message sync error:", err);
    if (throwOnError) throw err;
  }
}

export async function syncEvaluationToD1(
  db: D1Database | undefined,
  sessionId: string,
  analysis: any,
  followUp: string,
  throwOnError = false
) {
  if (!db) return;
  try {
    const commScore = typeof analysis?.communicationScore === "number" ? analysis.communicationScore : null;
    const techScore = typeof analysis?.technicalScore === "number" ? analysis.technicalScore : null;
    const strengths = JSON.stringify(Array.isArray(analysis?.strengths) ? analysis.strengths.slice(0, 10) : []);
    const gaps = JSON.stringify(Array.isArray(analysis?.gaps) ? analysis.gaps.slice(0, 10) : []);
    const nextFocus = JSON.stringify(Array.isArray(analysis?.nextFocus) ? analysis.nextFocus.slice(0, 10) : []);
    const rawOutput = analysis?.raw ? String(analysis.raw).slice(0, 4000) : null;

    await db
      .prepare(
        `INSERT INTO evaluations (session_id, communication_score, technical_score, strengths, gaps, next_focus, follow_up_question, raw_output, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(sessionId, commScore, techScore, strengths, gaps, nextFocus, followUp.slice(0, 1000), rawOutput, Date.now())
      .run();
  } catch (err) {
    console.error("D1 evaluation sync error:", err);
    if (throwOnError) throw err;
  }
}

// ─── Workflow — deep coaching analysis ────────────────────────────────────────

export class CoachingWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { topic, difficulty, history, sessionId } = event.payload;
    const safeTopic = sanitizeTopic(topic);
    const safeDifficulty = validateDifficulty(difficulty);

    // Step 1: Analyse the conversation so far
    const analysis = await step.do("analyse-session", async () => {
      const messages: RoleScopedChatInput[] = [
        {
          role: "system",
          content: `You are an expert technical interview coach specialising in ${safeTopic}.
Analyse the candidate's performance so far and identify:
1. Strengths demonstrated
2. Knowledge gaps
3. Communication quality (1-10)
4. Technical accuracy (1-10)
5. Recommended next focus areas
Return a JSON object with keys: strengths (array of strings), gaps (array of strings), communicationScore (number), technicalScore (number), nextFocus (array of strings).`,
        },
        ...history.slice(-15).map((m) => ({
          role: (m.role === "user" || m.role === "assistant" ? m.role : "user") as "user" | "assistant",
          content: m.content.slice(0, 2000),
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
      const rawGaps = Array.isArray((analysis as any).gaps) ? (analysis as any).gaps : [];
      const safeGaps = rawGaps.map((g: any) => String(g).replace(/[^a-zA-Z0-9\s\-]/g, "").slice(0, 80)).filter(Boolean);

      const rawFocus = Array.isArray((analysis as any).nextFocus) ? (analysis as any).nextFocus : [safeTopic];
      const safeFocus = rawFocus.map((f: any) => String(f).replace(/[^a-zA-Z0-9\s\-]/g, "").slice(0, 80)).filter(Boolean);

      const gapsStr = safeGaps.length > 0 ? safeGaps.join(", ") : "general architecture and edge cases";
      const focusStr = safeFocus.length > 0 ? safeFocus.join(", ") : safeTopic;

      const messages: RoleScopedChatInput[] = [
        {
          role: "system",
          content: `You are a senior ${safeTopic} interviewer. Generate ONE targeted ${safeDifficulty}-level interview question that will probe the candidate's gaps: ${gapsStr}. Focus on: ${focusStr}. Be concise — just the question, no preamble.`,
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
      const res = await stub.fetch("https://internal/update-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, followUp }),
      });
      if (!res.ok) throw new Error(`Failed to persist analysis to DO: ${res.status}`);
      return "persisted";
    });

    // Step 4: Persist the evaluation to Cloudflare D1 (throw on error so step retries)
    await step.do("persist-to-d1", async () => {
      await syncEvaluationToD1(this.env.DB, sessionId, analysis, followUp, true);
      return "persisted-d1";
    });

    return { analysis, followUp };
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── API Routes ──────────────────────────────────────────────────────────

    // POST /api/chat — main streaming chat endpoint
    if (path === "/api/chat" && request.method === "POST") {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return jsonError("Invalid JSON payload in request body", 400);
      }

      if (!isValidSessionId(body?.sessionId)) {
        return jsonError("Invalid or missing sessionId (must be 4-64 alphanumeric/dash characters)", 400);
      }

      const msgVal = validateMessage(body?.message);
      if (!msgVal.valid) {
        return jsonError(msgVal.error || "Invalid message content", 400);
      }

      const sessionId = body.sessionId;
      const message = msgVal.message!;
      const topic = sanitizeTopic(body.topic);
      const difficulty = validateDifficulty(body.difficulty);

      // Get session history from Durable Object
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);

      let history: Array<{ role: string; content: string }> = [];
      let stats = { messageCount: 0, topic, difficulty };

      try {
        const historyRes = await stub.fetch("https://internal/history");
        if (historyRes.ok) {
          const histData = (await historyRes.json()) as any;
          history = Array.isArray(histData?.history) ? histData.history : [];
          if (histData?.stats) stats = { ...stats, ...histData.stats };
        }
      } catch (err) {
        console.error("Error retrieving history from DO:", err);
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt(topic, difficulty, stats);

      // Add user message to DO
      try {
        await stub.fetch("https://internal/add-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: message, topic, difficulty }),
        });
      } catch (err) {
        console.error("Failed to save user message to DO:", err);
      }

      // Persist user message to D1
      await syncMessageToD1(env.DB, sessionId, "user", message);
      await syncSessionToD1(env.DB, sessionId, topic, difficulty, (stats.messageCount ?? 0) + 1);

      const messages: RoleScopedChatInput[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-15).map((m) => ({
          role: (m.role === "user" || m.role === "assistant" ? m.role : "user") as "user" | "assistant",
          content: m.content.slice(0, 2000),
        })),
        { role: "user", content: message },
      ];

      // Streaming response from Llama 3.3
      let aiResponse: any;
      try {
        aiResponse = await (env.AI as any).run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          { messages, stream: true, max_tokens: 1024 }
        );
      } catch (err: any) {
        console.error("Workers AI run error:", err);
        return jsonError("AI inference service temporarily unavailable. Please retry.", 503);
      }

      // Set up streaming pipeline with TransformStream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Background task registered with ExecutionContext
      const backgroundTask = (async () => {
        const reader = (aiResponse as ReadableStream).getReader();
        let sseBuffer = "";
        let accumulatedText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            await writer.write(encoder.encode(chunkText));

            // Parse SSE lines robustly
            sseBuffer += chunkText;
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const payload = trimmed.slice(6).trim();
                if (payload !== "[DONE]") {
                  try {
                    const parsed = JSON.parse(payload);
                    if (parsed?.response) {
                      accumulatedText += parsed.response;
                    }
                  } catch {
                    // Ignore line-level JSON parse errors
                  }
                }
              }
            }
          }
        } catch (streamErr) {
          console.error("Streaming pipe error:", streamErr);
        } finally {
          try {
            await writer.close();
          } catch {
            // Reader closed or cancelled by client
          }

          // Persist assistant message to DO and D1
          if (accumulatedText.trim().length > 0) {
            try {
              await stub.fetch("https://internal/add-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "assistant", content: accumulatedText }),
              });
              await syncMessageToD1(env.DB, sessionId, "assistant", accumulatedText);
              await syncSessionToD1(env.DB, sessionId, topic, difficulty, (stats.messageCount ?? 0) + 2);
            } catch (persistErr) {
              console.error("Failed to persist assistant response:", persistErr);
            }
          }
        }
      })();

      if (ctx?.waitUntil) {
        ctx.waitUntil(backgroundTask);
      }

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

    // POST /api/analyze — trigger deep workflow analysis
    if (path === "/api/analyze" && request.method === "POST") {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return jsonError("Invalid JSON payload in request body", 400);
      }

      if (!isValidSessionId(body?.sessionId)) {
        return jsonError("Invalid or missing sessionId", 400);
      }

      const sessionId = body.sessionId;
      const topic = sanitizeTopic(body.topic);
      const difficulty = validateDifficulty(body.difficulty);

      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);

      let history: Array<{ role: string; content: string }> = [];
      try {
        const historyRes = await stub.fetch("https://internal/history");
        if (historyRes.ok) {
          const histData = (await historyRes.json()) as any;
          history = Array.isArray(histData?.history) ? histData.history : [];
        }
      } catch (err) {
        console.error("Failed to load history for analysis:", err);
      }

      if (history.length < 2) {
        return jsonError("Please have a conversation with at least two messages before requesting an evaluation.", 400);
      }

      try {
        const instance = await env.COACHING_WORKFLOW.create({
          params: { sessionId, topic, difficulty, history },
        });

        return jsonOk({ workflowId: instance.id, status: "started" });
      } catch (wfErr: any) {
        console.error("Workflow creation failed:", wfErr);
        return jsonError("Failed to start evaluation workflow", 500);
      }
    }

    // GET /api/workflow/:id — poll workflow status
    if (path.startsWith("/api/workflow/") && request.method === "GET") {
      const wfId = path.replace("/api/workflow/", "");
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(wfId)) {
        return jsonError("Invalid workflow ID format", 400);
      }

      try {
        const instance = await env.COACHING_WORKFLOW.get(wfId);
        const status = await instance.status();
        return jsonOk(status);
      } catch {
        return jsonError("Workflow not found", 404);
      }
    }

    // GET /api/session/:id — get full session data
    if (path.startsWith("/api/session/") && !path.endsWith("/analysis") && request.method === "GET") {
      const sessionId = path.replace("/api/session/", "");
      if (!isValidSessionId(sessionId)) {
        return jsonError("Invalid sessionId format", 400);
      }

      try {
        const id = env.SESSION_STORE.idFromName(sessionId);
        const stub = env.SESSION_STORE.get(id);
        const res = await stub.fetch("https://internal/history");
        const data = await res.json();
        return jsonOk(data);
      } catch (err) {
        return jsonError("Failed to retrieve session data", 500);
      }
    }

    // GET /api/session/:id/analysis — get latest analysis
    if (path.startsWith("/api/session/") && path.endsWith("/analysis") && request.method === "GET") {
      const sessionId = path.replace("/api/session/", "").replace("/analysis", "");
      if (!isValidSessionId(sessionId)) {
        return jsonError("Invalid sessionId format", 400);
      }

      try {
        const id = env.SESSION_STORE.idFromName(sessionId);
        const stub = env.SESSION_STORE.get(id);
        const res = await stub.fetch("https://internal/analysis");
        const data = await res.json();
        return jsonOk(data);
      } catch (err) {
        return jsonError("Failed to retrieve session analysis", 500);
      }
    }

    // DELETE /api/session/:id — clear session in DO and D1
    if (path.startsWith("/api/session/") && request.method === "DELETE") {
      const sessionId = path.replace("/api/session/", "");
      if (!isValidSessionId(sessionId)) {
        return jsonError("Invalid sessionId format", 400);
      }

      try {
        const id = env.SESSION_STORE.idFromName(sessionId);
        const stub = env.SESSION_STORE.get(id);
        await stub.fetch("https://internal/clear", { method: "POST" });

        if (env.DB) {
          await env.DB.prepare("DELETE FROM messages WHERE session_id = ?").bind(sessionId).run();
          await env.DB.prepare("DELETE FROM evaluations WHERE session_id = ?").bind(sessionId).run();
          await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
        }

        return jsonOk({ cleared: true });
      } catch (err) {
        console.error("Error clearing session:", err);
        return jsonError("Failed to clear session", 500);
      }
    }

    // GET /api/analytics — relational stats across sessions from D1
    if (path === "/api/analytics" && request.method === "GET") {
      if (!env.DB) {
        return jsonOk({
          totalSessions: 0,
          totalMessages: 0,
          avgCommunicationScore: 0,
          avgTechnicalScore: 0,
          totalEvaluations: 0,
          topicDistribution: [],
          recentEvaluations: [],
          notice: "D1 database not configured",
        });
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

        return jsonOk({
          totalSessions: sessionCountResult?.count ?? 0,
          totalMessages: messageCountResult?.count ?? 0,
          avgCommunicationScore: scoreAvgResult?.avg_comm ?? 0,
          avgTechnicalScore: scoreAvgResult?.avg_tech ?? 0,
          totalEvaluations: scoreAvgResult?.total_evals ?? 0,
          topicDistribution: topicDistribution.results ?? [],
          recentEvaluations: recentEvaluations.results ?? [],
        });
      } catch (err: any) {
        console.error("Failed to query analytics from D1:", err);
        return jsonError("Failed to retrieve analytics telemetry", 500);
      }
    }

    // Serve static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ─── Prompt Engineering Helper ────────────────────────────────────────────────

function buildSystemPrompt(topic: string, difficulty: string, stats: Record<string, unknown>): string {
  const difficultyGuide: Record<string, string> = {
    easy: "Ask foundational questions suitable for junior developers. Be encouraging and patient.",
    medium: "Ask intermediate questions. Expect code-level reasoning and system design basics.",
    hard: "Ask advanced questions. Expect deep system design, distributed systems, and algorithm mastery.",
  };

  const safeTopic = sanitizeTopic(topic);
  const safeDifficulty = validateDifficulty(difficulty);
  const msgCount = typeof stats?.messageCount === "number" ? stats.messageCount : 0;

  return `You are an elite technical interview coach specialising in ${safeTopic}.
You are conducting a ${safeDifficulty}-level mock technical interview.
Difficulty guide: ${difficultyGuide[safeDifficulty]}

Session stats: ${msgCount} messages exchanged so far.

Your coaching style:
- Ask ONE precise question at a time
- After the candidate responds, give brief targeted feedback (2-3 sentences max)
- Point out what was correct, what was missing, and what could be improved
- Then ask a natural follow-up or next question
- Be direct but encouraging — simulate a real top-tech-company interviewer
- If the candidate asks for hints, give Socratic prompts, not direct answers
- When evaluating code or pseudocode, check for edge cases, complexity, and correctness

IMPORTANT: Keep your responses focused and under 300 words unless explaining something complex.
Start by greeting the candidate briefly and asking your first ${safeTopic} interview question.`;
}
