// public/ocr/state/rulesState.js

let rules = null;
let listeners = new Set();

export function getRules() {
  return rules;
}

export function setRules(nextRules) {
  rules = nextRules;
  notify();
}

export function onRulesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(rules);
    } catch (e) {
      console.error("rulesState listener error", e);
    }
  }
}