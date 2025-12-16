// ============================================================
// server/ocr/engine/geometry/crop.js
// PNG decode/crop/clamp helpers
// ============================================================

import pkg from "pngjs";
const { PNG } = pkg;

export function decodePng(buf) {
  return PNG.sync.read(buf);
}

export function pngToBuffer(png) {
  return PNG.sync.write(png);
}

export function cropPng(png, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const srcIdx = ((y + yy) * png.width + (x + xx)) * 4;
      const dstIdx = (yy * w + xx) * 4;
      out.data[dstIdx]     = png.data[srcIdx];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
}

export function clampRect(png, x, y, w, h) {
  const xx = Math.max(0, Math.min(png.width - 1, x));
  const yy = Math.max(0, Math.min(png.height - 1, y));
  const ww = Math.max(1, Math.min(png.width - xx, w));
  const hh = Math.max(1, Math.min(png.height - yy, h));
  return { x: xx, y: yy, w: ww, h: hh };
}