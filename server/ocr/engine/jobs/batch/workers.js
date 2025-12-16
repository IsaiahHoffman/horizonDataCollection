export async function runQueueWorkers(r, workerFn) {
  const workers = Array.from(
    { length: r.concurrency },
    () => async () => {
      while (!r.stopRequested) {
        const task = r.queue.shift();
        if (!task) return;

        const k = task.key;
        r.queueSet.delete(k);
        r.inFlightSet.add(k);

        try {
          await workerFn(task);
        } finally {
          r.inFlightSet.delete(k);
        }
      }
    }
  );

  await Promise.all(workers.map(w => w()));
}