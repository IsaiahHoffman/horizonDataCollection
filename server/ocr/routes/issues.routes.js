// ============================================================
// server/ocr/routes/issues.routes.js
// ============================================================

import fs from "fs";
import path from "path";

import {
  safeTableNumber,
  loadGlobalRules,
  loadDataFile,
  saveDataFile,
  loadIssuesState,
  saveIssuesState,
  parseDateTimeKeyStrict,
  processPngFileFromRow
} from "../engine/index.js";

import {
  validateByEnumStrict,
  validateByFormats,
  getRestrictionForColumn,
  normalizeOcrText
} from "../rules/ocrRuleEngine.js";

function validateValueAgainstRules({ rules, columnName, value }) {
  const restriction = getRestrictionForColumn(rules, columnName);

  if (restriction.restriction === "none") return { ok: true };
  if (restriction.restriction === "enum") return validateByEnumStrict(value, restriction.values);
  if (restriction.restriction === "format") return validateByFormats(value, restriction.formats);
  return { ok: true };
}

export function registerOcrIssuesRoutes(app, { PHOTOS_DIR, SCREEN_SCALE, getCalibration, RULES_PATH, runManager }) {
  // GET /ocr/issues/next
  app.get("/ocr/issues/next", (req, res) => {
    try {
      const tables = fs.existsSync(PHOTOS_DIR)
        ? fs.readdirSync(PHOTOS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
        : [];

      const candidates = [];

      for (const t of tables) {
        const safe = safeTableNumber(t);
        if (!safe) continue;

        const folder = path.join(PHOTOS_DIR, safe);
        const issuesPath = path.join(folder, "issues.json");
        const st = loadIssuesState(issuesPath, safe);

        for (const iss of (st.issues || [])) {
          if (iss.status !== "pending") continue;

          const fileName = iss.source?.fileName;
          const isBlocking =
            iss.kind === "date" &&
            fileName &&
            st.blockedFiles?.[fileName]?.issueId === iss.id;

          candidates.push({ tableNumber: safe, issue: iss, isBlocking, createdAt: Number(iss.createdAt || 0) });
        }
      }

      if (!candidates.length) return res.json({ success: true, found: false });

      candidates.sort((a, b) => {
        if (a.isBlocking !== b.isBlocking) return a.isBlocking ? -1 : 1;
        return a.createdAt - b.createdAt;
      });

      const top = candidates[0];
      return res.json({ success: true, found: true, tableNumber: top.tableNumber, issue: top.issue, isBlocking: top.isBlocking });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GET /ocr/issues/:tableNumber
  app.get("/ocr/issues/:tableNumber", (req, res) => {
    try {
      const safe = safeTableNumber(req.params.tableNumber);
      if (!safe) return res.status(400).json({ success: false, error: "Invalid tableNumber" });

      const folder = path.join(PHOTOS_DIR, safe);
      const issuesPath = path.join(folder, "issues.json");
      const st = loadIssuesState(issuesPath, safe);

      res.json({
        success: true,
        tableNumber: safe,
        issues: st.issues,
        blockedFiles: st.blockedFiles,
        draftRowKeys: Object.keys(st.draftRows || {})
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /ocr/issues/:tableNumber/:issueId/approve
  app.post("/ocr/issues/:tableNumber/:issueId/approve", async (req, res) => {
    try {
      const safe = safeTableNumber(req.params.tableNumber);
      if (!safe) return res.status(400).json({ success: false, error: "Invalid tableNumber" });

      const folder = path.join(PHOTOS_DIR, safe);
      if (!fs.existsSync(folder)) return res.status(404).json({ success: false, error: "Table folder not found" });

      const issuesPath = path.join(folder, "issues.json");
      const st = loadIssuesState(issuesPath, safe);

      const issueId = String(req.params.issueId || "");
      const issue = st.issues.find(x => x.id === issueId);
      if (!issue) return res.status(404).json({ success: false, error: "Issue not found" });
      if (issue.status === "resolved") return res.json({ success: true, alreadyResolved: true });

      const action = String(req.body?.action || "approve").toLowerCase();
      if (!["approve", "override"].includes(action)) {
        return res.status(400).json({ success: false, error: "Invalid action" });
      }

      const hasValue = req.body && Object.prototype.hasOwnProperty.call(req.body, "value");
      const incomingValue = hasValue ? String(req.body.value ?? "") : null;

      const cal = getCalibration();
      if (!cal?.tableTop || !cal?.tableBottom || !cal?.columns?.length || !cal?.rowsPerScreen) {
        return res.status(400).json({ success: false, error: "Calibration incomplete" });
      }

      const rules = loadGlobalRules(RULES_PATH);
      const dataPath = path.join(folder, "data.json");
      const dataObj = loadDataFile(dataPath, safe);

      async function resumeWaitingRunIfAny(dateOverrideByRowIndex = null) {
        if (!runManager?.resumeIfWaiting) return null;
        return await runManager.resumeIfWaiting({
          tableNumber: safe,
          issueId: issue.id,
          dateOverrideByRowIndex
        });
      }

      // -----------------------
      // DATE ISSUE (no override)
      // -----------------------
      if (issue.kind === "date") {
        if (action === "override") {
          return res.status(400).json({ success: false, error: "Date issues do not allow override." });
        }

        const correctedRaw = (incomingValue === null) ? String(issue.ocrValue || "") : incomingValue;
        const corrected = normalizeOcrText(correctedRaw);

        const vRule = validateValueAgainstRules({ rules, columnName: issue.columnName, value: corrected });
        if (!vRule.ok) {
          return res.status(400).json({
            success: false,
            error: "Date does not satisfy restrictions",
            details: { restriction: getRestrictionForColumn(rules, issue.columnName), matchedLine: vRule.matchedLine || null }
          });
        }

        const parsed = parseDateTimeKeyStrict(corrected);
        if (!parsed) {
          return res.status(400).json({ success: false, error: "Corrected date is still invalid (strict parse failed)" });
        }

        const dupFinal = dataObj.rows.some(r => r.key === parsed.key);
        const dupDraft = !!st.draftRows[parsed.key];

        const fileName = issue.source?.fileName;
        const rowIndex = Number(issue.source?.rowIndex);

        issue.status = "resolved";
        issue.resolution = {
          type: (dupFinal || dupDraft) ? "duplicate-discard" : "date-corrected",
          value: corrected,
          resolvedAt: Date.now()
        };

        if (fileName && st.blockedFiles[fileName]?.issueId === issue.id) {
          delete st.blockedFiles[fileName];
        }

        saveIssuesState(issuesPath, st);

        const dateOverride =
          Number.isInteger(rowIndex) && rowIndex >= 0 ? { [String(rowIndex)]: corrected } : null;

        // 1) If an interactive run is waiting on this, resume it (with override)
        const resumeInfo = await resumeWaitingRunIfAny(dateOverride);
        if (resumeInfo?.resumed) {
          return res.json({ success: true, resolved: true, resumedByRunManager: true, resume: resumeInfo });
        }

        // 2) If a batch run (animal/all) is active, enqueue this file as PRIORITY to finish ASAP
        if (runManager?.enqueuePriorityFile && fileName && Number.isInteger(rowIndex) && rowIndex >= 0) {
          const enq = runManager.enqueuePriorityFile({
            tableNumber: safe,
            fileName,
            startRowIndex: rowIndex,
            dateOverrideByRowIndex: dateOverride
          });

          if (enq.enqueued) {
            // Also attempt export finalize in case this was the last pending issue and run already done
            runManager.tryFinalizeExport?.(runManager.getActiveRun?.());
            return res.json({ success: true, resolved: true, queuedPriority: true, enqueue: enq });
          }
        }

        // 3) Otherwise: ASAP resume of this blocked file (standalone)
        if (!fileName || !Number.isInteger(rowIndex) || rowIndex < 0) {
          return res.json({ success: true, resolved: true, resumed: false, note: "No fileName/rowIndex to resume" });
        }

        const st2 = loadIssuesState(issuesPath, safe);
        const r2 = await processPngFileFromRow({
          folder,
          fileName,
          startRowIndex: rowIndex,
          dateOverrideByRowIndex: dateOverride || { [String(rowIndex)]: corrected },
          cal,
          SCREEN_SCALE,
          rules,
          dataObj,
          issuesState: st2
        });

        saveDataFile(dataPath, dataObj);
        saveIssuesState(issuesPath, st2);

        // attempt export finalize (if this was the last pending issue for a completed scope)
        const active = runManager?.getActiveRun?.() || null;
        if (active) runManager.tryFinalizeExport?.(active);

        return res.json({ success: true, resolved: true, resumed: true, resumeResult: r2 });
      }

      // -----------------------
      // CELL ISSUE
      // -----------------------
      if (issue.kind === "cell") {
        const key = String(issue.key || "");
        if (!key || !st.draftRows[key]) {
          return res.status(400).json({ success: false, error: "Draft row missing for this issue key" });
        }

        const proposedRaw = (incomingValue === null) ? String(issue.ocrValue || "") : incomingValue;
        const proposed = normalizeOcrText(proposedRaw);

        if (action === "approve") {
          const v = validateValueAgainstRules({ rules, columnName: issue.columnName, value: proposed });
          if (!v.ok) {
            return res.status(400).json({
              success: false,
              error: "Value does not satisfy restrictions",
              details: {
                restriction: getRestrictionForColumn(rules, issue.columnName),
                matchedLine: v.matchedLine || null,
                matchedValue: v.matchedValue || null
              }
            });
          }
        }

        st.draftRows[key].values[issue.columnName] = proposed;

        issue.status = "resolved";
        issue.resolution = {
          type: action === "override" ? "manual-override" : (incomingValue === null ? "approved-ocr" : "approved-corrected"),
          value: proposed,
          resolvedAt: Date.now()
        };

        const pendingForKey = st.issues.some(x => x.status === "pending" && x.kind === "cell" && x.key === key);

        let committed = false;
        if (!pendingForKey) {
          const draft = st.draftRows[key];

          dataObj.rows = dataObj.rows || [];
          dataObj.rows.push({ key: draft.key, ts: draft.ts, values: draft.values });

          const map = new Map();
          for (const r3 of dataObj.rows) if (!map.has(r3.key)) map.set(r3.key, r3);
          dataObj.rows = Array.from(map.values()).sort((a, b) => a.ts - b.ts);

          delete st.draftRows[key];
          committed = true;
        }

        saveDataFile(dataPath, dataObj);
        saveIssuesState(issuesPath, st);

        const resumeInfo = await resumeWaitingRunIfAny();
        const active = runManager?.getActiveRun?.() || null;
        if (active) runManager.tryFinalizeExport?.(active);

        return res.json({ success: true, resolved: true, committed, resume: resumeInfo });
      }

      return res.status(400).json({ success: false, error: "Unknown issue kind" });
    } catch (e) {
      console.error("approve issue error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}