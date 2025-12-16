// ============================================================
// server/saveBlock.js
// Saves ONE fragment per request:
//   public/photos/<tableNumber>/<blockStart> <blockEnd>.png
// ============================================================

import fs from "fs";
import path from "path";

export function registerSaveBlockRoutes(app, { PHOTOS_DIR }) {

  // ------------------------------------------------------------
  // POST /save-block-image
  // Body:
  // {
  //   tableNumber: "33",
  //   blockStart:  "01012025",
  //   blockEnd:    "12012025",
  //   buffer:      "<base64 PNG>"
  // }
  // ------------------------------------------------------------
  app.post("/save-block-image", (req, res) => {
    try {
      const { tableNumber, blockStart, blockEnd, buffer } = req.body || {};

      if (!tableNumber) {
        return res.status(400).json({ error: "Missing tableNumber" });
      }
      if (!blockStart || !blockEnd) {
        return res.status(400).json({ error: "Missing blockStart or blockEnd" });
      }
      if (!buffer) {
        return res.status(400).json({ error: "Missing buffer" });
      }

      // Sanitize inputs
      const safeTable = String(tableNumber).replace(/[^0-9]/g, "");
      const safeStart = String(blockStart).replace(/[^0-9]/g, "");
      const safeEnd   = String(blockEnd).replace(/[^0-9]/g, "");

      const folder = path.join(PHOTOS_DIR, safeTable);
      fs.mkdirSync(folder, { recursive: true });

      const fileName = `${safeStart} ${safeEnd}.png`;
      const filePath = path.join(folder, fileName);

      // Convert base64 → binary
      const buf = Buffer.from(buffer, "base64");

      fs.writeFileSync(filePath, buf);

      res.json({
        success: true,
        path: `/photos/${safeTable}/${fileName}`
      });

    } catch (e) {
      console.error("save-block-image error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}