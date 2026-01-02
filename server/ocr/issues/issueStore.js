// server/ocr/issues/issueStore.js

import fs from "fs";
import path from "path";
import crypto from "crypto";

function issuesDir(PHOTOS_DIR, animalId) {
  return path.join(PHOTOS_DIR, animalId, "issues");
}

function issueDir(PHOTOS_DIR, animalId, issueId) {
  return path.join(issuesDir(PHOTOS_DIR, animalId), issueId);
}

export async function createIssue({
  PHOTOS_DIR,
  animalId,
  imageName,
  rowIndex,
  columnIndex,
  value,
  reason,
  draftId,
  cellImageBuffer = null
}) {
  const id = crypto.randomUUID();
  const dir = issueDir(PHOTOS_DIR, animalId, id);

  fs.mkdirSync(dir, { recursive: true });

  const issue = {
    id,
    animalId,
    imageName,
    rowIndex,
    columnIndex,
    value,
    reason,
    draftId,
    createdAt: Date.now()
  };

  fs.writeFileSync(
    path.join(dir, "issue.json"),
    JSON.stringify(issue, null, 2)
  );

  if (cellImageBuffer) {
    fs.writeFileSync(
      path.join(dir, "cell.png"),
      cellImageBuffer
    );
  }
}

export async function loadAllIssues(PHOTOS_DIR) {
  if (!fs.existsSync(PHOTOS_DIR)) return [];

  const animals = fs.readdirSync(PHOTOS_DIR);
  const result = [];

  for (const animalId of animals) {
    const dir = issuesDir(PHOTOS_DIR, animalId);
    if (!fs.existsSync(dir)) continue;

    const issueIds = fs.readdirSync(dir);
    for (const id of issueIds) {
      const p = path.join(dir, id, "issue.json");
      if (!fs.existsSync(p)) continue;

      const issue = JSON.parse(fs.readFileSync(p, "utf8"));
      result.push(issue);
    }
  }

  return result;
}

export async function removeIssue(PHOTOS_DIR, animalId, issueId) {
  const dir = issueDir(PHOTOS_DIR, animalId, issueId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function countIssues(PHOTOS_DIR, animalId = null) {
  if (!fs.existsSync(PHOTOS_DIR)) return 0;

  let count = 0;

  const animals = animalId
    ? [animalId]
    : fs.readdirSync(PHOTOS_DIR).filter(a =>
        fs.statSync(path.join(PHOTOS_DIR, a)).isDirectory()
      );

  for (const a of animals) {
    const dir = issuesDir(PHOTOS_DIR, a);
    if (!fs.existsSync(dir)) continue;
    count += fs.readdirSync(dir).length;
  }

  return count;
}