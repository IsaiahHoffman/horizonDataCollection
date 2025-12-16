// ============================================================
// server/ocr/routes/reset.routes.js
// Reset OCR outputs for a clean start
//   POST /ocr/reset   { scope: "table"|"all", tableNumber?: string }
// ============================================================

import { resetOcrOutputsForTable, resetOcrOutputsForAllTables } from "../engine/storage/resetStore.js";

export function registerOcrResetRoutes(app, { PHOTOS_DIR, runManager }) {
  app.post("/ocr/reset", (req, res) => {
    try {
      const scope = String(req.body?.scope || "");
      const tableNumber = req.body?.tableNumber != null ? String(req.body.tableNumber) : null;

      if (!["table", "all"].includes(scope)) {
        return res.status(400).json({ success: false, error: "scope must be 'table' or 'all'" });
      }

      if (scope === "table") {
        if (!tableNumber) return res.status(400).json({ success: false, error: "Missing tableNumber" });
        const r = resetOcrOutputsForTable({ PHOTOS_DIR, tableNumber });
        if (!r.ok) return res.status(400).json({ success: false, error: r.reason });
      } else {
        resetOcrOutputsForAllTables({ PHOTOS_DIR });
      }

      // clear in-memory run state (clean start)
      runManager?.resetAllRuns?.();

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}