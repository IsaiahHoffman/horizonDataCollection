// ============================================================
// server/automation.js
// Handles: mouse clicks, key presses, typing, settings OCR
// ============================================================

import robot from "robotjs";
import pkg from "pngjs";
import Tesseract from "tesseract.js";

const { PNG } = pkg;

/* ---------------------------------------------
   Capture helper (same as capture.js)
--------------------------------------------- */
async function bufferFromCapture(x, y, w, h) {
  const cap = robot.screen.capture(x, y, w, h);
  const png = new PNG({ width: w, height: h });

  const src = cap.image;
  const bpp = cap.bytesPerPixel;

  for (let yy = 0; yy < h; yy++) {
    const rowStart = yy * cap.byteWidth;
    for (let xx = 0; xx < w; xx++) {
      const i = rowStart + xx * bpp;
      const n = (yy * w + xx) * 4;

      png.data[n]     = src[i + 2]; // r
      png.data[n + 1] = src[i + 1]; // g
      png.data[n + 2] = src[i];     // b
      png.data[n + 3] = src[i + 3]; // a
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
   REGISTER ROUTES
--------------------------------------------- */
export function registerAutomationRoutes(app, { getCalibration, SCREEN_SCALE }) {

  // ------------------------------------------------------------
  // CLICK POINT
  // ------------------------------------------------------------
  app.post("/click-point", (req, res) => {
    const { x, y } = req.body || {};

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    try {
      robot.moveMouse(x, y);
      robot.mouseClick();
      res.json({ success: true });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });


  // ------------------------------------------------------------
  // PRESS KEY
  // ------------------------------------------------------------
  app.post("/press-key", (req, res) => {
    const { key, ctrl } = req.body || {};

    if (!key) {
      return res.status(400).json({ error: "Missing key parameter" });
    }

    try {
      if (ctrl) robot.keyTap(key, "control");
      else robot.keyTap(key);

      res.json({ success: true });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });


  // ------------------------------------------------------------
  // TYPE TEXT
  // ------------------------------------------------------------
  app.post("/type-text", (req, res) => {
    const { text } = req.body || {};

    if (typeof text !== "string") {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    try {
      robot.typeString(text);
      res.json({ success: true });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });


  // ------------------------------------------------------------
  // OCR CHECK SETTINGS LOADED
  // Extracts text inside the configured settings bounding box
  // ------------------------------------------------------------
  app.get("/check-settings-loaded", async (req, res) => {
    try {
      const calibration = getCalibration();
      const tl = calibration.settingsBoxTopLeft;
      const br = calibration.settingsBoxBottomRight;

      if (!tl || !br) {
        return res.status(400).json({ error: "Settings bounding box not calibrated" });
      }

      const x1 = Math.min(tl.x, br.x);
      const y1 = Math.min(tl.y, br.y);
      const x2 = Math.max(tl.x, br.x);
      const y2 = Math.max(tl.y, br.y);

      const w = x2 - x1;
      const h = y2 - y1;

      if (w <= 0 || h <= 0) {
        return res.status(400).json({ error: "Invalid bounding box dimensions" });
      }

      const buf = await bufferFromCapture(
        Math.round(x1 * SCREEN_SCALE),
        Math.round(y1 * SCREEN_SCALE),
        Math.round(w * SCREEN_SCALE),
        Math.round(h * SCREEN_SCALE)
      );

      const result = await Tesseract.recognize(buf, "eng");
      const raw = result?.data?.text || "";
      const oneLine = raw.replace(/\s+/g, " ").trim();

      const lower = oneLine.toLowerCase();
      const isLoaded =
        lower.includes("settings") ||
        lower.includes("filter") ||
        lower.includes("date");

      res.json({ success: true, isLoaded, text: oneLine });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

}