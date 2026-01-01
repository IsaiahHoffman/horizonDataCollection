// server/ocr/scopes/allScope.js

import fs from "fs";
import path from "path";
import { runAnimalScope } from "./animalScope.js";

/**
 * All scope:
 * - Scans ALL animal folders
 * - Tracks animal-level and file-level progress
 */
export async function runAllScope(run, deps) {
  const { PHOTOS_DIR } = deps;

  if (!fs.existsSync(PHOTOS_DIR)) {
    throw new Error("PHOTOS_DIR does not exist");
  }

  // ✅ List all animal folders
  const animals = fs
    .readdirSync(PHOTOS_DIR)
    .filter(name =>
      fs.statSync(path.join(PHOTOS_DIR, name)).isDirectory()
    )
    .sort();

  // ✅ Animal-level progress
  run.animalsTotal = animals.length;
  run.animalsProcessed = 0;

  run.updatedAt = Date.now();

  for (const animalId of animals) {
    // ✅ Respect stop
    if (run.stopRequested) {
      run.updatedAt = Date.now();
      return;
    }

    // ✅ Respect pause
    while (run.pauseRequested) {
      await new Promise(r => setTimeout(r, 200));
      if (run.stopRequested) return;
    }

    // ✅ Set current animal
    run.currentAnimal = animalId;
    run.currentFile = null;

    // ✅ Reset file progress for this animal
    run.filesTotal = 0;
    run.filesProcessed = 0;

    run.updatedAt = Date.now();

    // ✅ Run animal scan (this updates filesTotal/filesProcessed internally)
    run.request.tableId = animalId;
    await runAnimalScope(run, deps);

    // ✅ Advance animal progress
    run.animalsProcessed++;
    run.updatedAt = Date.now();
  }
}