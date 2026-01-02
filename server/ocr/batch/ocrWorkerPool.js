// server/ocr/processing/ocrExtractor.js

import { createWorker } from "tesseract.js";
import { getWorkerCount } from "./concurrency.js";

let workers = [];
let index = 0;
let initialized = false;

export async function initOcrWorkers() {
  if (initialized) return;

  const count = getWorkerCount();

  for (let i = 0; i < count; i++) {
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789.:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz "
    });
    workers.push(worker);
  }

  initialized = true;
}

export function getOcrWorker() {
  if (!workers.length) {
    throw new Error("OCR workers not initialized");
  }

  const worker = workers[index];
  index = (index + 1) % workers.length;
  return worker;
}

export async function terminateOcrWorkers() {
  for (const w of workers) {
    await w.terminate();
  }
  workers = [];
  initialized = false;
}