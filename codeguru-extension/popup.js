/**
 * CodeGuru — Popup Script
 * Checks Ollama status and wires up the "Open Sidebar" button.
 */

document.addEventListener("DOMContentLoaded", () => {
  const ollamaDot  = document.getElementById("ollama-dot");
  const ollamaText = document.getElementById("ollama-text");
  const ollamaVal  = document.getElementById("ollama-val");
  const modelVal   = document.getElementById("model-val");
  const openBtn    = document.getElementById("open-sidebar-btn");

  // ── Health check ───────────────────────────────────────
  chrome.runtime.sendMessage({ type: "CODEGURU_HEALTH_CHECK" }, (resp) => {
    if (resp && resp.online) {
      ollamaDot.classList.add("online");
      ollamaText.textContent = "Connected";
      ollamaVal.classList.add("val-online");

      if (resp.hasModel) {
        modelVal.textContent = "codeguru ✓";
        modelVal.style.color = "#10B981";
      } else {
        modelVal.textContent = "codeguru — not found";
        modelVal.style.color = "#F59E0B";
      }
    } else {
      ollamaDot.classList.add("offline");
      ollamaText.textContent = "Offline";
      ollamaVal.classList.add("val-offline");
      modelVal.textContent = "—";
      modelVal.classList.remove("val-model");
      modelVal.classList.add("val-neutral");
    }
  });

  // ── Open sidebar on active tab ─────────────────────────
  openBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CODEGURU_TOGGLE_FROM_POPUP" });
    // Close popup so user can see the sidebar
    window.close();
  });
});
