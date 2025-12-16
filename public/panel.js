// ============================================================
// panel.js  (Main Entry / Global Orchestrator)
// ============================================================

console.log("Loaded main panel.js");

// ------------------------------------------------------------
// GLOBAL SHARED STATE
// ------------------------------------------------------------
window.calibration = {
  tableTop: null,
  tableBottom: null,

  columns: [],

  titleTopLeft: null,
  titleBottomRight: null,

  nextTablePoint: null,

  noDataTopLeft: null,
  noDataBottomRight: null,

  // Settings + date filter calibration
  settingsButtonPoint: null,
  settingsBoxTopLeft: null,
  settingsBoxBottomRight: null,
  dateFilterButtonPoint: null,
  dateStartFieldPoint: null,
  dateEndFieldPoint: null,
  applyChangesPoint: null,
  searchBoxPoint: null,

  // Date-range automation
  dateRangeStart: "",
  dateRangeEnd: "",
  daysPerBlock: 7,
  firstTableNumber: null,

  // Fragmentation row calculations
  rowsPerScreen: 0
};

window.captureFor = null;

// Flags for automation
window.scanning = false;
window.scanRunning = false;
window.multiScanning = false;


// ------------------------------------------------------------
// APP STARTUP
// ------------------------------------------------------------
window.addEventListener("load", async () => {
  log("🔄 Loading calibration…");

  // Fetch calibration state
  let saved = null;
  try {
    saved = await fetch("/calibration").then(r => r.json());
  } catch (e) {
    log("⚠ Failed to load calibration: " + e.message);
  }

  if (saved) {
    Object.assign(window.calibration, saved);
    restoreCalibrationUI();
    log("♻ Calibration restored.");
  }

  // Show proper steps
  checkProgress();

  // Start coordinate watcher
  startMouseWatcher();
});