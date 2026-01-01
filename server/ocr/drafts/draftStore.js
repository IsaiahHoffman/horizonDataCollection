import fs from "fs";
import path from "path";

function draftsDir(PHOTOS_DIR, animalId) {
  return path.join(PHOTOS_DIR, animalId, "drafts");
}

export function saveDraft({
  PHOTOS_DIR,
  animalId,
  draftId,
  row
}) {
  const dir = draftsDir(PHOTOS_DIR, animalId);
  fs.mkdirSync(dir, { recursive: true });

  const p = path.join(dir, `${draftId}.json`);
  fs.writeFileSync(p, JSON.stringify(row, null, 2));
}

export function loadDraft(PHOTOS_DIR, animalId, draftId) {
  const p = path.join(
    draftsDir(PHOTOS_DIR, animalId),
    `${draftId}.json`
  );
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function deleteDraft(PHOTOS_DIR, animalId, draftId) {
  const p = path.join(
    draftsDir(PHOTOS_DIR, animalId),
    `${draftId}.json`
  );
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function hasDrafts(PHOTOS_DIR, animalId) {
  const dir = draftsDir(PHOTOS_DIR, animalId);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).length > 0;
}