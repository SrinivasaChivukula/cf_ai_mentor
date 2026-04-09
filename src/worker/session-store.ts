// ─── Session Store Durable Object ─────────────────────────────────────────────
//
// Each user session is backed by its own Durable Object instance.
// State stored:
//   - history: full conversation messages
//   - stats: topic, difficulty, message count, created/updated timestamps
//   - latestAnalysis: result from the most recent CoachingWorkflow run

interface Message {
  role: string;
  content: string;
  timestamp: number;
}

interface SessionStats {
  topic: string;
  difficulty: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

interface AnalysisResult {
  analysis: Record<string, unknown>;
  followUp: string;
  generatedAt: number;
}

export class SessionStore {
  private state: DurableObjectState;
  private history: Message[] = [];
  private stats: SessionStats = {
    topic: "Software Engineering",
    difficulty: "medium",
    messageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  private latestAnalysis: AnalysisResult | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Hibernate storage — load lazily
    this.state.blockConcurrencyWhile(async () => {
      this.history = (await this.state.storage.get<Message[]>("history")) ?? [];
      this.stats = (await this.state.storage.get<SessionStats>("stats")) ?? this.stats;
      this.latestAnalysis = (await this.state.storage.get<AnalysisResult>("latestAnalysis")) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /history — return full history + stats
    if (path === "/history") {
      return Response.json({ history: this.history, stats: this.stats });
    }

    // GET /analysis — return latest workflow analysis
    if (path === "/analysis") {
      return Response.json({ latestAnalysis: this.latestAnalysis });
    }

    // POST /add-message — append a message
    if (path === "/add-message" && request.method === "POST") {
      const { role, content, topic, difficulty } = (await request.json()) as {
        role: string;
        content: string;
        topic?: string;
        difficulty?: string;
      };

      const message: Message = { role, content, timestamp: Date.now() };
      this.history.push(message);

      // Keep last 50 messages to avoid unbounded growth
      if (this.history.length > 50) {
        this.history = this.history.slice(-50);
      }

      this.stats.messageCount = this.history.length;
      this.stats.updatedAt = Date.now();
      if (topic) this.stats.topic = topic;
      if (difficulty) this.stats.difficulty = difficulty;

      await this.state.storage.put("history", this.history);
      await this.state.storage.put("stats", this.stats);

      return Response.json({ ok: true, messageCount: this.history.length });
    }

    // POST /update-analysis — called by the Workflow to persist the result
    if (path === "/update-analysis" && request.method === "POST") {
      const { analysis, followUp } = (await request.json()) as {
        analysis: Record<string, unknown>;
        followUp: string;
      };

      this.latestAnalysis = { analysis, followUp, generatedAt: Date.now() };
      await this.state.storage.put("latestAnalysis", this.latestAnalysis);

      return Response.json({ ok: true });
    }

    // POST /clear — wipe the session
    if (path === "/clear" && request.method === "POST") {
      this.history = [];
      this.stats = {
        topic: "Software Engineering",
        difficulty: "medium",
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.latestAnalysis = null;

      await this.state.storage.delete("history");
      await this.state.storage.delete("stats");
      await this.state.storage.delete("latestAnalysis");

      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }
}
