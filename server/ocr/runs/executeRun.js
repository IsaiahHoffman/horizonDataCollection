// server/ocr/runs/executeRun.js

import { runRowScope } from "../scopes/rowScope.js";
import { runFileScope } from "../scopes/fileScope.js";
import { runAnimalScope } from "../scopes/animalScope.js";
import { runAllScope } from "../scopes/allScope.js";
import { tryGenerateExport } from "../export/exportManager.js";

function now() {
  return Date.now();
}

export async function executeRun(run, deps) {
  try {
    run.status = "running";
    run.startedAt = now();
    run.updatedAt = now();

    deps.runManager?.performCleanStart(run);

    if (run.stopRequested) {
      run.status = "stopped";
      run.finishedAt = now();
      return;
    }

    switch (run.scope) {
      case "row":
        await runRowScope(run, deps);
        break;
      case "file":
        await runFileScope(run, deps);
        break;
      case "animal":
        await runAnimalScope(run, deps);
        break;
      case "all":
        await runAllScope(run, deps);
        break;
      default:
        throw new Error(`Unknown scope: ${run.scope}`);
    }

    run.status = run.stopRequested ? "stopped" : "done";
    run.finishedAt = now();
    run.updatedAt = now();

    // ✅ Try exporting if already clean
    tryGenerateExport(run, deps);
  } catch (e) {
    run.status = "error";
    run.error = e.message;
    run.finishedAt = now();
    run.updatedAt = now();
  }
}