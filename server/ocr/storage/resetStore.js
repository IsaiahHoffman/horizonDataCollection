// server/ocr/storage/resetStore.js

import fs from "fs";
import path from "path";

/**
 * Deletes OCR output for ONE animal.
 */
export function resetAnimal(PHOTOS_DIR, animalId) {
  const base = path.join(PHOTOS_DIR, animalId);

  const dataFile = path.join(base, "data.json");
  const issuesDir = path.join(base, "issues");
  const draftsDir = path.join(base, "drafts");

  if (fs.existsSync(dataFile)) {
    fs.unlinkSync(dataFile);
  }

  if (fs.existsSync(issuesDir)) {
    fs.rmSync(issuesDir, { recursive: true, force: true });
  }

  if (fs.existsSync(draftsDir)) {
    fs.rmSync(draftsDir, { recursive: true, force: true });
  }
}

/**
 * Deletes OCR output for ALL animals.
 */
export function resetAllAnimals(PHOTOS_DIR) {
  if (!fs.existsSync(PHOTOS_DIR)) return;

  const entries = fs.readdirSync(PHOTOS_DIR);

  for (const name of entries) {
    const full = path.join(PHOTOS_DIR, name);
    if (fs.statSync(full).isDirectory()) {
      resetAnimal(PHOTOS_DIR, name);
    }
  }
}

// 🔎 DEBUG – REMOVE LATER
console.log("✅ resetStore.js loaded, exports resetAnimal + resetAllAnimals");