// ============================================================
// server/ocr/runs/runManager.js
// ============================================================

import { executeRun } from "./executeRun.js";
import {
  resetAnimal,
  resetAllAnimals
} from "../storage/resetStore.js";
import { loadOcrRules } from "../rules/ruleLoader.js";

function now() {
  return Date.now();
}

function genRunId() {
  return `run_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

export function createRunManager(deps) {
  const runs = new Map();
  let activeRunId = null;

  function getRun(runId) {
    return runs.get(runId) || null;
  }

  function getActiveRun() {
    return activeRunId
      ? runs.get(activeRunId) || null
      : null;
  }

  /**
   * ✅ Clears previous OCR output BEFORE a run starts.
   *
   * Rules:
   * - row / file / animal → reset ONE animal
   * - all → reset ALL animals
   */
  function cleanForRun(request) {
    const { scope, tableId } = request || {};

    if (scope === "all") {
      resetAllAnimals(deps.PHOTOS_DIR);
      return;
    }

    if (
      scope === "animal" ||
      scope === "file" ||
      scope === "row"
    ) {
      if (!tableId) {
        throw new Error(
          `Missing tableId for scope "${scope}"`
        );
      }
      resetAnimal(deps.PHOTOS_DIR, tableId);
      return;
    }

    throw new Error(`Unknown scope: ${scope}`);
  }

  function startRun(request) {
    if (activeRunId) {
      const active = runs.get(activeRunId);
      if (
        active &&
        ["queued", "running", "paused", "stopping"].includes(
          active.status
        )
      ) {
        throw new Error(
          "Another OCR run is already active"
        );
      }
    }

    // ✅ CRITICAL FIX:
    // ✅ Clean BEFORE run starts
    cleanForRun(request);

    const runId = genRunId();
    const rulesSnapshot = loadOcrRules();

    const run = {
      runId,
      request,
      scope: request.scope,
      status: "queued",

      rules: rulesSnapshot,

      stopRequested: false,
      pauseRequested: false,

      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      updatedAt: now(),

      currentAnimal: null,
      currentFile: null,
      currentFileIndex: 0,

      filesTotal: 0,
      filesProcessed: 0,

      animalsTotal: 0,
      animalsProcessed: 0,

      exportPath: null
    };

    runs.set(runId, run);
    activeRunId = runId;

    setImmediate(() => executeRun(run, deps));

    return run;
  }

  function stopRun(runId) {
    const run = runs.get(runId);
    if (!run) return false;

    run.stopRequested = true;
    run.status = "stopping";
    run.updatedAt = now();
    return true;
  }

  function pauseRun(runId) {
    const run = runs.get(runId);
    if (!run || run.status !== "running") return false;

    run.pauseRequested = true;
    run.status = "paused";
    run.updatedAt = now();
    return true;
  }

  function resumeRun(runId) {
    const run = runs.get(runId);
    if (!run || run.status !== "paused") return false;

    run.pauseRequested = false;
    run.status = "running";
    run.updatedAt = now();
    return true;
  }

  function handleRulesChanged() {
    const run = getActiveRun();
    if (!run) return;

    run.stopRequested = true;
    run.status = "aborted_rules_changed";
    activeRunId = null;
  }

  return {
    startRun,
    stopRun,
    pauseRun,
    resumeRun,
    getRun,
    getActiveRun,
    handleRulesChanged
  };
}