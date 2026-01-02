// ============================================================
// server/ocr/scopes/animalScope.js
// ============================================================

import path from "path";
import fs from "fs";
import { extractOcrRowsFromImage } from "../processing/ocrExtractor.js";
import { processImage } from "../processing/processImage.js";
import { runQueue } from "../batch/queue.js";
import { getWorkerCount } from "../batch/concurrency.js";

/**
 * Animal scope:
 * - Scans ALL image files for one animal
 * - Each file is processed fully
 * - Issues do NOT block other files
 */
export async function runAnimalScope(run, deps) {
  const { tableId } = run.request;
  const { PHOTOS_DIR } = deps;

  if (!tableId) {
    throw new Error("animal scope requires tableId");
  }

  const folder = path.join(PHOTOS_DIR, tableId);

  if (!fs.existsSync(folder)) {
    throw new Error(`Animal folder not found: ${folder}`);
  }

  const files = fs
    .readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort();

  run.currentAnimal = tableId;
  run.filesTotal = files.length;
  run.filesProcessed = 0;
  run.updatedAt = Date.now();

  await runQueue({
    items: files,
    workerCount: getWorkerCount(),
    stopRequested: () => run.stopRequested,
    pauseRequested: () => run.pauseRequested,
    onItemStart: () => {
      run.updatedAt = Date.now();
    },
    workerFn: async (fileName) => {
      if (run.stopRequested) return;

      run.currentFile = fileName;
      run.updatedAt = Date.now();

      const imagePath = path.join(folder, fileName);

      const ocrRows = await extractOcrRowsFromImage(imagePath);

      await processImage({
        PHOTOS_DIR,
        animalId: tableId,
        imageName: fileName,
        ocrRows,
        rules: run.rules
      });

      run.filesProcessed++;
      run.updatedAt = Date.now();
    }
  });
}