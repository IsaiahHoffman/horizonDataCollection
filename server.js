// ============================================================
// server.js  (MAIN SERVER ENTRY)
// FIX: pass RULES_PATH into registerOcrDebugRoutes so it can read ocrRules.json
// ============================================================

import express from "express";
import robot from "robotjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Local modules
import { createCalibrationManager } from "./server/calibration.js";
import { registerAutomationRoutes } from "./server/automation.js";
import { registerCaptureRoutes } from "./server/capture.js";
import { registerTableCheckRoutes } from "./server/tableCheck.js";
import { registerSaveBlockRoutes } from "./server/saveBlock.js";

import { registerOcrModule } from "./server/ocr/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const PHOTOS_DIR = path.join(__dirname, "public", "photos");
const SCREEN_SCALE = 1.5;

const SAVE_PATH = path.join(__dirname, "calibration.json");

// Global OCR rules file (separate from calibration.json)
const RULES_PATH = path.join(__dirname, "ocrRules.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const { getCalibration, setCalibration } = createCalibrationManager(SAVE_PATH);

app.get("/mouse-position", (req, res) => res.json(robot.getMousePos()));

app.post("/update", (req, res) => {
  const updated = setCalibration(req.body);
  res.json(updated);
});

app.get("/calibration", (req, res) => res.json(getCalibration()));

fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// Routes
registerAutomationRoutes(app, { getCalibration, SCREEN_SCALE });

registerCaptureRoutes(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration });

registerTableCheckRoutes(app, { SCREEN_SCALE, getCalibration });

registerSaveBlockRoutes(app, { PHOTOS_DIR });

registerOcrModule(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH });

app.listen(PORT, () =>
  console.log(
    `✅ Server ready → http://localhost:${PORT} (scale=${SCREEN_SCALE}, dir=${__dirname})`
  )
);