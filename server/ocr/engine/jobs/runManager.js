// ============================================================
// server/ocr/engine/jobs/runManager.js
// In-memory OCR run manager (start/stop/status) for scoped runs
//
// FEATURES:
//  1) row/file interactive pauses on issue (waiting_on_issue)
//  2) auto-resume support (resumeIfWaiting) with correct row advance logic
//  3) animal/all run with queue + concurrency + priority enqueue for unblocked files
//  4) export when "truly complete" (done + no pending issues in scope)
// ============================================================

import fs from "fs";
import path from "path";
import os from "os";

import { listSubdirs, listPngs, safeTableNumber } from "../fs/listFiles.js";
import { loadGlobalRules } from "../storage/rulesStore.js";
import { loadDataFile, saveDataFile } from "../storage/dataStore.js";
import { loadIssuesState, saveIssuesState } from "../storage/issuesStore.js";
import { processPngFileFromRow } from "../processFile.js";
import { resetOcrOutputsForTable, resetOcrOutputsForAllTables } from "../storage/resetStore.js";

import {
  countPendingIssuesForScope,
  buildExportObjectForScope,
  writeExportFile
} from "../export/exporter.js";

function genRunId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function now() {
  return Date.now();
}

function defaultConcurrency() {
  // Conservative: keep machine usable. User can override via env.
  const env = Number(process.env.OCR_CONCURRENCY || "");
  if (Number.isInteger(env) && env > 0) return env;

  const cpu = Math.max(1, (os.cpus()?.length || 1));
  // cap at 4 by default; leave 1 core "free" when possible
  return Math.max(1, Math.min(4, cpu - 1));
}

export function createRunManager({ PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH }) {
  const runs = new Map();
  let activeRunId = null;
  let lastRunId = null;

  function getRun(runId) {
    return runs.get(runId) || null;
  }
  function getActiveRun() {
    return activeRunId ? runs.get(activeRunId) || null : null;
  }

  function stopRun(runId) {
    const r = runs.get(runId);
    if (!r) return false;
    r.stopRequested = true;
    r.status = (r.status === "done" || r.status === "error") ? r.status : "stopping";
    r.updatedAt = now();
    return true;
  }

  function resetAllRuns() {
    runs.clear();
    activeRunId = null;
    lastRunId = null;
  }

  function pendingCountForRun(r) {
    return countPendingIssuesForScope({ PHOTOS_DIR, request: r.request });
  }

  function tryFinalizeExport(r) {
    if (!r || r.status !== "done") return null;
    if (r.request?.exportOnComplete === false) return null; // NEW

    const pending = pendingCountForRun(r);
    if (pending !== 0) return null;

    if (r.exportPath) return r.exportPath;

    const exportObj = buildExportObjectForScope({ PHOTOS_DIR, request: r.request });
    const abs = writeExportFile({ projectRootDir: process.cwd(), exportObj });

    r.exportPath = abs;
    r.finalizedAt = now();
    return abs;
  }

  async function processOneTableOneFile(
    r,
    { tableNumber, fileName, startRowIndex = 0, maxRows = null, mode = "batch" },
    engineOverrides = {}
  ) {
    if (r.stopRequested) return { stopped: true };

    const safe = safeTableNumber(tableNumber);
    const folder = path.join(PHOTOS_DIR, safe);
    if (!fs.existsSync(folder)) {
      r.warnings.push(`Table folder not found: ${safe}`);
      return { skipped: true };
    }

    const rules = loadGlobalRules(RULES_PATH);

    const dataPath = path.join(folder, "data.json");
    const issuesPath = path.join(folder, "issues.json");

    const dataObj = loadDataFile(dataPath, safe);
    const issuesState = loadIssuesState(issuesPath, safe);

    const scope = r.request.scope;

    // Batch scopes skip blocked files, interactive scopes pause on issue.
    if (issuesState.blockedFiles[fileName] && (scope === "animal" || scope === "all")) {
      r.filesBlockedOrSkipped++;
      r.updatedAt = now();
      return { skipped: true };
    }

    r.currentTable = safe;
    r.currentFile = fileName;
    r.updatedAt = now();

    const cal = getCalibration();
    if (!cal?.tableTop || !cal?.tableBottom || !cal?.columns?.length || !cal?.rowsPerScreen) {
      return { error: true, message: "Calibration incomplete" };
    }

    const result = await processPngFileFromRow({
      folder,
      fileName,
      startRowIndex,
      maxRows,
      mode,
      ...engineOverrides,
      cal,
      SCREEN_SCALE,
      rules,
      dataObj,
      issuesState
    });

    saveDataFile(dataPath, dataObj);
    saveIssuesState(issuesPath, issuesState);

    r.filesProcessed++;
    r.rowsCommitted += result.rowsCommitted || 0;
    r.rowsDrafted += result.rowsDrafted || 0;
    if (result.blocked) r.filesBlockedOrSkipped++;

    r.updatedAt = now();
    return result;
  }

  // ------------------------------
  // Queue helpers for animal/all
  // ------------------------------
  function taskKey(t) {
    return `${safeTableNumber(t.tableNumber)}::${String(t.fileName)}`;
  }

  function ensureBatchQueueState(r) {
    r.queue ||= [];
    r.queueSet ||= new Set();
    r.inFlightSet ||= new Set();
    r.concurrency ||= defaultConcurrency();
  }

  function enqueueTask(r, task, { priority = false } = {}) {
    ensureBatchQueueState(r);
    const k = taskKey(task);
    if (r.queueSet.has(k) || r.inFlightSet.has(k)) return false;

    r.queueSet.add(k);
    if (priority) r.queue.unshift(task);
    else r.queue.push(task);
    r.updatedAt = now();
    return true;
  }

  async function runQueueWorkers(r) {
    ensureBatchQueueState(r);

    const worker = async () => {
      while (!r.stopRequested) {
        const task = r.queue.shift();
        if (!task) return;

        const k = taskKey(task);
        r.queueSet.delete(k);
        r.inFlightSet.add(k);

        try {
          await processOneTableOneFile(
            r,
            {
              tableNumber: task.tableNumber,
              fileName: task.fileName,
              startRowIndex: task.startRowIndex ?? 0,
              maxRows: null,
              mode: "batch"
            },
            task.engineOverrides || {}
          );
        } finally {
          r.inFlightSet.delete(k);
          r.updatedAt = now();
        }
      }
    };

    const n = Math.max(1, Number(r.concurrency) || 1);
    await Promise.all(Array.from({ length: n }, () => worker()));
  }

  async function executeRun(runId) {
    const r = runs.get(runId);
    if (!r) return;

    try {
      r.status = "running";
      r.startedAt = now();
      r.updatedAt = now();
      r.waiting = null;
      r.exportPath = null;
      r.finalizedAt = null;

      // NEW: cleanStart wipes old outputs for the scope tables
      if (r.request?.cleanStart && !r.cleanedOnce) {
        if (r.request.scope === "all") {
          resetOcrOutputsForAllTables({ PHOTOS_DIR });
        } else {
          resetOcrOutputsForTable({ PHOTOS_DIR, tableNumber: r.request.tableNumber });
        }
        r.cleanedOnce = true;
        r.updatedAt = now();
      }

      const scope = r.request.scope;

      // -------------------------
      // scope: row (interactive)
      // -------------------------
      if (scope === "row") {
        const { tableNumber, fileName, rowIndex } = r.request;

        const result = await processOneTableOneFile(r, {
          tableNumber,
          fileName,
          startRowIndex: rowIndex,
          maxRows: 1,
          mode: "interactive"
        });

        if (result?.blocked || result?.paused) {
          r.status = "waiting_on_issue";
          r.waiting = {
            tableNumber: safeTableNumber(tableNumber),
            fileName,
            rowIndex: result.blocked ? result.blockedAtRow : result.pausedAtRow,
            issueId: result.blocked ? result.blockedIssueId : result.pausedIssueId,
            kind: result.blocked ? "date" : "cell"
          };
          r.updatedAt = now();
          return;
        }

        r.status = r.stopRequested ? "stopped" : "done";
        r.updatedAt = now();
        tryFinalizeExport(r);
        activeRunId = null;
        lastRunId = runId;
        return;
      }

      // -------------------------
      // scope: file (interactive)
      // -------------------------
      if (scope === "file") {
        const { tableNumber, fileName } = r.request;

        const result = await processOneTableOneFile(r, {
          tableNumber,
          fileName,
          startRowIndex: 0,
          maxRows: null,
          mode: "interactive"
        });

        if (result?.blocked || result?.paused) {
          r.status = "waiting_on_issue";
          r.waiting = {
            tableNumber: safeTableNumber(tableNumber),
            fileName,
            rowIndex: result.blocked ? result.blockedAtRow : result.pausedAtRow,
            issueId: result.blocked ? result.blockedIssueId : result.pausedIssueId,
            kind: result.blocked ? "date" : "cell"
          };
          r.updatedAt = now();
          return;
        }

        r.status = r.stopRequested ? "stopped" : "done";
        r.updatedAt = now();
        tryFinalizeExport(r);
        activeRunId = null;
        lastRunId = runId;
        return;
      }

      // -------------------------
      // scope: animal (batch queue)
      // -------------------------
      if (scope === "animal") {
        const safe = safeTableNumber(r.request.tableNumber);
        const folder = path.join(PHOTOS_DIR, safe);
        const images = listPngs(folder);

        r.filesTotal = images.length;
        r.updatedAt = now();

        ensureBatchQueueState(r);
        r.queue = [];
        r.queueSet.clear?.();
        r.inFlightSet.clear?.();

        for (const f of images) enqueueTask(r, { tableNumber: safe, fileName: f, startRowIndex: 0 }, { priority: false });

        await runQueueWorkers(r);

        r.status = r.stopRequested ? "stopped" : "done";
        r.updatedAt = now();
        tryFinalizeExport(r);
        activeRunId = null;
        lastRunId = runId;
        return;
      }

      // -------------------------
      // scope: all (batch queue)
      // -------------------------
      if (scope === "all") {
        const tables = listSubdirs(PHOTOS_DIR).sort((a, b) => Number(a) - Number(b));
        r.tablesTotal = tables.length;

        ensureBatchQueueState(r);
        r.queue = [];
        r.queueSet.clear?.();
        r.inFlightSet.clear?.();

        let totalFiles = 0;
        for (const t of tables) {
          const folder = path.join(PHOTOS_DIR, t);
          const images = listPngs(folder);
          totalFiles += images.length;
          for (const f of images) enqueueTask(r, { tableNumber: t, fileName: f, startRowIndex: 0 }, { priority: false });
        }
        r.filesTotal = totalFiles;
        r.updatedAt = now();

        await runQueueWorkers(r);

        r.status = r.stopRequested ? "stopped" : "done";
        r.updatedAt = now();
        tryFinalizeExport(r);
        activeRunId = null;
        lastRunId = runId;
        return;
      }

      r.status = "error";
      r.error = `Unknown scope: ${scope}`;
      r.updatedAt = now();
      activeRunId = null;
      lastRunId = runId;
    } catch (e) {
      const r2 = runs.get(runId);
      if (r2) {
        r2.status = "error";
        r2.error = e?.message || String(e);
        r2.updatedAt = now();
      }
      activeRunId = null;
      lastRunId = runId;
    }
  }

  // Priority API for issues route (animal/all): enqueue file to be processed ASAP
  function enqueuePriorityFile({ tableNumber, fileName, startRowIndex = 0, dateOverrideByRowIndex = null }) {
    const r = getActiveRun();
    if (!r) return { enqueued: false, reason: "no-active-run" };

    if (!(r.request.scope === "animal" || r.request.scope === "all")) {
      return { enqueued: false, reason: "not-batch-scope" };
    }

    if (r.request.scope === "animal") {
      if (safeTableNumber(r.request.tableNumber) !== safeTableNumber(tableNumber)) {
        return { enqueued: false, reason: "wrong-table-for-animal-scope" };
      }
    }

    const ok = enqueueTask(
      r,
      {
        tableNumber,
        fileName,
        startRowIndex,
        engineOverrides: dateOverrideByRowIndex ? { dateOverrideByRowIndex } : {}
      },
      { priority: true }
    );

    return { enqueued: ok, reason: ok ? "ok" : "already-queued-or-inflight" };
  }

  // Interactive resume API (row/file)
  async function resumeIfWaiting({ tableNumber, issueId, dateOverrideByRowIndex = null }) {
    const run = getActiveRun() || (lastRunId ? runs.get(lastRunId) : null);
    if (!run) return { resumed: false, reason: "no-run" };

    // Even if run is done, issue resolution might allow export
    if (run.status !== "waiting_on_issue") {
      const exported = tryFinalizeExport(run);
      return { resumed: false, reason: "not-waiting", exported: exported || null };
    }

    if (!run.waiting || run.waiting.issueId !== issueId) return { resumed: false, reason: "issue-mismatch" };
    if (run.waiting.tableNumber !== safeTableNumber(tableNumber)) return { resumed: false, reason: "table-mismatch" };

    const scope = run.request.scope;
    if (scope !== "file" && scope !== "row") return { resumed: false, reason: "scope-not-resumable" };

    const { fileName, rowIndex, kind } = run.waiting;

    // IMPORTANT: for file scope + cell issue, continue AFTER the fixed row
    const startRow =
      (scope === "file" && kind === "cell")
        ? (Number(rowIndex) || 0) + 1
        : (Number(rowIndex) || 0);

    run.status = "running";
    run.updatedAt = now();
    run.waiting = null;

    const engineOverrides = {};
    if (kind === "date" && dateOverrideByRowIndex) {
      engineOverrides.dateOverrideByRowIndex = dateOverrideByRowIndex;
    }

    const result = await processOneTableOneFile(
      run,
      {
        tableNumber,
        fileName,
        startRowIndex: startRow,
        maxRows: scope === "row" ? 1 : null,
        mode: "interactive"
      },
      engineOverrides
    );

    if (result?.blocked || result?.paused) {
      run.status = "waiting_on_issue";
      run.waiting = {
        tableNumber: safeTableNumber(tableNumber),
        fileName,
        rowIndex: result.blocked ? result.blockedAtRow : result.pausedAtRow,
        issueId: result.blocked ? result.blockedIssueId : result.pausedIssueId,
        kind: result.blocked ? "date" : "cell"
      };
      run.updatedAt = now();
      return { resumed: true, waitingAgain: true };
    }

    run.status = run.stopRequested ? "stopped" : "done";
    run.updatedAt = now();

    const exported = tryFinalizeExport(run);
    activeRunId = null;
    lastRunId = run.runId;

    return { resumed: true, done: true, exported: exported || null };
  }

  function startRun(request) {
    if (activeRunId) {
      const active = runs.get(activeRunId);
      if (active && !["done", "error", "stopped"].includes(active.status)) {
        throw new Error(`Another run is already active (status=${active.status}, runId=${active.runId})`);
      }
    }

    const runId = genRunId();
const runState = {
  runId,
  request,
  status: "queued",
  error: null,
  warnings: [],
  stopRequested: false,
  startedAt: null,
  updatedAt: now(),
  waiting: null,

  cleanedOnce: false, // ✅ REQUIRED

  concurrency: defaultConcurrency(),
  queue: null,
  queueSet: null,
  inFlightSet: null,

  exportPath: null,
  finalizedAt: null,

  currentTable: request.tableNumber || "",
  currentFile: request.fileName || "",
  tablesTotal: 0,
  filesTotal: 0,
  filesProcessed: 0,
  filesBlockedOrSkipped: 0,
  rowsCommitted: 0,
  rowsDrafted: 0
};

    runs.set(runId, runState);
    activeRunId = runId;

    setTimeout(() => executeRun(runId), 0);

    return runState;
  }

  return {
    startRun,
    getRun,
    stopRun,
    getActiveRun,
    resumeIfWaiting,
    enqueuePriorityFile,
    tryFinalizeExport,
    resetAllRuns
  };
}