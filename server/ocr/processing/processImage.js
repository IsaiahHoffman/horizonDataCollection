// server/ocr/processing/processImage.js

import { processRow } from "./processRow.js";

/**
 * Process ALL rows in one image (file scope).
 *
 * Rules:
 * - Rows are processed top → bottom
 * - Empty date cell ends the file
 * - Issues do NOT stop the file
 * - Rows are OCR'd once only
 */
export async function processImage({
  PHOTOS_DIR,
  animalId,
  imageName,
  ocrRows,
  rules
}) {
  if (!Array.isArray(ocrRows)) return;

  for (let rowIndex = 0; rowIndex < ocrRows.length; rowIndex++) {
    const cells = ocrRows[rowIndex];
    if (!cells || cells.length === 0) continue;

    const result = await processRow({
      PHOTOS_DIR,
      animalId,
      imageName,
      rowIndex,
      cells,
      rules
    });

    // ✅ End of table when Date is empty
    if (result?.done) {
      break;
    }

    // ✅ Issues do NOT block further rows
    // ✅ Draft rows are handled internally
    // ✅ Valid rows are saved internally
  }
}