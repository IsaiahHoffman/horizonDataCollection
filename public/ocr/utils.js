// ============================================================
// public/ocr/utils.js
// Small shared utilities for OCR UI
// ============================================================

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function linesToArray(text) {
  return String(text || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}