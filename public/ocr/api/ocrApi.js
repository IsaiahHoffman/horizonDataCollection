// public/ocr/api/ocrApi.js

import { requestJSON } from "./client.js";

/* ---------------- RULES ---------------- */

export function fetchRules() {
  return requestJSON("/ocr-rules");
}

export function saveRules(rules) {
  return requestJSON("/ocr-rules", {
    method: "POST",
    body: JSON.stringify({ rules })
  });
}

/* ---------------- RUNS ---------------- */

export function startRun(payload) {
  return requestJSON("/ocr/run", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function stopRun(runId) {
  return requestJSON(`/ocr/run/${runId}/stop`, {
    method: "POST"
  });
}

export function fetchRunStatus(runId) {
  return requestJSON(`/ocr/run/${runId}/status`);
}

/* ---------------- ISSUES ---------------- */

export function fetchNextIssue() {
  return requestJSON("/ocr/issues/next");
}

export function approveIssue({ tableId, issueId, value }) {
  return requestJSON(`/ocr/issues/${tableId}/${issueId}/approve`, {
    method: "POST",
    body: JSON.stringify({ action: "approve", value })
  });
}

export function overrideIssue({ tableId, issueId, value }) {
  return requestJSON(`/ocr/issues/${tableId}/${issueId}/approve`, {
    method: "POST",
    body: JSON.stringify({ action: "override", value })
  });
}

export function fetchCounts({ scope, tableId }) {
  const qs = new URLSearchParams({ scope });
  if (tableId) qs.set("tableId", tableId);

  return requestJSON(`/ocr/counts?${qs.toString()}`);
}