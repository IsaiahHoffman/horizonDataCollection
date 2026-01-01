// server/ocr/export/exporter.js

import fs from "fs";
import path from "path";
import { hasDrafts } from "../drafts/draftStore.js";

/**
 * Load data.json for one animal.
 */
function loadAnimalData(PHOTOS_DIR, animalId) {
  const p = path.join(PHOTOS_DIR, animalId, "data.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8")).rows || [];
}

/**
 * Check if unresolved issues or drafts exist.
 */
function hasBlockingProblems(PHOTOS_DIR, animalId) {
  const issuesDir = path.join(PHOTOS_DIR, animalId, "issues");
  if (fs.existsSync(issuesDir)) {
    const entries = fs.readdirSync(issuesDir);
    if (entries.length > 0) return true;
  }

  return hasDrafts(PHOTOS_DIR, animalId);
}

/**
 * Build export object based on scope.
 */
export function buildExportObject({
  PHOTOS_DIR,
  scope,
  tableId
}) {
  let animals = [];

  if (scope === "row" || scope === "file" || scope === "animal") {
    animals = [tableId];
  } else if (scope === "all") {
    animals = fs
      .readdirSync(PHOTOS_DIR)
      .filter(name =>
        fs.statSync(path.join(PHOTOS_DIR, name)).isDirectory()
      );
  } else {
    throw new Error(`Unknown scope: ${scope}`);
  }

  const result = [];

  for (const animalId of animals) {
    if (hasBlockingProblems(PHOTOS_DIR, animalId)) {
      throw new Error(
        `Unresolved issues or drafts for animal ${animalId}`
      );
    }

    const rows = loadAnimalData(PHOTOS_DIR, animalId);
    result.push({
      animalId,
      rows
    });
  }

  return result;
}

/**
 * Write export file to /exports.
 */
export function writeExportFile(exportData) {
  const exportsDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const filename = `export_${ts}.json`;
  const p = path.join(exportsDir, filename);

  fs.writeFileSync(
    p,
    JSON.stringify(exportData, null, 2)
  );

  return p;
}