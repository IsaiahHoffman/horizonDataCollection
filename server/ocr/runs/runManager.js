// server/ocr/runs/runManager.js

import { executeRun } from "./executeRun.js";
import { resetAnimal, resetAllAnimals } from "../storage/resetStore.js";
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

  // ✅ ADD THIS
  function getActiveRun() {
    return activeRunId ? runs.get(activeRunId) || null : null;
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
      cleanedOnce: false,

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

  function performCleanStart(run) {
    if (run.cleanedOnce) return;

    if (run.scope === "all") {
      resetAllAnimals(deps.PHOTOS_DIR);
    } else {
      resetAnimal(deps.PHOTOS_DIR, run.request.tableId);
    }

    run.cleanedOnce = true;
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
    getActiveRun, // ✅ EXPORT IT
    performCleanStart,
    handleRulesChanged
  };
}