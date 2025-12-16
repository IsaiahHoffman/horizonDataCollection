// ============================================================
// server/ocr/engine/storage/issuesStore.js
// issues.json persistence + issue crop saving
// ============================================================

import fs from "fs";
import path from "path";

export function loadIssuesState(issuesPath, tableNumber) {
  if (!fs.existsSync(issuesPath)) {
    return {
      version: 1,
      tableNumber: String(tableNumber),
      draftRows: {},
      issues: [],
      blockedFiles: {}
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("bad json");
    if (!parsed.tableNumber) parsed.tableNumber = String(tableNumber);
    if (!parsed.draftRows || typeof parsed.draftRows !== "object") parsed.draftRows = {};
    if (!Array.isArray(parsed.issues)) parsed.issues = [];
    if (!parsed.blockedFiles || typeof parsed.blockedFiles !== "object") parsed.blockedFiles = {};
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch {
    return {
      version: 1,
      tableNumber: String(tableNumber),
      draftRows: {},
      issues: [],
      blockedFiles: {}
    };
  }
}

export function saveIssuesState(issuesPath, state) {
  fs.writeFileSync(issuesPath, JSON.stringify(state, null, 2));
}

export function genIssueId() {
  return `iss_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureIssuesDir(folder) {
  const dir = path.join(folder, "issues");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveIssueCrop(folder, issueId, cropBuf) {
  const dir = ensureIssuesDir(folder);
  const fileName = `${issueId}.png`;
  const abs = path.join(dir, fileName);
  fs.writeFileSync(abs, cropBuf);
  return `/photos/${path.basename(folder)}/issues/${fileName}`;
}