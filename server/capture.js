// ============================================================
// server/capture.js
// Capture table image (ONE SCREEN ONLY) and title area
// ============================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import robot from "robotjs";
import pkg from "pngjs";
import Tesseract from "tesseract.js";

const { PNG } = pkg;

/* ---------------------------------------------
   Convert RobotJS screenshot → PNG buffer
--------------------------------------------- */
async function bufferFromCapture(x, y, w, h) {
  let cap;
  try {
    cap = robot.screen.capture(x, y, w, h);
  } catch (err) {
    console.error("robot.screen.capture error:", err);
    throw err;
  }

  const png = new PNG({ width: w, height: h });
  const src = cap.image;
  const bpp = cap.bytesPerPixel;

  try {
    for (let yy = 0; yy < h; yy++) {
      const rowStart = yy * cap.byteWidth;
      for (let xx = 0; xx < w; xx++) {
        const i = rowStart + xx * bpp;

        const b = src[i];
        const g = src[i + 1];
        const r = src[i + 2];
        const a = src[i + 3];

        const idx = (yy * w + xx) * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  } catch (err) {
    console.error("Error copying PNG pixels:", err);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    png
      .pack()
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

/* ---------------------------------------------
   OCR TITLE AREA (Title → table number)
--------------------------------------------- */
async function captureTitleAndOcr({ PHOTOS_DIR, SCREEN_SCALE, getCalibration }) {
  const calibration = getCalibration();
  const { titleTopLeft, titleBottomRight } = calibration;

  if (!titleTopLeft || !titleBottomRight) {
    throw new Error("Title area not calibrated");
  }

  const lx = Math.min(titleTopLeft.x, titleBottomRight.x);
  const rx = Math.max(titleTopLeft.x, titleBottomRight.x);
  const ty = Math.min(titleTopLeft.y, titleBottomRight.y);
  const by = Math.max(titleTopLeft.y, titleBottomRight.y);

  const width = rx - lx;
  const height = by - ty;

  if (width <= 0 || height <= 0) {
    throw new Error("Title area has invalid dimensions");
  }

  const px = Math.round(lx * SCREEN_SCALE);
  const py = Math.round(ty * SCREEN_SCALE);
  const pw = Math.round(width * SCREEN_SCALE);
  const ph = Math.round(height * SCREEN_SCALE);

  const capBuffer = await bufferFromCapture(px, py, pw, ph);

  // Save temporarily (debug)
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const tempPath = path.join(PHOTOS_DIR, "title-temp.png");
  fs.writeFileSync(tempPath, capBuffer);

  const result = await Tesseract.recognize(capBuffer, "eng");
  const text = result?.data?.text || "";

  try {
    fs.unlinkSync(tempPath);
  } catch (e) {}

  return { success: true, text };
}

/* ---------------------------------------------
   REGISTER ENDPOINTS
--------------------------------------------- */
export function registerCaptureRoutes(app, {
  PHOTOS_DIR,
  SCREEN_SCALE,
  getCalibration
}) {

  // ------------------------------------------------------------
  // Capture TABLE (exact visible rows only)
  // ------------------------------------------------------------
  app.get("/capture-table", async (req, res) => {
    try {
      const calibration = getCalibration();
      const { tableTop, tableBottom, columns } = calibration;

      if (!tableTop || !tableBottom || !columns.length) {
        return res.status(400).json({
          error: "Calibration incomplete (tableTop, tableBottom, columns required)"
        });
      }

      // Compute table capture region using FIRST column startX and LAST endX
      const logicalTopY = tableTop.y;
      const logicalBottomY = tableBottom.y;
      const logicalXStart = Math.min(...columns.map(c => c.startX));
      const logicalXEnd   = Math.max(...columns.map(c => c.endX));

      const logicalWidth  = logicalXEnd - logicalXStart;
      const logicalHeight = logicalBottomY - logicalTopY;

      if (logicalWidth <= 0 || logicalHeight <= 0) {
        return res.status(400).json({ error: "Invalid table capture dimensions" });
      }

      const px = Math.round(logicalXStart * SCREEN_SCALE);
      const py = Math.round(logicalTopY   * SCREEN_SCALE);
      const pw = Math.round(logicalWidth  * SCREEN_SCALE);
      const ph = Math.round(logicalHeight * SCREEN_SCALE);

      const buf = await bufferFromCapture(px, py, pw, ph);

      res.json({
        success: true,
        buffer: buf.toString("base64"),  // client will send to /save-block-image
        width: pw,
        height: ph
      });

    } catch (e) {
      console.error("capture-table error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------
  // Capture TITLE (OCR only)
  // ------------------------------------------------------------
  app.get("/capture-title", async (req, res) => {
    try {
      const data = await captureTitleAndOcr({
        PHOTOS_DIR,
        SCREEN_SCALE,
        getCalibration
      });

      res.json(data);

    } catch (e) {
      console.error("capture-title error:", e);
      res.status(500).json({ error: e.message });
    }
  });

}