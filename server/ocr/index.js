// ============================================================
// server/ocr/index.js
// ============================================================

import fs from "fs";
import path from "path";

import { createRunManager } from "./runs/runManager.js";
import { loadOcrRules } from "./rules/ruleLoader.js";
import { loadAllIssues } from "./issues/issueStore.js";
import { tryGenerateExport } from "./export/exportManager.js";
import { initOcrWorkers } from "./batch/ocrWorkerPool.js";

import { countIssues } from "./issues/issueStore.js";
import { countDrafts } from "./drafts/draftStore.js";
import { countDataPoints } from "./storage/dataStore.js";

import {
  overrideIssue,
  recheckIssue
} from "./issues/issueActions.js";

/**
 * Registers all OCR routes with the Express app.
 */
export function registerOcrModule(app, deps) {
  // ✅ Initialize OCR worker pool once
  initOcrWorkers();

  const runManager = createRunManager(deps);

  // --------------------------------------------------
  // TABLE / FILE LISTING
  // --------------------------------------------------

  app.get("/ocr/tables", (req, res) => {
    const tables = fs
      .readdirSync(deps.PHOTOS_DIR)
      .filter(f =>
        fs.statSync(path.join(deps.PHOTOS_DIR, f)).isDirectory()
      );

    res.json({ success: true, tables });
  });

  app.get("/ocr/files/:tableId", (req, res) => {
    const dir = path.join(deps.PHOTOS_DIR, req.params.tableId);
    if (!fs.existsSync(dir)) {
      return res.status(404).json({ success: false });
    }

    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith(".png"));

    res.json({ success: true, files });
  });

  // --------------------------------------------------
  // RUN CONTROL
  // --------------------------------------------------

  app.post("/ocr/run", (req, res) => {
    try {
      const run = runManager.startRun(req.body || {});
      res.json({ success: true, runId: run.runId });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });

  app.get("/ocr/run/:runId/status", (req, res) => {
    const run = runManager.getRun(req.params.runId);
    if (!run) {
      return res
        .status(404)
        .json({ success: false, error: "Run not found" });
    }
    res.json({ success: true, run });
  });

  app.post("/ocr/run/:runId/stop", (req, res) => {
    const ok = runManager.stopRun(req.params.runId);
    res.json({ success: ok });
  });

  // --------------------------------------------------
  // ✅ EXPORT (SINGLE SOURCE OF TRUTH)
  // --------------------------------------------------

  app.post("/ocr/export/try", (req, res) => {
    const run = runManager.getActiveRun();
    if (!run) {
      return res.json({ success: false });
    }

    tryGenerateExport(run, deps);

    res.json({
      success: true,
      exportPath: run.exportPath || null
    });
  });

  // --------------------------------------------------
  // RULES
  // --------------------------------------------------

  app.get("/ocr-rules", (req, res) => {
    try {
      const calibrationPath = path.join(
        process.cwd(),
        "calibration.json"
      );
      const calibration = JSON.parse(
        fs.readFileSync(calibrationPath, "utf8")
      );

      if (!Array.isArray(calibration.columns)) {
        throw new Error(
          "Invalid calibration.json: columns[] missing"
        );
      }

      const rulesPath = path.join(
        process.cwd(),
        "ocrRules.json"
      );
      const persistedRules = JSON.parse(
        fs.readFileSync(rulesPath, "utf8")
      );

      res.json({
        success: true,
        columns: calibration.columns,
        rules: persistedRules.rules || {}
      });
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: e.message });
    }
  });

  app.post("/ocr-rules", (req, res) => {
    try {
      const RULES_PATH = path.join(
        process.cwd(),
        "ocrRules.json"
      );

      if (!req.body || typeof req.body.rules !== "object") {
        throw new Error("Invalid rules payload");
      }

      fs.writeFileSync(
        RULES_PATH,
        JSON.stringify(
          { version: 1, rules: req.body.rules },
          null,
          2
        )
      );

      runManager.handleRulesChanged();

      res.json({ success: true });
    } catch (e) {
      res
        .status(400)
        .json({ success: false, error: e.message });
    }
  });

  // --------------------------------------------------
  // ISSUES
  // --------------------------------------------------

  app.get("/ocr/issues/next", async (req, res) => {
    try {
      const issues = await loadAllIssues(deps.PHOTOS_DIR);
      if (issues.length === 0) {
        return res.json({ found: false });
      }

      const issue = issues[0];
      res.json({
        found: true,
        tableId: issue.animalId,
        issue
      });
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: e.message });
    }
  });

  app.get(
    "/ocr/issues/:tableId/:issueId/image",
    (req, res) => {
      const { tableId, issueId } = req.params;
      const p = path.join(
        deps.PHOTOS_DIR,
        tableId,
        "issues",
        issueId,
        "cell.png"
      );

      if (!fs.existsSync(p)) {
        return res.status(404).end();
      }

      res.sendFile(p);
    }
  );

  app.post(
    "/ocr/issues/:tableId/:issueId/approve",
    async (req, res) => {
      try {
        const { tableId, issueId } = req.params;
        const { action, value } = req.body;

        const issues = await loadAllIssues(deps.PHOTOS_DIR);
        const issue = issues.find(
          i =>
            i.id === issueId && i.animalId === tableId
        );

        if (!issue) {
          throw new Error("Issue not found");
        }

        const rules = loadOcrRules();

        if (action === "override") {
          await overrideIssue({
            PHOTOS_DIR: deps.PHOTOS_DIR,
            issue,
            newValue: value
          });
        } else {
          await recheckIssue({
            PHOTOS_DIR: deps.PHOTOS_DIR,
            issue,
            newValue: value,
            rules
          });
        }

        res.json({ success: true });
      } catch (e) {
        res
          .status(400)
          .json({ success: false, error: e.message });
      }
    }
  );

  // --------------------------------------------------
  // ✅ ISSUE / DRAFT / DATA COUNTS (SINGLE ROUTE)
  // --------------------------------------------------

  app.get("/ocr/counts", (req, res) => {
    try {
      const scope = req.query.scope;
      const animalId = req.query.tableId || null;

      let issues = 0;
      let drafts = 0;
      let data = 0;

      if (scope === "all") {
        issues = countIssues(deps.PHOTOS_DIR);
        drafts = countDrafts(deps.PHOTOS_DIR);
        data = countDataPoints(deps.PHOTOS_DIR);
      } else {
        if (!animalId) {
          throw new Error("tableId required for this scope");
        }
        issues = countIssues(deps.PHOTOS_DIR, animalId);
        drafts = countDrafts(deps.PHOTOS_DIR, animalId);
        data = countDataPoints(deps.PHOTOS_DIR, animalId);
      }

      res.json({
        success: true,
        issues,
        drafts,
        data
      });
    } catch (e) {
      res.status(400).json({
        success: false,
        error: e.message
      });
    }
  });
}