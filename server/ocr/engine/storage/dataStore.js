// ============================================================
// server/ocr/engine/storage/dataStore.js
// data.json persistence helpers (final rows only)
// ============================================================

import fs from "fs";

export function loadDataFile(filePath, tableNumber) {
  if (!fs.existsSync(filePath)) return { tableNumber: String(tableNumber), rows: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed.rows)) parsed.rows = [];
    if (!parsed.tableNumber) parsed.tableNumber = String(tableNumber);
    return parsed;
  } catch {
    return { tableNumber: String(tableNumber), rows: [] };
  }
}

export function saveDataFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function mergeRows(existingRows, newRows) {
  const map = new Map();
  for (const r of existingRows) map.set(r.key, r);
  for (const r of newRows) if (!map.has(r.key)) map.set(r.key, r);
  const merged = Array.from(map.values());
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}