// ============================================================
// public/ocr/runUI.js
// Run-scopes UI: start/stop scoped OCR runs and poll status
// ============================================================

import { fetchJSON } from "./api.js";
import { setText } from "./utils.js";
import { getSelectedTable } from "./tables.js";

let currentRunId = null;
let pollTimer = null;

function getScope() {
  return document.getElementById("runScope").value;
}
function getFileName() {
  return document.getElementById("runFile").value;
}
function getRowIndex() {
  return Number(document.getElementById("runRowIndex").value || 0);
}

function setRunControlsEnabled({ fileEnabled, rowEnabled }) {
  document.getElementById("runFile").disabled = !fileEnabled;
  document.getElementById("runRowIndex").disabled = !rowEnabled;
}

async function refreshFileListForSelectedTable() {
  const scope = getScope();
  const tableNumber = getSelectedTable();
  const fileSel = document.getElementById("runFile");

  fileSel.innerHTML = "";

  // only relevant when scope needs a file
  if (!["row", "file"].includes(scope)) return;

  const data = await fetchJSON(`/ocr/images/${tableNumber}`);
  const images = data.images || [];

  for (const f of images) {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    fileSel.appendChild(opt);
  }
}

function updateVisibilityByScope() {
  const scope = getScope();
  if (scope === "row") setRunControlsEnabled({ fileEnabled: true, rowEnabled: true });
  else if (scope === "file") setRunControlsEnabled({ fileEnabled: true, rowEnabled: false });
  else setRunControlsEnabled({ fileEnabled: false, rowEnabled: false });
}

async function pollStatusOnce() {
  if (!currentRunId) return;
  const data = await fetchJSON(`/ocr/run/${currentRunId}/status`);
  const r = data.run;

  const msg = `run=${r.status} table=${r.currentTable || ""} file=${r.currentFile || ""} `
    + `processed=${r.filesProcessed} blocked/skipped=${r.filesBlockedOrSkipped} `
    + `rowsCommitted=${r.rowsCommitted} rowsDrafted=${r.rowsDrafted}`;

  setText("runStatus", msg);

  if (["done", "error", "stopped"].includes(r.status)) {
    clearInterval(pollTimer);
    pollTimer = null;
    currentRunId = null;
  }
}

export function initRunUI() {
  // scope change
  document.getElementById("runScope").onchange = async () => {
    updateVisibilityByScope();
    await refreshFileListForSelectedTable();
  };

  // table change should refresh file list
  document.getElementById("tableSelect").addEventListener("change", async () => {
    await refreshFileListForSelectedTable();
  });

  document.getElementById("runStartBtn").onclick = async () => {
    const scope = getScope();
    const tableNumber = getSelectedTable();

    const body = { scope };

    if (scope !== "all") body.tableNumber = tableNumber;
    if (scope === "row") {
      body.fileName = getFileName();
      body.rowIndex = getRowIndex();
    }
    if (scope === "file") {
      body.fileName = getFileName();
    }

    setText("runStatus", "starting...");
    const started = await fetchJSON("/ocr/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    currentRunId = started.runId;
    setText("runStatus", `started runId=${currentRunId}`);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      pollStatusOnce().catch(e => setText("runStatus", "error: " + e.message));
    }, 1000);

    // poll immediately
    await pollStatusOnce();
  };

  document.getElementById("runStopBtn").onclick = async () => {
    if (!currentRunId) {
      setText("runStatus", "no active run");
      return;
    }
    await fetchJSON(`/ocr/run/${currentRunId}/stop`, { method: "POST" });
    setText("runStatus", "stop requested...");
  };

  // initial setup
  updateVisibilityByScope();
  refreshFileListForSelectedTable().catch(() => {});
}