// server/ocr/processing/dedupe.js

import fs from "fs";
import path from "path";

/**
 * Ensures the animal output directory exists.
 */
function ensureAnimalDir(PHOTOS_DIR, animalId) {
  const dir = path.join(PHOTOS_DIR, animalId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Loads data.json for an animal, or returns empty structure.
 */
function loadData(PHOTOS_DIR, animalId) {
  const dir = ensureAnimalDir(PHOTOS_DIR, animalId);
  const filePath = path.join(dir, "data.json");

  if (!fs.existsSync(filePath)) {
    return { rows: [] };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Saves data.json for an animal.
 */
function saveData(PHOTOS_DIR, animalId, data) {
  const dir = ensureAnimalDir(PHOTOS_DIR, animalId);
  const filePath = path.join(dir, "data.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Saves a row if its Date value is new.
 * Date is column index 0.
 */
export async function saveRowIfNewDate(PHOTOS_DIR, animalId, cells) {
  if (!Array.isArray(cells) || cells.length === 0) return;

  const data = loadData(PHOTOS_DIR, animalId);

  const row = cells.map(c => String(c?.value ?? "").trim());
  const dateValue = row[0];

  if (!dateValue) return;

  // Deduplicate by Date
  if (data.rows.some(r => r[0] === dateValue)) {
    return;
  }

  data.rows.push(row);
  saveData(PHOTOS_DIR, animalId, data);
}