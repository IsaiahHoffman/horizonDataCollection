// ============================================================
// endpoints.js
// Client → Server automation endpoints
// ============================================================

console.log("Loaded endpoints.js");

/* ------------------------------------------------------------
   CLICK POINT
------------------------------------------------------------ */
window.clickPoint = async function (pt) {
  if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") {
    log("⚠ clickPoint: invalid coords");
    return false;
  }

  try {
    const res = await fetch("/click-point", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pt)
    });

    const data = await res.json();
    if (!data.success) {
      log("⚠ clickPoint error: " + (data.error || "Unknown"));
      return false;
    }
    return true;

  } catch (e) {
    log("⚠ clickPoint exception: " + e.message);
    return false;
  }
};

/* ------------------------------------------------------------
   PRESS KEY
------------------------------------------------------------ */
window.pressKey = async function (key, ctrl = false) {
  try {
    const res = await fetch("/press-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ctrl })
    });

    const data = await res.json();
    if (!data.success) {
      log("⚠ pressKey error: " + (data.error || "Unknown"));
      return false;
    }
    return true;

  } catch (e) {
    log("⚠ pressKey exception: " + e.message);
    return false;
  }
};

/* ------------------------------------------------------------
   TYPE TEXT
------------------------------------------------------------ */
window.typeText = async function (text) {
  try {
    const res = await fetch("/type-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (!data.success) {
      log("⚠ typeText error: " + (data.error || "Unknown"));
      return false;
    }
    return true;

  } catch (e) {
    log("⚠ typeText exception: " + e.message);
    return false;
  }
};

/* ------------------------------------------------------------
   CHECK SETTINGS LOADED (OCR)
------------------------------------------------------------ */
window.checkSettingsLoaded = async function () {
  try {
    const res = await fetch("/check-settings-loaded");
    const data = await res.json();

    if (!data.success) {
      log("⚠ checkSettingsLoaded error: " + (data.error || "Unknown"));
      return { success: false, isLoaded: false, text: "" };
    }

    return data;

  } catch (e) {
    log("⚠ checkSettingsLoaded exception: " + e.message);
    return { success: false, isLoaded: false, text: "" };
  }
};

/* ------------------------------------------------------------
   SAVE BLOCK IMAGE (NEW)
   Saves one PNG fragment to:
   public/photos/<tableNumber>/<start> <end>.png
------------------------------------------------------------ */
window.saveBlockImage = async function (tableNumber, blockStart, blockEnd, base64PNG) {
  try {
    const res = await fetch("/save-block-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        blockStart,
        blockEnd,
        buffer: base64PNG
      })
    });

    const data = await res.json();
    if (!data.success) {
      log("⚠ saveBlockImage error: " + (data.error || "Unknown"));
      return false;
    }

    log(`💾 Saved block image → ${data.path}`);
    return true;

  } catch (e) {
    log("⚠ saveBlockImage exception: " + e.message);
    return false;
  }
};

/* ------------------------------------------------------------
   FETCH CALIBRATION
------------------------------------------------------------ */
window.fetchCalibration = async function () {
  try {
    return await fetch("/calibration").then(r => r.json());
  } catch (e) {
    log("⚠ fetchCalibration exception: " + e.message);
    return null;
  }
};

/* ------------------------------------------------------------
   SAVE CALIBRATION
------------------------------------------------------------ */
window.saveCalibration = async function () {
  try {
    await fetch("/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(window.calibration)
    });
    return true;

  } catch (e) {
    log("⚠ saveCalibration exception: " + e.message);
    return false;
  }
};