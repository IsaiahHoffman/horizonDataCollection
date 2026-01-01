// public/ocr/ui/layout.js

export function renderLayout() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <section id="rulesSection">
      <h2>Global OCR Rules</h2>
      <div id="rulesEditor"></div>
      <button id="saveRulesBtn">Save Rules</button>
      <div id="rulesStatus"></div>
    </section>

    <section id="runSection">
      <h2>Run OCR</h2>
      <div id="runControls"></div>
      <div id="runStatus"></div>
    </section>

    <section id="issuesSection">
      <h2>Issues</h2>
      <div id="issuesPanel"></div>
    </section>

    <section id="exportSection">
      <h2>Export</h2>
      <div id="exportPanel"></div>
    </section>
  `;
}