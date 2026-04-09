# Cloudflare AI Mentor ⚡

An AI-powered technical interview coach running entirely on Cloudflare's edge platform.

![Cloudflare Workers AI](https://img.shields.io/badge/Cloudflare-Workers%20AI-orange?logo=cloudflare)
![Llama 3.3 70B](https://img.shields.io/badge/LLM-Llama%203.3%2070B-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)

🔗 **Live Demo:** https://cf-ai-mentor.lucifer96389.workers.dev

---

## What it does

Pick a topic (DSA, System Design, JavaScript, etc.), pick a difficulty, and get dropped into a mock technical interview. The AI coach asks questions one at a time, gives you feedback on your answers, and tracks the conversation across the session. After a few exchanges, you can trigger a deep analysis that scores your communication and technical accuracy, identifies gaps, and suggests what to focus on next.

Features:
- Streaming responses from Llama 3.3 70B via Cloudflare Workers AI
- Conversation memory per session using Durable Objects (keeps last 50 messages)
- Multi-step analysis pipeline using Cloudflare Workflows
- Voice input via the Web Speech API — just speak your answer
- 8 interview topics and 3 difficulty levels

---

## How it's built

```
Browser
  │
  ├── chat / voice input
  │
  ▼
Cloudflare Worker (src/worker/index.ts)
  │
  ├── /api/chat ──────► Workers AI  (Llama 3.3 70B, streaming SSE)
  │
  ├── /api/analyze ───► Workflow (CoachingWorkflow)
  │                         ├─ step 1: analyse session with Llama 3.3
  │                         ├─ step 2: generate a follow-up question
  │                         └─ step 3: save result → Durable Object
  │
  ├── /api/session/:id ► Durable Object (SessionStore)
  │                         └─ persistent conversation history + stats
  │
  └── /* ─────────────► Cloudflare Assets (static frontend)
```

| Component | What it's used for |
|---|---|
| Workers AI (Llama 3.3 70B FP8) | Powers all AI responses |
| Durable Objects (SessionStore) | Stores conversation history, session stats, and analysis results per session |
| Workflows (CoachingWorkflow) | Runs the 3-step analysis pipeline |
| Assets | Serves the frontend |

---

## Running locally

You'll need Node.js 18+, a Cloudflare account (free tier is fine), and Wrangler.

```bash
git clone https://github.com/SrinivasaChivukula/cf_ai_mentor.git
cd cf_ai_mentor
npm install
npx wrangler login
npx wrangler dev --remote
```

The `--remote` flag is needed because Workers AI runs on Cloudflare's edge — it doesn't run locally. Everything else (Durable Objects, Workflows, Assets) runs locally through Wrangler.

Open http://localhost:8787 in your browser.

---

## Deploying

```bash
npm run deploy
```

You'll get a `*.workers.dev` URL right away. To use a custom domain, go to the Cloudflare dashboard → Workers & Pages → your worker → Settings → Triggers.

---

## Project structure

```
cf_ai_mentor/
├── src/
│   ├── worker/
│   │   ├── index.ts          # worker entry point + CoachingWorkflow
│   │   └── session-store.ts  # Durable Object for session memory
│   └── frontend/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── wrangler.toml
├── tsconfig.json
├── package.json
├── README.md
└── PROMPTS.md
```

---

## API

| Endpoint | Method | What it does |
|---|---|---|
| `/api/chat` | POST | Stream a response from Llama 3.3 |
| `/api/analyze` | POST | Kick off a deep analysis Workflow |
| `/api/workflow/:id` | GET | Check Workflow status |
| `/api/session/:id` | GET | Get session history and stats |
| `/api/session/:id/analysis` | GET | Get the latest analysis result |
| `/api/session/:id` | DELETE | Clear the session |

---

## Tech

- Cloudflare Workers (TypeScript)
- Llama 3.3 70B via Cloudflare Workers AI
- Cloudflare Durable Objects for session memory
- Cloudflare Workflows for multi-step AI pipelines
- Vanilla HTML/CSS/JS frontend, no framework
- Web Speech API for voice input

---

MIT © Dattanand Shetty
