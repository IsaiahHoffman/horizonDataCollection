// server/ocr/storage/dataStore.js

import fs from "fs";
import path from "path";

function dataPath(PHOTOS_DIR, animalId) {
  return path.join(PHOTOS_DIR, animalId, "data.json");
}

function emptyData() {
  return { rows: [] };
}

export async function loadData(PHOTOS_DIR, animalId) {
  const p = dataPath(PHOTOS_DIR, animalId);
  if (!fs.existsSync(p)) {
    return emptyData();
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export async function saveData(PHOTOS_DIR, animalId, data) {
  const p = dataPath(PHOTOS_DIR, animalId);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export function countDataPoints(PHOTOS_DIR, animalId = null) {
  if (!fs.existsSync(PHOTOS_DIR)) return 0;

  let total = 0;

  const animals = animalId
    ? [animalId]
    : fs.readdirSync(PHOTOS_DIR).filter(a =>
        fs.statSync(path.join(PHOTOS_DIR, a)).isDirectory()
      );

  for (const a of animals) {
    const p = dataPath(PHOTOS_DIR, a);
    if (!fs.existsSync(p)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      const rows = Array.isArray(data.rows) ? data.rows : [];
      for (const row of rows) {
        if (Array.isArray(row)) {
          total += row.length;
        }
      }
    } catch {
      // ignore malformed data.json
    }
  }

  return total;
}