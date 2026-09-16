const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const chatLog = document.getElementById("chatLog");
const chatScroll = document.getElementById("chatScroll");
const conversationEmpty = document.getElementById("conversationEmpty");
const suggestions = document.getElementById("suggestions");
const startBtn = document.getElementById("startBtn");
const composerForm = document.getElementById("composerForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let hasMessages = false;

function setStatus(state, text) {
  statusPill.dataset.state = state;
  statusText.textContent = text;
}

function setActiveControls(active) {
  messageInput.disabled = !active;
  sendBtn.disabled = !active;
}

function refreshEmptyState() {
  conversationEmpty.hidden = hasMessages;
}

function scrollToBottom() {
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function addUserBubble(text) {
  hasMessages = true;
  refreshEmptyState();
  const div = document.createElement("div");
  div.className = "msg msg-user";
  div.textContent = text;
  chatLog.appendChild(div);
  scrollToBottom();
}

function addSystemNote(text) {
  hasMessages = true;
  refreshEmptyState();
  const div = document.createElement("div");
  div.className = "msg system-note";
  div.textContent = text;
  chatLog.appendChild(div);
  scrollToBottom();
}

function pre(value) {
  const el = document.createElement("pre");
  el.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return el;
}

function renderToolCall(call, result) {
  const wrap = document.createElement("div");
  wrap.className = "tool-call";

  const isError = result && result.result && typeof result.result === "object" && "error" in result.result;
  const nameEl = document.createElement("div");
  nameEl.className = "tool-name";
  nameEl.textContent = `Tool: ${call.name}`;
  wrap.appendChild(nameEl);

  const inputLine = document.createElement("div");
  inputLine.className = "tool-line";
  inputLine.innerHTML = `<span class="label">Input:</span>`;
  inputLine.appendChild(pre(call.args || {}));
  wrap.appendChild(inputLine);

  const resultLine = document.createElement("div");
  resultLine.className = `tool-line ${isError ? "result-error" : "result-ok"}`;
  resultLine.innerHTML = `<span class="label">${isError ? "Lỗi:" : "Kết quả:"}</span>`;
  resultLine.appendChild(pre(result ? result.result : "(chưa có kết quả)"));
  wrap.appendChild(resultLine);

  return wrap;
}

function addAssistantCard(turn, artifactVersion) {
  hasMessages = true;
  refreshEmptyState();
  const outer = document.createElement("div");
  outer.className = "msg msg-assistant";

  if (turn.status === "provider_error") {
    const banner = document.createElement("div");
    banner.className = "error-banner";
    banner.textContent = `Lỗi provider: ${turn.error}`;
    outer.appendChild(banner);
    chatLog.appendChild(outer);
    scrollToBottom();
    return;
  }

  const card = document.createElement("div");
  card.className = "assistant-card";

  const textEl = document.createElement("p");
  textEl.className = "assistant-text";
  textEl.textContent = turn.display_text || turn.assistant_text || "(không có phản hồi văn bản)";
  card.appendChild(textEl);

  (turn.rounds || []).forEach((round) => {
    if (!round.tool_calls || round.tool_calls.length === 0) return;
    const block = document.createElement("div");
    block.className = "round-block";
    const title = document.createElement("div");
    title.className = "round-title";
    title.textContent = `Vòng ${round.round}`;
    block.appendChild(title);
    round.tool_calls.forEach((call, index) => {
      const result = (round.tool_results || [])[index];
      block.appendChild(renderToolCall(call, result));
    });
    card.appendChild(block);
  });

  const meta = document.createElement("div");
  meta.className = "turn-meta";
  meta.textContent = `status=${turn.status} · version=${artifactVersion}`;
  card.appendChild(meta);

  outer.appendChild(card);
  chatLog.appendChild(outer);
  scrollToBottom();
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
}

messageInput.addEventListener("input", autoResizeTextarea);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composerForm.requestSubmit();
  }
});

suggestions.addEventListener("click", (event) => {
  const btn = event.target.closest(".quick-btn");
  if (!btn) return;
  messageInput.value = btn.dataset.text;
  autoResizeTextarea();
  if (!messageInput.disabled) messageInput.focus();
});

startBtn.addEventListener("click", async () => {
  const provider = document.getElementById("providerSelect").value;
  const version = document.getElementById("versionInput").value.trim() || "v5";
  const model = document.getElementById("modelInput").value.trim();

  startBtn.disabled = true;
  startBtn.textContent = "Đang khởi tạo...";
  setStatus("connecting", "Đang khởi tạo...");

  try {
    const resp = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, version, model }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      setStatus("error", "Lỗi kết nối");
      addSystemNote(`Không khởi tạo được phiên: ${data.error || "unknown error"}`);
      return;
    }
    hasMessages = false;
    chatLog.querySelectorAll(".msg").forEach((el) => el.remove());
    refreshEmptyState();
    setStatus("ready", `Sẵn sàng · ${data.provider} · ${data.model || "?"}`);
    addSystemNote(`Phiên mới đã bắt đầu (version=${data.artifact_version}). Transcript: ${data.transcript_path}`);
    setActiveControls(true);
    messageInput.focus();
  } catch (err) {
    setStatus("error", "Lỗi kết nối");
    addSystemNote(`Lỗi kết nối: ${err}`);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Bắt đầu phiên";
  }
});

composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  addUserBubble(text);
  messageInput.value = "";
  autoResizeTextarea();
  setActiveControls(false);

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      addSystemNote(`Lỗi: ${data.error || "unknown error"} ${data.message || ""}`);
      return;
    }
    addAssistantCard(data.turn, data.artifact_version);
  } catch (err) {
    addSystemNote(`Lỗi kết nối: ${err}`);
  } finally {
    setActiveControls(true);
    messageInput.focus();
  }
});

(async function init() {
  const resp = await fetch("/api/session");
  const data = await resp.json();
  if (data.active) {
    setStatus("ready", `Sẵn sàng · ${data.provider} · ${data.model || "?"}`);
  } else {
    setStatus("idle", "Chưa kết nối");
  }
  refreshEmptyState();
  setActiveControls(Boolean(data.active));
})();
