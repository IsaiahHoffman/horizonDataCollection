// ============================================================
// server/ocr/engine/export/exporter.js
// Build a compiled export JSON and write to ./exports/ocr_export_<timestamp>.json
//
// UPDATED: export object uses `animals: [...]`
// ============================================================

import fs from "fs";
import path from "path";

import { listSubdirs, safeTableNumber } from "../fs/listFiles.js";
import { loadDataFile } from "../storage/dataStore.js";
import { loadIssuesState } from "../storage/issuesStore.js";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function tsName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Count pending issues within a run scope
export function countPendingIssuesForScope({ PHOTOS_DIR, request }) {
  const scope = request.scope;

  const countInTable = (tableNumber, filterFn = null) => {
    const safe = safeTableNumber(tableNumber);
    const folder = path.join(PHOTOS_DIR, safe);
    const issuesPath = path.join(folder, "issues.json");
    const st = loadIssuesState(issuesPath, safe);
    const pending = (st.issues || []).filter(x => x.status === "pending");
    return filterFn ? pending.filter(filterFn).length : pending.length;
  };

  if (scope === "row") {
    const { tableNumber, fileName, rowIndex } = request;
    return countInTable(tableNumber, (iss) =>
      iss.source?.fileName === fileName && Number(iss.source?.rowIndex) === Number(rowIndex)
    );
  }

  if (scope === "file") {
    const { tableNumber, fileName } = request;
    return countInTable(tableNumber, (iss) => iss.source?.fileName === fileName);
  }

  if (scope === "animal") {
    const { tableNumber } = request;
    return countInTable(tableNumber);
  }

  if (scope === "all") {
    const tables = listSubdirs(PHOTOS_DIR);
    let total = 0;
    for (const t of tables) total += countInTable(t);
    return total;
  }

  return 0;
}

// Build export object for a run scope
export function buildExportObjectForScope({ PHOTOS_DIR, request }) {
  const scope = request.scope;

  const readAnimal = (tableNumber) => {
    const safe = safeTableNumber(tableNumber);
    const folder = path.join(PHOTOS_DIR, safe);
    const dataPath = path.join(folder, "data.json");
    const dataObj = loadDataFile(dataPath, safe);
    return { tableNumber: safe, rows: dataObj.rows || [] };
  };

  let animals = [];

  if (scope === "all") {
    const dirs = listSubdirs(PHOTOS_DIR).sort((a, b) => Number(a) - Number(b));
    animals = dirs.map(readAnimal);
  } else {
    // row/file/animal export the table-level data.json (which is fine for clean-start test runs)
    animals = [readAnimal(request.tableNumber)];
  }

  const totals = {
    animals: animals.length,
    rows: animals.reduce((acc, a) => acc + (a.rows?.length || 0), 0)
  };

  return {
    version: 1,
    exportedAt: Date.now(),
    scope,
    request,
    totals,
    animals
  };
}

export function writeExportFile({ projectRootDir, exportObj }) {
  const outDir = ensureDir(path.join(projectRootDir, "exports"));
  const fileName = `ocr_export_${tsName()}.json`;
  const abs = path.join(outDir, fileName);
  fs.writeFileSync(abs, JSON.stringify(exportObj, null, 2));
  return abs;
}