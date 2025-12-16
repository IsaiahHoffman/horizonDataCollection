// ============================================================
// server/ocr/engine/storage/rulesStore.js
// Load global OCR rules from root ocrRules.json
// ============================================================

import fs from "fs";

export function loadGlobalRules(RULES_PATH) {
  if (!RULES_PATH || !fs.existsSync(RULES_PATH)) {
    return { version: 1, columns: {}, settings: { enumStrict: true } };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") return { version: 1, columns: {}, settings: { enumStrict: true } };
    if (!parsed.columns || typeof parsed.columns !== "object") parsed.columns = {};
    if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = { enumStrict: true };
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch {
    return { version: 1, columns: {}, settings: { enumStrict: true } };
  }
}