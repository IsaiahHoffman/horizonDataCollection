// ============================================================
// server/ocr/rules/ocrRuleEngine.js
// Global OCR rule compiler + validators
// ============================================================

function escapeRegexChar(ch) {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

export function normalizeOcrText(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function parseGroupOptions(groupText) {
  const inner = String(groupText ?? "").trim();

  // Alternatives
  if (inner.includes("|")) {
    return inner.split("|").map(s => s.trim()).filter(Boolean);
  }

  // Range inside parentheses: (n..nnn)
  if (inner.includes("..")) {
    const [aRaw, bRaw] = inner.split("..").map(s => s.trim());
    const isAllN = s => s.length > 0 && [...s].every(ch => ch === "n" || ch === "N");
    if (!isAllN(aRaw) || !isAllN(bRaw)) return [inner];

    const lo = Math.min(aRaw.length, bRaw.length);
    const hi = Math.max(aRaw.length, bRaw.length);

    const opts = [];
    for (let k = lo; k <= hi; k++) opts.push("n".repeat(k));
    return opts;
  }

  return [inner];
}

function compilePieceToRegex(piece) {
  let out = "";
  for (const ch of piece) {
    if (ch === "n" || ch === "N") out += "\\d";
    else out += escapeRegexChar(ch);
  }
  return out;
}

export function compileFormatLine(line) {
  const src = String(line ?? "").trim();
  const warnings = [];

  if (!src) return { regex: /^$/, whitelist: "0123456789", warnings };

  // warn if | or .. appear outside parentheses (they are literal by design)
  {
    let depth = 0;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth === 0 && ch === "|") warnings.push(`'|' found outside parentheses in: ${src}`);
      else if (depth === 0 && src.slice(i, i + 2) === "..") {
        warnings.push(`'..' found outside parentheses in: ${src}`);
        i++;
      }
    }
  }

  // whitelist: digits + literal chars used in the format
  const wl = new Set("0123456789".split(""));
  let body = "";

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      let inside = "";

      while (j < src.length && depth > 0) {
        const c2 = src[j];
        if (c2 === "(") depth++;
        else if (c2 === ")") depth--;
        if (depth > 0) inside += c2;
        j++;
      }

      if (depth !== 0) {
        warnings.push(`Unbalanced '(' in format: ${src}`);
        body += escapeRegexChar("(");
        wl.add("(");
        continue;
      }

      const options = parseGroupOptions(inside);
      body += `(?:${options.map(compilePieceToRegex).join("|")})`;

      for (const opt of options) {
        for (const cOpt of opt) {
          if (cOpt === "n" || cOpt === "N") continue;
          wl.add(cOpt);
        }
      }

      i = j - 1;
    } else {
      if (ch === "n" || ch === "N") {
        body += "\\d";
      } else {
        body += escapeRegexChar(ch);
        wl.add(ch);
      }
    }
  }

  return {
    regex: new RegExp(`^${body}$`),
    whitelist: Array.from(wl).join(""),
    warnings
  };
}

export function validateByFormats(text, formats) {
  const t = normalizeOcrText(text);
  const list = Array.isArray(formats) ? formats : [];
  for (const f of list) {
    const { regex } = compileFormatLine(f);
    if (regex.test(t)) return { ok: true, matchedLine: f };
  }
  return { ok: false, matchedLine: null };
}

export function validateByEnumStrict(text, values) {
  const t = normalizeOcrText(text);
  const list = Array.isArray(values) ? values : [];
  for (const v of list) {
    if (t === String(v)) return { ok: true, matchedValue: String(v) };
  }
  return { ok: false, matchedValue: null };
}

export function getRestrictionForColumn(globalRules, colName) {
  const rule = globalRules?.columns?.[colName] || { restriction: "none" };
  const restriction = String(rule.restriction || "none").toLowerCase();

  if (restriction === "format") {
    return { restriction, formats: Array.isArray(rule.formats) ? rule.formats : [], values: [] };
  }
  if (restriction === "enum") {
    return { restriction, formats: [], values: Array.isArray(rule.values) ? rule.values : [] };
  }
  return { restriction: "none", formats: [], values: [] };
}