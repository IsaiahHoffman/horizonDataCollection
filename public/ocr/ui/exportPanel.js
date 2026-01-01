// public/ocr/ui/exportPanel.js

import { onRunChange } from "../state/runState.js";

export function initExportPanel() {
  const host = document.getElementById("exportPanel");

  host.innerHTML = `
    <div id="exportStatus" style="color:#666;">
      No export available.
    </div>
  `;

  onRunChange(run => {
    render(run);
  });
}

function render(run) {
  const el = document.getElementById("exportStatus");
  if (!el) return;

  if (!run) {
    el.innerHTML = `<div style="color:#666;">No export available.</div>`;
    return;
  }

  if (run.status === "running" || run.status === "stopping") {
    el.innerHTML = `
      <div style="color:#666;">
        OCR in progress. Export will be available when all issues are resolved.
      </div>
    `;
    return;
  }

  if (run.status === "error") {
    el.innerHTML = `
      <div style="color:#a00;">
        OCR failed. No export created.
      </div>
    `;
    return;
  }

  if (run.status === "stopped") {
    el.innerHTML = `
      <div style="color:#a60;">
        OCR was stopped. No export created.
      </div>
    `;
    return;
  }

  if (run.status === "done") {
    if (run.exportPath) {
      el.innerHTML = `
        <div style="color:#080;">
          ✅ <b>Export created</b>
        </div>
        <div style="margin-top:6px;font-family:monospace;font-size:12px;">
          ${escape(run.exportPath)}
        </div>
        <div style="margin-top:8px;color:#333;">
          All data has been validated and is safe to use.
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="color:#a60;">
          OCR finished, but export was not created.
        </div>
        <div style="margin-top:6px;color:#333;">
          This usually means unresolved issues remain
          or the selected scope does not produce exports.
        </div>
      `;
    }
  }
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}