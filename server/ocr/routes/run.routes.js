// ============================================================
// server/ocr/routes/run.routes.js
// (only showing full file for easy copy/paste)
// ============================================================

import fs from "fs";
import path from "path";

import {
  listSubdirs,
  listPngs,
  safeTableNumber,
  loadGlobalRules,
  loadDataFile,
  saveDataFile,
  loadIssuesState,
  saveIssuesState,
  processPngFileFromRow
} from "../engine/index.js";

import { createRunManager } from "../engine/jobs/runManager.js";

export function registerOcrRunRoutes(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH, runManager: injected }) {
  const runManager = injected || createRunManager({ PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH });

  app.get("/ocr/tables", (req, res) => {
    try {
      const tables = listSubdirs(PHOTOS_DIR);
      res.json({ success: true, tables });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/ocr/images/:tableNumber", (req, res) => {
    try {
      const safe = safeTableNumber(req.params.tableNumber);
      const folder = path.join(PHOTOS_DIR, safe);
      const images = listPngs(folder);
      res.json({ success: true, images });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Legacy synchronous run remains unchanged...
  app.post("/ocr/run/:tableNumber", async (req, res) => {
    try {
      const safe = safeTableNumber(req.params.tableNumber);
      if (!safe) return res.status(400).json({ success: false, error: "Invalid tableNumber" });

      const cal = getCalibration();
      if (!cal?.tableTop || !cal?.tableBottom || !cal?.columns?.length || !cal?.rowsPerScreen) {
        return res.status(400).json({ success: false, error: "Calibration incomplete" });
      }

      const folder = path.join(PHOTOS_DIR, safe);
      if (!fs.existsSync(folder)) return res.status(404).json({ success: false, error: "Table folder not found" });

      const rules = loadGlobalRules(RULES_PATH);
      const images = listPngs(folder);

      const dataPath = path.join(folder, "data.json");
      const issuesPath = path.join(folder, "issues.json");

      const dataObj = loadDataFile(dataPath, safe);
      const issuesState = loadIssuesState(issuesPath, safe);

      let pngsProcessed = 0;
      let pngsBlockedOrSkipped = 0;
      let rowsCommitted = 0;
      let rowsDrafted = 0;

      for (const imgName of images) {
        if (issuesState.blockedFiles[imgName]) {
          pngsBlockedOrSkipped++;
          continue;
        }

        const r = await processPngFileFromRow({
          folder,
          fileName: imgName,
          startRowIndex: 0,
          cal,
          SCREEN_SCALE,
          rules,
          dataObj,
          issuesState
        });

        pngsProcessed++;
        rowsCommitted += r.rowsCommitted || 0;
        rowsDrafted += r.rowsDrafted || 0;

        if (r.blocked) pngsBlockedOrSkipped++;
      }

      saveDataFile(dataPath, dataObj);
      saveIssuesState(issuesPath, issuesState);

      res.json({
        success: true,
        tableNumber: safe,
        imagesFound: images.length,
        imagesProcessed: pngsProcessed,
        imagesBlockedOrSkipped: pngsBlockedOrSkipped,
        rowsCommitted,
        rowsDrafted,
        totalFinalRows: dataObj.rows.length,
        dataPath: `/photos/${safe}/data.json`,
        issuesPath: `/photos/${safe}/issues.json`
      });
    } catch (e) {
      console.error("ocr run error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // NEW: start scoped run (background)
  app.post("/ocr/run", (req, res) => {
    try {
      const scope = String(req.body?.scope || "");
      const tableNumber = req.body?.tableNumber != null ? String(req.body.tableNumber) : null;
      const fileName = req.body?.fileName != null ? String(req.body.fileName) : null;
      const rowIndex = req.body?.rowIndex != null ? Number(req.body.rowIndex) : null;

      if (!["row", "file", "animal", "all"].includes(scope)) {
        return res.status(400).json({ success: false, error: "Invalid scope" });
      }

      if (scope !== "all") {
        if (!tableNumber) return res.status(400).json({ success: false, error: "Missing tableNumber" });
      }

      if (scope === "row") {
        if (!fileName) return res.status(400).json({ success: false, error: "Missing fileName" });
        if (!Number.isInteger(rowIndex) || rowIndex < 0) {
          return res.status(400).json({ success: false, error: "Invalid rowIndex" });
        }
      }

      if (scope === "file") {
        if (!fileName) return res.status(400).json({ success: false, error: "Missing fileName" });
      }

      // DEFAULTS:
      // - cleanStart: true for ALL scopes (you want clean start for file/animal/all; row/file are testing anyway)
      // - exportOnComplete: true for animal/all; false for row/file (avoid export spam in testing)
      const cleanStart =
        (req.body && Object.prototype.hasOwnProperty.call(req.body, "cleanStart"))
          ? Boolean(req.body.cleanStart)
          : true;

      const exportOnComplete =
        (req.body && Object.prototype.hasOwnProperty.call(req.body, "exportOnComplete"))
          ? Boolean(req.body.exportOnComplete)
          : (scope === "animal" || scope === "all");

      const run = runManager.startRun({
        scope,
        tableNumber,
        fileName,
        rowIndex,
        cleanStart,
        exportOnComplete
      });

      res.json({ success: true, runId: run.runId });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });

  app.get("/ocr/run/:runId/status", (req, res) => {
    const runId = String(req.params.runId || "");
    const r = runManager.getRun(runId);
    if (!r) return res.status(404).json({ success: false, error: "runId not found" });
    res.json({ success: true, run: r });
  });

  app.post("/ocr/run/:runId/stop", (req, res) => {
    const runId = String(req.params.runId || "");
    const ok = runManager.stopRun(runId);
    if (!ok) return res.status(404).json({ success: false, error: "runId not found" });
    res.json({ success: true });
  });
}