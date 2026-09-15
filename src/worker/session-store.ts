// ─── Session Store Durable Object ─────────────────────────────────────────────
//
// Each user session is backed by its own Durable Object instance.
// State stored:
//   - history: full conversation messages (bounded by count and size)
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

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_ITEMS = 30;
const ALLOWED_ROLES = new Set(['user', 'assistant', 'system']);

export class SessionStore {
  private state: DurableObjectState;
  private history: Message[] = [];
  private stats: SessionStats = {
    topic: 'Software Engineering',
    difficulty: 'medium',
    messageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  private latestAnalysis: AnalysisResult | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Hibernate storage — load lazily
    this.state.blockConcurrencyWhile(async () => {
      try {
        this.history = (await this.state.storage.get<Message[]>('history')) ?? [];
        this.stats = (await this.state.storage.get<SessionStats>('stats')) ?? this.stats;
        this.latestAnalysis = (await this.state.storage.get<AnalysisResult>('latestAnalysis')) ?? null;
      } catch (err) {
        console.error('SessionStore initialization error:', err);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /history — return full history + stats
    if (path === '/history') {
      return Response.json({ history: this.history, stats: this.stats });
    }

    // GET /analysis — return latest workflow analysis
    if (path === '/analysis') {
      return Response.json({ latestAnalysis: this.latestAnalysis });
    }

    // POST /add-message — append a message
    if (path === '/add-message' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      const { role, content, topic, difficulty } = body;
      const safeRole = typeof role === 'string' && ALLOWED_ROLES.has(role) ? role : 'user';
      const safeContent = typeof content === 'string' ? content.slice(0, MAX_MESSAGE_CHARS) : '';

      const message: Message = { role: safeRole, content: safeContent, timestamp: Date.now() };
      this.history.push(message);

      // Bound history to prevent exceeding Durable Object 128KB value size
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history = this.history.slice(-MAX_HISTORY_ITEMS);
      }

      this.stats.messageCount = this.history.length;
      this.stats.updatedAt = Date.now();
      if (topic && typeof topic === 'string') {
        this.stats.topic = topic.slice(0, 60);
      }
      if (difficulty && typeof difficulty === 'string') {
        const allowedDiffs = ['easy', 'medium', 'hard'];
        if (allowedDiffs.includes(difficulty)) {
          this.stats.difficulty = difficulty;
        }
      }

      await this.state.storage.put('history', this.history);
      await this.state.storage.put('stats', this.stats);

      return Response.json({ ok: true, messageCount: this.history.length });
    }

    // POST /update-analysis — called by the Workflow to persist the result
    if (path === '/update-analysis' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      const { analysis, followUp } = body;
      this.latestAnalysis = {
        analysis: typeof analysis === 'object' && analysis !== null ? analysis : {},
        followUp: typeof followUp === 'string' ? followUp.slice(0, 1000) : '',
        generatedAt: Date.now(),
      };
      await this.state.storage.put('latestAnalysis', this.latestAnalysis);

      return Response.json({ ok: true });
    }

    // POST /clear — wipe the session
    if (path === '/clear' && request.method === 'POST') {
      this.history = [];
      this.stats = {
        topic: 'Software Engineering',
        difficulty: 'medium',
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.latestAnalysis = null;

      await this.state.storage.delete('history');
      await this.state.storage.delete('stats');
      await this.state.storage.delete('latestAnalysis');

      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }
}
