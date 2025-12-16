// ============================================================
// server/ocr/engine/preprocess/numericPreprocess.js
// Numeric preprocessing variants (kept as-is from current behavior)
// ============================================================

import pkg from "pngjs";
const { PNG } = pkg;

function scalePngNearest(png, scale = 4) {
  const out = new PNG({ width: png.width * scale, height: png.height * scale });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (y * png.width + x) * 4;
      for (let yy = 0; yy < scale; yy++) {
        for (let xx = 0; xx < scale; xx++) {
          const dx = x * scale + xx;
          const dy = y * scale + yy;
          const dstIdx = (dy * out.width + dx) * 4;
          out.data[dstIdx]     = png.data[srcIdx];
          out.data[dstIdx + 1] = png.data[srcIdx + 1];
          out.data[dstIdx + 2] = png.data[srcIdx + 2];
          out.data[dstIdx + 3] = png.data[srcIdx + 3];
        }
      }
    }
  }
  return out;
}

function toGrayArray(png) {
  const gray = new Uint8Array(png.width * png.height);
  let k = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    gray[k++] = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
  }
  return gray;
}

function thresholdGrayToBW(gray, w, h, thr) {
  const out = new PNG({ width: w, height: h });
  let k = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = gray[k++] < thr ? 0 : 255;
      const idx = (y * w + x) * 4;
      out.data[idx] = v;
      out.data[idx + 1] = v;
      out.data[idx + 2] = v;
      out.data[idx + 3] = 255;
    }
  }
  return out;
}

function dilateBW1px(png) {
  const out = new PNG({ width: png.width, height: png.height });
  out.data.fill(255);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;

  const w = png.width, h = png.height;
  const isBlack = (x, y) => png.data[(y * w + x) * 4] === 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBlack(x, y)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const o = (yy * w + xx) * 4;
          out.data[o] = 0; out.data[o + 1] = 0; out.data[o + 2] = 0; out.data[o + 3] = 255;
        }
      }
    }
  }
  return out;
}

export function preprocessNumericVariants(buf) {
  const src = PNG.sync.read(buf);
  const scaled = scalePngNearest(src, 4);
  const gray = toGrayArray(scaled);
  const thresholds = [245, 235, 225];
  return thresholds.map(thr => PNG.sync.write(dilateBW1px(thresholdGrayToBW(gray, scaled.width, scaled.height, thr))));
}