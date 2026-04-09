/* ─── CF AI Mentor — Frontend Application ──────────────────────────────────── */

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  sessionId: generateSessionId(),
  topic: "JavaScript & Web Development",
  difficulty: "medium",
  messageCount: 0,
  isStreaming: false,
  isRecording: false,
  recognition: null,
  currentWorkflowId: null,
  workflowPollInterval: null,
};

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const setupModal   = $("setup-modal");
const app          = $("app");
const topicSelect  = $("topic-select");
const startBtn     = $("start-btn");
const diffBtns     = document.querySelectorAll(".diff-btn");
const messagesEl   = $("messages-container");
const welcomeEl    = $("welcome-screen");
const chatInput    = $("chat-input");
const sendBtn      = $("send-btn");
const voiceBtn     = $("voice-btn");
const sidebarEl    = $("sidebar");
const menuBtn      = $("menu-btn");
const sidebarToggle = $("sidebar-toggle");
const analyzeBtn   = $("analyze-btn");
const newSessionBtn = $("new-session-btn");
const analysisPanel = $("analysis-panel");
const analysisContent = $("analysis-content");
const toastContainer = $("toast-container");

// ─── Difficulty selection ─────────────────────────────────────────────────────
diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    diffBtns.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-checked", "true");
    state.difficulty = btn.dataset.difficulty;
  });
});

// ─── Start session ────────────────────────────────────────────────────────────
startBtn.addEventListener("click", () => {
  state.topic = topicSelect.value;
  state.sessionId = generateSessionId();
  state.messageCount = 0;

  // Update sidebar
  $("sidebar-topic").textContent = state.topic;
  $("sidebar-difficulty").textContent = capitalize(state.difficulty);
  $("sidebar-messages").textContent = "0";
  $("welcome-topic").textContent = `${state.topic} mock interview`;
  $("top-bar-title").textContent = state.topic;
  $("top-bar-sub").textContent = `${capitalize(state.difficulty)} level · Session ${state.sessionId.slice(-6)}`;

  // Show app
  setupModal.style.display = "none";
  app.style.display = "flex";
  setStatus("online", "AI ready");
  chatInput.focus();
});

// ─── Sidebar toggle ───────────────────────────────────────────────────────────
menuBtn.addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
  sidebarEl.classList.toggle("collapsed");
});
sidebarToggle.addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
  sidebarEl.classList.toggle("collapsed");
});

// ─── New session ──────────────────────────────────────────────────────────────
newSessionBtn.addEventListener("click", async () => {
  // Clear server-side session
  try {
    await fetch(`/api/session/${state.sessionId}`, { method: "DELETE" });
  } catch { /* ignore */ }

  // Reset state
  state.sessionId = generateSessionId();
  state.messageCount = 0;
  state.currentWorkflowId = null;
  if (state.workflowPollInterval) clearInterval(state.workflowPollInterval);

  // Clear UI
  while (messagesEl.children.length > 1) messagesEl.removeChild(messagesEl.lastChild);
  welcomeEl.style.display = "flex";
  analysisPanel.style.display = "none";
  $("sidebar-messages").textContent = "0";
  $("top-bar-sub").textContent = `${capitalize(state.difficulty)} level · Session ${state.sessionId.slice(-6)}`;
  showToast("New session started", "success");
});

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage(text) {
  const content = text.trim();
  if (!content || state.isStreaming) return;

  // Hide welcome
  welcomeEl.style.display = "none";

  // Add user message
  appendMessage("user", content);
  chatInput.value = "";
  autoResize();
  state.messageCount++;
  $("sidebar-messages").textContent = state.messageCount;

  // Show typing indicator
  const typingEl = appendTypingIndicator();

  state.isStreaming = true;
  sendBtn.disabled = true;
  setStatus("thinking", "Thinking…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        message: content,
        topic: state.topic,
        difficulty: state.difficulty,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    typingEl.remove();

    // Stream the response
    const msgEl = appendMessage("assistant", "");
    const bubbleEl = msgEl.querySelector(".msg-bubble");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.response) {
            fullText += parsed.response;
            bubbleEl.textContent = fullText;
            scrollToBottom();
          }
        } catch { /* partial JSON */ }
      }
    }

    state.messageCount++;
    $("sidebar-messages").textContent = state.messageCount;
    setStatus("online", "AI ready");

  } catch (err) {
    typingEl?.remove();
    appendMessage("assistant", `⚠️ Something went wrong: ${err.message}. Please try again.`);
    setStatus("online", "AI ready");
    showToast("Failed to get response", "error");
  } finally {
    state.isStreaming = false;
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", () => sendMessage(chatInput.value));
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
});
chatInput.addEventListener("input", autoResize);

// ─── Deep Analysis ────────────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {
  if (state.currentWorkflowId) {
    showToast("Analysis already in progress…", "info");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "⏳ Analysing…";
  setStatus("thinking", "Running analysis…");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        topic: state.topic,
        difficulty: state.difficulty,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Analysis failed", "error");
      return;
    }

    state.currentWorkflowId = data.workflowId;
    showToast("Deep analysis started — usually takes 15-30s", "info");
    pollWorkflow(data.workflowId);

  } catch (err) {
    showToast("Failed to start analysis", "error");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Deep Analysis`;
    setStatus("online", "AI ready");
  }
});

function pollWorkflow(workflowId) {
  if (state.workflowPollInterval) clearInterval(state.workflowPollInterval);
  state.workflowPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/workflow/${workflowId}`);
      const status = await res.json();

      if (status.status === "complete") {
        clearInterval(state.workflowPollInterval);
        state.currentWorkflowId = null;
        showToast("Analysis complete!", "success");
        loadAnalysis();
      } else if (status.status === "errored") {
        clearInterval(state.workflowPollInterval);
        state.currentWorkflowId = null;
        showToast("Analysis encountered an error", "error");
      }
    } catch { /* retry */ }
  }, 3000);
}

async function loadAnalysis() {
  try {
    const res = await fetch(`/api/session/${state.sessionId}/analysis`);
    const { latestAnalysis } = await res.json();
    if (!latestAnalysis) return;

    const { analysis, followUp } = latestAnalysis;
    renderAnalysis(analysis, followUp);
    analysisPanel.style.display = "block";
  } catch { /* ignore */ }
}

function renderAnalysis(analysis, followUp) {
  const commScore = analysis?.communicationScore ?? null;
  const techScore = analysis?.technicalScore ?? null;
  const strengths = analysis?.strengths ?? [];
  const gaps = analysis?.gaps ?? [];
  const nextFocus = analysis?.nextFocus ?? [];

  const scoreClass = (n) => n >= 8 ? "score-good" : n >= 5 ? "score-mid" : "score-bad";

  analysisContent.innerHTML = `
    ${commScore !== null ? `<div class="score-row"><span class="score-label">Communication</span><span class="score-val ${scoreClass(commScore)}">${commScore}/10</span></div>` : ""}
    ${techScore !== null ? `<div class="score-row"><span class="score-label">Technical Accuracy</span><span class="score-val ${scoreClass(techScore)}">${techScore}/10</span></div>` : ""}
    ${strengths.length ? `<div style="margin-top:12px;font-size:0.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Strengths</div><div class="tag-list">${strengths.map((s) => `<span class="tag tag-good">${escHtml(s)}</span>`).join("")}</div>` : ""}
    ${gaps.length ? `<div style="margin-top:10px;font-size:0.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Knowledge Gaps</div><div class="tag-list">${gaps.map((g) => `<span class="tag tag-gap">${escHtml(g)}</span>`).join("")}</div>` : ""}
    ${nextFocus.length ? `<div style="margin-top:10px;font-size:0.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Next Focus</div><div class="tag-list">${nextFocus.map((f) => `<span class="tag tag-good">${escHtml(f)}</span>`).join("")}</div>` : ""}
    ${followUp ? `<div class="followup-box">💡 Suggested next question:<br/>${escHtml(followUp)}</div>` : ""}
    ${analysis?.raw ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--text-2)">${escHtml(analysis.raw)}</div>` : ""}
  `;
}

// ─── Voice Input ──────────────────────────────────────────────────────────────
let recognition = null;

if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join("");
    chatInput.value = transcript;
    autoResize();
  };

  recognition.onend = () => {
    state.isRecording = false;
    voiceBtn.classList.remove("recording");
    $("voice-status").textContent = "Press Enter to send · Shift+Enter for new line";
    if (chatInput.value.trim()) sendMessage(chatInput.value);
  };

  recognition.onerror = (e) => {
    state.isRecording = false;
    voiceBtn.classList.remove("recording");
    if (e.error !== "aborted") showToast(`Voice error: ${e.error}`, "error");
  };
} else {
  voiceBtn.title = "Voice input not supported in this browser";
  voiceBtn.style.opacity = "0.4";
}

voiceBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (state.isRecording) {
    recognition.stop();
  } else {
    chatInput.value = "";
    recognition.start();
    state.isRecording = true;
    voiceBtn.classList.add("recording");
    $("voice-status").textContent = "🔴 Listening…";
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appendMessage(role, content) {
  const isUser = role === "user";
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.innerHTML = `
    <div class="msg-avatar">${isUser ? "👤" : "⚡"}</div>
    <div class="msg-content">
      <div class="msg-meta">
        <span class="msg-name">${isUser ? "You" : "AI Coach"}</span>
        <span>${formatTime(new Date())}</span>
      </div>
      <div class="msg-bubble">${escHtml(content)}</div>
    </div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function appendTypingIndicator() {
  const el = document.createElement("div");
  el.className = "message assistant";
  el.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="msg-content">
      <div class="msg-meta"><span class="msg-name">AI Coach</span></div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function setStatus(type, text) {
  const dot = $("status-dot");
  const label = $("status-text");
  dot.className = `status-dot ${type}`;
  label.textContent = text;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function autoResize() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
}

function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function generateSessionId() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
