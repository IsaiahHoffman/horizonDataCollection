// server/ocr/scopes/rowScope.js

import path from "path";
import { extractOcrRowsFromImage } from "../processing/ocrExtractor.js";
import { processRow } from "../processing/processRow.js";

/**
 * Row scope:
 * - Processes exactly ONE row
 * - OCR validation failures create issues
 * - Run completes normally (status=done)
 * - NEVER throws for OCR validation problems
 */
export async function runRowScope(run, deps) {
  const { tableId, fileName, rowIndex } = run.request;
  const { PHOTOS_DIR } = deps;

  if (!tableId || !fileName || typeof rowIndex !== "number") {
    throw new Error("row scope requires tableId, fileName, rowIndex");
  }

  const imagePath = path.join(PHOTOS_DIR, tableId, fileName);

  run.currentAnimal = tableId;
  run.currentFile = fileName;
  run.updatedAt = Date.now();

  // -----------------------------------------
  // OCR extraction (infrastructure-level)
  // -----------------------------------------
  const ocrRows = await extractOcrRowsFromImage(imagePath);

  const cells = ocrRows[rowIndex];
  if (!cells) {
    // No such row → treat as completed
    return;
  }

  // -----------------------------------------
  // Process the row
  // -----------------------------------------
  const result = await processRow({
    PHOTOS_DIR,
    animalId: tableId,
    imageName: fileName,
    rowIndex,
    cells,
    rules: run.rules
  });

  // If issue created or row saved, row scope is done.
  // DO NOT throw.
  return;
}