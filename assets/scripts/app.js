import { ProblemPackEditor } from "./ProblemPackEditor.js";

if (!customElements.get("problem-pack-editor")) {
  customElements.define("problem-pack-editor", ProblemPackEditor);
}
