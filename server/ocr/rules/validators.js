// server/ocr/rules/validators.js

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
 * Compile format string like (nnn|nn|n).n to regex.
 */
function compileFormatToRegex(format) {
  let src = format;

  src = src.replace(/n/g, "[0-9]");
  src = src.replace(/\./g, "\\.");

  return new RegExp(`^${src}$`);
}

/**
 * Format validation (multiple formats allowed).
 */
export function validateFormat(value, formats) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;

  if (!Array.isArray(formats)) return false;

  for (const f of formats) {
    const rx = compileFormatToRegex(f);
    if (rx.test(v)) return true;
  }

  return false;
}