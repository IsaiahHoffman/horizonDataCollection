// ============================================================
// server/ocr/processing/ocrExtractor.js
// ============================================================

import fs from "fs";
import sharp from "sharp";
import { getCalibration } from "../rules/calibrationProxy.js";
import { getOcrWorker } from "../batch/ocrWorkerPool.js";

/**
 * VERY conservative blank detection.
 */
async function isTrulyBlankCell(buffer) {
  const { data } = await sharp(buffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let darkPixels = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 180) darkPixels++;
    if (darkPixels > 10) return false;
  }
  return darkPixels <= 10;
}

/**
 * Detect red background.
 */
async function isRedBackground(buffer) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let redCount = 0;
  const pixelCount = info.width * info.height;

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 150 && r > g + 40 && r > b + 40) {
      redCount++;
    }
  }

  return redCount / pixelCount > 0.2;
}

/**
 * Red preprocessing (unchanged).
 */
async function preprocessRedCell(buffer) {
  return sharp(buffer)
    .extractChannel("red")
    .negate()
    .linear(1.4, -20)
    .png()
    .toBuffer();
}

/**
 * White preprocessing (unchanged).
 */
async function preprocessWhiteCell(buffer) {
  return sharp(buffer)
    .grayscale()
    .png()
    .toBuffer();
}

/**
 * ✅ Detect small dot-like blobs (decimal candidates)
 */
async function detectDecimalDots(buffer) {
  const img = sharp(buffer).grayscale();
  const { data, info } = await img
    .threshold(180)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const visited = new Uint8Array(data.length);
  const dots = [];

  const w = info.width;
  const h = info.height;

  function idx(x, y) {
    return y * w + x;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (visited[i] || data[i] !== 0) continue;

      // flood fill
      let stack = [[x, y]];
      let pixels = [];

      while (stack.length) {
        const [cx, cy] = stack.pop();
        const ci = idx(cx, cy);
        if (
          cx < 0 || cy < 0 || cx >= w || cy >= h ||
          visited[ci] || data[ci] !== 0
        ) continue;

        visited[ci] = 1;
        pixels.push([cx, cy]);

        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
      }

      const area = pixels.length;
      if (area < 3 || area > 25) continue;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const [px, py] of pixels) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;

      if (Math.abs(bw - bh) <= 2) {
        dots.push({
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          area
        });
      }
    }
  }

  return dots;
}

/**
 * OCR extractor.
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

  const cellHeight =
    (tableBottom.y - tableTop.y) / rowsPerScreen;

  const dateStartX = columns[0].startX;
  const lastEndX = Math.max(...columns.map(c => c.endX));
  const scale = meta.width / (lastEndX - dateStartX);

  const worker = getOcrWorker();
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
        .extract({ left, top, width, height })
        .png()
        .toBuffer();

      if (await isTrulyBlankCell(cellImageBuffer)) {
        rowCells.push({
          value: "",
          cellImageBuffer
        });
        continue;
      }

      let ocrBuffer;
      if (await isRedBackground(cellImageBuffer)) {
        ocrBuffer = await preprocessRedCell(cellImageBuffer);
      } else {
        ocrBuffer = await preprocessWhiteCell(cellImageBuffer);
      }

      const {
        data: { text }
      } = await worker.recognize(ocrBuffer);

      let value = text.trim();

      // ✅ EXPERIMENTAL: attach decimal if dot detected
      if (/^\d{2,4}$/.test(value)) {
        const dots = await detectDecimalDots(cellImageBuffer);
        if (
          dots.length === 1 &&
          dots[0].y > height * 0.6
        ) {
          value =
            value.slice(0, -1) + "." + value.slice(-1);
        }
      }

      rowCells.push({
        value,
        cellImageBuffer
      });
    }

    rows.push(rowCells);
  }

  return rows;
}