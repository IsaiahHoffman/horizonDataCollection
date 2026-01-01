// server/ocr/rules/ruleLoader.js

import fs from "fs";
import path from "path";
import { getCalibration } from "./calibrationProxy.js";

export function loadOcrRules() {
  const RULES_PATH = path.join(process.cwd(), "ocrRules.json");

  if (!fs.existsSync(RULES_PATH)) {
    throw new Error("ocrRules.json not found");
  }

  const calibration = getCalibration();
  const calibrationColumns = calibration.columns;

  const raw = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
  const rulesByName = raw.rules || {};

  const resolvedColumns = calibrationColumns.map((col, index) => {
    const rule = rulesByName[col.name];

    if (!rule) {
      return {
        index,
        name: col.name,
        type: "none",
        strictCase: false,
        allowEmpty: false,
        config: null
      };
    }

    return {
      index,
      name: col.name,
      type: rule.type || "none",
      strictCase: !!rule.strictCase,
      allowEmpty: !!rule.allowEmpty,
      config: rule.config || null
    };
  });

  return {
    columns: resolvedColumns
  };
}