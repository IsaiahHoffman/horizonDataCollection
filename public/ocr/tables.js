// ============================================================
// public/ocr/tables.js
// Table/animal dropdown loading + helpers
// ============================================================

import { fetchJSON } from "./api.js";

export function getSelectedTable() {
  return document.getElementById("tableSelect").value;
}

export async function loadTables() {
  const data = await fetchJSON("/ocr-debug/tables");
  const sel = document.getElementById("tableSelect");
  sel.innerHTML = "";

  for (const t of data.tables || []) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  }
}