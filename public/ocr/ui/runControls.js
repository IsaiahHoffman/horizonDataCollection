// public/ocr/ui/runControls.js

import {
  startRun,
  stopRun,
  fetchRunStatus
} from "../api/ocrApi.js";

import {
  getRun,
  setRun,
  onRunChange
} from "../state/runState.js";

import { requestJSON } from "../api/client.js";

let pollTimer = null;

export async function initRunControls() {
  const host = document.getElementById("runControls");

  host.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <label>Scope:</label>
      <select id="runScope">
        <option value="row">Row</option>
        <option value="file">File</option>
        <option value="animal">Animal</option>
        <option value="all">All</option>
      </select>

      <label>Animal:</label>
      <select id="tableSelect"></select>

      <label>File:</label>
      <select id="fileSelect"></select>

      <label>Row:</label>
      <input id="rowInput" type="number" min="0" value="0" style="width:70px;" />
    </div>

    <div style="margin-top:10px;display:flex;gap:8px;">
      <button id="startBtn">Start</button>
      <button id="pauseBtn" disabled>Pause</button>
      <button id="resumeBtn" disabled>Resume</button>
      <button id="stopBtn" disabled>Stop</button>
    </div>

    <div id="runStatus" style="margin-top:8px;font-size:12px;color:#555;"></div>
  `;

  document.getElementById("runScope").onchange = updateUIByScope;
  document.getElementById("tableSelect").onchange = loadFilesForAnimal;

  document.getElementById("startBtn").onclick = start;
  document.getElementById("pauseBtn").onclick = pause;
  document.getElementById("resumeBtn").onclick = resume;
  document.getElementById("stopBtn").onclick = stop;

  onRunChange(updateButtons);

  await loadAnimals();
  updateUIByScope();
}

/* ---------------- DATA LOADERS ---------------- */

async function loadAnimals() {
  const sel = document.getElementById("tableSelect");
  sel.innerHTML = "";

  const data = await requestJSON("/ocr/tables");
  for (const a of data.tables) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  }

  await loadFilesForAnimal();
}

async function loadFilesForAnimal() {
  const animalId = document.getElementById("tableSelect").value;
  const sel = document.getElementById("fileSelect");
  sel.innerHTML = "";

  if (!animalId) return;

  const data = await requestJSON(`/ocr/files/${animalId}`);
  for (const f of data.files) {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  }
}

/* ---------------- UI STATE ---------------- */

function updateUIByScope() {
  const scope = document.getElementById("runScope").value;

  document.getElementById("tableSelect").disabled =
    scope === "all";

  document.getElementById("fileSelect").disabled =
    scope === "animal" || scope === "all";

  document.getElementById("rowInput").disabled =
    scope !== "row";
}

function updateButtons(run) {
  document.getElementById("startBtn").disabled = !!run;
  document.getElementById("pauseBtn").disabled =
    !run || run.status !== "running";
  document.getElementById("resumeBtn").disabled =
    !run || run.status !== "paused";
  document.getElementById("stopBtn").disabled = !run;
}

/* ---------------- RUN CONTROL ---------------- */

async function start() {
  if (getRun()) return;

  const scope = document.getElementById("runScope").value;
  const animalId = document.getElementById("tableSelect").value;
  const fileName = document.getElementById("fileSelect").value;
  const rowIndex = Number(document.getElementById("rowInput").value || 0);

  const payload = { scope };

  if (scope !== "all") payload.tableId = animalId;
  if (scope === "file") payload.fileName = fileName;
  if (scope === "row") {
    payload.fileName = fileName;
    payload.rowIndex = rowIndex;
  }

  const started = await startRun(payload);
  setRun({ runId: started.runId, status: "running" });

  startPolling(started.runId);
}

async function pause() {
  const run = getRun();
  if (!run) return;

  await requestJSON(`/ocr/run/${run.runId}/pause`, {
    method: "POST"
  });
}

async function resume() {
  const run = getRun();
  if (!run) return;

  await requestJSON(`/ocr/run/${run.runId}/resume`, {
    method: "POST"
  });
}

async function stop() {
  const run = getRun();
  if (!run) return;

  await stopRun(run.runId);
}

/* ---------------- POLLING ---------------- */

function startPolling(runId) {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    const data = await fetchRunStatus(runId);
    const run = data.run;

    setRun(run);

    const statusEl = document.getElementById("runStatus");
    if (statusEl) {
      statusEl.textContent =
        `status=${run.status} ` +
        `animal=${run.currentAnimal || ""} ` +
        `file=${run.currentFile || ""} ` +
        `files=${run.filesProcessed || 0}/${run.filesTotal || 0}`;
    }

    if (
      ["stopped", "error"].includes(run.status)
    ) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 1000);
}