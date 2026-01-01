// server/ocr/rules/calibrationProxy.js

import fs from "fs";
import path from "path";

const CALIBRATION_PATH = path.join(process.cwd(), "calibration.json");

/**
 * Loads calibration.json.
 * Used by ruleLoader to determine column order.
 */
export function getCalibration() {
  if (!fs.existsSync(CALIBRATION_PATH)) {
    throw new Error("calibration.json not found");
  }

  const raw = fs.readFileSync(CALIBRATION_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.columns)) {
    throw new Error("Invalid calibration.json: columns[] missing");
  }

  return parsed;
}