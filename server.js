// ============================================================
// server.js (MAIN SERVER ENTRY)
// ============================================================

import express from "express";
import robot from "robotjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Local modules (UNCHANGED)
import { createCalibrationManager } from "./server/calibration.js";
import { registerAutomationRoutes } from "./server/automation.js";
import { registerCaptureRoutes } from "./server/capture.js";
import { registerTableCheckRoutes } from "./server/tableCheck.js";
import { registerSaveBlockRoutes } from "./server/saveBlock.js";

// ✅ NEW OCR MODULE (rebuilt)
import { registerOcrModule } from "./server/ocr/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const PHOTOS_DIR = path.join(__dirname, "public", "photos");
const SCREEN_SCALE = 1.5;
const SAVE_PATH = path.join(__dirname, "calibration.json");
const RULES_PATH = path.join(__dirname, "ocrRules.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const { getCalibration, setCalibration } = createCalibrationManager(SAVE_PATH);

// --- misc endpoints (UNCHANGED) ---
app.get("/mouse-position", (req, res) =>
  res.json(robot.getMousePos())
);

app.post("/update", (req, res) => {
  const updated = setCalibration(req.body);
  res.json(updated);
});

app.get("/calibration", (req, res) =>
  res.json(getCalibration())
);

// Ensure photos dir exists
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// ================================
// Capture side (UNCHANGED)
// ================================
registerAutomationRoutes(app, { getCalibration, SCREEN_SCALE });
registerCaptureRoutes(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration });
registerTableCheckRoutes(app, { SCREEN_SCALE, getCalibration });
registerSaveBlockRoutes(app, { PHOTOS_DIR });

// ================================
// ✅ OCR side (NEW, CLEAN)
// ================================
registerOcrModule(app, {
  PHOTOS_DIR,
  SCREEN_SCALE,
  getCalibration,
  RULES_PATH
});

// Start server
app.listen(PORT, () => {
  console.log(
    `✅ Server ready → http://localhost:${PORT}\n` +
    `   Capture + OCR enabled\n` +
    `   PHOTOS_DIR=${PHOTOS_DIR}`
  );
});