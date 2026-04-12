

const API_BASE = window.location.origin.includes('localhost') ? window.location.origin : 'http://localhost:3000';

let cachedProjects = [];
const toolMeta = {
  create_project: { color: "#7c5cfc", icon: "folder-plus" },
  get_project: { color: "#3b82f6", icon: "search" },
  list_projects: { color: "#14b8a6", icon: "list" },
  update_project: { color: "#f59e0b", icon: "edit" },
  manage_todo: { color: "#22c55e", icon: "check-circle" },
  delete_project: { color: "#ef4444", icon: "trash" },
  create_random_project: { color: "#ec4899", icon: "dice" }
};

const promptMeta = {
  daily_overview: { color: "#f59e0b", icon: "sun", label: "Daily Overview" },
  analyze_project: { color: "#3b82f6", icon: "chart", label: "Analyze Project" },
  suggest_todos: { color: "#a78bfa", icon: "sparkle", label: "Suggest Todos" }
};

let serverTools = [];
let serverPrompts = [];
let recentActivities = [];
let messages = [];
let currentPage = "Dashboard";
let currentTool = null;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const chatContainer = $("#chatContainer");
const pageTitle = $("#pageTitle");
const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");
const toolsPanel = $("#toolsPanel");
const toolsFab = $("#toolsFab");
const modalOverlay = $("#modalOverlay");
const modalTitle = $("#modalTitle");
const modalFields = $("#modalFields");
const modalCancel = $("#modalCancel");
const modalRun = $("#modalRun");
const hamburgerBtn = $("#hamburgerBtn");
const newProjectBtn = $("#newProjectBtn");
const refreshBtn = $("#refreshBtn");
const activityToggle = $("#activityToggle");
const activityEntries = $("#activityEntries");
function getToolIcon(name) {
  const icons = {
    "folder-plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    "list": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    "edit": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    "check-circle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    "trash": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    "dice": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    "sun": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    "chart": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    "sparkle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'
  };
  return icons[name] || icons["search"];
}

const diamondSVG = '<svg viewBox="0 0 28 28" fill="none"><path d="M14 2L24 14L14 26L4 14L14 2Z" fill="#7c5cfc" opacity="0.25"/><path d="M14 6L20 14L14 22L8 14L14 6Z" fill="#7c5cfc"/><path d="M14 10L17 14L14 18L11 14L14 10Z" fill="#a78bfa"/></svg>';
const diamondLargeSVG = '<svg viewBox="0 0 28 28" fill="none" width="64" height="64"><path d="M14 2L24 14L14 26L4 14L14 2Z" fill="#7c5cfc" opacity="0.25"/><path d="M14 6L20 14L14 22L8 14L14 6Z" fill="#7c5cfc"/><path d="M14 10L17 14L14 18L11 14L14 10Z" fill="#a78bfa"/></svg>';
function renderMessages() {
  if (messages.length === 0) {
    chatContainer.innerHTML = renderWelcomeState();
    attachQuickActions();
    return;
  }

  chatContainer.innerHTML = messages.map((msg, i) => {
    if (msg.type === "user") return renderUserMessage(msg);
    if (msg.type === "ai") return renderAIMessage(msg);
    if (msg.type === "tool") return renderToolMessage(msg);
    if (msg.type === "typing") return renderTypingMessage();
    return "";
  }).join("");

  scrollToBottom();
}

function renderWelcomeState() {
  return `
    <div class="welcome-state">
      <div class="welcome-logo">${diamondLargeSVG}</div>
      <h1 class="welcome-heading">What would you like to manage today?</h1>
      <p class="welcome-sub">I can help you create projects, manage tasks, analyze progress, and plan your workflow via MCP.</p>
      <div class="quick-actions">
        <div class="quick-chip" data-action="list_projects">List all projects</div>
        <div class="quick-chip" data-action="create_project">Create new project</div>
        <div class="quick-chip" data-action="daily_overview">Daily overview</div>
        <div class="quick-chip" data-action="suggest_todos">Suggest tasks</div>
      </div>
    </div>
  `;
}

function attachQuickActions() {
  chatContainer.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const toolName = chip.getAttribute("data-action");
      if (['daily_overview', 'suggest_todos', 'analyze_project'].includes(toolName)) {
        openPromptModal(toolName);
      } else {
        openToolModal(toolName);
      }
    });
  });
}

function renderUserMessage(msg) {
  return `
    <div class="message user">
      <div class="message-avatar">U</div>
      <div class="message-bubble">${escapeHtml(msg.text)}</div>
    </div>
  `;
}

function renderAIMessage(msg) {
  return `
    <div class="message ai">
      <div class="message-avatar">${diamondSVG}</div>
      <div class="message-bubble">${formatMarkdown(msg.text)}</div>
    </div>
  `;
}

function renderTypingMessage() {
  return `
    <div class="message ai">
      <div class="message-avatar">${diamondSVG}</div>
      <div class="message-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
}

function renderToolMessage(msg) {
  let projectCards = "";
  if (msg.projects && Array.isArray(msg.projects)) {
    projectCards = msg.projects.map(p => renderProjectMiniCard(p)).join("");
  } else if (msg.project) {
    projectCards = renderProjectMiniCard(msg.project);
  }

  return `
    <div class="message tool-result">
      <div class="tool-result-box">
        <div class="tool-badge">⚡ ${msg.tool}</div>
        <div style="color:var(--text-secondary);line-height:1.6; white-space: pre-wrap;">${msg.text || ""}</div>
        ${projectCards}
      </div>
    </div>
  `;
}

function renderProjectMiniCard(project) {
  if (!project.project_name) return ''; // fallback if it's not a valid project

  const now = new Date();
  const dl = new Date(project.deadline);
  const isFuture = dl >= now;
  const dlClass = isFuture ? "future" : "past";
  const dlText = dl.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  let todos = "";
  if (project.todolist && Array.isArray(project.todolist)) {
    todos = project.todolist.map(t => {
      const checkIcon = t.is_done
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : "";
      return `
        <div class="todo-item-mini ${t.is_done ? "done" : ""}">
          <div class="todo-check">${checkIcon}</div>
          <span>${escapeHtml(t.text)}</span>
        </div>
      `;
    }).join("");
  }

  return `
    <div class="project-mini-card">
      <div class="project-mini-header">
        <span class="project-mini-name">ID: ${project.id} — ${escapeHtml(project.project_name)}</span>
        <span class="deadline-badge ${dlClass}">${dlText}</span>
      </div>
      <div class="todo-list-mini">${todos}</div>
    </div>
  `;
}
async function fetchTools() {
  try {
    const res = await fetch(`${API_BASE}/api/tools`);
    const data = await res.json();
    serverTools = data.tools || [];
    renderToolsPanel();
  } catch (e) {
    console.error("Failed to fetch tools", e);
  }
}

async function fetchPrompts() {
  try {
    const res = await fetch(`${API_BASE}/api/prompts`);
    const data = await res.json();
    serverPrompts = data.prompts || [];
    renderToolsPanel();
  } catch (e) {
    console.error("Failed to fetch prompts", e);
  }
}

async function fetchProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'list_projects', args: {} })
    });
    const data = await res.json();
    if (data && data.content && data.content.length > 0) {
      const parsed = JSON.parse(data.content[0].text);
      cachedProjects = parsed.projects || [];
    }
  } catch (e) {
    console.error("Failed to fetch initial projects", e);
  }
}
function renderToolsPanel() {
  const toolsList = $("#toolsList");
  toolsList.innerHTML = serverTools.map(t => {
    const meta = toolMeta[t.name] || { color: "#7c5cfc", icon: "search" };
    return `
    <div class="tool-card" data-tool="${t.name}">
      <div class="tool-icon" style="background:${meta.color}20;color:${meta.color};">
        ${getToolIcon(meta.icon)}
      </div>
      <div class="tool-info">
        <div class="tool-name">${t.name}</div>
        <div class="tool-desc" title="${t.description || ''}">${t.description || 'No description'}</div>
      </div>
      <button class="tool-run-btn" data-tool="${t.name}">Run</button>
    </div>
  `}).join("");
  toolsList.querySelectorAll(".tool-run-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openToolModal(btn.getAttribute("data-tool"));
    });
  });
  const promptsList = $("#promptsList");
  promptsList.innerHTML = serverPrompts.map(p => {
    const meta = promptMeta[p.name] || { color: "#a78bfa", icon: "sparkle", label: p.name };
    return `
    <div class="prompt-card" data-prompt="${p.name}">
      <div class="prompt-border" style="background:${meta.color};"></div>
      <div class="prompt-icon" style="color:${meta.color};">${getToolIcon(meta.icon)}</div>
      <div class="prompt-text">${p.description || meta.label}</div>
    </div>
  `}).join("");

  promptsList.querySelectorAll(".prompt-card").forEach(card => {
    card.addEventListener("click", () => {
      openPromptModal(card.getAttribute("data-prompt"));
    });
  });

  renderActivity();
}

function renderActivity() {
  activityEntries.innerHTML = recentActivities.map(a => `
    <div class="activity-entry">
      <span class="activity-time">${a.time}</span>
      <span class="activity-text">${a.text}</span>
    </div>
  `).join("");
}

function addActivity(text) {
  const now = new Date();
  const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  recentActivities.unshift({ time, text });
  if (recentActivities.length > 5) recentActivities.pop();
  renderActivity();
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatMarkdown(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/\n/g, "<br>");
  return text;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}
$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    $$(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    const page = item.getAttribute("data-page");
    currentPage = page;
    pageTitle.textContent = page;

    messages = [];
    messages.push({
      type: "ai",
      text: getPageWelcome(page)
    });
    renderMessages();

    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
  });
});

function getPageWelcome(page) {
  const welcomes = {
    "Dashboard": "Welcome to your **Dashboard**. Use the MCP Tools panel on the right to start interacting with the local `server.ts` JSON database.",
    "Projects": "📁 **Projects** — I can help you create, update, or analyze any project using our backend MCP tools.",
    "Todo Lists": "✅ **Todo Lists** — Use the `manage_todo` tool to add items to your projects.",
    "Analytics": "📊 **Analytics** — Execute the Prompt `analyze_project` to get LLM simulated reports.",
    "Daily Overview": "☀️ **Daily Overview**\n\nRun the `daily_overview` prompt for your daily briefing.",
    "Analyze Project": "🔍 **Project Analysis** — Use the Prompt tool to start an analysis.",
    "Suggest Tasks": "✨ **Task Suggestions** — Use the connected LLM MCP prompt to suggest you tasks for a project.",
    "Random Project": "🎲 **Random Project** — Use the `create_random_project` tool."
  };
  return welcomes[page] || "Welcome to **" + page + "**! How can I help you?";
}
let isPromptModal = false;

function openToolModal(toolName) {
  const tool = serverTools.find(t => t.name === toolName);
  if (!tool) return;

  currentTool = tool;
  isPromptModal = false;
  modalTitle.textContent = tool.name;

  let fieldsHTML = '';
  if (tool.inputSchema && tool.inputSchema.properties) {
    const props = tool.inputSchema.properties;
    for (const [key, value] of Object.entries(props)) {
      fieldsHTML += `
            <div class="modal-field">
              <label>${key} ${tool.inputSchema.required?.includes(key) ? '*' : ''}</label>
              <input type="text" placeholder="${value.description || ''}" data-type="${value.type}" data-key="${key}">
            </div>
          `;
    }
  }

  if (!fieldsHTML) {
    modalFields.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">This tool requires no parameters. Click Run to execute.</p>';
  } else {
    modalFields.innerHTML = fieldsHTML;
  }

  modalOverlay.classList.add("show");
}

function openPromptModal(promptName) {
  const prompt = serverPrompts.find(t => t.name === promptName);
  if (!prompt) return;

  currentTool = prompt;
  isPromptModal = true;
  modalTitle.textContent = prompt.name;

  let fieldsHTML = '';
  if (prompt.arguments) {
    for (const arg of prompt.arguments) {
      fieldsHTML += `
            <div class="modal-field">
              <label>${arg.name} ${arg.required ? '*' : ''}</label>
              <input type="text" placeholder="${arg.description || ''}" data-key="${arg.name}">
            </div>
          `;
    }
  }

  if (!fieldsHTML) {
    modalFields.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">This prompt requires no arguments. Click Run to execute.</p>';
  } else {
    modalFields.innerHTML = fieldsHTML;
  }

  modalOverlay.classList.add("show");
}

function closeModal() {
  modalOverlay.classList.remove("show");
  currentTool = null;
}

modalCancel.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("show")) {
    closeModal();
  }
});

modalRun.addEventListener("click", async () => {
  if (!currentTool) return;

  const params = {};
  modalFields.querySelectorAll("input").forEach(inp => {
    let val = inp.value;
    if (val) {
      if (inp.getAttribute('data-type') === 'number' || inp.getAttribute('data-type') === 'integer') {
        val = Number(val);
      }
      params[inp.getAttribute("data-key")] = val;
    }
  });

  const toolNameToRun = currentTool.name;
  const isRunningPrompt = isPromptModal;

  closeModal();

  messages.push({ type: "user", text: `Run ${isRunningPrompt ? 'prompt' : 'tool'}: ${toolNameToRun}` });
  messages.push({ type: "typing" });
  renderMessages();

  try {
    let endpoint = isRunningPrompt ? '/api/prompts/execute' : '/api/tools/execute';
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: toolNameToRun, args: params })
    });
    const data = await res.json();

    messages = messages.filter(m => m.type !== "typing");

    if (data.error) throw new Error(data.error);

    if (isRunningPrompt) {
      if (data.messages && data.messages.length > 0) {
        messages.push({
          type: "tool",
          tool: toolNameToRun,
          text: data.messages.map(m => m.content?.type === 'text' ? m.content.text : '').join("\n")
        });
      }
      addActivity(`Executed prompt: ${toolNameToRun}`);
    } else {
      if (data.content && data.content.length > 0) {
        const textContent = data.content[0].text;
        let parsedResult = {};
        try { parsedResult = JSON.parse(textContent); } catch (e) { }

        messages.push({
          type: "tool",
          tool: toolNameToRun,
          text: textContent,
          project: parsedResult.project,
          projects: parsedResult.projects
        });
      }
      addActivity(`Executed tool: ${toolNameToRun}`);
      fetchProjects();
    }

  } catch (err) {
    messages = messages.filter(m => m.type !== "typing");
    messages.push({
      type: "tool",
      tool: toolNameToRun,
      text: `Error: ${err.message}`
    });
  }
  renderMessages();
});
newProjectBtn.addEventListener("click", () => { openToolModal("create_project"); });

refreshBtn.addEventListener("click", () => {
  messages = [];
  messages.push({
    type: "ai",
    text: `Data locally refreshed! You have **${cachedProjects.length} projects** tracked.`
  });
  renderMessages();
  fetchTools();
  fetchPrompts();
  fetchProjects();
});

hamburgerBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("show");
});

sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
});

toolsFab.addEventListener("click", () => {
  toolsPanel.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (window.innerWidth <= 1024 &&
    toolsPanel.classList.contains("open") &&
    !toolsPanel.contains(e.target) &&
    e.target !== toolsFab &&
    !toolsFab.contains(e.target)) {
    toolsPanel.classList.remove("open");
  }
});

activityToggle.addEventListener("click", () => {
  activityToggle.classList.toggle("collapsed");
  activityEntries.classList.toggle("hidden");
});
async function init() {
  await fetchProjects();
  await fetchTools();
  await fetchPrompts();

  let projectCount = cachedProjects.length;
  messages.push({
    type: "ai",
    text: `Hello! I'm **PlannerAI**, running connected to your MCP Server! I can see you have **${projectCount} active projects**. Open the tools panel and let's get to work.`
  });
  renderMessages();
}

init();

// ─── AI AGENT CHAT ────────────────────────────────────────────────────────────

// Čuva historiju razgovora za kontekst (max 20 poruka da se ne prelije)
let chatHistory = [];
const MAX_HISTORY = 20;

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const text = input.value.trim();

  if (!text) return;

  // Resetuj input i onemogući slanje dok čekamo odgovor
  input.value = '';
  sendBtn.disabled = true;

  // Prikaži korisnikovu poruku i typing indikator
  messages.push({ type: 'user', text });
  messages.push({ type: 'typing' });
  renderMessages();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory,
      }),
    });

    const data = await res.json();
    const reply = data.reply || data.error || 'Greška pri obradi zahtjeva.';

    // Ukloni typing indikator, dodaj odgovor agenta
    messages.pop();
    messages.push({ type: 'ai', text: reply });

    // Ažuriraj historiju razgovora
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: reply });

    // Ograniči historiju na MAX_HISTORY poruka
    if (chatHistory.length > MAX_HISTORY) {
      chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY);
    }

    // Osvježi prikaz projekata jer je agent mogao napraviti izmjene
    await fetchProjects();

  } catch (err) {
    console.error('[chat]', err);
    messages.pop();
    messages.push({ type: 'ai', text: 'Greška u komunikaciji sa agentom. Provjeri da li server radi.' });
  }

  sendBtn.disabled = false;
  renderMessages();
  input.focus();
}

// Event listeneri za slanje poruke
document.getElementById('chatSendBtn')?.addEventListener('click', sendChatMessage);
document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// ─── KRAJ AI AGENT CHAT BLOKA ─────────────────────────────────────────────────

