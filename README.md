# CF AI Mentor ⚡

> An AI-powered technical interview coach built entirely on Cloudflare's developer platform.

![Tech Stack](https://img.shields.io/badge/Cloudflare-Workers%20AI-orange?logo=cloudflare)
![Llama](https://img.shields.io/badge/LLM-Llama%203.3%2070B-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What is CF AI Mentor?

CF AI Mentor is a full-stack AI application that simulates real technical interviews across multiple topics (DSA, System Design, JavaScript, and more). It provides:

- **Real-time coaching** with streaming AI responses via Llama 3.3 70B
- **Persistent memory** — the AI remembers your entire conversation history within a session
- **Deep performance analysis** — a multi-step Workflow analyses your strengths, gaps, and scores
- **Voice input** — speak your answers using the Web Speech API
- **Beautiful UI** — dark glassmorphism design served from Cloudflare Assets

---

## Architecture

```
User Browser
    │
    ├── Chat / Voice Input
    │
    ▼
Cloudflare Worker (src/worker/index.ts)
    │
    ├── /api/chat  ──────► Workers AI (Llama 3.3 70B, streaming SSE)
    │
    ├── /api/analyze ────► Cloudflare Workflow (CoachingWorkflow)
    │                           ├─ Step 1: Analyse session (Llama 3.3)
    │                           ├─ Step 2: Generate follow-up question
    │                           └─ Step 3: Persist analysis → Durable Object
    │
    ├── /api/session/:id ► Durable Object (SessionStore)
    │                           └─ Persistent conversation history + stats
    │
    └── /*  ─────────────► Cloudflare Assets (static frontend)
```

### Cloudflare Components

| Component | Purpose |
|---|---|
| **Workers AI** (Llama 3.3 70B FP8) | LLM powering all chat responses |
| **Durable Objects** (`SessionStore`) | Per-session persistent memory — conversation history, stats, analysis results |
| **Workflows** (`CoachingWorkflow`) | Multi-step AI pipeline for deep performance analysis |
| **Assets** | Serves the static frontend (HTML/CSS/JS) |

---

## Features

- 🎯 **8 interview topics** — DSA, System Design, JavaScript, Python, SQL, Distributed Systems, ML, Behavioral
- 📊 **3 difficulty levels** — Easy (Junior), Medium (Mid-level), Hard (Senior / FAANG)
- 💾 **Session memory** — Durable Objects store up to 50 messages per session with metadata
- 🔄 **Deep Analysis Workflow** — runs a 3-step AI pipeline and returns communication/technical scores, identified strengths, knowledge gaps, and a suggested follow-up question
- 🎙️ **Voice input** — uses the Web Speech API to transcribe spoken answers
- 📡 **Streaming responses** — Llama 3.3 streams tokens in real-time via SSE
- 🧹 **New session** — clear history and start fresh anytime

---

## Running Locally

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Wrangler CLI (`npm install -g wrangler`)

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/cf_ai_mentor.git
cd cf_ai_mentor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 4. Run locally

```bash
npm run dev
```

Wrangler will start a local dev server at **http://localhost:8787**. Workers AI, Durable Objects, and Workflows all work locally via `wrangler dev`.

> **Note:** Workers AI calls may be slower locally since they're proxied to Cloudflare's edge. Durable Objects and Workflows run fully locally.

---

## Deploying to Cloudflare

### 1. Deploy

```bash
npm run deploy
```

This publishes your Worker + Assets to Cloudflare's global network. You'll get a `*.workers.dev` URL immediately.

### 2. (Optional) Custom domain

1. Go to the Cloudflare dashboard → Workers & Pages → your Worker
2. Under "Settings → Triggers", add a custom domain

---

## Project Structure

```
cf_ai_mentor/
├── src/
│   ├── worker/
│   │   ├── index.ts          # Main Worker — routing, CoachingWorkflow, exports
│   │   └── session-store.ts  # Durable Object — persistent session memory
│   └── frontend/
│       ├── index.html        # App shell
│       ├── styles.css        # Dark glassmorphism design
│       └── app.js            # Client logic — streaming, voice, workflow polling
├── wrangler.toml             # Cloudflare binding config
├── tsconfig.json
├── package.json
├── README.md
└── PROMPTS.md
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | `POST` | Stream a chat response from Llama 3.3 |
| `/api/analyze` | `POST` | Trigger a deep-analysis Workflow |
| `/api/workflow/:id` | `GET` | Poll Workflow status |
| `/api/session/:id` | `GET` | Get session history + stats |
| `/api/session/:id/analysis` | `GET` | Get the latest analysis result |
| `/api/session/:id` | `DELETE` | Clear a session |

---

## Tech Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **LLM**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI
- **Memory**: Cloudflare Durable Objects
- **Coordination**: Cloudflare Workflows
- **Frontend**: Vanilla HTML/CSS/JS (no framework) served via Cloudflare Assets
- **Voice**: Web Speech API (browser-native)

---

## License

MIT © Dattanand Shetty
