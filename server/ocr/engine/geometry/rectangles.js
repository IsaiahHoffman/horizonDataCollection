// ============================================================
// server/ocr/engine/geometry/rectangles.js
// Build row/column rectangles from calibration.json
// ============================================================

export function buildCellRectangles(cal, SCREEN_SCALE) {
  const { tableTop, tableBottom, columns, rowsPerScreen } = cal;

  const logicalXStart = Math.min(...columns.map(c => c.startX));
  const logicalTopY = tableTop.y;

  const logicalHeight = tableBottom.y - tableTop.y;
  const rowHeightLogical = logicalHeight / rowsPerScreen;

  const xOriginPx = Math.round(logicalXStart * SCREEN_SCALE);
  const yOriginPx = Math.round(logicalTopY * SCREEN_SCALE);

  const colRects = columns.map(c => {
    const leftAbs = Math.round(c.startX * SCREEN_SCALE);
    const rightAbs = Math.round(c.endX * SCREEN_SCALE);
    return {
      name: c.name,
      x: leftAbs - xOriginPx,
      w: Math.max(1, rightAbs - leftAbs)
    };
  });

  const rowRects = [];
  for (let r = 0; r < rowsPerScreen; r++) {
    const topAbs = Math.round((logicalTopY + r * rowHeightLogical) * SCREEN_SCALE);
    const botAbs = Math.round((logicalTopY + (r + 1) * rowHeightLogical) * SCREEN_SCALE);
    rowRects.push({
      r,
      y: topAbs - yOriginPx,
      h: Math.max(1, botAbs - topAbs)
    });
  }

  return { colRects, rowRects };
}