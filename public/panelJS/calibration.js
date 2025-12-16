// ============================================================
// calibration.js
// Calibration hotkeys for all required UI points
// ============================================================

console.log("Loaded calibration.js");

/* ------------------------------------------------------------
   ADD COLUMN
------------------------------------------------------------ */
window.addColumn = function () {
  const name = prompt("Column name? (first = Date)");
  if (!name) return;

  calibration.columns.push({
    name,
    startX: null,
    endX: null
  });

  drawColumns();
  log(`Added column "${name}"`);
  save();
};


/* ------------------------------------------------------------
   MAIN HOTKEY HANDLER
------------------------------------------------------------ */
window.addEventListener("keydown", async function (e) {

  const k = e.key.toLowerCase();

  // ==========================================================
  // COLUMN START/END CALIBRATION (S/E)
  // ==========================================================
  if (window.captureFor) {
    if (k === "s") {
      const pos = await getMouse();
      const col = calibration.columns.find(c => c.name === window.captureFor);

      if (col) {
        col.startX = pos.x;
        log(`Start of ${window.captureFor} = X:${pos.x}`);
        drawColumns();
        await save();
      }

      window.captureFor = null;
      return;
    }

    if (k === "e") {
      const pos = await getMouse();
      const col = calibration.columns.find(c => c.name === window.captureFor);

      if (col) {
        col.endX = pos.x;
        log(`End of ${window.captureFor} = X:${pos.x}`);
        drawColumns();
        await save();
      }

      window.captureFor = null;
      return;
    }
  }

  // ==========================================================
  // STEP 1 — TABLE REGION
  // ==========================================================
  if (k === "t") {
    const pos = await getMouse();
    calibration.tableTop = pos;
    document.getElementById("topVal").textContent = `Y:${pos.y}`;
    log(`Top = Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  if (k === "b") {
    const pos = await getMouse();
    calibration.tableBottom = pos;
    document.getElementById("botVal").textContent = `Y:${pos.y}`;
    log(`Bottom = Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // ==========================================================
  // STEP 3 — TITLE OCR REGION
  // ==========================================================
  if (k === "l") {
    const pos = await getMouse();
    calibration.titleTopLeft = pos;
    document.getElementById("titleTopLeftVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Title TL = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  if (k === "r") {
    const pos = await getMouse();
    calibration.titleBottomRight = pos;
    document.getElementById("titleBottomRightVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Title BR = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // ==========================================================
  // STEP 4 — NEXT TABLE BUTTON
  // ==========================================================
  if (k === "n") {
    const pos = await getMouse();
    calibration.nextTablePoint = pos;
    document.getElementById("nextTableVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Next Table point = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // ==========================================================
  // STEP 5 — NO-DATA REGION
  // ==========================================================
  if (k === "y") {
    const pos = await getMouse();
    calibration.noDataTopLeft = pos;
    document.getElementById("noDataTopLeftVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`No-data TL = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  if (k === "u") {
    const pos = await getMouse();
    calibration.noDataBottomRight = pos;
    document.getElementById("noDataBottomRightVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`No-data BR = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // ==========================================================
  // STEP 6 — SETTINGS & DATE FILTER CALIBRATION
  // ==========================================================

  // W = Settings button
  if (k === "w" && !e.ctrlKey) {
    const pos = await getMouse();
    calibration.settingsButtonPoint = pos;
    document.getElementById("settingsButtonVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Settings button = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // O = Settings TL
  if (k === "o") {
    const pos = await getMouse();
    calibration.settingsBoxTopLeft = pos;
    document.getElementById("settingsTLVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Settings TL = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // P = Settings BR
  if (k === "p") {
    const pos = await getMouse();
    calibration.settingsBoxBottomRight = pos;
    document.getElementById("settingsBRVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Settings BR = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // D = Date filter button
  if (k === "d") {
    const pos = await getMouse();
    calibration.dateFilterButtonPoint = pos;
    document.getElementById("dateFilterVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Date filter = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // F = Start date field
  if (k === "f") {
    const pos = await getMouse();
    calibration.dateStartFieldPoint = pos;
    document.getElementById("dateStartVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Start date field = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // G = End date field
  if (k === "g") {
    const pos = await getMouse();
    calibration.dateEndFieldPoint = pos;
    document.getElementById("dateEndVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`End date field = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // A = Apply button
  if (k === "a" && !e.ctrlKey) {
    const pos = await getMouse();
    calibration.applyChangesPoint = pos;
    document.getElementById("applyBtnVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Apply button = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

  // Q = Search box
  if (k === "q") {
    const pos = await getMouse();
    calibration.searchBoxPoint = pos;
    document.getElementById("searchBoxVal").textContent =
      `X:${pos.x} Y:${pos.y}`;
    log(`Search box = X:${pos.x} Y:${pos.y}`);
    await save();
    checkProgress();
    return;
  }

});