// server/ocr/batch/concurrency.js

import os from "os";

/**
 * Determines worker count based on CPU.
 * Leaves 1 core free.
 */
export function getWorkerCount() {
  const cpuCount = os.cpus()?.length || 1;
  return Math.max(1, cpuCount - 1);
}