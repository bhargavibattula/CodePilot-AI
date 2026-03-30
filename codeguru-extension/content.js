/* ==================================================================
   CodeGuru — Content Script v5 (Redesign)
   Focused Chat · Collapsible Bottom Tools · Draggable FAB
   ================================================================== */

(function () {
  "use strict";
  if (document.getElementById("cg-fab")) return;

  // ── Config ──────────────────────────────────────────────
  const SIDEBAR_W   = 380;
  const CTX_LIMIT   = 5000;
  const HISTORY_MAX = 10;

  // ── State ───────────────────────────────────────────────
  let sidebarOpen = false;
  let loading     = false;
  let useContext  = true;
  let history     = [];
  let activeMode  = "explain"; // explain | solve | optimize | quiz

  // ── Platform Check ──────────────────────────────────────
  const isLeetCode = location.hostname.includes("leetcode.com");
  const isGFG      = location.hostname.includes("geeksforgeeks.org");

  // ── Icons ───────────────────────────────────────────────
  const IC = {
    chat:  '<svg width="24" height="24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    send:  '<svg width="18" height="18" fill="white"><path d="M2 21L23 12 2 3v7l15 2-15 2z"/></svg>',
    arrow: '<svg width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" class="cg-icon-arrow"><path d="M6 9l6 6 6-6"/></svg>',
    bolt:  '<svg width="16" height="16" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  };

  // ── Helpers ──────────────────────────────────────────────
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function md(raw) {
    let out = esc(raw);
    out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (_,l,c) => `<pre><code>${c}</code></pre>`);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\n/g, "<br>");
    return out;
  }

  function getContext() {
    const sel = window.getSelection().toString().trim();
    const raw = sel.length > 10 ? sel : (document.body.innerText || "");
    return raw.slice(0, CTX_LIMIT);
  }

  // ── Smart DOM Extraction (LeetCode/GFG) ─────────────────
  function extractProblem() {
    if (!isLeetCode && !isGFG) return null;
    let title = isLeetCode ? (document.querySelector('[data-cy="question-title"]')?.innerText || document.title) : (document.querySelector('.problems_header_content__title__L2cB2')?.innerText || document.title);
    let desc = isLeetCode ? document.querySelector('[data-track-load="description_content"]')?.innerText : document.querySelector('.problem-statement')?.innerText;
    return { title, desc: desc?.slice(0, 2000) };
  }

  function detectCode() {
    const blocks = [];
    document.querySelectorAll('pre, code, .monaco-editor .view-lines, .CodeMirror-code').forEach(el => {
      const text = el.innerText.trim();
      if (text.length > 50) blocks.push(text.slice(0, 2000));
    });
    return [...new Set(blocks)].slice(0, 3);
  }

  // ── Draggable FAB ───────────────────────────────────────
  const fab = document.createElement("button"); fab.id = "cg-fab"; fab.innerHTML = IC.chat; document.body.appendChild(fab);
  try {
    const pos = JSON.parse(localStorage.getItem("cg-fab-pos"));
    if (pos) { fab.style.left = pos.x + "px"; fab.style.top = pos.y + "px"; fab.style.right = "auto"; fab.style.bottom = "auto"; }
  } catch(e) {}

  let dragging = false, dragMoved = false, startX, startY;
  fab.addEventListener("pointerdown", (e) => {
    dragging = true; dragMoved = false; startX = e.clientX; startY = e.clientY;
    fab.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 3) dragMoved = true;
    fab.style.left = (fab.offsetLeft + dx) + "px"; fab.style.top = (fab.offsetTop + dy) + "px";
    fab.style.right = "auto"; fab.style.bottom = "auto";
    startX = e.clientX; startY = e.clientY;
  });
  document.addEventListener("pointerup", () => {
    if (!dragging) return; dragging = false;
    localStorage.setItem("cg-fab-pos", JSON.stringify({ x: fab.offsetLeft, y: fab.offsetTop }));
    if (!dragMoved) toggleSidebar();
  });

  // ── Sidebar UI ──────────────────────────────────────────
  const sidebar = document.createElement("div");
  sidebar.id = "cg-sidebar";
  sidebar.innerHTML = `
    <div class="cg-head">
      <div class="cg-logo-group"><span class="cg-brand">CodeGuru</span></div>
      <button class="cg-close-btn" id="cg-close">${IC.close}</button>
    </div>

    <div class="cg-modes">
      <button class="cg-mode-pill active" data-mode="explain"><div class="cg-dot" style="background:#22c55e"></div>Explain</button>
      <button class="cg-mode-pill" data-mode="solve"><div class="cg-dot" style="background:#3b82f6"></div>Solve</button>
      <button class="cg-mode-pill" data-mode="optimize"><div class="cg-dot" style="background:#a855f7"></div>Optimize</button>
      <button class="cg-mode-pill" data-mode="quiz"><div class="cg-dot" style="background:#eab308"></div>Quiz</button>
    </div>

    <div class="cg-context-row">
      <span>Auto-Page Context</span>
      <input type="checkbox" id="cg-ctx-check" checked>
    </div>

    <div class="cg-chat-area" id="cg-chat-box">
      <div class="cg-msg cg-msg-bot">Hi Battula! Select a mode and ask me anything about your code.</div>
    </div>

    <!-- COLLAPSIBLE BOTTOM PANELS -->
    <div class="cg-collapsible-root">
      
      <!-- Panel 1: Problem -->
      <div class="cg-collapse-item" id="cg-panel-lc" style="display:none">
        <button class="cg-collapse-head"><span>🚀 Problem Detected</span>${IC.arrow}</button>
        <div class="cg-collapse-content">
          <div class="cg-lc-card">
            <div id="cg-lc-label" style="font-weight:700; margin-bottom:4px"></div>
            <button class="cg-lc-solve-btn" id="cg-solve-action">Auto-Solve This</button>
          </div>
        </div>
      </div>

      <!-- Panel 2: Detected Code -->
      <div class="cg-collapse-item" id="cg-panel-code">
        <button class="cg-collapse-head"><span>🔍 Detected Snippets</span>${IC.arrow}</button>
        <div class="cg-collapse-content" id="cg-code-list"></div>
      </div>

    </div>

    <div class="cg-input-wrapper">
      <div class="cg-input-box">
        <textarea id="cg-input" placeholder="Message CodeGuru..." rows="1"></textarea>
        <button class="cg-send-btn" id="cg-send">${IC.send}</button>
      </div>
    </div>
  `;
  document.body.appendChild(sidebar);

  const $chatBox = sidebar.querySelector("#cg-chat-box");
  const $input   = sidebar.querySelector("#cg-input");
  const $send    = sidebar.querySelector("#cg-send");

  // ── Event Handlers ──────────────────────────────────────
  sidebar.querySelector("#cg-close").addEventListener("click", toggleSidebar);

  // Mode Selection
  sidebar.querySelectorAll(".cg-mode-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      sidebar.querySelectorAll(".cg-mode-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeMode = btn.dataset.mode;
    });
  });

  // Collapsibles Toggle
  sidebar.querySelectorAll(".cg-collapse-head").forEach(head => {
    head.addEventListener("click", () => {
      head.parentElement.classList.toggle("expanded");
    });
  });

  // Sending Logic
  async function sendMessage(text) {
    if (!text || loading) return;
    $input.value = ""; $input.style.height = "24px";
    addBubble("user", text);
    loading = true; $send.disabled = true;

    let instructions = {
      explain: "Explain this clearly with step-by-step logic.",
      solve: "Solve this coding problem. Provide code in Python and Java. Include a dry run.",
      optimize: "Optimize this code for better time/space complexity. Show before vs after.",
      quiz: "Quiz me on this! Ask me one question about time complexity or logic."
    };

    let fullPrompt = `Mode: ${activeMode}\nGoal: ${instructions[activeMode]}\n\n`;
    if (sidebar.querySelector("#cg-ctx-check").checked) {
      fullPrompt += `CONTEXT:\n${getContext()}\n\n`;
    }
    fullPrompt += `USER QUESTION: ${text}\n\nCodeGuru:`;

    const dots = addDots();
    chrome.runtime.sendMessage({ type: "OLLAMA_GENERATE", prompt: fullPrompt }, res => {
      dots.remove(); loading = false; $send.disabled = false;
      if (res && res.ok) {
        addBubble("bot", res.text);
      } else {
        const errorMsg = res ? res.text : "Is Ollama running? (Check background console)";
        addBubble("bot", `⚠️ Error: ${errorMsg}`);
      }
    });
  }

  $send.addEventListener("click", () => sendMessage($input.value));
  $input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage($input.value); }});

  // UI Helpers
  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = `cg-msg cg-msg-${role}`;
    div.innerHTML = md(text);
    $chatBox.appendChild(div);
    $chatBox.scrollTop = $chatBox.scrollHeight;
  }

  function addDots() {
    const div = document.createElement("div");
    div.className = "cg-msg cg-msg-bot cg-typing";
    div.innerHTML = '<div class="cg-dot-anim"></div><div class="cg-dot-anim"></div><div class="cg-dot-anim"></div>';
    $chatBox.appendChild(div);
    $chatBox.scrollTop = $chatBox.scrollHeight;
    return div;
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle("open", sidebarOpen);
    document.body.style.marginRight = sidebarOpen ? SIDEBAR_W + "px" : "0";
    if (sidebarOpen) {
      $input.focus();
      updatePanels();
    }
  }

  function updatePanels() {
    // Problem Recognition
    const prob = extractProblem();
    const lcPanel = sidebar.querySelector("#cg-panel-lc");
    if (prob) {
      lcPanel.style.display = "block";
      sidebar.querySelector("#cg-lc-label").innerText = prob.title;
      sidebar.querySelector("#cg-solve-action").onclick = () => {
        activeMode = "solve";
        sidebar.querySelectorAll(".cg-mode-pill").forEach(b => b.classList.toggle("active", b.dataset.mode === "solve"));
        sendMessage(`Solve problem: ${prob.title}\n\nDescription: ${prob.desc}`);
      };
    }

    // Code Detection
    const codes = detectCode();
    const codeList = sidebar.querySelector("#cg-code-list");
    codeList.innerHTML = codes.map((c, i) => `
      <div style="background:#0c1222; padding:8px; border-radius:4px; margin-top:8px; font-family:monospace; font-size:10px; cursor:pointer" onclick="this.parentElement.parentElement.parentElement.classList.remove('expanded'); window.CG_ACTION('${c.replace(/'/g, "\\'")}')">
        ${c.slice(0, 100)}...
      </div>
    `).join("");
    window.CG_ACTION = (code) => { $input.value = "Explain this code:\n\n" + code; $input.focus(); };
  }

})();
