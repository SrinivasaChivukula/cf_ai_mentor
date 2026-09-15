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

// ============================================================================
// INTENT RECOGNITION & CONTEXTUAL KNOWLEDGE BASE
// ============================================================================

interface EvaluationResult {
  feedback: string;
  nextStep: string;
}

function handleSolutionsArchitectInquiry(): EvaluationResult {
  return {
    feedback: `### Core Questions & Focus Areas for a Solutions Architect Interview

Solutions Architect interviews evaluate your ability to translate ambiguous business requirements into scalable, resilient, and cost-effective technical architectures. Typically, interview panels probe across **5 critical pillars**:

1. **System Architecture & Decomposition**:
   - *How do you decompose a monolithic transactional system into event-driven microservices without downtime?* (Look for: Strangler Fig pattern, CDC / Debezium, Outbox pattern, Saga choreography vs. orchestration).
   - *When would you choose synchronous REST/gRPC versus asynchronous messaging (Kafka, SQS/SNS, RabbitMQ)?*

2. **Scalability, Resilience & Disaster Recovery**:
   - *How do you architect a multi-region active-active deployment?* (Look for: Anycast DNS/Cloudflare, data conflict resolution, RPO / RTO targets, and latency trade-offs).
   - *How do you design for graceful degradation under cascading failures?* (Circuit breakers, bulkhead isolation, rate limiting with token-bucket/sliding window, retry with exponential backoff and jitter).

3. **Data Architecture & Consistency Trade-offs**:
   - *Navigating the CAP & PACELC theorems in practice:* When do you accept eventual consistency (e.g., shopping carts) vs. strict serializability (e.g., ledger balances)?
   - *Database sharding & caching topologies:* How to handle cross-shard joins, hot keys, and eliminate cache stampedes / thundering herds.

4. **Security, Compliance & Identity**:
   - *Zero Trust architecture design:* mTLS between internal services, API gateway OAuth2/OIDC token verification, least-privilege IAM policies, and encrypting data at rest and in flight.

5. **Cloud Economics (FinOps) & Trade-offs**:
   - *Serverless (Cloudflare Workers, AWS Lambda) vs. Containerized (EKS/ECS) vs. Bare Metal:* How do cold starts, egress network costs, and memory footprints affect total cost of ownership (TCO)?
   - *Build vs. Buy decisions:* How to justify vendor platforms vs. internal open-source maintenance.`,
    nextStep: `Would you like to shift our session into a **Solutions Architecture scenario** (e.g., *"Design an edge-native, multi-region payment gateway handling 50k transactions/second with sub-50ms p99 latency"*), or would you prefer to resume your original technical interview topic?`,
  };
}

function handleHelpOrHint(lastQuestion: string, topic: string): EvaluationResult {
  const lq = lastQuestion.toLowerCase();

  if (lq.includes('var') && lq.includes('let')) {
    return {
      feedback: `**Hint for 'var', 'let', 'const' & Hoisting:**
- **Scope:** Think about curly braces \`{ ... }\` (block scope) versus \`function() { ... }\` (function scope). Which one is restricted to the block?
- **Hoisting:** What does the JavaScript engine do during the creation phase before executing code line-by-line?
- **Initialization:** If you try to \`console.log(x)\` before declaring \`var x = 5\`, what prints? What happens if you do the same with \`let x = 5\` (hint: Temporal Dead Zone)?
- **Reassignment:** Can you re-assign or re-declare them? What about modifying an object assigned to a \`const\`?`,
      nextStep: `Take a shot at contrasting them using these points!`,
    };
  }

  if (lq.includes('event loop')) {
    return {
      feedback: `**Hint for Event Loop & Queues:**
- Think of the JavaScript runtime as single-threaded: it executes synchronous code on the **Call Stack**.
- When an asynchronous operation completes (like a resolved \`Promise\` or a \`setTimeout\` timer):
  - Microtasks (e.g., \`Promise.then\`, \`queueMicrotask\`) go to the **Microtask Queue**.
  - Macrotasks (e.g., \`setTimeout\`, \`setInterval\`, I/O) go to the **Task Queue**.
- The event loop checks the microtask queue *exhaustively* after every stack turn before picking *one* macrotask.`,
      nextStep: `How does that order affect code execution when you mix \`setTimeout(..., 0)\` and \`Promise.resolve().then(...)\`?`,
    };
  }

  if (lq.includes('cap theorem')) {
    return {
      feedback: `**Hint for CAP Theorem:**
- **C (Consistency):** Every read receives the most recent write or an error.
- **A (Availability):** Every non-failing node returns a non-error response, but without guarantee it's the latest data.
- **P (Partition Tolerance):** The system continues to operate despite arbitrary message loss or network delay between nodes.
- Because physical network partitions are unavoidable in distributed systems, when a partition occurs, you must choose: either reject writes (favoring C) or accept writes on both sides (favoring A, leading to divergence).`,
      nextStep: `Can you name an example of a CP system versus an AP system, and explain why a distributed system can't be 'CA'?`,
    };
  }

  return {
    feedback: `No worries! Let's break this down into first principles. Think about the fundamental trade-offs: time complexity vs. space complexity, consistency vs. availability, or runtime performance vs. developer velocity.`,
    nextStep: `Would you like me to walk through the complete reference solution, or would you like to try with a simplified scenario?`,
  };
}

function evaluateCandidateAnswer(
  currentQuestion: string,
  userMessage: string,
  topic: string,
  difficulty: string,
  turnIndex: number
): EvaluationResult {
  const lq = currentQuestion.toLowerCase();
  const ans = userMessage.toLowerCase();

  // --- JavaScript 'var', 'let', 'const' & Hoisting ---
  if (lq.includes('var') && (lq.includes('let') || lq.includes('const'))) {
    const mentionsScope = ans.includes('block') || ans.includes('function') || ans.includes('scope');
    const mentionsHoisting = ans.includes('hoist') || ans.includes('declaration') || ans.includes('undefined') || ans.includes('tdz') || ans.includes('temporal');
    const mentionsReassign = ans.includes('reassign') || ans.includes('immutable') || ans.includes('mutate') || ans.includes('const');

    if (mentionsScope && mentionsHoisting && mentionsReassign) {
      return {
        feedback: `### Evaluation: Outstanding (Score: 9.5/10)
You hit every key technical distinction:
- **Scoping:** Correctly identified that \`var\` is function-scoped (or globally scoped), whereas \`let\` and \`const\` are strictly block-scoped.
- **Hoisting & TDZ:** Articulated that while all declarations are hoisted, \`var\` is initialized to \`undefined\`, whereas \`let\` and \`const\` remain in the **Temporal Dead Zone (TDZ)** from the start of the block until execution reaches the declaration.
- **Immutability Nuance:** \`const\` prevents reassignment of the variable binding, though properties of objects/arrays assigned to \`const\` remain mutable unless frozen with \`Object.freeze()\`.`,
        nextStep: `**Next Question:** Let's dive into asynchronous JavaScript: Can you contrast \`Promise.all()\`, \`Promise.allSettled()\`, and \`Promise.race()\`? In a resilient microfrontend or distributed UI, why might \`Promise.allSettled()\` be preferred over \`Promise.all()\`?`,
      };
    } else if (mentionsScope || mentionsReassign || mentionsHoisting) {
      const missing: string[] = [];
      if (!mentionsScope) missing.push('scope distinctions (function scope vs block scope)');
      if (!mentionsHoisting) missing.push('hoisting semantics and the Temporal Dead Zone (TDZ)');
      if (!mentionsReassign) missing.push('reassignment restrictions and binding immutability for const');

      return {
        feedback: `### Evaluation: Good Foundation, Missing Edge Details (Score: 7.5/10)
You touched on the core concepts, but in a senior technical interview you should explicitly cover:
- **Scope:** \`var\` is function-scoped, whereas \`let\` and \`const\` are block-scoped.
- **Hoisting & TDZ:** \`var\` gets hoisted and initialized with \`undefined\`. \`let\` and \`const\` are hoisted as well, but accessing them before their line throws a \`ReferenceError\` due to the Temporal Dead Zone.
- **Mutation:** Mentioning that \`const\` prevents variable rebinding, but does not deeply freeze nested object structures.`,
        nextStep: `**Follow-up Question:** Given what you know about closures and variable scoping: How does using \`var\` in a \`for (var i = 0; i < 3; i++) { setTimeout(() => console.log(i), 100); }\` loop behave differently than using \`let i = 0\`, and why?`,
      };
    } else {
      return {
        feedback: `### Evaluation: Clarification Needed
Your response didn't quite touch on the core criteria:
1. **Scope:** Function scope (\`var\`) vs. Block scope (\`let\`, \`const\`).
2. **Hoisting & Temporal Dead Zone (TDZ):** How \`var\` initializes to \`undefined\`, while \`let\`/\`const\` cannot be accessed before declaration.
3. **Reassignment:** \`let\` allows reassignment, \`const\` creates an immutable binding.`,
        nextStep: `How would you explain the difference in scope if you declared \`var x = 10\` inside an \`if (true) { ... }\` block versus \`let x = 10\`?`,
      };
    }
  }

  // --- JavaScript Event Loop ---
  if (lq.includes('event loop') || lq.includes('microtask')) {
    const mentionsMicro = ans.includes('microtask') || ans.includes('promise') || ans.includes('queue');
    const mentionsMacro = ans.includes('macrotask') || ans.includes('settimeout') || ans.includes('task queue');
    const mentionsStack = ans.includes('call stack') || ans.includes('stack') || ans.includes('single thread');

    if (mentionsMicro && (mentionsMacro || mentionsStack)) {
      return {
        feedback: `### Evaluation: Strong Technical Depth (Score: 9.2/10)
Excellent explanation of the JavaScript concurrency model. You accurately mapped:
- **Call Stack:** Executes synchronous frames in LIFO order.
- **Microtask Queue:** Handles \`Promise.then\`, \`catch\`, \`finally\`, and \`queueMicrotask\`. Emptied completely before yielding.
- **Macrotask Queue:** Handles timers (\`setTimeout\`), DOM events, and I/O callbacks.
- **Rendering Opportunity:** The browser renders/repaints after microtasks are cleared and before the next macrotask.`,
        nextStep: `**Next Question:** If a microtask schedules another microtask recursively in a loop (e.g. \`function loop() { Promise.resolve().then(loop); }\`), what happens to the browser UI, macrotasks like \`setTimeout\`, and user inputs?`,
      };
    }
  }

  // --- CAP Theorem ---
  if (lq.includes('cap theorem') || lq.includes('partition tolerance')) {
    const mentionsTradeoff = ans.includes('consistency') && ans.includes('availability') && (ans.includes('partition') || ans.includes('network'));
    if (mentionsTradeoff) {
      return {
        feedback: `### Evaluation: Solid Distributed Systems Acumen (Score: 9.0/10)
Great articulation. As Eric Brewer established, in any distributed data store, network partitions (P) are an unavoidable physical reality (split-brain, fiber cuts, packet loss). Thus, the architectural choice is between:
- **CP (Consistency + Partition Tolerance):** When partition occurs, reject or delay writes to prevent divergence (e.g., Spanner, Raft, etcd, ZooKeeper).
- **AP (Availability + Partition Tolerance):** Accept writes on both sides of partition, accepting eventual consistency and conflict resolution (e.g., Cassandra, DynamoDB with eventual reads).`,
        nextStep: `**Next Question:** The PACELC theorem expands on CAP by analyzing what happens when the network is running normally *without* partitions. Can you explain what PACELC trades off during normal operation (the 'ELC' half)?`,
      };
    }
  }

  // --- Default Analytical Fallback for Any Technical Topic ---
  const questionsByTopic: Record<string, string[]> = {
    'JavaScript & Web Development': [
      "Now, consider memory management: How do closures in JavaScript retain references to outer scope variables, and what patterns lead to detached DOM tree memory leaks?",
      "How does V8's hidden classes and inline caching optimize property access, and why is deleting object properties via \`delete obj.prop\` considered a deoptimization anti-pattern?",
      "How would you design an asset-loading pipeline that prioritizes Critical Rendering Path resources using \`rel=preload\`, \`fetchpriority\`, and HTTP/3 multiplexing?",
    ],
    'System Design': [
      "Now let's talk about scaling data: When your relational database hits write throughput limits, how do you approach horizontal sharding, and how do you handle cross-shard transactions?",
      "Next, let's address caching consistency: When using a cache-aside pattern with Redis, what race condition can occur between a DB update and a cache read, and how do you eliminate thundering herds?",
      "Consider reliability: How would you implement distributed rate limiting across edge PoPs? What are the tradeoffs between a token bucket and a sliding-window counter in Redis?",
    ],
    'Distributed Systems': [
      "In distributed consensus, how does the Raft protocol handle network partitions where two candidates concurrently request votes in the same term?",
      "How would you design a distributed lock service? What are the dangers of relying solely on Redis \`SETNX\` with TTL without fencing tokens (as noted in Martin Kleppmann's analysis)?",
      "In an event-driven architecture using Kafka, how do you guarantee exactly-once processing (EOP) semantics end-to-end between producers, topics, and consumers?",
    ],
    'Data Structures & Algorithms': [
      "If we need to find the Kth largest element in an unsorted stream of 100 million integers, how would you design a Min-Heap solution versus Quickselect?",
      "Now, how would you detect a cycle in a directed graph? Walk me through Kahn's algorithm (topological sort via indegree) versus DFS with three-color node marking.",
      "Consider dynamic programming: How would you approach the Coin Change problem (minimum coins for an amount)? Can you state the recurrence relation and space-optimized bottom-up formulation?",
    ],
  };

  const pool = questionsByTopic[topic] || questionsByTopic['System Design'];
  const nextQ = pool[turnIndex % pool.length];

  const wordCount = userMessage.trim().split(/\s+/).length;
  let critique = "";

  if (wordCount < 15) {
    critique = `### Initial Assessment (Score: 6.8/10)
Your answer is on the right track, but quite brief. In senior technical interviews, interviewers look for structured reasoning: state your design principle first, explain the operational trade-offs, and highlight real-world edge cases.`;
  } else if (ans.includes('tradeoff') || ans.includes('scaling') || ans.includes('latency') || ans.includes('bottleneck') || ans.includes('complexity')) {
    critique = `### Technical Assessment (Score: 8.8/10)
Strong response. You effectively incorporated engineering trade-offs, operational considerations, and system behavior under load.`;
  } else {
    critique = `### Technical Assessment (Score: 8.0/10)
Solid explanation covering the primary mechanics. A great way to elevate this response is to discuss failure recovery modes and operational metrics (e.g., p99 latency degradation, concurrency locks).`;
  }

  return {
    feedback: critique,
    nextStep: `**Next Question:** ${nextQ}`,
  };
}

export async function generateStreamingResponse(
  topic: string,
  difficulty: string,
  userMessage: string,
  messageHistory: Message[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const turnIndex = Math.floor(messageHistory.length / 2);
  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  // Find the last assistant question asked
  let lastAssistantQuestion = "";
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    if (messageHistory[i].role === 'assistant' && messageHistory[i].content) {
      lastAssistantQuestion = messageHistory[i].content;
      break;
    }
  }

  let result: EvaluationResult;

  // 1. Check if user is asking about Solutions Architect
  if (
    lower.includes('solution') && (lower.includes('architect') || lower.includes('architecture')) ||
    (lower.includes('prepare for') && lower.includes('architect'))
  ) {
    result = handleSolutionsArchitectInquiry();
  }
  // 2. Check if user is asking for hints, help, or saying "I don't know"
  else if (
    lower === "i don't know" ||
    lower === "idk" ||
    lower.includes("not sure") ||
    lower.includes("give me a hint") ||
    lower.includes("can you help") ||
    lower.includes("explain the question") ||
    lower.includes("can you clarify") ||
    lower === "skip" ||
    lower === "pass"
  ) {
    result = handleHelpOrHint(lastAssistantQuestion, topic);
  }
  // 3. Check if user is asking a general technical question instead of answering
  else if (
    (lower.startsWith('what is') ||
      lower.startsWith('what are') ||
      lower.startsWith('how does') ||
      lower.startsWith('how do i') ||
      lower.startsWith('why do') ||
      lower.startsWith('can you explain')) &&
    !lower.includes('var') &&
    !lower.includes('event loop')
  ) {
    result = {
      feedback: `That's an insightful question to explore. In system design and software architecture, understanding this concept is essential:
      
When evaluating this domain, architects look at **operational bounds** (throughput, memory overhead, latency percentiles) and **architectural decoupling** (independent deployability, boundary contexts).`,
      nextStep: `Would you like us to deep-dive into that architectural area for the remainder of this session, or shall we return to evaluating your current question: *"${lastAssistantQuestion.slice(0, 100)}..."*?`,
    };
  }
  // 4. Normal answer evaluation
  else {
    result = evaluateCandidateAnswer(
      lastAssistantQuestion,
      trimmed,
      topic,
      difficulty,
      turnIndex
    );
  }

  const fullResponse = `${result.feedback}\n\n${result.nextStep}`;

  // Stream token-by-token with realistic cadence
  const chunkSize = 8;
  for (let i = 0; i < fullResponse.length; i += chunkSize) {
    const piece = fullResponse.slice(i, i + chunkSize);
    onChunk(piece);
    await new Promise((r) => setTimeout(r, 12));
  }

  return fullResponse;
}

export function generateAnalysisData(topic: string, difficulty: string, messages: Message[]): { analysis: AnalysisData; followUp: string } {
  const commScore = Math.min(10, Math.max(7, Math.floor(7.8 + (messages.length * 0.35))));
  const techScore = Math.min(10, Math.max(7, Math.floor(8.2 + (messages.length * 0.28))));

  return {
    analysis: {
      communicationScore: commScore,
      technicalScore: techScore,
      strengths: [
        "Structured, methodical problem decomposition",
        "Clear articulation of architectural tradeoffs and NFRs",
        "Attention to edge cases, error modes, and runtime complexities",
        "Concise technical vocabulary and system reasoning",
      ],
      gaps: [
        "Deep-dive into zero-downtime database schema migration strategies",
        "Quantifying p99 latency bounds under network degradation",
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
