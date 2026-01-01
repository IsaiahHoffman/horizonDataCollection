// server/ocr/export/exportManager.js

import fs from "fs";
import path from "path";
import {
  buildExportObject,
  writeExportFile
} from "./exporter.js";
import { hasDrafts } from "../drafts/draftStore.js";

function hasIssues(PHOTOS_DIR, animalId) {
  const dir = path.join(PHOTOS_DIR, animalId, "issues");
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

/**
 * Attempt to generate export if run is complete and clean.
 * Safe to call many times.
 */
export function tryGenerateExport(run, deps) {
  if (!run || run.status !== "done") return;
  if (run.exportPath) return;

  const { PHOTOS_DIR } = deps;

  const animals =
    run.scope === "all"
      ? fs
          .readdirSync(PHOTOS_DIR)
          .filter(name =>
            fs.statSync(path.join(PHOTOS_DIR, name)).isDirectory()
          )
      : [run.request.tableId];

  for (const animalId of animals) {
    if (
      hasIssues(PHOTOS_DIR, animalId) ||
      hasDrafts(PHOTOS_DIR, animalId)
    ) {
      return;
    }
  }

  const exportData = buildExportObject({
    PHOTOS_DIR,
    scope: run.scope,
    tableId: run.request.tableId
  });

  run.exportPath = writeExportFile(exportData);
}