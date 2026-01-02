// ============================================================
// server/ocr/rules/validators.js
// ============================================================

/**
 * Strict date validation: d.M.yyyy HH:mm
 * Leading zeros optional.
 */
export function validateDate(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;

  const rx =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/;

  const m = v.match(rx);
  if (!m) return false;

  const [, d, mo, y, h, mi] = m.map(Number);

  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  if (h < 0 || h > 23) return false;
  if (mi < 0 || mi > 59) return false;

  return true;
}

/**
 * Enum validation with optional case-insensitivity.
 */
export function validateEnum(value, allowed, strictCase) {
  if (!Array.isArray(allowed)) return false;
  if (typeof value !== "string") return false;

  if (strictCase) {
    return allowed.includes(value);
  }

  const v = value.toLowerCase();
  return allowed.some(a => String(a).toLowerCase() === v);
}

/**
 * Expand grammar like (nnn|nn|n).n into all concrete formats.
 */
function expandFormat(format) {
  const rx = /$([^()]+)$/;
  let out = [format];

  while (out.some(f => rx.test(f))) {
    const next = [];
    for (const f of out) {
      const m = f.match(rx);
      if (!m) {
        next.push(f);
        continue;
      }
      const [group, body] = m;
      for (const opt of body.split("|")) {
        next.push(f.replace(group, opt));
      }
    }
    out = next;
  }

  return out;
}

/**
 * Compile concrete format to regex.
 */
function compileFormatToRegex(format) {
  let src = format;
  src = src.replace(/n/g, "[0-9]");
  src = src.replace(/\./g, "\\.");
  src = src.replace(/\s/g, "\\s");
  return new RegExp(`^${src}$`);
}

/**
 * Count digits required by a format.
 */
function digitCount(format) {
  return (format.match(/n/g) || []).length;
}

/**
 * Rebuild a value from digits using a concrete format.
 */
function rebuildFromFormat(digits, format) {
  if (digits.length !== digitCount(format)) return null;

  let out = "";
  let di = 0;

  for (const ch of format) {
    if (ch === "n") out += digits[di++] ?? "";
    else out += ch;
  }

  return out;
}

/**
 * Format validation with grammar-aware normalization.
 * ✅ Handles missing decimals (white/black cells)
 */
export function validateFormat(value, formats) {
  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;
  if (!Array.isArray(formats)) return false;

  // Expand all formats
  const expanded = formats.flatMap(expandFormat);

  // ✅ 1. Direct match
  for (const f of expanded) {
    const rx = compileFormatToRegex(f);
    if (rx.test(raw)) return true;
  }

  // ✅ 2. Attempt punctuation recovery
  const digits = raw.replace(/\D/g, "");
  if (!digits) return false;

  for (const f of expanded) {
    const rebuilt = rebuildFromFormat(digits, f);
    if (!rebuilt) continue;

    const rx = compileFormatToRegex(f);
    if (rx.test(rebuilt)) return true;
  }

  return false;
}