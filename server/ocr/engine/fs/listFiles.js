// ============================================================
// server/ocr/engine/fs/listFiles.js
// Filesystem helpers for OCR module
// ============================================================

import fs from "fs";
import path from "path";

export function safeTableNumber(tableNumber) {
  return String(tableNumber || "").replace(/[^0-9]/g, "");
}

export function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

export function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".png") && f !== "title-temp.png")
    .sort();
}

export function newestPngFirst(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".png") && f !== "title-temp.png")
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .map(x => x.f);
}