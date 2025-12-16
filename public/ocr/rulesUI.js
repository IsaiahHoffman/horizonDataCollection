// ============================================================
// public/ocr/rulesUI.js
// Global OCR rules editor UI (none/format/enum) using /ocr-rules endpoints
// ============================================================

import { fetchJSON } from "./api.js";
import { escapeHtml, linesToArray, setText } from "./utils.js";

function defaultRulesShape() {
  return { version: 1, columns: {}, settings: { enumStrict: true } };
}

function ensureRuleForColumn(rules, colName) {
  rules.columns ||= {};
  if (!rules.columns[colName]) rules.columns[colName] = { restriction: "none" };
  return rules.columns[colName];
}

function renderGlobalRulesUI(columns, rules, warningsByColumn = {}) {
  const host = document.getElementById("globalRules");
  host.innerHTML = "";

  if (!columns?.length) {
    host.textContent = "(No columns found in calibration.json)";
    return;
  }

  for (const col of columns) {
    const name = col.name;
    const rule = ensureRuleForColumn(rules, name);
    const restriction = String(rule.restriction || "none").toLowerCase();

    const row = document.createElement("div");
    row.className = "ruleRow";
    row.dataset.col = name;

    row.innerHTML = `
      <div><b>${escapeHtml(name)}</b></div>

      <div>
        <select class="restrictionSel">
          <option value="none"   ${restriction === "none" ? "selected" : ""}>No restrictions</option>
          <option value="format" ${restriction === "format" ? "selected" : ""}>Format restrictions</option>
          <option value="enum"   ${restriction === "enum" ? "selected" : ""}>Enum restrictions</option>
        </select>
        <div class="warnBox" style="margin-top:6px;color:#a60;font-size:12px;"></div>
      </div>

      <div>
        <textarea class="ruleText" spellcheck="false"></textarea>
        <div class="ruleHelp" style="margin-top:6px;color:#666;font-size:12px;"></div>
      </div>
    `;

    const sel = row.querySelector(".restrictionSel");
    const ta = row.querySelector(".ruleText");
    const help = row.querySelector(".ruleHelp");
    const warn = row.querySelector(".warnBox");

    function syncEditorFromRule() {
      const r = String(sel.value);

      if (r === "none") {
        ta.value = "";
        ta.disabled = true;
        help.textContent = "";
      } else if (r === "format") {
        ta.disabled = false;
        ta.value = Array.isArray(rule.formats) ? rule.formats.join("\n") : "";
        help.innerHTML = `One format per line. Example: <code>(n|nn).(n|nn).nnnn (n|nn):nn</code>`;
      } else if (r === "enum") {
        ta.disabled = false;
        ta.value = Array.isArray(rule.values) ? rule.values.join("\n") : "";
        help.textContent = "One allowed value per line (STRICT match).";
      }

      const w = warningsByColumn[name] || [];
      warn.textContent = w.length ? w.join(" | ") : "";
    }

    sel.onchange = () => {
      const r = String(sel.value);
      if (r === "none") {
        rules.columns[name] = { restriction: "none" };
      } else if (r === "format") {
        rules.columns[name] = { restriction: "format", formats: [] };
      } else if (r === "enum") {
        rules.columns[name] = { restriction: "enum", values: [] };
      }
      Object.assign(rule, rules.columns[name]);
      syncEditorFromRule();
    };

    syncEditorFromRule();
    host.appendChild(row);
  }
}

export async function loadGlobalRulesUI() {
  setText("globalRulesStatus", "loading...");
  const data = await fetchJSON("/ocr-rules");

  const rules = data.rules || defaultRulesShape();
  const columns = data.columns || [];
  const warningsByColumn = data.warningsByColumn || {};

  renderGlobalRulesUI(columns, rules, warningsByColumn);

  // stash current rules object for save
  window.__GLOBAL_RULES__ = rules;

  setText("globalRulesStatus", "");
}

export async function saveGlobalRulesUI() {
  const host = document.getElementById("globalRules");
  const rows = host.querySelectorAll(".ruleRow");

  const out = defaultRulesShape();
  out.settings.enumStrict = true; // locked strict
  out.columns = {};

  rows.forEach(row => {
    const colName = row.dataset.col;
    const restriction = row.querySelector(".restrictionSel").value;
    const ta = row.querySelector(".ruleText");

    if (restriction === "none") {
      out.columns[colName] = { restriction: "none" };
      return;
    }

    if (restriction === "format") {
      out.columns[colName] = { restriction: "format", formats: linesToArray(ta.value) };
      return;
    }

    if (restriction === "enum") {
      out.columns[colName] = { restriction: "enum", values: linesToArray(ta.value) };
      return;
    }
  });

  setText("globalRulesStatus", "saving...");
  await fetchJSON("/ocr-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: out })
  });

  setText("globalRulesStatus", "saved");

  // reload to reflect server-sanitized rules + warnings
  await loadGlobalRulesUI();
}