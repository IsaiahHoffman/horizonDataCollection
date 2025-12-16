// ============================================================
// capture.js
// Client-side wrappers for table & title capture
// ============================================================

console.log("Loaded capture.js");

/* ------------------------------------------------------------
   CAPTURE TABLE (One static PNG for the visible table area)
------------------------------------------------------------ */
window.captureTableImage = async function () {
  try {
    const res = await fetch("/capture-table");
    const data = await res.json();

    if (!res.ok || !data.success) {
      log("⚠ capture-table error: " + (data.error || "Unknown"));
      return null;
    }

    // data.buffer is base64 PNG
    return {
      base64: data.buffer,
      width: data.width,
      height: data.height
    };

  } catch (e) {
    log("⚠ captureTableImage exception: " + e.message);
    return null;
  }
};

/* ------------------------------------------------------------
   CAPTURE TITLE (OCR)
------------------------------------------------------------ */
window.captureTitleText = async function () {
  try {
    const res = await fetch("/capture-title");
    const data = await res.json();

    if (!res.ok || !data.success) {
      log("⚠ capture-title error: " + (data.error || "Unknown"));
      return "";
    }

    const text = (data.text || "").replace(/\s+/g, " ").trim();
    log(`📸 Title OCR: "${text}"`);

    return text;

  } catch (e) {
    log("⚠ captureTitleText exception: " + e.message);
    return "";
  }
};