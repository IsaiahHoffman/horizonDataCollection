// ============================================================
// server/ocr/index.js
// OCR module hub: registers OCR routes (run/debug/rules/issues/reset)
// UPDATED: creates a shared runManager singleton for run+issues routes
// ============================================================

import { registerOcrRunRoutes } from "./routes/run.routes.js";
import { registerOcrDebugRoutes } from "./routes/debug.routes.js";
import { registerOcrRulesRoutes } from "./routes/rules.routes.js";
import { registerOcrIssuesRoutes } from "./routes/issues.routes.js";
import { registerOcrResetRoutes } from "./routes/reset.routes.js";

import { createRunManager } from "./engine/jobs/runManager.js";

export function registerOcrModule(app, deps) {
  const runManager = createRunManager(deps);

  const deps2 = { ...deps, runManager };

  registerOcrRunRoutes(app, deps2);
  registerOcrDebugRoutes(app, deps2);
  registerOcrRulesRoutes(app, deps2);
  registerOcrIssuesRoutes(app, deps2);
  registerOcrResetRoutes(app, deps2);
}
