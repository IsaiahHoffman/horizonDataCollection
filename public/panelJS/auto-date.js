// ============================================================
// auto-date.js
// ENTIRE AUTOMATION ENGINE (Date Blocks + Fragmentation +
// Multi-Table Looping + Saving PNGs)
// ============================================================

console.log("Loaded auto-date.js");

/* ------------------------------------------------------------
   WAIT helper
------------------------------------------------------------ */
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ------------------------------------------------------------
   Robustly apply a date range (retries).
   This prevents the "segmented range didn't actually apply" bug,
   which causes wrong filenames + duplicates.
------------------------------------------------------------ */
async function applyDateRangeWithRetry(startDate, endDate, label = "") {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const okSettings = await openSettingsAndVerify();
    if (!okSettings) {
      log(`⚠ (${label}) Failed to open Settings (attempt ${attempt}/6)`);
      continue;
    }

    const okFilter = await selectDateFilter();
    if (!okFilter) {
      log(`⚠ (${label}) Failed to select Date filter (attempt ${attempt}/6)`);
      await delay(250);
      continue;
    }

    const okEnter = await enterDateRange(startDate, endDate);
    if (!okEnter) {
      log(`⚠ (${label}) Failed to enter date range (attempt ${attempt}/6)`);
      await delay(250);
      continue;
    }

    // Give the table time to refresh
    await delay(900);
    return true;
  }

  log(`❌ (${label}) Could not apply date range ${startDate} → ${endDate}`);
  return false;
}

/* ------------------------------------------------------------
   OPEN SETTINGS (OCR verification)
------------------------------------------------------------ */
window.openSettingsAndVerify = async function () {
  const p = calibration.settingsButtonPoint;
  if (!p) {
    log("⚠ Settings button not calibrated.");
    return false;
  }

  for (let i = 0; i < 6; i++) {
    await clickPoint(p);
    await delay(400);

    const chk = await checkSettingsLoaded();
    if (chk.success && chk.isLoaded) {
      log("✅ Settings opened.");
      return true;
    }

    log(`⚠ Settings not loaded (try ${i + 1}/6)`);
  }

  log("❌ Failed to open Settings.");
  return false;
};

/* ------------------------------------------------------------
   SELECT DATE FILTER
------------------------------------------------------------ */
window.selectDateFilter = async function () {
  const p = calibration.dateFilterButtonPoint;
  if (!p) {
    log("⚠ Date filter button not calibrated.");
    return false;
  }
  await clickPoint(p);
  await delay(200);
  return true;
};

/* ------------------------------------------------------------
   ENTER DATE RANGE INTO FIELDS
------------------------------------------------------------ */
window.enterDateRange = async function (startDate, endDate) {
  const sf = calibration.dateStartFieldPoint;
  const ef = calibration.dateEndFieldPoint;
  const ap = calibration.applyChangesPoint;

  if (!sf || !ef || !ap) {
    log("⚠ Date range fields not calibrated.");
    return false;
  }

  await clickPoint(sf);
  await delay(150);
  await pressKey("a", true);
  await pressKey("backspace");
  await typeText(startDate);
  await delay(250);

  await clickPoint(ef);
  await delay(150);
  await pressKey("a", true);
  await pressKey("backspace");
  await typeText(endDate);
  await delay(250);

  log(`🖱 Applying date range ${startDate} → ${endDate}`);
  await clickPoint(ap);
  await delay(900);

  return true;
};

/* ------------------------------------------------------------
   RETURN TO FIRST TABLE VIA SEARCH BOX
------------------------------------------------------------ */
window.returnToFirstTable = async function () {
  const sp = calibration.searchBoxPoint;
  const num = calibration.firstTableNumber;

  if (!sp) {
    log("⚠ Search box not calibrated.");
    return false;
  }
  if (!num) {
    log("⚠ firstTableNumber not set.");
    return false;
  }

  for (let attempt = 1; attempt <= 6; attempt++) {
    await clickPoint(sp);
    await delay(200);

    await pressKey("a", true);
    await pressKey("backspace");

    await typeText(String(num));
    await delay(500);

    await pressKey("enter");
    await delay(700);

    await pressKey("enter");
    await delay(800);

    const chk = await fetch("/check-table-state").then(r => r.json());

    if (chk.success && (chk.state === "data" || chk.state === "no-data")) {
      log(`✅ Returned to first table ${num}.`);
      return true;
    }

    log(`⏳ Waiting for table load… (${attempt}/6)`);
  }

  log("❌ Could not return to first table.");
  return false;
};

/* ------------------------------------------------------------
   EXTRACT TABLE NUMBER FROM TITLE TEXT
------------------------------------------------------------ */
window.extractTableNumber = function (text) {
  if (!text) return null;
  const m = text.match(/^\s*([0-9]+)/);
  return m ? m[1] : null;
};

/* ------------------------------------------------------------
   COMPUTE DATE BLOCK BOUNDARIES
   (unchanged: you said advancing a day loses data)
------------------------------------------------------------ */
window.computeNextDateBlock = function (currStr, endStr, blockDays) {
  const parse = s =>
    new Date(
      s.slice(4),
      s.slice(2, 4) - 1,
      s.slice(0, 2)
    );

  const toStr = d =>
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    d.getFullYear();

  const start = parse(currStr);
  const end = parse(endStr);

  const blockEnd = new Date(start);
  blockEnd.setDate(blockEnd.getDate() + (blockDays - 1));
  if (blockEnd > end) blockEnd.setTime(end.getTime());

  const nextStart = new Date(blockEnd);
  nextStart.setDate(nextStart.getDate()); // intentional overlap

  return {
    blockStart: currStr,
    blockEnd: toStr(blockEnd),
    nextStart: toStr(nextStart),
    isLast: blockEnd.getTime() === end.getTime()
  };
};

/* ------------------------------------------------------------
   OCR LAST ROW CELL (Date column only)
------------------------------------------------------------ */
window.getLastRowDateString = async function () {
  try {
    const chk = await fetch("/check-table-state").then(r => r.json());
    if (!chk.success) {
      log("⚠ check-table-state error");
      return { hasData: false, dateStr: "" };
    }

    if (chk.state === "no-data") {
      return { hasData: false, dateStr: "" };
    }

    const txt = chk.lastCell || "";
    const cleaned = txt.replace(/\s+/g, " ").trim();
    if (!cleaned) return { hasData: false, dateStr: "" };

    const m = cleaned.match(/^(\d{1,2}\.\d{1,2}\.\d{4})/);
    if (!m) return { hasData: false, dateStr: "" };

    const [d, mo, y] = m[1].split(".");
    const dd = d.padStart(2, "0");
    const mm = mo.padStart(2, "0");
    const yyyy = y;

    return { hasData: true, dateStr: `${dd}${mm}${yyyy}` };
  } catch (e) {
    log("⚠ getLastRowDateString exception: " + e.message);
    return { hasData: false, dateStr: "" };
  }
};

/* ------------------------------------------------------------
   FRAGMENTATION LOGIC (fixed)
   Fixes:
   - Wrong second filename (uses captureStart/captureEnd)
   - Duplicates (dedupe keys)
   - If Settings/apply fails, stop segmenting (prevents re-capturing original range)
------------------------------------------------------------ */
window.fragmentTableForBlock = async function (origStart, origEnd) {
  let currentStart = origStart;
  let currentEnd = origEnd;

  const tableNumber = calibration.currentTableNumber;

  // NEW: track whether we ever applied a segmented range
  let rangeChanged = false;

  // prevent duplicate saves if the loop repeats a range
  const savedKeys = new Set();
  async function saveOnce(start, end, base64) {
    const key = `${tableNumber}|${start}|${end}`;
    if (savedKeys.has(key)) {
      log(`↪ Duplicate segment ${start} → ${end} skipped`);
      return true;
    }
    savedKeys.add(key);
    return await saveBlockImage(tableNumber, start, end, base64);
  }

  while (true) {
    const captureStart = currentStart;
    const captureEnd = currentEnd;

    log(`🖼 Capturing fragment: ${captureStart} → ${captureEnd}`);

    const img = await captureTableImage();
    if (!img) {
      log("⚠ captureTableImage failed");
      return { rangeChanged };
    }

    const { hasData, dateStr } = await getLastRowDateString();

    // Final segment
    if (!hasData) {
      log(`📁 Final segment: ${captureStart} → ${captureEnd}`);
      await saveOnce(captureStart, captureEnd, img.base64);
      return { rangeChanged };
    }

    const boundary = dateStr;

    // Can't segment further safely
    if (boundary === captureStart) {
      log(`⚠ Boundary equals start (${boundary}). Cannot segment further by date-only filter.`);
      log(`📁 Saving single segment and stopping: ${captureStart} → ${captureEnd}`);
      await saveOnce(captureStart, captureEnd, img.base64);
      return { rangeChanged };
    }

    log(`🔀 Overflow detected at ${boundary}`);

    // Save partial from this screenshot
    await saveOnce(captureStart, boundary, img.base64);

    // Apply next segmented range (boundary → origEnd)
    currentStart = boundary;
    currentEnd = origEnd;

    const ok = await applyDateRangeWithRetry(currentStart, currentEnd, "segment");
    if (!ok) {
      log("❌ Segment range could not be applied. Stopping segmentation to avoid bad captures.");
      return { rangeChanged };
    }

    // NEW: date range was changed away from the original block
    rangeChanged = true;

    await delay(800);
  }
};

/* ------------------------------------------------------------
   PROCESS ONE TABLE FOR ONE BLOCK
------------------------------------------------------------ */
window.processTableForBlock = async function (origStart, origEnd) {
  const title = await captureTitleText();
  const num = extractTableNumber(title);

  if (!num) {
    log("⚠ Could not extract table number. Skipping table.");
    return { tableNumber: null, rangeChanged: false };
  }

  calibration.currentTableNumber = num;
  log(`📌 Processing table #${num}`);

  const fragInfo = await fragmentTableForBlock(origStart, origEnd);
  return { tableNumber: num, rangeChanged: !!fragInfo?.rangeChanged };
};

/* ------------------------------------------------------------
   TABLE LOOP for one block
   FIX: Always reset range back to full block before clicking Next Table.
------------------------------------------------------------ */
window.runTableLoopForBlock = async function (origStart, origEnd) {
  const seen = new Set();

  while (true) {
    const result = await processTableForBlock(origStart, origEnd);
    const thisNum = result.tableNumber;
    if (!thisNum) return;

    if (seen.has(thisNum)) {
      log("⛔ Table list completed.");
      return;
    }
    seen.add(thisNum);

    // Speed improvement:
    // Only reset back to the full block if segmentation changed the date range.
    if (result.rangeChanged) {
      const resetOk = await applyDateRangeWithRetry(
        origStart,
        origEnd,
        "reset-before-next-table"
      );
      if (!resetOk) {
        log("⚠ Could not reset date range before next table. Continuing anyway.");
      }
    } else {
      log("⚡ No segmentation: skipping date-range reset before next table.");
    }

    await clickPoint(calibration.nextTablePoint);
    await delay(1000);
  }
};

/* ------------------------------------------------------------
   FULL DATE BLOCK PROCESSING
------------------------------------------------------------ */
window.runDateBlock = async function (blockStart, blockEnd) {
  log(`==============================`);
  log(`📅 STARTING BLOCK: ${blockStart} → ${blockEnd}`);
  log(`==============================`);

  await applyDateRangeWithRetry(blockStart, blockEnd, "start-block");

  await returnToFirstTable();
  await delay(800);

  await runTableLoopForBlock(blockStart, blockEnd);

  log(`🏁 Block completed: ${blockStart} → ${blockEnd}`);
};

/* ------------------------------------------------------------
   MASTER FUNCTION: Scan Full Date Range
------------------------------------------------------------ */
window.scanFullDateRange = async function () {
  log("🚀 Starting full date-range scan…");

  const title = await captureTitleText();
  const num = extractTableNumber(title);
  if (!num) {
    log("⚠ Could not extract starting table number.");
    return;
  }

  calibration.firstTableNumber = num;
  await saveCalibration();
  log(`📌 First table number = ${num}`);

  const origStart = calibration.dateRangeStart;
  const origEnd = calibration.dateRangeEnd;
  const blockDays = calibration.daysPerBlock;

  let current = origStart;

  while (true) {
    const blk = computeNextDateBlock(current, origEnd, blockDays);

    await runDateBlock(blk.blockStart, blk.blockEnd);

    if (blk.isLast) break;

    current = blk.nextStart;
    log(`➡ Next block start: ${current}`);
  }

  log("🎉 ALL BLOCKS COMPLETED!");
};