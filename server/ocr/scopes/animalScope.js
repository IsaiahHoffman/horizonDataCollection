// server/ocr/scopes/animalScope.js

import path from "path";
import fs from "fs";
import { extractOcrRowsFromImage } from "../processing/ocrExtractor.js";
import { processImage } from "../processing/processImage.js";

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

  // ✅ Get all image files
  const files = fs
    .readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort();

  run.currentAnimal = tableId;
  run.filesTotal = files.length;
  run.filesProcessed = 0;
  run.updatedAt = Date.now();

  for (const fileName of files) {
    // ✅ Respect stop
    if (run.stopRequested) {
      run.updatedAt = Date.now();
      return;
    }

    // ✅ Respect pause
    while (run.pauseRequested) {
      await new Promise(r => setTimeout(r, 200));
      if (run.stopRequested) return;
    }

    run.currentFile = fileName;
    run.updatedAt = Date.now();

    const imagePath = path.join(folder, fileName);

    // ✅ OCR the image
    const ocrRows = await extractOcrRowsFromImage(imagePath);

    // ✅ Process all rows in the image
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
}