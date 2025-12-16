// ============================================================
// server/tableCheck.js
// Detects table state: data / no-data / loading
// And extracts LAST CELL date for overflow detection.
// ============================================================

import robot from "robotjs";
import pkg from "pngjs";
import Tesseract from "tesseract.js";

const { PNG } = pkg;

/* ---------------------------------------------
   Helper: capture region → PNG buffer
--------------------------------------------- */
async function captureRegion(x, y, w, h) {
  const cap = robot.screen.capture(x, y, w, h);
  const png = new PNG({ width: w, height: h });

  const src = cap.image;
  const bpp = cap.bytesPerPixel;

  for (let yy = 0; yy < h; yy++) {
    const rs = yy * cap.byteWidth;
    for (let xx = 0; xx < w; xx++) {
      const i = rs + xx * bpp;
      const n = (yy * w + xx) * 4;

      png.data[n] = src[i + 2];
      png.data[n + 1] = src[i + 1];
      png.data[n + 2] = src[i];
      png.data[n + 3] = src[i + 3];
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    png.pack()
      .on("data", c => chunks.push(c))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

/* ---------------------------------------------
   Main route registration
--------------------------------------------- */
export function registerTableCheckRoutes(app, { SCREEN_SCALE, getCalibration }) {

  // ------------------------------------------------------------
  // GET /check-table-state
  // ------------------------------------------------------------
  app.get("/check-table-state", async (req, res) => {
    try {
      const cal = getCalibration();
      const { tableTop, tableBottom, columns, rowsPerScreen, dateStartFieldPoint } = cal;

      if (!tableTop || !tableBottom || !columns?.length || !rowsPerScreen) {
        return res.status(400).json({
          error: "Calibration incomplete (tableTop, tableBottom, columns, rowsPerScreen needed)"
        });
      }

      // DATE COLUMN (first column)
      const col = columns[0];
      if (!Number.isFinite(col.startX) || !Number.isFinite(col.endX)) {
        return res.status(400).json({ error: "First column not calibrated" });
      }

      const x1 = col.startX;
      const x2 = col.endX;
      const width = x2 - x1;

      const topY = tableTop.y;
      const bottomY = tableBottom.y;
      const totalHeight = bottomY - topY;

      // row height from calibration
      const rowHeight = totalHeight / rowsPerScreen;

      const firstTopY = topY;
      const firstBottomY = topY + rowHeight;

      // LAST ROW cell coords:
      const lastTopY = bottomY - rowHeight;
      const lastBottomY = bottomY;

      // Pixel coordinates
      const capFirst = {
        x: Math.round(x1 * SCREEN_SCALE),
        y: Math.round(firstTopY * SCREEN_SCALE),
        w: Math.round(width * SCREEN_SCALE),
        h: Math.round(rowHeight * SCREEN_SCALE)
      };

      const capLast = {
        x: Math.round(x1 * SCREEN_SCALE),
        y: Math.round(lastTopY * SCREEN_SCALE),
        w: Math.round(width * SCREEN_SCALE),
        h: Math.round(rowHeight * SCREEN_SCALE)
      };

      // Capture FIRST cell
      const bufFirst = await captureRegion(capFirst.x, capFirst.y, capFirst.w, capFirst.h);
      const ocrFirst = await Tesseract.recognize(bufFirst, "eng");
      const firstText = (ocrFirst?.data?.text || "").replace(/\s+/g, " ").trim();

      // Check for data
      const firstHasData = firstText.length > 0;

      if (!firstHasData) {
        // Could still be loading, but usually means no-data
        return res.json({
          success: true,
          state: "no-data",
          firstCell: firstText,
          lastCell: ""
        });
      }

      // Capture LAST cell (for overflow)
      const bufLast = await captureRegion(capLast.x, capLast.y, capLast.w, capLast.h);
      const ocrLast = await Tesseract.recognize(bufLast, "eng");
      const lastText = (ocrLast?.data?.text || "").replace(/\s+/g, " ").trim();

      return res.json({
        success: true,
        state: "data",
        firstCell: firstText,
        lastCell: lastText
      });

    } catch (e) {
      console.error("check-table-state error:", e);
      res.status(500).json({ error: e.message });
    }
  });

}