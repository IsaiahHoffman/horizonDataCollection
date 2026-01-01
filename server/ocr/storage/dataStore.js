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