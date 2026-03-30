/**
 * CodeGuru — Background Worker (Fixed)
 * No timeout — Ollama on CPU can take 30-90 seconds.
 */

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "OLLAMA_GENERATE") {

    fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "codeguru",
        prompt: req.prompt,
        stream: false
      })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      sendResponse({ ok: true, text: data.response || "No response." });
    })
    .catch(err => {
      console.error("[CodeGuru] Fetch error:", err);
      sendResponse({ ok: false, text: err.message });
    });

    return true; // Keep channel open for async
  }
});
