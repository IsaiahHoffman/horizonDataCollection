// ============================================================
// ui-helpers.js
// Shared UI helpers for calibration + automation console
// ============================================================

console.log("Loaded ui-helpers.js");

/* ------------------------------------------------------------
   LOGGING
------------------------------------------------------------ */
window.log = function (msg) {
  const c = document.getElementById("console");
  c.innerHTML += msg + "<br>";
  c.scrollTop = c.scrollHeight;
};

/* ------------------------------------------------------------
   GET MOUSE POSITION (server)
------------------------------------------------------------ */
window.getMouse = async function () {
  try {
    return await (await fetch("/mouse-position")).json();
  } catch (e) {
    log("⚠ getMouse error: " + e.message);
    return { x: 0, y: 0 };
  }
};

/* ------------------------------------------------------------
   SAVE CALIBRATION TO SERVER
------------------------------------------------------------ */
window.save = async function () {
  try {
    await fetch("/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(window.calibration)
    });
  } catch (e) {
    log("⚠ save error: " + e.message);
  }
};

/* ------------------------------------------------------------
   DRAW COLUMNS UI LIST
------------------------------------------------------------ */
window.drawColumns = function () {
  const box = document.getElementById("cols");
  box.innerHTML = "";

  calibration.columns.forEach(c => {
    const d = document.createElement("div");
    d.className = "col";
    d.innerHTML = `
      <strong>${c.name}</strong><br>
      start: ${c.startX ?? "(unset)"}<br>
      end: ${c.endX ?? "(unset)"}<br>
      <button data-n="${c.name}" class="setS">Set Start(S)</button>
      <button data-n="${c.name}" class="setE">Set End(E)</button>
    `;
    box.appendChild(d);
  });

  // Bind start
  box.querySelectorAll(".setS").forEach(b => {
    b.onclick = e => {
      window.captureFor = e.target.dataset.n;
      alert(`Hover start of ${window.captureFor} then press S`);
    };
  });

  // Bind end
  box.querySelectorAll(".setE").forEach(b => {
    b.onclick = e => {
      window.captureFor = e.target.dataset.n;
      alert(`Hover end of ${window.captureFor} then press E`);
    };
  });
};

/* ------------------------------------------------------------
   RESTORE CALIBRATION VALUES TO UI
------------------------------------------------------------ */
window.restoreCalibrationUI = function () {

  // Step 1
  if (calibration.tableTop)
    document.getElementById("topVal").textContent =
      `Y:${calibration.tableTop.y}`;

  if (calibration.tableBottom)
    document.getElementById("botVal").textContent =
      `Y:${calibration.tableBottom.y}`;

  // Step 2: columns
  drawColumns();

  // Step 3: title
  if (calibration.titleTopLeft)
    document.getElementById("titleTopLeftVal").textContent =
      `X:${calibration.titleTopLeft.x} Y:${calibration.titleTopLeft.y}`;

  if (calibration.titleBottomRight)
    document.getElementById("titleBottomRightVal").textContent =
      `X:${calibration.titleBottomRight.x} Y:${calibration.titleBottomRight.y}`;

  // Step 4: next table
  if (calibration.nextTablePoint)
    document.getElementById("nextTableVal").textContent =
      `X:${calibration.nextTablePoint.x} Y:${calibration.nextTablePoint.y}`;

  // Step 5: no‑data area
  if (calibration.noDataTopLeft)
    document.getElementById("noDataTopLeftVal").textContent =
      `X:${calibration.noDataTopLeft.x} Y:${calibration.noDataTopLeft.y}`;

  if (calibration.noDataBottomRight)
    document.getElementById("noDataBottomRightVal").textContent =
      `X:${calibration.noDataBottomRight.x} Y:${calibration.noDataBottomRight.y}`;

  // Step 6: Settings + Date Filter
  if (calibration.settingsButtonPoint)
    document.getElementById("settingsButtonVal").textContent =
      `X:${calibration.settingsButtonPoint.x} Y:${calibration.settingsButtonPoint.y}`;

  if (calibration.settingsBoxTopLeft)
    document.getElementById("settingsTLVal").textContent =
      `X:${calibration.settingsBoxTopLeft.x} Y:${calibration.settingsBoxTopLeft.y}`;

  if (calibration.settingsBoxBottomRight)
    document.getElementById("settingsBRVal").textContent =
      `X:${calibration.settingsBoxBottomRight.x} Y:${calibration.settingsBoxBottomRight.y}`;

  if (calibration.dateFilterButtonPoint)
    document.getElementById("dateFilterVal").textContent =
      `X:${calibration.dateFilterButtonPoint.x} Y:${calibration.dateFilterButtonPoint.y}`;

  if (calibration.dateStartFieldPoint)
    document.getElementById("dateStartVal").textContent =
      `X:${calibration.dateStartFieldPoint.x} Y:${calibration.dateStartFieldPoint.y}`;

  if (calibration.dateEndFieldPoint)
    document.getElementById("dateEndVal").textContent =
      `X:${calibration.dateEndFieldPoint.x} Y:${calibration.dateEndFieldPoint.y}`;

  if (calibration.applyChangesPoint)
    document.getElementById("applyBtnVal").textContent =
      `X:${calibration.applyChangesPoint.x} Y:${calibration.applyChangesPoint.y}`;

  if (calibration.searchBoxPoint)
    document.getElementById("searchBoxVal").textContent =
      `X:${calibration.searchBoxPoint.x} Y:${calibration.searchBoxPoint.y}`;

  // Step 7: date range
  if (calibration.dateRangeStart)
    document.getElementById("dateRangeStart").value = calibration.dateRangeStart;

  if (calibration.dateRangeEnd)
    document.getElementById("dateRangeEnd").value = calibration.dateRangeEnd;

  if (calibration.daysPerBlock)
    document.getElementById("daysPerBlock").value = calibration.daysPerBlock;

  // Step 8: rows per screen
  if (calibration.rowsPerScreen)
    document.getElementById("rowsPerScreen").value = calibration.rowsPerScreen;
};

/* ------------------------------------------------------------
   PROGRESS CONTROL – Which steps are visible?
------------------------------------------------------------ */
window.checkProgress = function () {

  // Step 1 always visible

  // Step 2
  if (calibration.tableTop && calibration.tableBottom) {
    document.getElementById("step2").style.display = "block";
  }

  // Step 3
  if (calibration.columns.length > 0) {
    document.getElementById("step3").style.display = "block";
  }

  // Step 4
  if (calibration.titleTopLeft && calibration.titleBottomRight) {
    document.getElementById("step4").style.display = "block";
  }

  // Step 5
  if (calibration.nextTablePoint) {
    document.getElementById("step5").style.display = "block";
  }

  // Step 6
  if (calibration.noDataTopLeft && calibration.noDataBottomRight) {
    document.getElementById("step6").style.display = "block";
  }

  // Step 7 – date range
  if (calibration.settingsButtonPoint &&
      calibration.settingsBoxTopLeft &&
      calibration.settingsBoxBottomRight &&
      calibration.dateFilterButtonPoint &&
      calibration.dateStartFieldPoint &&
      calibration.dateEndFieldPoint &&
      calibration.applyChangesPoint &&
      calibration.searchBoxPoint) {
    document.getElementById("step7").style.display = "block";
  }

  // Step 8 – rows per screen
  if (calibration.dateRangeStart &&
      calibration.dateRangeEnd &&
      calibration.daysPerBlock > 0) {
    document.getElementById("step8").style.display = "block";
  }

  // Scan block only when EVERYTHING calibrated
  const allGood =
    calibration.tableTop &&
    calibration.tableBottom &&
    calibration.columns.length > 0 &&
    calibration.titleTopLeft &&
    calibration.titleBottomRight &&
    calibration.nextTablePoint &&
    calibration.noDataTopLeft &&
    calibration.noDataBottomRight &&
    calibration.settingsButtonPoint &&
    calibration.settingsBoxTopLeft &&
    calibration.settingsBoxBottomRight &&
    calibration.dateFilterButtonPoint &&
    calibration.dateStartFieldPoint &&
    calibration.dateEndFieldPoint &&
    calibration.applyChangesPoint &&
    calibration.searchBoxPoint &&
    calibration.dateRangeStart &&
    calibration.dateRangeEnd &&
    calibration.daysPerBlock > 0 &&
    calibration.rowsPerScreen > 0;

  if (allGood) {
    document.getElementById("scanBlock").style.display = "block";
  }
};

/* ------------------------------------------------------------
   SAVE DATE RANGE
------------------------------------------------------------ */
window.saveDateRange = function () {
  calibration.dateRangeStart = document.getElementById("dateRangeStart").value.trim();
  calibration.dateRangeEnd   = document.getElementById("dateRangeEnd").value.trim();
  calibration.daysPerBlock   = +document.getElementById("daysPerBlock").value || 1;

  log(`💾 Saved date range: ${calibration.dateRangeStart} → ${calibration.dateRangeEnd} (block=${calibration.daysPerBlock})`);
  save();
  checkProgress();
};

/* ------------------------------------------------------------
   SAVE ROWS PER SCREEN
------------------------------------------------------------ */
window.saveRowsPerScreen = function () {
  calibration.rowsPerScreen = +document.getElementById("rowsPerScreen").value || 0;
  log(`💾 Saved rowsPerScreen = ${calibration.rowsPerScreen}`);
  save();
  checkProgress();
};

/* ------------------------------------------------------------
   MOUSE COORDINATE WATCHER
------------------------------------------------------------ */
window.startMouseWatcher = function () {
  setInterval(async () => {
    const p = await getMouse();
    document.getElementById("coords").textContent =
      `X:${p.x} Y:${p.y}`;
  }, 200);
};