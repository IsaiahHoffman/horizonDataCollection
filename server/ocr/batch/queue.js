// server/ocr/batch/queue.js

export async function runQueue({
  items,
  workerCount,
  workerFn,
  stopRequested,
  pauseRequested,
  onItemStart
}) {
  let index = 0;

  async function worker() {
    while (true) {
      if (stopRequested()) return;

      // Pause loop
      while (pauseRequested()) {
        await new Promise(r => setTimeout(r, 200));
        if (stopRequested()) return;
      }

      const i = index++;
      if (i >= items.length) return;

      if (onItemStart) {
        onItemStart(i);
      }

      await workerFn(items[i], i);
    }
  }

  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}