export function ensureBatchQueueState(r, defaultConcurrency) {
  r.queue ||= [];
  r.queueSet ||= new Set();
  r.inFlightSet ||= new Set();
  r.concurrency ||= defaultConcurrency();
}

export function taskKey({ tableNumber, fileName }) {
  return `${tableNumber}::${fileName}`;
}

export function enqueueTask(r, task, { priority = false } = {}) {
  const k = taskKey(task);
  if (r.queueSet.has(k) || r.inFlightSet.has(k)) return false;

  r.queueSet.add(k);
  priority ? r.queue.unshift(task) : r.queue.push(task);
  return true;
}