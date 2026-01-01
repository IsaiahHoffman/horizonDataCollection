// public/ocr/app.js

import { renderLayout } from "./ui/layout.js";
import { initRunControls } from "./ui/runControls.js";
import { initRulesEditor } from "./ui/rulesEditor.js";
import { initIssuesPanel } from "./ui/issuesPanel.js";
import { initExportPanel } from "./ui/exportPanel.js";

function init() {
  renderLayout();

  initRulesEditor();
  initRunControls();
  initIssuesPanel();
  initExportPanel();
}

init();