// server/ocr/processing/ocrExtractor.js

import fs from "fs";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { getCalibration } from "../rules/calibrationProxy.js";

/**
 * OCR extractor for table-only images.
 * Calibration is in logical (app) pixels.
 * Image is in physical pixels (DPI-scaled).
 */
export async function extractOcrRowsFromImage(imagePath) {
  const {
    tableTop,
    tableBottom,
    columns,
    rowsPerScreen
  } = getCalibration();

  const imageBuffer = fs.readFileSync(imagePath);
  const image = sharp(imageBuffer);
  const meta = await image.metadata();

  // --- Calibration-based cell height (logical)
  const cellHeight =
    (tableBottom.y - tableTop.y) / rowsPerScreen;

  // --- Date column defines X origin (logical)
  const dateStartX = columns[0].startX;
  const lastEndX = Math.max(...columns.map(c => c.endX));

  // --- DPI scale (physical / logical)
  const tableWidthLogical = lastEndX - dateStartX;
  const scale = meta.width / tableWidthLogical;

  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist:
      "0123456789.:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz "
  });

  const rows = [];

  for (let rowIndex = 0; rowIndex < rowsPerScreen; rowIndex++) {
    const top = Math.round(rowIndex * cellHeight * scale);
    const height = Math.round(cellHeight * scale);

    const rowCells = [];

    for (const col of columns) {
      const left = Math.round(
        (col.startX - dateStartX) * scale
      );
      const width = Math.round(
        (col.endX - col.startX) * scale
      );

      if (
        left < 0 ||
        top < 0 ||
        left + width > meta.width ||
        top + height > meta.height
      ) {
        rowCells.push({ value: "", cellImageBuffer: null });
        continue;
      }

      const cellImageBuffer = await image
        .clone()
        .extract({
          left,
          top,
          width,
          height
        })
        .png()
        .toBuffer();

      const {
        data: { text }
      } = await worker.recognize(cellImageBuffer);

      rowCells.push({
        value: text.replace(/\s+/g, " ").trim(),
        cellImageBuffer
      });
    }

    rows.push(rowCells);
  }

  await worker.terminate();
  return rows;
}