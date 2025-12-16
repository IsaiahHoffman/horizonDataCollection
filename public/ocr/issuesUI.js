// ============================================================
// public/ocr/issuesUI.js
// Issues panel UI: polls /ocr/issues/next and allows approve/override
//
// Updated semantics:
//  - Approve (validated): sends current input value and action="approve"
//      * server validates against CURRENT global rules
//  - Override (no validation): sends current input value and action="override"
//      * server bypasses validation (date issues: override disabled)
//
// UX improvement:
//  - show server error details (restriction + formats/values preview)
//  - polling will not clobber input while typing
// ============================================================

import { fetchJSON } from "./api.js";
import { escapeHtml, setText } from "./utils.js";

let pollTimer = null;

// currently displayed issue identity
let currentKey = null; // `${tableNumber}:${issueId}`

// editing state
let isDirty = false;

function issueKey(tableNumber, issue) {
  return `${String(tableNumber || "")}:${String(issue?.id || "")}`;
}

function renderNone() {
  currentKey = null;
  isDirty = false;

  const box = document.getElementById("issuesBox");
  if (!box) return;
  box.innerHTML = `<div style="color:#666;">No pending issues</div>`;
}

function isUserEditing() {
  const input = document.getElementById("issueValue");
  return isDirty || (input && document.activeElement === input);
}

// Local helper: like fetchJSON but preserves server payload (data.details)
async function postJSON(url, bodyObj) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj || {})
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    err.status = res.status;
    throw err;
  }

  return data;
}

function setStatus(text) {
  const el = document.getElementById("issueActionStatus");
  if (!el) return;
  el.textContent = text || "";
}

function setStatusDetailsFromError(err) {
  const el = document.getElementById("issueActionStatus");
  if (!el) return;

  const msg = err?.message || "Unknown error";
  const data = err?.data || {};
  const details = data?.details || null;

  // default: just message
  if (!details) {
    el.textContent = `error: ${msg}`;
    return;
  }

  const restriction = details.restriction || {};
  const rType = restriction.restriction || "none";

  let extra = "";

  if (rType === "format") {
    const formats = Array.isArray(restriction.formats) ? restriction.formats : [];
    const preview = formats.slice(0, 12).map(s => `  - ${s}`).join("\n");
    extra =
      `restriction: format\n` +
      (details.matchedLine ? `matchedLine: ${details.matchedLine}\n` : "") +
      `allowed formats (preview):\n${preview}` +
      (formats.length > 12 ? `\n  ...and ${formats.length - 12} more` : "");
  } else if (rType === "enum") {
    const values = Array.isArray(restriction.values) ? restriction.values : [];
    const preview = values.slice(0, 20).map(s => `  - ${s}`).join("\n");
    extra =
      `restriction: enum\n` +
      (details.matchedValue ? `matchedValue: ${details.matchedValue}\n` : "") +
      `allowed values (preview):\n${preview}` +
      (values.length > 20 ? `\n  ...and ${values.length - 20} more` : "");
  } else {
    extra = `restriction: ${rType}`;
  }

  el.textContent =
    `error: ${msg}\n\n` +
    `${extra}\n\n` +
    `Tip: update Global OCR Rules, then try Approve again. Or use Override (non-date only).`;
}

function renderIssue(payload) {
  const { tableNumber, issue, isBlocking } = payload;
  currentKey = issueKey(tableNumber, issue);
  isDirty = false;

  const box = document.getElementById("issuesBox");
  if (!box) return;

  const src = issue.source || {};

  box.innerHTML = `
    <div style="margin-top:6px;">
      <div><b>Table:</b> ${escapeHtml(tableNumber)}</div>
      <div><b>Kind:</b> ${escapeHtml(issue.kind)} ${
        isBlocking ? `<span style="color:#a00;">(BLOCKING)</span>` : ""
      }</div>
      <div><b>File:</b> ${escapeHtml(src.fileName || "")}</div>
      <div><b>Row:</b> ${escapeHtml(String(src.rowIndex ?? ""))}</div>
      <div><b>Column:</b> ${escapeHtml(issue.columnName || "")}</div>
    </div>

    <div style="margin-top:10px;">
      <img
        src="${escapeHtml(issue.cropPath || "")}"
        style="width:100%;border:1px solid #ddd;background:#fafafa;"
      />
    </div>

    <div style="margin-top:10px;font-size:12px;color:#333;">
      <div><b>OCR:</b> <span style="font-family:ui-monospace;">${escapeHtml(issue.ocrValue || "")}</span></div>
      <div style="margin-top:6px;"><b>Rule (snapshot):</b> <span style="font-family:ui-monospace;">${escapeHtml(JSON.stringify(issue.rule || {}))}</span></div>
      <div style="margin-top:6px;color:#666;">
        Approve validates against CURRENT global rules. Override bypasses validation.
      </div>
    </div>

    <div style="margin-top:10px;">
      <label style="font-size:12px;color:#333;"><b>Value</b>:</label>
      <input id="issueValue" type="text" style="width:100%;padding:6px;" />
    </div>

    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <button id="approveOcrBtn">Approve (Validated)</button>
      <button id="overrideBtn">Override (No Validation)</button>
    </div>

    <div id="issueActionStatus" style="margin-top:10px;font-size:12px;color:#666;white-space:pre-wrap;"></div>
  `;

  // set input value via DOM (safe for quotes)
  const input = document.getElementById("issueValue");
  if (input) {
    input.value = String(issue.ocrValue || "");
    input.addEventListener("input", () => {
      isDirty = true;
      // clear previous error text as user edits
      setStatus("");
    });
  }

  const approveBtn = document.getElementById("approveOcrBtn");
  const overrideBtn = document.getElementById("overrideBtn");

  // Date issues: no override (server also rejects it)
  if (issue.kind === "date" && overrideBtn) {
    overrideBtn.disabled = true;
    overrideBtn.title = "Date issues do not allow override.";
  }

  if (approveBtn) {
    approveBtn.onclick = async () => {
      try {
        const v = document.getElementById("issueValue")?.value ?? "";
        setStatus("saving...");
        // use postJSON (keeps details)
        await postJSON(`/ocr/issues/${tableNumber}/${issue.id}/approve`, {
          action: "approve",
          value: v
        });
        setStatus("saved");
        await refreshOnce({ force: true });
      } catch (e) {
        setStatusDetailsFromError(e);
      }
    };
  }

  if (overrideBtn) {
    overrideBtn.onclick = async () => {
      try {
        const v = document.getElementById("issueValue")?.value ?? "";
        setStatus("saving...");
        await postJSON(`/ocr/issues/${tableNumber}/${issue.id}/approve`, {
          action: "override",
          value: v
        });
        setStatus("saved");
        await refreshOnce({ force: true });
      } catch (e) {
        setStatusDetailsFromError(e);
      }
    };
  }
}

export async function refreshOnce({ force = false } = {}) {
  // If user is typing, don't clobber their input
  if (!force && isUserEditing()) return;

  const data = await fetchJSON("/ocr/issues/next");

  if (!data.found) {
    if (!isUserEditing()) renderNone();
    return;
  }

  const nextKey = issueKey(data.tableNumber, data.issue);

  // If same issue is already displayed, don't re-render (prevents input reset)
  if (!force && currentKey === nextKey) return;

  // If different issue but user is editing, skip until they're done
  if (!force && isUserEditing()) return;

  renderIssue(data);
}

export function initIssuesUI() {
  refreshOnce({ force: true }).catch(() => renderNone());

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    refreshOnce().catch(() => {});
  }, 1500);
}