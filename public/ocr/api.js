// ============================================================
// public/ocr/api.js
// Fetch helpers (JSON)
// ============================================================

export async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}