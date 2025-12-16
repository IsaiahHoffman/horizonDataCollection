// ============================================================
// server/ocr/engine/ocrText.js
// Tesseract OCR wrapper
// ============================================================

import Tesseract from "tesseract.js";
import { normalizeOcrText } from "../rules/ocrRuleEngine.js";

export async function ocrOneLineFromBuffer(buf, { whitelist, psm = "7", numericMode = false } = {}) {
  const params = {
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: "1"
  };

  if (whitelist) params.tessedit_char_whitelist = whitelist;

  if (numericMode) {
    params.classify_bln_numeric_mode = "1";
    params.load_system_dawg = "0";
    params.load_freq_dawg = "0";
  }

  const r = await Tesseract.recognize(buf, "eng", params);
  return normalizeOcrText(r?.data?.text || "");
}