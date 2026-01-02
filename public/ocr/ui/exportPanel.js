// public/ocr/ui/exportPanel.js

import { onRunChange, getRun } from "../state/runState.js";
import { requestJSON } from "../api/client.js";

let pollTimer = null;

export function initExportPanel() {
  const host = document.getElementById("exportPanel");

  host.innerHTML = `
    <div id="exportStatus" style="color:#666;">
      No export available.
    </div>
  `;

  onRunChange(run => {
    render(run);
    maybeStartPolling(run);
  });
}

function maybeStartPolling(run) {
  if (!run) return;

  // ✅ Start polling once run is done
  if (run.status === "done") {
    if (pollTimer) return;

    pollTimer = setInterval(async () => {
      try {
        const res = await requestJSON(
          "/ocr/export/try",
          { method: "POST" }
        );

        if (res.exportPath) {
          const currentRun = getRun();
          if (currentRun) {
            currentRun.exportPath = res.exportPath;
          }

          clearInterval(pollTimer);
          pollTimer = null;
          render(getRun());
        }
      } catch (e) {
        console.error("export poll error", e);
      }
    }, 1500);
  }
}

function render(run) {
  const el = document.getElementById("exportStatus");
  if (!el) return;

  if (!run) {
    el.textContent = "No export available.";
    return;
  }

  if (run.exportPath) {
    el.innerHTML = `
      <div style="color:#080;">
        ✅ <b>Export ready</b>
      </div>
      <div style="margin-top:6px;font-family:monospace;font-size:12px;">
        ${escape(run.exportPath)}
      </div>
    `;
    return;
  }

  if (run.status === "running" || run.status === "stopping") {
    el.textContent =
      "OCR in progress. Export will be available when complete.";
    return;
  }

  if (run.status === "done") {
    el.textContent =
      "Scan complete. Waiting for issues to be resolved…";
    return;
  }

  if (run.status === "error") {
    el.textContent =
      "OCR failed. Export not available.";
    return;
  }

  if (run.status === "stopped") {
    el.textContent =
      "OCR stopped. Export not available.";
    return;
  }

  el.textContent = "No export available.";
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}