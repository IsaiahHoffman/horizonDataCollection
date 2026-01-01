// public/ocr/ui/rulesEditor.js

import { fetchRules, saveRules } from "../api/ocrApi.js";
import { getRun, clearRun } from "../state/runState.js";

/**
 * Initialize Global OCR Rules editor.
 */
export async function initRulesEditor() {
  const host = document.getElementById("rulesEditor");
  const status = document.getElementById("rulesStatus");
  const saveBtn = document.getElementById("saveRulesBtn");

  status.textContent = "Loading rules...";

  const data = await fetchRules();
  const calibrationColumns = data.columns;
  const rulesByName = data.rules || {};

  render(host, calibrationColumns, rulesByName);

  status.textContent = "";

  saveBtn.onclick = async () => {
    try {
      status.textContent = "Saving rules...";

      const rules = serialize(host);

      await saveRules(rules);

      if (getRun()) {
        clearRun();
        alert(
          "Global OCR rules updated.\n\n" +
          "Any active OCR run was stopped.\n" +
          "Please restart OCR."
        );
      }

      status.textContent = "Rules saved";
    } catch (e) {
      status.textContent = "Error: " + e.message;
    }
  };
}

/* ---------------- RENDER ---------------- */

function render(host, columns, rules) {
  host.innerHTML = "";

  columns.forEach((col, index) => {
    const rule = rules[col.name] || {
      type: "none",
      strictCase: false,
      allowEmpty: false,
      config: null
    };

    const row = document.createElement("div");
    row.dataset.colName = col.name;
    row.style.display = "grid";
    row.style.gridTemplateColumns = "180px 140px 1fr 160px";
    row.style.gap = "8px";
    row.style.marginBottom = "14px";

    // ---- Column name ----
    const name = document.createElement("div");
    name.innerHTML =
      `<b>${escape(col.name)}</b>` +
      (index === 0 ? " <span style='color:#666'>(Date)</span>" : "");

    // ---- Rule type ----
    const select = document.createElement("select");
    ["none", "format", "enum"].forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      if (rule.type === t) opt.selected = true;
      select.appendChild(opt);
    });

    // ---- Config textarea ----
    const textarea = document.createElement("textarea");
    textarea.rows = 4;
    textarea.style.width = "100%";

    if (rule.type === "format") {
      textarea.value = (rule.config?.formats || []).join("\n");
    }
    if (rule.type === "enum") {
      textarea.value = (rule.config?.values || []).join("\n");
    }

    textarea.disabled = rule.type === "none";

    // ---- Flags ----
    const flags = document.createElement("div");
    flags.style.display = "flex";
    flags.style.flexDirection = "column";
    flags.style.gap = "4px";

    const strictCaseCb = checkbox(
      "Strict case",
      !!rule.strictCase
    );

    const allowEmptyCb = checkbox(
      "Allow empty",
      !!rule.allowEmpty
    );

    flags.appendChild(strictCaseCb.label);
    flags.appendChild(allowEmptyCb.label);

    // ---- Interactions ----
    select.onchange = () => {
      textarea.disabled = select.value === "none";
      textarea.value = "";
    };

    if (index === 0) {
      select.disabled = true;
      textarea.disabled = true;
      strictCaseCb.input.disabled = true;
      allowEmptyCb.input.disabled = true;
    }

    row.appendChild(name);
    row.appendChild(select);
    row.appendChild(textarea);
    row.appendChild(flags);

    host.appendChild(row);
  });
}

/* ---------------- SERIALIZE ---------------- */

function serialize(host) {
  const out = {};

  host.querySelectorAll("[data-col-name]").forEach(row => {
    const name = row.dataset.colName;
    const type = row.children[1].value;
    const textarea = row.children[2];
    const flags = row.children[3];

    const strictCase =
      flags.querySelector("input[name=strictCase]")?.checked || false;

    const allowEmpty =
      flags.querySelector("input[name=allowEmpty]")?.checked || false;

    if (type === "none") return;

    const text = textarea.value.trim();

    if (type === "format") {
      out[name] = {
        type: "format",
        strictCase,
        allowEmpty,
        config: {
          formats: text
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean)
        }
      };
    }

    if (type === "enum") {
      out[name] = {
        type: "enum",
        strictCase,
        allowEmpty,
        config: {
          values: text
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean)
        }
      };
    }
  });

  return out;
}

/* ---------------- UTIL ---------------- */

function checkbox(labelText, checked) {
  const label = document.createElement("label");
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "6px";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.name = labelText === "Strict case" ? "strictCase" : "allowEmpty";

  label.appendChild(input);
  label.appendChild(document.createTextNode(labelText));

  return { label, input };
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}