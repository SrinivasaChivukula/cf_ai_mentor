# PROMPTS.md — AI Prompts Used in Development

This file documents all AI-assisted prompts used to build the **CF AI Mentor** project, as required by the internship application instructions.

---

## 1. Project Ideation & Architecture

**Prompt:**
> I'm applying for an internship that requires building an AI-powered application on Cloudflare. The requirements are:
> - LLM (recommend Llama 3.3 on Workers AI)
> - Workflow/coordination (Workflows, Workers, or Durable Objects)
> - User input via chat or voice (Pages or Realtime)
> - Memory or state
>
> Help me design a project that meaningfully uses all four of these components, is technically impressive, and could be built in a day or two. Give me architecture details.

**AI Response Summary:** Suggested a technical interview coaching app with streaming chat (Workers AI / Llama 3.3), per-session conversation memory (Durable Objects), multi-step performance analysis pipeline (Workflows), and a voice-enabled chat UI (Web Speech API on Cloudflare Pages/Assets).

---

## 2. Durable Object Session Store

**Prompt:**
> Write a Cloudflare Durable Object class called `SessionStore` in TypeScript that:
> - Stores a conversation history array of `{role, content, timestamp}` messages
> - Stores session stats (topic, difficulty, messageCount, createdAt, updatedAt)
> - Stores a `latestAnalysis` result from an AI workflow
> - Exposes internal HTTP routes: GET /history, GET /analysis, POST /add-message, POST /update-analysis, POST /clear
> - Uses blockConcurrencyWhile for initial load
> - Caps history at 50 messages

---

## 3. Cloudflare Workflow — Multi-step AI Analysis Pipeline

**Prompt:**
> Write a Cloudflare Workflow class `CoachingWorkflow` that takes a conversation history and:
> - Step 1: Calls Llama 3.3 on Workers AI to analyse the session and return a JSON object with strengths, gaps, communicationScore, technicalScore, and nextFocus
> - Step 2: Uses that analysis to generate a targeted follow-up interview question
> - Step 3: Persists the result to a Durable Object via an internal fetch
> Use proper WorkflowEntrypoint types and WorkflowStep.do() for each step.

---

## 4. Main Worker Routing

**Prompt:**
> Write a Cloudflare Worker `fetch` handler with these routes:
> - POST /api/chat — calls Workers AI (Llama 3.3) with streaming and SSE, saves the conversation turn to a Durable Object
> - POST /api/analyze — creates a Workflow instance
> - GET /api/workflow/:id — polls workflow status
> - GET /api/session/:id — returns session history from the Durable Object
> - DELETE /api/session/:id — clears the session
> - /* — passes through to Cloudflare Assets (static frontend)
> Include proper CORS headers and TypeScript types.

---

## 5. Chat System Prompt Engineering

**Prompt:**
> Write a system prompt for Llama 3.3 that makes it behave as an elite technical interview coach. The prompt should:
> - Accept a topic (e.g. "System Design") and difficulty level (easy/medium/hard)
> - Define what each difficulty level means
> - Instruct the AI to ask one question at a time
> - Give brief targeted feedback after each answer
> - Use a Socratic approach for hints rather than giving answers
> - Keep responses under 300 words

---

## 6. Frontend Dark UI Design

**Prompt:**
> Design a dark-mode, glassmorphism-style chat UI in vanilla HTML/CSS/JS for an AI interview coach app. Include:
> - A setup modal with topic selector and difficulty picker
> - A collapsible sidebar with session stats and analysis panel
> - A chat area with bubble messages, streaming support, and a typing indicator
> - A textarea input with auto-resize, voice input button, and send button
> - Animated background orbs, gradient accent colors, Inter font
> - Toast notifications for status updates
> No external CSS frameworks.

---

## 7. Streaming SSE Response Parsing

**Prompt:**
> In vanilla JavaScript, how do I consume a streaming Server-Sent Events response from a Cloudflare Worker that streams Llama 3.3 output as `data: {"response":"..."}` chunks? Show how to read with the Fetch API ReadableStream reader, decode chunks, parse SSE lines, and append text progressively to a DOM element.

---

## 8. Voice Input Integration

**Prompt:**
> Add voice input to a browser chat app using the Web Speech API. When the user clicks the mic button, start recording and set `interimResults: true`. On result, populate the textarea. On end, auto-send if there's transcript. Handle errors gracefully. Show recording state on the button with a CSS pulse animation.

---

## 9. Workflow Status Polling

**Prompt:**
> In vanilla JavaScript, write a polling function that calls GET /api/workflow/:id every 3 seconds, checks if `status === "complete"` or `"errored"`, and when complete fetches the analysis result from GET /api/session/:id/analysis and renders it in the sidebar. Clear the interval when done.

---

## 10. wrangler.toml Configuration

**Prompt:**
> Write a wrangler.toml for a Cloudflare project that uses:
> - Workers AI (binding: AI)
> - A Durable Object class called SessionStore (binding: SESSION_STORE)
> - A Workflow class called CoachingWorkflow (binding: COACHING_WORKFLOW)
> - Static assets in `./src/frontend` (binding: ASSETS)
> Set compatibility_date to 2024-11-01 and enable nodejs_compat.

---

## 11. README Documentation

**Prompt:**
> Write a comprehensive README.md for a Cloudflare AI project called "CF AI Mentor". Include:
> - Project description and feature list
> - Architecture diagram (ASCII)
> - Table of Cloudflare components used and their purpose
> - Step-by-step local development instructions
> - Deployment instructions
> - Project structure tree
> - API reference table
> Make it professional and suitable for an internship application portfolio.
