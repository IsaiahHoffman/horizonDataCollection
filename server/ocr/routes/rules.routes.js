// ============================================================
// server/ocr/routes/rules.routes.js
// Global OCR rules endpoints:
//   GET  /ocr-rules
//   POST /ocr-rules
//   POST /ocr-rules/test
// ============================================================

import fs from "fs";
import { compileFormatLine, normalizeOcrText } from "../rules/ocrRuleEngine.js";

function defaultRules() {
  return {
    version: 1,
    columns: {},
    settings: {
      enumStrict: true
    }
  };
}

function loadRules(RULES_PATH) {
  if (!RULES_PATH || !fs.existsSync(RULES_PATH)) return defaultRules();
  try {
    const parsed = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") return defaultRules();
    if (!parsed.columns || typeof parsed.columns !== "object") parsed.columns = {};
    if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = { enumStrict: true };
    if (!parsed.version) parsed.version = 1;
    // lock enumStrict true (as requested)
    parsed.settings.enumStrict = true;
    return parsed;
  } catch {
    return defaultRules();
  }
}

function saveRules(RULES_PATH, rules) {
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));
}

function toStringArray(v, max = 200) {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x ?? "").trim()).filter(Boolean).slice(0, max);
}

function sanitizeIncomingRules(incoming) {
  const out = defaultRules();
  if (!incoming || typeof incoming !== "object") return out;

  out.version = 1;
  out.settings.enumStrict = true;

  const cols = incoming.columns && typeof incoming.columns === "object" ? incoming.columns : {};
  for (const [colName, rule] of Object.entries(cols)) {
    if (!colName) continue;
    const r = rule && typeof rule === "object" ? rule : {};

    const restriction = String(r.restriction || "none").toLowerCase();
    if (!["none", "format", "enum"].includes(restriction)) continue;

    if (restriction === "none") {
      out.columns[colName] = { restriction: "none" };
      continue;
    }

    if (restriction === "format") {
      out.columns[colName] = {
        restriction: "format",
        formats: toStringArray(r.formats, 200)
      };
      continue;
    }

    if (restriction === "enum") {
      out.columns[colName] = {
        restriction: "enum",
        values: toStringArray(r.values, 2000)
      };
      continue;
    }
  }

  return out;
}

export function registerOcrRulesRoutes(app, { RULES_PATH, getCalibration }) {
  // ------------------------------------------------------------
  // GET /ocr-rules
  // ------------------------------------------------------------
  app.get("/ocr-rules", (req, res) => {
    try {
      const rules = loadRules(RULES_PATH);
      const cal = getCalibration();
      const columns = (cal?.columns || []).map(c => ({ name: c.name }));

      // warnings per column (format lines)
      const warningsByColumn = {};
      for (const [colName, rule] of Object.entries(rules.columns || {})) {
        if (rule?.restriction !== "format") continue;
        const formats = Array.isArray(rule.formats) ? rule.formats : [];
        const warnings = [];
        for (const f of formats) {
          const compiled = compileFormatLine(f);
          if (compiled.warnings?.length) warnings.push(...compiled.warnings);
        }
        warningsByColumn[colName] = Array.from(new Set(warnings));
      }

      res.json({ success: true, rules, columns, warningsByColumn });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ------------------------------------------------------------
  // POST /ocr-rules
  // Body: { rules }
  // ------------------------------------------------------------
  app.post("/ocr-rules", (req, res) => {
    try {
      const incoming = req.body?.rules;
      const sanitized = sanitizeIncomingRules(incoming);
      saveRules(RULES_PATH, sanitized);

      res.json({ success: true, savedTo: "/ocrRules.json", rules: sanitized });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ------------------------------------------------------------
  // POST /ocr-rules/test
  // Body: { columnName, value }
  // Returns: { ok, matchedLine?, matchedValue?, restriction }
  // ------------------------------------------------------------
  app.post("/ocr-rules/test", (req, res) => {
    try {
      const rules = loadRules(RULES_PATH);

      const columnName = String(req.body?.columnName || "");
      const valueRaw = String(req.body?.value ?? "");
      const value = normalizeOcrText(valueRaw);

      if (!columnName) return res.status(400).json({ success: false, error: "Missing columnName" });

      const rule = rules.columns?.[columnName] || { restriction: "none" };
      const restriction = String(rule.restriction || "none").toLowerCase();

      if (restriction === "none") {
        return res.json({ success: true, restriction, ok: true });
      }

      if (restriction === "enum") {
        const values = Array.isArray(rule.values) ? rule.values.map(v => String(v)) : [];
        const ok = values.includes(value);
        return res.json({
          success: true,
          restriction,
          ok,
          matchedValue: ok ? value : null
        });
      }

      if (restriction === "format") {
        const formats = Array.isArray(rule.formats) ? rule.formats : [];
        for (const f of formats) {
          const compiled = compileFormatLine(f);
          if (compiled.regex.test(value)) {
            return res.json({
              success: true,
              restriction,
              ok: true,
              matchedLine: f,
              whitelist: compiled.whitelist
            });
          }
        }

        const warnings = [];
        for (const f of formats) {
          const compiled = compileFormatLine(f);
          if (compiled.warnings?.length) warnings.push(...compiled.warnings);
        }

        return res.json({
          success: true,
          restriction,
          ok: false,
          matchedLine: null,
          warnings: Array.from(new Set(warnings))
        });
      }

      return res.json({ success: true, restriction, ok: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}