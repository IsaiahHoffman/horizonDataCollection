// ============================================================
// server/ocr/engine/storage/resetStore.js
// Helpers to wipe OCR outputs for a clean start
//   - data.json
//   - issues.json
//   - issues/ (crops)
// ============================================================

import fs from "fs";
import path from "path";
import { listSubdirs, safeTableNumber } from "../fs/listFiles.js";

function rmIfExists(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

export function resetOcrOutputsForTable({ PHOTOS_DIR, tableNumber }) {
  const safe = safeTableNumber(tableNumber);
  if (!safe) return { ok: false, reason: "invalid-tableNumber" };

  const folder = path.join(PHOTOS_DIR, safe);
  rmIfExists(path.join(folder, "data.json"));
  rmIfExists(path.join(folder, "issues.json"));
  rmIfExists(path.join(folder, "issues"));

  return { ok: true, tableNumber: safe };
}

export function resetOcrOutputsForAllTables({ PHOTOS_DIR }) {
  const tables = listSubdirs(PHOTOS_DIR);
  const results = tables.map(t => resetOcrOutputsForTable({ PHOTOS_DIR, tableNumber: t }));
  return { ok: true, count: results.length, results };
}