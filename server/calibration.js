// ============================================================
// server/calibration.js
// NEW CALIBRATION MANAGER (NO SCROLLING, NO PAGING)
// ============================================================

import fs from "fs";

export function createCalibrationManager(SAVE_PATH) {

  // ------------------------------------------------------------
  // DEFAULT CALIBRATION STRUCTURE (new system)
  // ------------------------------------------------------------
  let calibration = {
    // Table region (vertical)
    tableTop: null,          // {x,y}
    tableBottom: null,       // {x,y}

    // Column calibration (list of {name, startX, endX})
    columns: [],

    // Title OCR region
    titleTopLeft: null,
    titleBottomRight: null,

    // Next table button click point
    nextTablePoint: null,

    // No-data area (optional) — still used
    noDataTopLeft: null,
    noDataBottomRight: null,

    // Date-range automation: Settings menu
    settingsButtonPoint: null,
    settingsBoxTopLeft: null,
    settingsBoxBottomRight: null,

    // Date filter button
    dateFilterButtonPoint: null,

    // Date input fields
    dateStartFieldPoint: null,
    dateEndFieldPoint: null,

    // Apply button
    applyChangesPoint: null,

    // Search box (to return to first table)
    searchBoxPoint: null,

    // Date-range values
    dateRangeStart: "",
    dateRangeEnd: "",
    daysPerBlock: 7,

    // For restarting table at each block
    firstTableNumber: null,

    // NEW: how many rows fit on screen
    rowsPerScreen: 0
  };


  // ------------------------------------------------------------
  // LOAD existing calibration file if exists
  // ------------------------------------------------------------
  try {
    if (fs.existsSync(SAVE_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(SAVE_PATH, "utf8"));

      // Merge loaded values into new structure
      calibration = { ...calibration, ...loaded };

      // Ensure missing arrays/fields exist
      if (!calibration.columns) calibration.columns = [];
      if (!calibration.settingsButtonPoint) calibration.settingsButtonPoint = null;
      if (!calibration.settingsBoxTopLeft) calibration.settingsBoxTopLeft = null;
      if (!calibration.settingsBoxBottomRight) calibration.settingsBoxBottomRight = null;
      if (!calibration.dateFilterButtonPoint) calibration.dateFilterButtonPoint = null;
      if (!calibration.dateStartFieldPoint) calibration.dateStartFieldPoint = null;
      if (!calibration.dateEndFieldPoint) calibration.dateEndFieldPoint = null;
      if (!calibration.applyChangesPoint) calibration.applyChangesPoint = null;
      if (!calibration.searchBoxPoint) calibration.searchBoxPoint = null;
      if (!calibration.noDataTopLeft) calibration.noDataTopLeft = null;
      if (!calibration.noDataBottomRight) calibration.noDataBottomRight = null;

      if (!calibration.dateRangeStart) calibration.dateRangeStart = "";
      if (!calibration.dateRangeEnd) calibration.dateRangeEnd = "";
      if (!calibration.daysPerBlock) calibration.daysPerBlock = 7;
      if (!calibration.firstTableNumber) calibration.firstTableNumber = null;
      if (!calibration.rowsPerScreen) calibration.rowsPerScreen = 0;

      console.log("📁 Loaded previous calibration file.");
    }
  } catch (e) {
    console.error("❌ Error loading calibration:", e);
  }


  // ------------------------------------------------------------
  // SAVE calibration to disk
  // ------------------------------------------------------------
  function saveToFile() {
    try {
      fs.writeFileSync(SAVE_PATH, JSON.stringify(calibration, null, 2));
    } catch (e) {
      console.error("❌ Error saving calibration:", e);
    }
  }


  // ------------------------------------------------------------
  // GET & SET
  // ------------------------------------------------------------
  function getCalibration() {
    return calibration;
  }

  function setCalibration(newCal) {
    calibration = { ...calibration, ...newCal };

    if (!calibration.columns) calibration.columns = [];
    if (!calibration.settingsButtonPoint) calibration.settingsButtonPoint = null;
    if (!calibration.settingsBoxTopLeft) calibration.settingsBoxTopLeft = null;
    if (!calibration.settingsBoxBottomRight) calibration.settingsBoxBottomRight = null;
    if (!calibration.dateFilterButtonPoint) calibration.dateFilterButtonPoint = null;
    if (!calibration.dateStartFieldPoint) calibration.dateStartFieldPoint = null;
    if (!calibration.dateEndFieldPoint) calibration.dateEndFieldPoint = null;
    if (!calibration.applyChangesPoint) calibration.applyChangesPoint = null;
    if (!calibration.searchBoxPoint) calibration.searchBoxPoint = null;
    if (!calibration.noDataTopLeft) calibration.noDataTopLeft = null;
    if (!calibration.noDataBottomRight) calibration.noDataBottomRight = null;

    if (!calibration.dateRangeStart) calibration.dateRangeStart = "";
    if (!calibration.dateRangeEnd) calibration.dateRangeEnd = "";
    if (!calibration.daysPerBlock) calibration.daysPerBlock = 7;
    if (!calibration.firstTableNumber) calibration.firstTableNumber = null;
    if (!calibration.rowsPerScreen) calibration.rowsPerScreen = 0;

    saveToFile();
    return calibration;
  }

  return {
    getCalibration,
    setCalibration
  };
}