// server/ocr/processing/processRow.js

import crypto from "crypto";
import { validateCell } from "../rules/ruleEngine.js";
import { saveRowIfNewDate } from "./dedupe.js";
import { createIssue } from "../issues/issueStore.js";
import { saveDraft } from "../drafts/draftStore.js";

export async function processRow({
  PHOTOS_DIR,
  animalId,
  imageName,
  rowIndex,
  cells,
  rules
}) {
  const dateRaw = String(cells?.[0]?.value ?? "").trim();
  if (!dateRaw) {
    return { done: true };
  }

  const dateCheck = validateCell({
    value: dateRaw,
    columnIndex: 0,
    rules
  });

  if (!dateCheck.ok) {
    await createIssue({
      PHOTOS_DIR,
      animalId,
      imageName,
      rowIndex,
      columnIndex: 0,
      value: dateRaw,
      reason: dateCheck.reason,
      cellImageBuffer: cells[0]?.cellImageBuffer
    });
    return { issueCreated: true };
  }

  const draftId = crypto.randomUUID();
  const issues = [];

  for (let colIndex = 1; colIndex < cells.length; colIndex++) {
    const cell = cells[colIndex];
    const raw = String(cell?.value ?? "").trim();

    const res = validateCell({
      value: raw,
      columnIndex: colIndex,
      rules
    });

    if (!res.ok) {
      issues.push({
        columnIndex: colIndex,
        value: raw,
        reason: res.reason,
        cellImageBuffer: cell?.cellImageBuffer
      });
    }
  }

  if (issues.length > 0) {
    saveDraft({
      PHOTOS_DIR,
      animalId,
      draftId,
      row: {
        draftId,
        imageName,
        rowIndex,
        cells: cells.map(c => String(c?.value ?? "").trim())
      }
    });

    for (const i of issues) {
      await createIssue({
        PHOTOS_DIR,
        animalId,
        imageName,
        rowIndex,
        columnIndex: i.columnIndex,
        value: i.value,
        reason: i.reason,
        draftId,
        cellImageBuffer: i.cellImageBuffer
      });
    }

    return { draftCreated: true };
  }

  await saveRowIfNewDate(PHOTOS_DIR, animalId, cells);
  return { ok: true };
}