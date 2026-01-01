// server/ocr/rules/ruleEngine.js

import {
  validateDate,
  validateEnum,
  validateFormat
} from "./validators.js";

export function validateCell({
  value,
  columnIndex,
  rules,
  allowOverride = false
}) {
  const col = rules?.columns?.[columnIndex];
  if (!col) {
    return { ok: false, reason: "Unknown column" };
  }

  const raw = typeof value === "string" ? value.trim() : "";

  // -------------------------
  // Date column (index 0)
  // -------------------------
  if (columnIndex === 0) {
    if (!validateDate(raw)) {
      return { ok: false, reason: "Invalid date format" };
    }
    return { ok: true };
  }

  // -------------------------
  // Empty handling
  // -------------------------
  if (!raw) {
    if (col.allowEmpty) {
      return { ok: true };
    }
    return { ok: false, reason: "Value is required" };
  }

  // -------------------------
  // Override bypass (non-date)
  // -------------------------
  if (allowOverride) {
    return { ok: true };
  }

  switch (col.type) {
    case "none":
      return { ok: true };

    case "enum":
      if (
        !validateEnum(
          raw,
          col.config?.values || [],
          col.strictCase
        )
      ) {
        return { ok: false, reason: "Value not in enum" };
      }
      return { ok: true };

    case "format":
      if (
        !validateFormat(
          raw,
          col.config?.formats || []
        )
      ) {
        return { ok: false, reason: "Value does not match format" };
      }
      return { ok: true };

    default:
      return { ok: false, reason: "Unknown rule type" };
  }
}