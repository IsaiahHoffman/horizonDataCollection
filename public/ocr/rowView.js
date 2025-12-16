// ============================================================
// public/ocr/rowView.js
// Renders the OCR cell grid for a single row
// ============================================================

import { escapeHtml } from "./utils.js";

export function renderRow(cells) {
  const box = document.getElementById("rowView");
  box.innerHTML = "";

  for (const c of cells || []) {
    const div = document.createElement("div");
    div.className = "cell";

    const imgSrc = `data:image/png;base64,${c.imgBase64}`;
    const restriction = c.restriction || "none";
    const valid = (typeof c.valid === "boolean") ? c.valid : true;

    const badge = restriction === "none"
      ? `<span style="color:#666;">(no restriction)</span>`
      : valid
        ? `<span style="color:#0a0;">(valid)</span>`
        : `<span style="color:#a00;">(INVALID)</span>`;

    div.innerHTML = `
      <h3>${escapeHtml(c.name)}
        <span style="font-weight:normal;">[${escapeHtml(restriction)}] ${badge}</span>
      </h3>
      <img src="${imgSrc}" alt="${escapeHtml(c.name)}">
      <div class="text"><b>clean:</b> ${escapeHtml(c.text || "")}</div>
      <div class="text" style="margin-top:6px;"><b>raw:</b> ${escapeHtml(c.rawText || "")}</div>
      ${!valid && restriction === "format"
        ? `<div style="margin-top:6px;color:#a00;font-size:12px;"><b>Expected:</b> one of the listed formats</div>`
        : ""}
      ${!valid && restriction === "enum"
        ? `<div style="margin-top:6px;color:#a00;font-size:12px;"><b>Expected:</b> one of the allowed values</div>`
        : ""}
    `;

    box.appendChild(div);
  }
}