// ============================================================
// public/ocr/ui/issuesPanel.js
// ============================================================

import {
  fetchNextIssue,
  approveIssue,
  overrideIssue,
  fetchCounts
} from "../api/ocrApi.js";

import { requestJSON } from "../api/client.js";
import { getRun } from "../state/runState.js";

/**
 * Polling interval (ms)
 */
const POLL_MS = 1500;

let pollTimer = null;
let currentIssueKey = null;
let isEditing = false;

export function initIssuesPanel() {
  const host = document.getElementById("issuesPanel");

  host.innerHTML = `
    <div id="issueContent" style="color:#666;">
      No issues loaded.
    </div>
  `;

  startPolling();
}

/* ---------------- POLLING ---------------- */

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    try {
      await refreshCounts();
      await refreshIssue();
    } catch (e) {
      console.error("issue poll error", e);
    }
  }, POLL_MS);

  refreshCounts().catch(() => {});
  refreshIssue().catch(() => {});
}

async function refreshCounts() {
  const run = getRun();
  const el = document.getElementById("issuesCount");
  if (!el || !run) return;

  const scope = run.scope;
  const tableId = run.request?.tableId;

  // ✅ GUARD: only fetch when parameters are valid
  if (!scope) return;
  if (scope !== "all" && !tableId) return;

  try {
    const res = await fetchCounts({ scope, tableId });

    el.textContent =
      `(Issues: ${res.issues} | ` +
      `Drafts: ${res.drafts} | ` +
      `Data: ${res.data})`;
  } catch (e) {
    // ✅ Expected to occasionally fail during run transitions
    console.warn("Failed to fetch issue counts", e.message);
  }
}

async function refreshIssue(force = false) {
  if (isEditing && !force) return;

  const data = await fetchNextIssue();

  if (!data.found) {
    renderNone();
    return;
  }

  const nextKey = `${data.tableId}:${data.issue.id}`;
  if (!force && nextKey === currentIssueKey) return;

  renderIssue(data);
}

/* ---------------- RENDERING ---------------- */

function renderNone() {
  currentIssueKey = null;
  isEditing = false;

  const el = document.getElementById("issueContent");
  el.innerHTML = `<div style="color:#666;">No pending issues</div>`;
}

function renderIssue({ tableId, issue }) {
  currentIssueKey = `${tableId}:${issue.id}`;
  isEditing = false;

  const el = document.getElementById("issueContent");

  el.innerHTML = `
    <div style="margin-bottom:6px;">
      <b>Animal:</b> ${escape(issue.animalId)}
    </div>
    <div style="margin-bottom:6px;">
      <b>File:</b> ${escape(issue.imageName)}
    </div>
    <div style="margin-bottom:6px;">
      <b>Row:</b> ${issue.rowIndex}
      <b>Column:</b> ${issue.columnIndex}
    </div>

    <div style="margin:10px 0;">
      <img
        src="/ocr/issues/${tableId}/${issue.id}/image"
        style="max-width:100%;border:1px solid #ccc;"
      />
    </div>

    <div style="margin:10px 0;">
      <b>OCR value:</b>
      <div style="font-family:monospace;background:#eee;padding:6px;">
        ${escape(issue.value)}
      </div>
    </div>

    <div style="margin:10px 0;">
      <label><b>New value:</b></label>
      <input
        id="issueValueInput"
        type="text"
        style="width:100%;padding:6px;"
      />
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="approveBtn">Approve</button>
      <button id="overrideBtn">Override</button>
    </div>

    <div
      id="issueStatus"
      style="margin-top:8px;font-size:12px;color:#666;"
    ></div>
  `;

  const input = document.getElementById("issueValueInput");
  const approveBtn = document.getElementById("approveBtn");
  const overrideBtn = document.getElementById("overrideBtn");

  input.value = issue.value || "";

  if (issue.columnIndex === 0) {
    overrideBtn.disabled = true;
    overrideBtn.title = "Date column cannot be overridden.";
  }

  input.oninput = () => {
    isEditing = true;
    setStatus("");
  };

  approveBtn.onclick = async () => {
    try {
      setStatus("Saving...");
      await approveIssue({
        tableId,
        issueId: issue.id,
        value: input.value
      });

      await requestJSON("/ocr/export/try", { method: "POST" });
      await refreshCounts();
      await refreshIssue(true);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  overrideBtn.onclick = async () => {
    try {
      setStatus("Saving (override)...");
      await overrideIssue({
        tableId,
        issueId: issue.id,
        value: input.value
      });

      await requestJSON("/ocr/export/try", { method: "POST" });
      await refreshCounts();
      await refreshIssue(true);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };
}

/* ---------------- HELPERS ---------------- */

function setStatus(text) {
  const el = document.getElementById("issueStatus");
  if (el) el.textContent = text || "";
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}