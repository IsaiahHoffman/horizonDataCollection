// ============================================================
// public/ocr/debuggerRun.js
// Implements the Start/Stop "row stepping" OCR debugger loop
// ============================================================

import { fetchJSON } from "./api.js";
import { sleep, setText } from "./utils.js";
import { getSelectedTable } from "./tables.js";
import { renderRow } from "./rowView.js";

let running = false;

export function stopRun() {
  running = false;
  setText("status", "stopped");
}

export async function startRun() {
  running = true;
  setText("status", "running");

  const tableNumber = getSelectedTable();
  const pauseMs = Number(document.getElementById("pauseMs").value || 0);

  let row = 0;

  while (running) {
    setText("status", "fetching row...");
    const data = await fetchJSON(`/ocr-debug/row/${tableNumber}?row=${row}`);

    setText("fileName", data.fileName || "(unknown)");
    setText("rowNum", String(data.rowIndex));
    renderRow(data.cells || []);

    if (data.done) {
      setText("status", `done (${data.reason || "finished"})`);
      running = false;
      break;
    }

    setText("status", `showing row ${row} (pausing ${pauseMs}ms)`);
    await sleep(pauseMs);

    row++;
  }
}