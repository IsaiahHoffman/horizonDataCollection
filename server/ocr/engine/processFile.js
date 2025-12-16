// ============================================================
// server/ocr/engine/processFile.js
// Process a single PNG file row-by-row with strict date-first workflow
//
// UPDATED:
//  - supports maxRows (scope=row does exactly one row)
//  - supports mode="interactive" to STOP immediately when a cell issue is created
//  - supports dateOverrideByRowIndex so date issue corrections can resume properly
// ============================================================

import fs from "fs";
import path from "path";

import {
  compileFormatLine,
  validateByEnumStrict,
  validateByFormats,
  getRestrictionForColumn,
  normalizeOcrText
} from "../rules/ocrRuleEngine.js";

import { decodePng, pngToBuffer, cropPng, clampRect } from "./geometry/crop.js";
import { buildCellRectangles } from "./geometry/rectangles.js";
import { parseDateTimeKeyStrict } from "./parse/dateTimeKey.js";
import { preprocessNumericVariants } from "./preprocess/numericPreprocess.js";
import { ocrOneLineFromBuffer } from "./ocrText.js";
import { mergeRows } from "./storage/dataStore.js";
import { genIssueId, saveIssueCrop } from "./storage/issuesStore.js";

function ruleSnapshotForColumn(rules, colName) {
  const r = rules?.columns?.[colName] || { restriction: "none" };
  const restriction = String(r.restriction || "none").toLowerCase();
  if (restriction === "format") return { restriction, formats: Array.isArray(r.formats) ? r.formats : [] };
  if (restriction === "enum") return { restriction, values: Array.isArray(r.values) ? r.values : [] };
  return { restriction: "none" };
}

function validateCellStrict(text, restrictionInfo) {
  if (restrictionInfo.restriction === "none") return { ok: true };
  if (restrictionInfo.restriction === "enum") return validateByEnumStrict(text, restrictionInfo.values);
  if (restrictionInfo.restriction === "format") return validateByFormats(text, restrictionInfo.formats);
  return { ok: true };
}

function buildWhitelistForFormat(formats) {
  const wl = new Set("0123456789".split(""));
  for (const f of formats) {
    const compiled = compileFormatLine(f);
    for (const ch of compiled.whitelist) wl.add(ch);
  }
  return Array.from(wl).join("");
}

function formatsExpectDecimal(formats) {
  return Array.isArray(formats) && formats.some(f => String(f).includes("."));
}

async function ocrWithDecimalRetry(cropBuf, ruleSnap, whitelist) {
  // pass 1 normal
  const txt1 = await ocrOneLineFromBuffer(cropBuf, { whitelist, psm: "7", numericMode: false });

  if (!(ruleSnap?.restriction === "format" && formatsExpectDecimal(ruleSnap.formats))) return txt1;

  const v1 = validateCellStrict(txt1, ruleSnap);
  if (v1.ok) return txt1;

  // numeric mode on original
  const txt1b = (await ocrOneLineFromBuffer(cropBuf, {
    whitelist: "0123456789.,",
    psm: "8",
    numericMode: true
  })).replaceAll(",", ".");
  const v1b = validateCellStrict(txt1b, ruleSnap);
  if (v1b.ok) return txt1b;

  // preprocessed variants
  const vars = preprocessNumericVariants(cropBuf);
  for (const preBuf of vars) {
    const txt2 = (await ocrOneLineFromBuffer(preBuf, {
      whitelist: "0123456789.,",
      psm: "8",
      numericMode: true
    })).replaceAll(",", ".");
    const v2 = validateCellStrict(txt2, ruleSnap);
    if (v2.ok) return txt2;
  }

  return txt1;
}

export async function processPngFileFromRow({
  folder,
  fileName,
  startRowIndex = 0,
  maxRows = null,
  mode = "batch", // "batch" | "interactive"

  // NEW: allows date corrections to be injected during resume
  // Example: { 12: "2025-01-03 12:05" } (but your actual format is "dd.mm.yyyy HH:MM")
  dateOverrideByRowIndex = null,

  cal,
  SCREEN_SCALE,
  rules,
  dataObj,
  issuesState
}) {
  const imgPath = path.join(folder, fileName);
  const png = decodePng(fs.readFileSync(imgPath));
  const { colRects, rowRects } = buildCellRectangles(cal, SCREEN_SCALE);

  const dateColName = colRects[0]?.name || "Date";
  const dateRule = getRestrictionForColumn(rules, dateColName);
  const dateWhitelist = (dateRule.restriction === "format" && dateRule.formats.length)
    ? buildWhitelistForFormat(dateRule.formats)
    : null;

  let rowsCommitted = 0;
  let rowsDrafted = 0;

  const keyExists = (key) => {
    if (dataObj.rows.some(r => r.key === key)) return true;
    if (issuesState.draftRows && issuesState.draftRows[key]) return true;
    return false;
  };

  const startIdx = Math.max(0, Number(startRowIndex) || 0);
  const endExclusive = (maxRows == null)
    ? rowRects.length
    : Math.min(rowRects.length, startIdx + Math.max(0, Number(maxRows) || 0));

  for (let idx = startIdx; idx < endExclusive; idx++) {
    const rr = rowRects[idx];

    // -----------------------
    // DATE FIRST (with override support)
    // -----------------------
    let dateText = "";

    const hasOverride =
      dateOverrideByRowIndex &&
      Object.prototype.hasOwnProperty.call(dateOverrideByRowIndex, String(idx));

    if (hasOverride) {
      dateText = normalizeOcrText(dateOverrideByRowIndex[String(idx)]);
    } else {
      const dateRect = clampRect(png, colRects[0].x, rr.y, colRects[0].w, rr.h);
      const dateCrop = cropPng(png, dateRect.x, dateRect.y, dateRect.w, dateRect.h);
      const dateBuf = pngToBuffer(dateCrop);

      dateText = await ocrOneLineFromBuffer(dateBuf, { whitelist: dateWhitelist, psm: "7", numericMode: false });
      if (!dateText) break;

      const dateRuleSnap = ruleSnapshotForColumn(rules, dateColName);
      const dateValidByRule = validateCellStrict(dateText, dateRuleSnap);
      const parsed = parseDateTimeKeyStrict(dateText);

      if (!dateValidByRule.ok || !parsed) {
        const issueId = genIssueId();
        const cropPath = saveIssueCrop(folder, issueId, dateBuf);

        issuesState.issues.push({
          id: issueId,
          status: "pending",
          kind: "date",
          ocrValue: dateText,
          columnName: dateColName,
          cropPath,
          source: { fileName, rowIndex: idx, colName: dateColName },
          rule: dateRuleSnap,
          createdAt: Date.now()
        });

        issuesState.blockedFiles[fileName] = { rowIndex: idx, issueId };

        return {
          blocked: true,
          incomplete: true,
          blockedAtRow: idx,
          blockedIssueId: issueId,
          rowsCommitted,
          rowsDrafted
        };
      }

      if (keyExists(parsed.key)) continue;

      // date is valid and unique, proceed to read remaining cells
      const values = { [dateColName]: dateText };
      const invalidCells = [];

      for (let c = 1; c < colRects.length; c++) {
        const col = colRects[c];
        const rect = clampRect(png, col.x, rr.y, col.w, rr.h);
        const crop = cropPng(png, rect.x, rect.y, rect.w, rect.h);
        const cropBuf = pngToBuffer(crop);

        const restriction = getRestrictionForColumn(rules, col.name);
        const whitelist = (restriction.restriction === "format" && restriction.formats.length)
          ? buildWhitelistForFormat(restriction.formats)
          : null;

        const ruleSnap = ruleSnapshotForColumn(rules, col.name);
        const txt = await ocrWithDecimalRetry(cropBuf, ruleSnap, whitelist);

        values[col.name] = txt;

        const v = validateCellStrict(txt, ruleSnap);
        if (!v.ok) invalidCells.push({ colName: col.name, ocrValue: txt, cropBuf, ruleSnap });
      }

      if (invalidCells.length === 0) {
        dataObj.rows = mergeRows(dataObj.rows, [{ key: parsed.key, ts: parsed.ts, values }]);
        rowsCommitted++;
        continue;
      }

      issuesState.draftRows[parsed.key] = {
        key: parsed.key,
        ts: parsed.ts,
        values,
        source: { fileName, rowIndex: idx }
      };

      const firstIssueIndex = issuesState.issues.length;

      for (const bad of invalidCells) {
        const issueId = genIssueId();
        const cropPath = saveIssueCrop(folder, issueId, bad.cropBuf);

        issuesState.issues.push({
          id: issueId,
          status: "pending",
          kind: "cell",
          key: parsed.key,
          columnName: bad.colName,
          ocrValue: bad.ocrValue,
          cropPath,
          source: { fileName, rowIndex: idx, colName: bad.colName },
          rule: bad.ruleSnap,
          overrideAllowed: true,
          createdAt: Date.now()
        });
      }

      rowsDrafted++;

      if (mode === "interactive") {
        const firstIssueId = issuesState.issues[firstIssueIndex]?.id || null;
        return {
          blocked: false,
          paused: true,
          incomplete: true,
          pausedAtRow: idx,
          pausedIssueId: firstIssueId,
          rowsCommitted,
          rowsDrafted
        };
      }

      continue;
    }

    // If we have a date override, we still must validate + parse + proceed
    if (!dateText) break;

    const dateRuleSnap = ruleSnapshotForColumn(rules, dateColName);
    const dateValidByRule = validateCellStrict(dateText, dateRuleSnap);
    const parsed = parseDateTimeKeyStrict(dateText);

    if (!dateValidByRule.ok || !parsed) {
      // If override is invalid, treat it as a blocking date issue without re-cropping
      const issueId = genIssueId();
      issuesState.issues.push({
        id: issueId,
        status: "pending",
        kind: "date",
        ocrValue: dateText,
        columnName: dateColName,
        cropPath: "", // no crop for override path (optional: could still crop)
        source: { fileName, rowIndex: idx, colName: dateColName },
        rule: dateRuleSnap,
        createdAt: Date.now()
      });
      issuesState.blockedFiles[fileName] = { rowIndex: idx, issueId };
      return {
        blocked: true,
        incomplete: true,
        blockedAtRow: idx,
        blockedIssueId: issueId,
        rowsCommitted,
        rowsDrafted
      };
    }

    if (keyExists(parsed.key)) continue;

    const values = { [dateColName]: dateText };
    const invalidCells = [];

    for (let c = 1; c < colRects.length; c++) {
      const col = colRects[c];
      const rect = clampRect(png, col.x, rr.y, col.w, rr.h);
      const crop = cropPng(png, rect.x, rect.y, rect.w, rect.h);
      const cropBuf = pngToBuffer(crop);

      const restriction = getRestrictionForColumn(rules, col.name);
      const whitelist = (restriction.restriction === "format" && restriction.formats.length)
        ? buildWhitelistForFormat(restriction.formats)
        : null;

      const ruleSnap = ruleSnapshotForColumn(rules, col.name);
      const txt = await ocrWithDecimalRetry(cropBuf, ruleSnap, whitelist);

      values[col.name] = txt;

      const v = validateCellStrict(txt, ruleSnap);
      if (!v.ok) invalidCells.push({ colName: col.name, ocrValue: txt, cropBuf, ruleSnap });
    }

    if (invalidCells.length === 0) {
      dataObj.rows = mergeRows(dataObj.rows, [{ key: parsed.key, ts: parsed.ts, values }]);
      rowsCommitted++;
      continue;
    }

    issuesState.draftRows[parsed.key] = {
      key: parsed.key,
      ts: parsed.ts,
      values,
      source: { fileName, rowIndex: idx }
    };

    const firstIssueIndex = issuesState.issues.length;

    for (const bad of invalidCells) {
      const issueId = genIssueId();
      const cropPath = saveIssueCrop(folder, issueId, bad.cropBuf);

      issuesState.issues.push({
        id: issueId,
        status: "pending",
        kind: "cell",
        key: parsed.key,
        columnName: bad.colName,
        ocrValue: bad.ocrValue,
        cropPath,
        source: { fileName, rowIndex: idx, colName: bad.colName },
        rule: bad.ruleSnap,
        overrideAllowed: true,
        createdAt: Date.now()
      });
    }

    rowsDrafted++;

    if (mode === "interactive") {
      const firstIssueId = issuesState.issues[firstIssueIndex]?.id || null;
      return {
        blocked: false,
        paused: true,
        incomplete: true,
        pausedAtRow: idx,
        pausedIssueId: firstIssueId,
        rowsCommitted,
        rowsDrafted
      };
    }
  }

  return { blocked: false, rowsCommitted, rowsDrafted };
}