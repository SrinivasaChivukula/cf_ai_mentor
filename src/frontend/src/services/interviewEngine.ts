import { AnalysisData, AnalyticsData, Message } from '../types';

export const OPENING_QUESTIONS: Record<string, Record<string, string>> = {
  'JavaScript & Web Development': {
    easy: "Welcome to your frontend technical interview! Let's start with a foundational question: Can you explain the difference between 'var', 'let', and 'const' in modern JavaScript, and what variable hoisting means in practice?",
    medium: "Welcome to your JavaScript and Web Development mock interview! To get started: Could you explain how the JavaScript Event Loop works? Specifically, how does the call stack interact with the microtask queue (Promises) and macrotask queue (setTimeout)?",
    hard: "Welcome! We'll be focusing on advanced browser runtimes and frontend architecture. To begin: How would you architect a zero-runtime CSS-in-JS solution or design an incremental hydration strategy for a large-scale React application to optimize Core Web Vitals (LCP, INP, and CLS)?",
  },
  'Data Structures & Algorithms': {
    easy: "Welcome to your algorithms interview! Let's start with fundamentals: How does a Hash Map achieve average O(1) time complexity for lookups, and what happens under the hood when a hash collision occurs?",
    medium: "Welcome! Let's dive into algorithm design: How would you design and implement an LRU (Least Recently Used) Cache supporting get() and put() in O(1) time complexity? What data structures would you combine and why?",
    hard: "Welcome to your senior algorithms interview! Consider this problem: You are given an unsorted array of integers and a sliding window of size K. How would you compute the median of elements in the window as it slides from left to right in O(N log K) or better?",
  },
  'System Design': {
    easy: "Welcome to your System Design interview! Let's start with core infrastructure concepts: What is the difference between vertical scaling and horizontal scaling, and when would you introduce a reverse proxy like Nginx or Cloudflare in front of your servers?",
    medium: "Welcome to your System Design interview! Today, let's design a URL Shortener service like Bitly at scale (100 million new URLs per month, 10 billion clicks per month). How would you approach the ID generation strategy, database schema, and caching layer?",
    hard: "Welcome! Today we are designing a globally distributed, real-time Collaborative Document Editing system (similar to Google Docs or Figma multiplayer). How would you choose between Operational Transformation (OT) and Conflict-free Replicated Data Types (CRDTs), and how would you handle network partitions and offline sync?",
  },
  'Distributed Systems': {
    easy: "Welcome to your Distributed Systems interview! To start: Can you explain the CAP theorem and what trade-offs a system makes when choosing between Consistency and Availability during a network partition?",
    medium: "Welcome! Let's discuss consensus: How does the Raft consensus protocol ensure leader election and log replication consistency? What happens when a network partition isolates the leader from the majority of the cluster?",
    hard: "Welcome! In distributed transactions, Two-Phase Commit (2PC) can block coordinators and participants. How would you design an eventually consistent cross-service business transaction across microservices using the Saga pattern, and how do you handle compensating transactions?",
  },
  'Python': {
    easy: "Welcome to your Python interview! Let's start with the basics: What is the difference between a list and a tuple in Python, and when would you choose one over the other in terms of performance and immutability?",
    medium: "Welcome! Can you explain the Python Global Interpreter Lock (GIL)? How does it affect multi-threaded CPU-bound programs versus I/O-bound programs, and how does the asyncio event loop bypass GIL bottlenecks?",
    hard: "Welcome! How does Python's memory management work under the hood (specifically reference counting vs cyclic garbage collection), and how can you leverage __slots__ and custom memory allocators to optimize large-scale data ingestion pipelines?",
  },
  'Database Design & SQL': {
    easy: "Welcome! Let's start with relational database fundamentals: Can you explain the difference between a PRIMARY KEY and a UNIQUE constraint, and what an INNER JOIN does compared to a LEFT OUTER JOIN?",
    medium: "Welcome! How do B-Tree indexes work in relational databases like PostgreSQL or MySQL? Why might a query fail to use an index on a composite column (A, B), and how do database execution plans (EXPLAIN ANALYZE) help identify sequential scans?",
    hard: "Welcome! Consider an e-commerce database handling flash sales. How would you design isolation levels to prevent phantom reads and write skew, and how would you evaluate pessimistic locking (SELECT FOR UPDATE) vs optimistic locking (versioning)?",
  },
  'Machine Learning': {
    easy: "Welcome to your Machine Learning interview! Let's begin with foundational concepts: What is the bias-variance tradeoff in supervised learning, and how can you diagnose whether a model is underfitting or overfitting using training and validation curves?",
    medium: "Welcome! How does the Multi-Head Self-Attention mechanism in the Transformer architecture calculate attention weights (Query, Key, Value), and why is scaled dot-product attention preferred over additive attention?",
    hard: "Welcome! When serving large language models (LLMs) in production, how would you optimize inference throughput and memory latency using techniques like vLLM PagedAttention, KV-caching, quantization (AWQ/GPTQ), and speculative decoding?",
  },
  'Behavioral & Leadership': {
    easy: "Welcome to your interview! To get started: Tell me about a challenging software project you worked on recently. What was your role, what hurdles did you encounter, and what was the outcome?",
    medium: "Welcome! Tell me about a time when you strongly disagreed with a teammate or technical lead regarding an architectural decision or code implementation. How did you handle the situation, and what was the final resolution?",
    hard: "Welcome! Describe a situation where a critical production outage or security incident occurred under your watch with an ambiguous root cause. How did you lead the triage, communicate with stakeholders, and institute post-mortem prevention?",
  },
};

export function getOpeningQuestion(topic: string, difficulty: string): string {
  const topicMap = OPENING_QUESTIONS[topic] || OPENING_QUESTIONS['JavaScript & Web Development'];
  return topicMap[difficulty] || topicMap['medium'];
}

export async function generateStreamingResponse(
  topic: string,
  difficulty: string,
  userMessage: string,
  messageHistory: Message[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const turnIndex = Math.floor(messageHistory.length / 2);
  let feedback = "";
  let nextQuestion = "";

  const trimmed = userMessage.trim().toLowerCase();

  if (trimmed.length < 25) {
    feedback = "Good initial thought, but in a technical interview setting you want to elaborate with concrete code examples, time/space complexities, and operational edge cases.";
  } else if (trimmed.includes("because") || trimmed.includes("complexity") || trimmed.includes("tradeoff") || trimmed.includes("scaling")) {
    feedback = "Excellent response. You articulated the architectural tradeoffs clearly and addressed the underlying operational considerations.";
  } else {
    feedback = "Solid explanation. You covered the core concepts well. A good follow-up consideration here is how this behaves under concurrent load or failure modes.";
  }

  if (topic.includes("JavaScript")) {
    const questions = [
      "Now, consider memory management: How do closures in JavaScript retain references to outer scope variables, and what are common patterns that inadvertently lead to detached DOM tree memory leaks?",
      "Let's touch on asynchronous programming: Can you contrast Promise.all(), Promise.allSettled(), and Promise.race()? When would you choose allSettled over all in resilient production microfrontends?",
      "Next, how does V8's hidden classes and inline caching optimize property access in JavaScript objects, and why is deleting object properties considered a deoptimization anti-pattern?",
    ];
    nextQuestion = questions[turnIndex % questions.length];
  } else if (topic.includes("System Design") || topic.includes("Distributed")) {
    const questions = [
      "Now let's talk about scaling data: When your relational database hits write throughput limits, how do you approach database sharding (e.g., hash-based vs range-based key partitioning), and how do you handle cross-shard queries?",
      "Next, let's address caching consistency: When using a cache-aside pattern with Redis, what race condition can occur between a database update and a cache read, and how do you eliminate cache stampedes / thundering herds?",
      "Consider reliability: How would you implement rate limiting across multiple server instances? What are the tradeoffs between a token bucket algorithm and sliding window log using Redis sorted sets?",
    ];
    nextQuestion = questions[turnIndex % questions.length];
  } else if (topic.includes("Algorithms")) {
    const questions = [
      "Good. Let's analyze time and space complexity: If we need to find the Kth largest element in an unsorted stream of 100 million integers, how would you design a Min-Heap solution versus Quickselect?",
      "Now, how would you detect a cycle in a directed graph? Walk me through Kahn's algorithm (topological sort via indegree) versus DFS with three-color node marking.",
      "Consider dynamic programming: How would you approach the Coin Change problem (minimum coins for an amount)? Can you state the recurrence relation and space-optimized bottom-up formulation?",
    ];
    nextQuestion = questions[turnIndex % questions.length];
  } else {
    const questions = [
      "Great. Now, what potential failure modes or edge cases would you anticipate with this approach in a high-traffic production environment?",
      "How would you instrument this system with observability (metrics, structured logs, distributed tracing) to detect anomalies in real time?",
      "If requirements scaled by 100x tomorrow, which layer of your design would become the primary bottleneck, and how would you refactor it?",
    ];
    nextQuestion = questions[turnIndex % questions.length];
  }

  const fullResponse = `${feedback}\n\n**Next Question:** ${nextQuestion}`;

  const chunkSize = 6;
  for (let i = 0; i < fullResponse.length; i += chunkSize) {
    const piece = fullResponse.slice(i, i + chunkSize);
    onChunk(piece);
    await new Promise((r) => setTimeout(r, 14));
  }

  return fullResponse;
}

export function generateAnalysisData(topic: string, difficulty: string, messages: Message[]): { analysis: AnalysisData; followUp: string } {
  const commScore = Math.min(10, Math.max(7, Math.floor(7.5 + (messages.length * 0.4))));
  const techScore = Math.min(10, Math.max(7, Math.floor(8.0 + (messages.length * 0.3))));

  return {
    analysis: {
      communicationScore: commScore,
      technicalScore: techScore,
      strengths: [
        "Structured, methodical problem decomposition",
        "Clear articulation of architectural tradeoffs",
        "Attention to edge cases and runtime complexities",
        "Concise technical vocabulary and system reasoning",
      ],
      gaps: [
        "Deep-dive into zero-downtime database migration strategies",
        "Quantifying latency bounds under network degradation",
        "Detailed memory footprint analysis in concurrent workloads",
      ],
      nextFocus: [
        `${topic} Distributed Failure Recovery`,
        "Concurrency and Race Condition Mitigation",
        "Production Observability & SLA Monitoring",
      ],
    },
    followUp: `Given what we discussed regarding ${topic}, how would you implement an automated canary deployment pipeline with automated rollback if error rates breach 0.1%?`,
  };
}

export function getMockAnalytics(): AnalyticsData {
  return {
    totalSessions: 142,
    totalMessages: 894,
    avgCommunicationScore: 8.6,
    avgTechnicalScore: 8.4,
    totalEvaluations: 88,
    topicDistribution: [
      { topic: "System Design", count: 38 },
      { topic: "JavaScript & Web Development", count: 32 },
      { topic: "Data Structures & Algorithms", count: 28 },
      { topic: "Distributed Systems", count: 22 },
      { topic: "Python", count: 12 },
      { topic: "Database Design & SQL", count: 10 },
    ],
    recentEvaluations: [
      { id: 1, session_id: "sess_sys_design_01", topic: "System Design", difficulty: "hard", communication_score: 9, technical_score: 9, created_at: Date.now() - 3600000 },
      { id: 2, session_id: "sess_js_web_02", topic: "JavaScript & Web Development", difficulty: "medium", communication_score: 9, technical_score: 8, created_at: Date.now() - 7200000 },
      { id: 3, session_id: "sess_dist_sys_03", topic: "Distributed Systems", difficulty: "hard", communication_score: 8, technical_score: 9, created_at: Date.now() - 14400000 },
      { id: 4, session_id: "sess_dsa_algo_04", topic: "Data Structures & Algorithms", difficulty: "medium", communication_score: 8, technical_score: 8, created_at: Date.now() - 28800000 },
    ],
  };
}
