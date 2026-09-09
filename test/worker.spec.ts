import { describe, it, expect, vi } from 'vitest';
import worker, { SessionStore, syncSessionToD1, syncMessageToD1, syncEvaluationToD1 } from '../src/worker/index';

// Mock DurableObjectState for unit testing SessionStore
function createMockDOState() {
  const store = new Map<string, any>();
  return {
    storage: {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (key: string, val: any) => {
        store.set(key, val);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
    blockConcurrencyWhile: vi.fn(async (fn: () => Promise<any>) => fn()),
  } as unknown as DurableObjectState;
}

// Mock D1Database for unit testing
function createMockD1() {
  const queries: Array<{ sql: string; bindings: any[] }> = [];
  const mockPrepared = (sql: string) => {
    let currentBindings: any[] = [];
    return {
      bind: (...args: any[]) => {
        currentBindings = args;
        return {
          run: vi.fn(async () => {
            queries.push({ sql, bindings: currentBindings });
            return { success: true };
          }),
          first: vi.fn(async () => {
            queries.push({ sql, bindings: currentBindings });
            return { count: 5, avg_comm: 8.5, avg_tech: 7.9, total_evals: 3 };
          }),
          all: vi.fn(async () => {
            queries.push({ sql, bindings: currentBindings });
            return { results: [{ topic: 'System Design', count: 4 }] };
          }),
        };
      },
      run: vi.fn(async () => {
        queries.push({ sql, bindings: [] });
        return { success: true };
      }),
      first: vi.fn(async () => {
        queries.push({ sql, bindings: [] });
        return { count: 5, avg_comm: 8.5, avg_tech: 7.9, total_evals: 3 };
      }),
      all: vi.fn(async () => {
        queries.push({ sql, bindings: [] });
        return { results: [{ topic: 'System Design', count: 4 }] };
      }),
    };
  };

  return {
    prepare: vi.fn((sql: string) => mockPrepared(sql)),
    queries,
  } as unknown as D1Database & { queries: Array<{ sql: string; bindings: any[] }> };
}

describe('Cloudflare Worker HTTP Endpoints', () => {
  it('should handle CORS OPTIONS requests with correct headers', async () => {
    const req = new Request('https://cf-ai-mentor.test/api/chat', { method: 'OPTIONS' });
    const mockEnv = {} as any;
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('should return analytics placeholder when D1 is not configured', async () => {
    const req = new Request('https://cf-ai-mentor.test/api/analytics', { method: 'GET' });
    const mockEnv = {} as any;
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.totalSessions).toBe(0);
    expect(data.notice).toBe('D1 database not configured');
  });

  it('should query D1 database when fetching analytics', async () => {
    const mockDb = createMockD1();
    const req = new Request('https://cf-ai-mentor.test/api/analytics', { method: 'GET' });
    const mockEnv = { DB: mockDb } as any;
    const res = await worker.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.totalSessions).toBe(5);
    expect(data.avgCommunicationScore).toBe(8.5);
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});

describe('SessionStore Durable Object', () => {
  it('should store, retrieve, and clear messages and stats', async () => {
    const state = createMockDOState();
    const session = new SessionStore(state);

    // Initial history
    const initialRes = await session.fetch(new Request('https://internal/history'));
    const initialData = (await initialRes.json()) as any;
    expect(initialData.history).toEqual([]);
    expect(initialData.stats.messageCount).toBe(0);

    // Add message
    const addRes = await session.fetch(
      new Request('https://internal/add-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: 'How does event loop work in JS?',
          topic: 'JavaScript & Web Development',
          difficulty: 'medium',
        }),
      })
    );
    expect(addRes.status).toBe(200);

    // Verify added
    const historyRes = await session.fetch(new Request('https://internal/history'));
    const historyData = (await historyRes.json()) as any;
    expect(historyData.history.length).toBe(1);
    expect(historyData.history[0].content).toBe('How does event loop work in JS?');
    expect(historyData.stats.topic).toBe('JavaScript & Web Development');

    // Clear session
    const clearRes = await session.fetch(
      new Request('https://internal/clear', { method: 'POST' })
    );
    expect(clearRes.status).toBe(200);

    const afterClearRes = await session.fetch(new Request('https://internal/history'));
    const afterClearData = (await afterClearRes.json()) as any;
    expect(afterClearData.history.length).toBe(0);
  });
});

describe('Cloudflare D1 Relational Helpers', () => {
  it('should sync session upserts into D1', async () => {
    const mockDb = createMockD1();
    await syncSessionToD1(mockDb, 'sess_123', 'System Design', 'hard', 4);

    expect(mockDb.prepare).toHaveBeenCalled();
    const lastQuery = mockDb.queries[mockDb.queries.length - 1];
    expect(lastQuery.sql).toContain('INSERT INTO sessions');
    expect(lastQuery.bindings[0]).toBe('sess_123');
    expect(lastQuery.bindings[1]).toBe('System Design');
    expect(lastQuery.bindings[2]).toBe('hard');
  });

  it('should sync message inserts into D1', async () => {
    const mockDb = createMockD1();
    await syncMessageToD1(mockDb, 'sess_123', 'assistant', 'Explain caching layers');

    expect(mockDb.prepare).toHaveBeenCalled();
    const lastQuery = mockDb.queries[mockDb.queries.length - 1];
    expect(lastQuery.sql).toContain('INSERT INTO messages');
    expect(lastQuery.bindings[0]).toBe('sess_123');
    expect(lastQuery.bindings[1]).toBe('assistant');
    expect(lastQuery.bindings[2]).toBe('Explain caching layers');
  });

  it('should sync evaluation records with JSON arrays into D1', async () => {
    const mockDb = createMockD1();
    const analysis = {
      communicationScore: 9,
      technicalScore: 8,
      strengths: ['Clear structure', 'Discussed Tradeoffs'],
      gaps: ['Overlooked cache stampede'],
      nextFocus: ['Cache invalidation patterns'],
    };

    await syncEvaluationToD1(mockDb, 'sess_123', analysis, 'How to mitigate cache thundering herd?');

    expect(mockDb.prepare).toHaveBeenCalled();
    const lastQuery = mockDb.queries[mockDb.queries.length - 1];
    expect(lastQuery.sql).toContain('INSERT INTO evaluations');
    expect(lastQuery.bindings[0]).toBe('sess_123');
    expect(lastQuery.bindings[1]).toBe(9);
    expect(lastQuery.bindings[2]).toBe(8);
    expect(lastQuery.bindings[3]).toContain('Clear structure');
    expect(lastQuery.bindings[6]).toBe('How to mitigate cache thundering herd?');
  });
});

