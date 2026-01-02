// ============================================================
// server/ocr/scopes/fileScope.js
// ============================================================

import path from "path";
import fs from "fs";
import { extractOcrRowsFromImage } from "../processing/ocrExtractor.js";
import { processImage } from "../processing/processImage.js";

/**
 * File scope:
 * - OCRs one image file
 * - Processes all rows in that file
 */
export async function runFileScope(run, deps) {
  const { tableId, fileName } = run.request;
  const { PHOTOS_DIR } = deps;

  if (!tableId || !fileName) {
    throw new Error("file scope requires tableId and fileName");
  }

  const imagePath = path.join(PHOTOS_DIR, tableId, fileName);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  // ✅ Explicit progress initialization
  run.currentAnimal = tableId;
  run.currentFile = fileName;
  run.filesTotal = 1;
  run.filesProcessed = 0;
  run.updatedAt = Date.now();

  // ✅ OCR the image
  const ocrRows = await extractOcrRowsFromImage(imagePath);

  // ✅ Process all rows
  await processImage({
    PHOTOS_DIR,
    animalId: tableId,
    imageName: fileName,
    ocrRows,
    rules: run.rules
  });

  run.filesProcessed = 1;
  run.updatedAt = Date.now();
}