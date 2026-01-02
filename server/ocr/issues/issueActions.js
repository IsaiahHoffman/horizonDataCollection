// server/ocr/issues/issueActions.js

import fs from "fs";
import path from "path";
import { validateCell } from "../rules/ruleEngine.js";
import { removeIssue } from "./issueStore.js";
import {
  loadDraft,
  deleteDraft
} from "../drafts/draftStore.js";
import { saveRowIfNewDate } from "../processing/dedupe.js";

/**
 * Override an issue (non-date only).
 */
export async function overrideIssue({
  PHOTOS_DIR,
  issue,
  newValue
}) {
  if (issue.columnIndex === 0) {
    throw new Error("Date column cannot be overridden");
  }

  await resolveNonDateIssue({
    PHOTOS_DIR,
    issue,
    newValue
  });
}

/**
 * Recheck an issue (validated).
 */
export async function recheckIssue({
  PHOTOS_DIR,
  issue,
  newValue,
  rules
}) {
  // ✅ DATE ISSUE
  if (issue.columnIndex === 0) {
    // EOF case
    if (!newValue || !newValue.trim()) {
      await removeIssue(PHOTOS_DIR, issue.animalId, issue.id);
      return;
    }

    const res = validateCell({
      value: newValue,
      columnIndex: 0,
      rules
    });

    if (!res.ok) {
      throw new Error(res.reason);
    }

    await saveRowIfNewDate(
      PHOTOS_DIR,
      issue.animalId,
      [{ value: newValue }]
    );

    await removeIssue(PHOTOS_DIR, issue.animalId, issue.id);
    return;
  }

  // ✅ NON-DATE ISSUE
  const res = validateCell({
    value: newValue,
    columnIndex: issue.columnIndex,
    rules
  });

  if (!res.ok) {
    throw new Error(res.reason);
  }

  await resolveNonDateIssue({
    PHOTOS_DIR,
    issue,
    newValue
  });
}

/**
 * Resolve non-date issues using drafts.
 */
async function resolveNonDateIssue({
  PHOTOS_DIR,
  issue,
  newValue
}) {
  const draft = loadDraft(
    PHOTOS_DIR,
    issue.animalId,
    issue.draftId
  );

  if (!draft) {
    throw new Error("Draft not found for issue");
  }

  draft.cells[issue.columnIndex] = newValue;

  await removeIssue(
    PHOTOS_DIR,
    issue.animalId,
    issue.id
  );

  const dir = path.join(
    PHOTOS_DIR,
    issue.animalId,
    "issues"
  );

  let remainingForDraft = false;

  if (fs.existsSync(dir)) {
    const ids = fs.readdirSync(dir);
    for (const id of ids) {
      const p = path.join(dir, id, "issue.json");
      if (!fs.existsSync(p)) continue;

      const other = JSON.parse(
        fs.readFileSync(p, "utf8")
      );

      if (other.draftId === issue.draftId) {
        remainingForDraft = true;
        break;
      }
    }
  }

  if (!remainingForDraft) {
    await saveRowIfNewDate(
      PHOTOS_DIR,
      issue.animalId,
      draft.cells.map(v => ({ value: v }))
    );

    deleteDraft(
      PHOTOS_DIR,
      issue.animalId,
      issue.draftId
    );
  }
}