// ============================================================
// server/ocr/routes/debug.routes.js
// OCR debugger endpoints: /ocr-debug/tables, /ocr-debug/row/:tableNumber
// ============================================================

import fs from "fs";
import path from "path";

import { newestPngFirst, safeTableNumber, loadGlobalRules } from "../engine/index.js";
import { decodePng, pngToBuffer, cropPng, clampRect } from "../engine/geometry/crop.js";
import { buildCellRectangles } from "../engine/geometry/rectangles.js";
import { preprocessNumericVariants } from "../engine/preprocess/numericPreprocess.js";
import { ocrOneLineFromBuffer } from "../engine/ocrText.js";

import {
  compileFormatLine,
  validateByEnumStrict,
  validateByFormats,
  getRestrictionForColumn
} from "../rules/ocrRuleEngine.js";

function buildWhitelistForFormats(formats) {
  const wlSet = new Set("0123456789".split(""));
  for (const f of formats) {
    const compiled = compileFormatLine(f);
    for (const ch of compiled.whitelist) wlSet.add(ch);
  }
  return Array.from(wlSet).join("");
}

function formatsExpectDecimal(formats) {
  return Array.isArray(formats) && formats.some(f => String(f).includes("."));
}

export function registerOcrDebugRoutes(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH }) {
  app.get("/ocr-debug/tables", (req, res) => {
    try {
      const dirs = fs.existsSync(PHOTOS_DIR)
        ? fs.readdirSync(PHOTOS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .sort((a, b) => Number(a) - Number(b))
        : [];
      res.json({ success: true, tables: dirs });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/ocr-debug/row/:tableNumber", async (req, res) => {
    try {
      const cal = getCalibration();
      if (!cal?.tableTop || !cal?.tableBottom || !cal?.columns?.length || !cal?.rowsPerScreen) {
        return res.status(400).json({ success: false, error: "Calibration incomplete" });
      }

      const rules = loadGlobalRules(RULES_PATH);

      const safe = safeTableNumber(req.params.tableNumber);
      const folder = path.join(PHOTOS_DIR, safe);
      if (!fs.existsSync(folder)) return res.status(404).json({ success: false, error: "Table folder not found" });

      const rowIndex = Number(req.query.row ?? 0);
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        return res.status(400).json({ success: false, error: "Invalid row index" });
      }

      const requested = req.query.file ? String(req.query.file) : null;
      let fileName = requested;

      if (!fileName) {
        const pngs = newestPngFirst(folder);
        if (!pngs.length) return res.status(404).json({ success: false, error: "No PNG images found" });
        fileName = pngs[0];
      }

      const imgPath = path.join(folder, fileName);
      if (!fs.existsSync(imgPath)) return res.status(404).json({ success: false, error: "PNG file not found" });

      const png = decodePng(fs.readFileSync(imgPath));
      const { colRects, rowRects } = buildCellRectangles(cal, SCREEN_SCALE);

      if (rowIndex >= rowRects.length) {
        return res.json({ success: true, done: true, reason: "rowIndex >= rowsPerScreen", fileName, rowIndex, cells: [] });
      }

      const rr = rowRects[rowIndex];
      const cells = [];

      for (const c of colRects) {
        const rect = clampRect(png, c.x, rr.y, c.w, rr.h);
        const crop = cropPng(png, rect.x, rect.y, rect.w, rect.h);
        const cropBuf = pngToBuffer(crop);

        const restriction = getRestrictionForColumn(rules, c.name);
        let whitelist = null;
        if (restriction.restriction === "format" && restriction.formats.length) {
          whitelist = buildWhitelistForFormats(restriction.formats);
        }

        const rawText = await ocrOneLineFromBuffer(cropBuf, { whitelist, psm: "7", numericMode: false });
        let text = rawText;

        let valid = true;
        let matchedLine = null;
        let matchedValue = null;

        if (restriction.restriction === "format") {
          const v1 = validateByFormats(text, restriction.formats);
          valid = v1.ok;
          matchedLine = v1.matchedLine;

          if (!valid && formatsExpectDecimal(restriction.formats)) {
            const t1b = (await ocrOneLineFromBuffer(cropBuf, {
              whitelist: "0123456789.,",
              psm: "8",
              numericMode: true
            })).replaceAll(",", ".");
            const v1b = validateByFormats(t1b, restriction.formats);
            if (v1b.ok) {
              text = t1b; valid = true; matchedLine = v1b.matchedLine;
            } else {
              const vars = preprocessNumericVariants(cropBuf);
              for (const preBuf of vars) {
                const t2 = (await ocrOneLineFromBuffer(preBuf, {
                  whitelist: "0123456789.,",
                  psm: "8",
                  numericMode: true
                })).replaceAll(",", ".");
                const v2 = validateByFormats(t2, restriction.formats);
                if (v2.ok) { text = t2; valid = true; matchedLine = v2.matchedLine; break; }
              }
            }
          }
        } else if (restriction.restriction === "enum") {
          const v = validateByEnumStrict(text, restriction.values);
          valid = v.ok;
          matchedValue = v.matchedValue;
        }

        cells.push({
          name: c.name,
          restriction: restriction.restriction,
          valid,
          matchedLine,
          matchedValue,
          rawText,
          text,
          imgBase64: cropBuf.toString("base64"),
          width: rect.w,
          height: rect.h
        });
      }

      const done = ((cells[0]?.text || "").trim().length === 0);
      return res.json({ success: true, fileName, rowIndex, done, reason: done ? "empty-date-cell" : "", cells });
    } catch (e) {
      console.error("ocr-debug row error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}