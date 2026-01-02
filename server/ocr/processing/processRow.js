// ============================================================
// server/ocr/processing/processRow.js
// ============================================================

import crypto from "crypto";
import { validateCell } from "../rules/ruleEngine.js";
import { saveRowIfNewDate } from "./dedupe.js";
import { createIssue } from "../issues/issueStore.js";
import { saveDraft } from "../drafts/draftStore.js";

/**
 * Expand a format containing (a|b|c) groups into all combinations.
 * Example: (nn|n).n → ["nn.n", "n.n"]
 */
function expandFormat(format) {
  // ✅ FIXED REGEX
  const rx = /$([^()]+)$/;

  let formats = [format];

  while (formats.some(f => rx.test(f))) {
    const next = [];

    for (const f of formats) {
      const m = f.match(rx);
      if (!m) {
        next.push(f);
        continue;
      }

      const [group, body] = m;
      const options = body.split("|");

      for (const opt of options) {
        next.push(f.replace(group, opt));
      }
    }

    formats = next;
  }

  return formats;
}

/**
 * Try to rebuild value from digits using a specific format.
 */
function rebuildFromFormat(raw, format) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const expectedDigits = (format.match(/n/g) || []).length;
  if (digits.length !== expectedDigits) return null;

  let out = "";
  let di = 0;

  for (const ch of format) {
    if (ch === "n") {
      out += digits[di++] ?? "";
    } else {
      out += ch;
    }
  }

  return out;
}

/**
 * Suppress obvious OCR junk like oo / II for numeric columns.
 */
function suppressNumericJunk(raw) {
  if (!raw) return raw;

  const v = raw.trim();
  if (!/\d/.test(v) && /^[oOIl]+$/.test(v)) {
    return "";
  }
  return raw;
}

export async function processRow({
  PHOTOS_DIR,
  animalId,
  imageName,
  rowIndex,
  cells,
  rules
}) {
  // --------------------------------------------------
  // DATE COLUMN (INDEX 0)
  // --------------------------------------------------
  let dateRaw = String(cells?.[0]?.value ?? "").trim();

  // Fix rare missing space between date and time
  if (
    /^\d{1,2}\.\d{1,2}\.\d{4}\d{1,2}:\d{2}$/.test(dateRaw)
  ) {
    dateRaw = dateRaw.replace(
      /^(\d{1,2}\.\d{1,2}\.\d{4})(\d{1,2}:\d{2})$/,
      "$1 $2"
    );
  }

  if (!dateRaw) return { done: true };

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

  cells[0].value = dateRaw;

  const draftId = crypto.randomUUID();
  const issues = [];

  // --------------------------------------------------
  // PROCESS NON-DATE CELLS
  // --------------------------------------------------
  for (let colIndex = 1; colIndex < cells.length; colIndex++) {
    const cell = cells[colIndex];
    let raw = String(cell?.value ?? "").trim();

    const colRule = rules?.columns?.[colIndex];

    // Suppress junk first
    if (colRule?.type === "format") {
      raw = suppressNumericJunk(raw);
    }

    // ✅ Initial validation
    let res = validateCell({
      value: raw,
      columnIndex: colIndex,
      rules
    });

    let finalValue = raw;

    // ✅ CHANGE 2:
    // Attempt recovery if invalid OR digits-only
    if (
      colRule?.type === "format" &&
      (!res.ok || /^[0-9]+$/.test(raw))
    ) {
      const baseFormats = colRule.config?.formats || [];
      const expandedFormats = baseFormats.flatMap(expandFormat);

      for (const fmt of expandedFormats) {
        const rebuilt = rebuildFromFormat(raw, fmt);
        if (!rebuilt) continue;

        const retry = validateCell({
          value: rebuilt,
          columnIndex: colIndex,
          rules
        });

        if (retry.ok) {
          finalValue = rebuilt;
          res = retry;
          break;
        }
      }
    }

    if (!res.ok) {
      issues.push({
        columnIndex: colIndex,
        value: finalValue,
        reason: res.reason,
        cellImageBuffer: cell?.cellImageBuffer
      });
    } else {
      cells[colIndex].value = finalValue;
    }
  }

  // --------------------------------------------------
  // HANDLE ISSUES / SAVE
  // --------------------------------------------------
  if (issues.length > 0) {
    saveDraft({
      PHOTOS_DIR,
      animalId,
      draftId,
      row: {
        draftId,
        imageName,
        rowIndex,
        cells: cells.map(c =>
          String(c?.value ?? "").trim()
        )
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