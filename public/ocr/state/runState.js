// public/ocr/state/runState.js

let currentRun = null;
let listeners = new Set();

export function getRun() {
  return currentRun;
}

export function setRun(run) {
  currentRun = run;
  notify();
}

export function clearRun() {
  currentRun = null;
  notify();
}

export function onRunChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(currentRun);
    } catch (e) {
      console.error("runState listener error", e);
    }
  }
}