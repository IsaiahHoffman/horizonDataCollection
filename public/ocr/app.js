// ============================================================
// public/ocr/app.js
// OCR page bootstrap: init tables + init rules UI + wire buttons + scopes run UI
// ============================================================

import { setText } from "./utils.js";
import { loadTables } from "./tables.js";
import { startRun, stopRun } from "./debuggerRun.js";
import { loadGlobalRulesUI, saveGlobalRulesUI } from "./rulesUI.js";
import { initRunUI } from "./runUI.js";
import { initIssuesUI } from "./issuesUI.js";

async function init() {
  try {
    await loadTables();
    await loadGlobalRulesUI();

    // Debugger controls
    document.getElementById("startBtn").onclick = () =>
      startRun().catch(e => setText("status", "error: " + e.message));

    document.getElementById("stopBtn").onclick = () => stopRun();

    // Rules save
    document.getElementById("saveGlobalRulesBtn").onclick = () =>
      saveGlobalRulesUI().catch(e => setText("globalRulesStatus", "error: " + e.message));

    // Scopes UI
    initRunUI();

    // Issues panel UI (starts polling /ocr/issues/next)
    initIssuesUI();

    setText("status", "idle");
  } catch (e) {
    setText("status", "error: " + e.message);
  }
}

init();