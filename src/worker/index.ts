import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { SessionStore } from "./session-store";
export { SessionStore };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Env {
  AI: Ai;
  SESSION_STORE: DurableObjectNamespace;
  COACHING_WORKFLOW: Workflow;
  ASSETS: Fetcher;
}

interface WorkflowParams {
  sessionId: string;
  topic: string;
  difficulty: string;
  history: Array<{ role: string; content: string }>;
}

// ─── Workflow — deep coaching analysis ────────────────────────────────────────

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
          // Save assistant response to DO (best-effort)
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

    // DELETE /api/session/:id — clear session
    if (path.startsWith("/api/session/") && request.method === "DELETE") {
      const sessionId = path.replace("/api/session/", "");
      const id = env.SESSION_STORE.idFromName(sessionId);
      const stub = env.SESSION_STORE.get(id);
      await stub.fetch("https://internal/clear", { method: "POST" });
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
Start by greeting the candidate briefly and asking your first ${topic} interview question.`;
}
