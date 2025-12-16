// ============================================================
// server/ocr/engine/parse/dateTimeKey.js
// Strict date parsing + normalization to key+ts
// ============================================================

import { normalizeOcrText } from "../../rules/ocrRuleEngine.js";

export function parseDateTimeKeyStrict(text) {
  const cleaned = normalizeOcrText(text);

  const m = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;

  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);

  if (!(d >= 1 && d <= 31)) return null;
  if (!(mo >= 1 && mo <= 12)) return null;
  if (!(y >= 1900 && y <= 2100)) return null;
  if (!(hh >= 0 && hh <= 23)) return null;
  if (!(mi >= 0 && mi <= 59)) return null;

  const dt = new Date(y, mo - 1, d, hh, mi, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== (mo - 1) ||
    dt.getDate() !== d ||
    dt.getHours() !== hh ||
    dt.getMinutes() !== mi
  ) return null;

  const dd = String(d).padStart(2, "0");
  const mm = String(mo).padStart(2, "0");
  const HH = String(hh).padStart(2, "0");
  const Min = String(mi).padStart(2, "0");

  const key = `${y}-${mm}-${dd} ${HH}:${Min}`;
  const ts = dt.getTime();
  return { key, ts };
}