# PROMPTS.md — AI Assistance Used

This documents how AI was used during development of this project, as required by the application instructions.

---

## Areas where AI was used

**1. Project design**
Used AI to brainstorm a project idea that meaningfully touched all four required components (LLM, workflows, memory, and user input). Landed on a technical interview coach — it's a natural fit since coaching sessions have state, need multi-turn memory, and benefit from async analysis pipelines.

**2. Durable Object design**
Asked AI to help structure the `SessionStore` Durable Object — specifically how to handle `blockConcurrencyWhile` for initialization, what fields to persist (history, stats, latest analysis), and how to cap the history at 50 messages to avoid unbounded growth.

**3. Cloudflare Workflow**
Used AI to figure out the `WorkflowEntrypoint` API and how to chain `step.do()` calls properly. The three-step structure (analyse → generate follow-up → persist) came from discussing what a meaningful multi-step pipeline would look like versus just a single LLM call.

**4. Worker routing**
Asked for help setting up the main `fetch` handler with all the API routes, CORS headers, and how to wire the Durable Object namespace and Workflow binding together in TypeScript.

**5. System prompt for the interview coach**
Iterated on the LLM system prompt a few times — mainly around getting the AI to ask one question at a time and give concise feedback rather than dumping everything at once.

**6. Streaming SSE on the frontend**
Asked how to read a `ReadableStream` from a `fetch` response and parse the `data: {...}` chunks incrementally so text appears token-by-token in the UI.

**7. Voice input**
Used AI to figure out the Web Speech API setup — specifically `interimResults`, handling the `onend` event to auto-send, and the CSS pulse animation for the recording state.

**8. Frontend UI**
Asked for help with the dark glassmorphism layout in vanilla CSS — the animated background orbs, the collapsible sidebar, and the message bubble styles.

**9. Workflow status polling**
Asked how to cleanly poll a workflow endpoint on an interval, stop when complete, and then fetch and render the result without race conditions.

**10. wrangler.toml config**
Used AI to figure out the correct `wrangler.toml` syntax for binding Workers AI, Durable Objects, Workflows, and Assets together — particularly the `new_sqlite_classes` migration format required for the free plan.
