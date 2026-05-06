export class ProblemPackEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      identifier: "sample_problem_set",
      title: "Sample Problem Set",
      problems: [],
      imageStore: new Map()
    };
  }

  connectedCallback() {
    this.render();
    this.addProblem("choice");
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: grid; gap: 14px; }
        .card {
          background: #fff;
          border: 1px solid #d7dee7;
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(20, 30, 50, 0.06);
          padding: 14px;
          margin: 10px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 820px) {
          .meta-grid { grid-template-columns: 1fr; }
        }
        label {
          display: block;
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 13px;
        }
        input[type="text"], textarea, select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #c8d2df;
          border-radius: 10px;
          background: #f9fbfd;
          padding: 10px;
          color: #1f2937;
          font-size: 14px;
        }
        textarea { min-height: 74px; resize: vertical; }
        .toolbar, .row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        button {
          border: 0;
          background: #0f766e;
          color: #fff;
          border-radius: 10px;
          padding: 9px 12px;
          cursor: pointer;
          font-weight: 700;
        }
        button.secondary { background: #334155; }
        button.ghost { background: #e5eaf0; color: #1f2937; }
        button.danger { background: #b42318; }
        .problem-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .problem-index { font-weight: 800; }
        .section-title { font-size: 13px; color: #475467; margin: 2px 0 8px; font-weight: 700; }
        .option-list, .condition-list { display: grid; gap: 8px; }
        .muted { color: #667085; font-size: 12px; }
        .footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .status { font-size: 12px; color: #475467; }
      </style>

      <div class="wrap">
        <div class="card">
          <div class="meta-grid">
            <div>
              <label>문제세트 Identifier</label>
              <input id="pack-id" type="text" placeholder="sample_problem_set" />
            </div>
            <div>
              <label>문제세트 제목</label>
              <input id="pack-title" type="text" placeholder="Sample Problem Set" />
            </div>
          </div>
          <div class="toolbar" style="margin-top:10px;">
            <button id="add-choice">객관식 추가</button>
            <button id="add-short" class="secondary">단답형 추가</button>
            <button id="upload" class="secondary">ZIP/JSON 불러오기</button>
            <button id="download" class="ghost">ZIP 다운로드</button>
            <input id="upload-file" type="file" accept=".zip,.json,application/zip,application/json" style="display:none;" />
          </div>
        </div>

        <div id="problem-list"></div>

        <div class="footer">
          <div class="status" id="status">준비됨</div>
        </div>
      </div>
    `;

    this.bindRoot();
    this.renderProblems();
  }

  bindRoot() {
    const idEl = this.shadowRoot.getElementById("pack-id");
    const titleEl = this.shadowRoot.getElementById("pack-title");
    idEl.value = this.state.identifier;
    titleEl.value = this.state.title;

    idEl.addEventListener("input", () => {
      this.state.identifier = this.sanitizeId(idEl.value || "problem_set");
      idEl.value = this.state.identifier;
    });
    titleEl.addEventListener("input", () => {
      this.state.title = titleEl.value;
    });

    this.shadowRoot.getElementById("add-choice").addEventListener("click", () => this.addProblem("choice"));
    this.shadowRoot.getElementById("add-short").addEventListener("click", () => this.addProblem("shortAnswer"));
    this.shadowRoot.getElementById("upload").addEventListener("click", () => {
      const fileEl = this.shadowRoot.getElementById("upload-file");
      fileEl.value = "";
      fileEl.click();
    });
    this.shadowRoot.getElementById("upload-file").addEventListener("change", async (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      await this.importFromFile(file);
    });
    this.shadowRoot.getElementById("download").addEventListener("click", () => this.downloadZip());
  }

  addProblem(kind) {
    const idx = this.state.problems.length + 1;
    const base = {
      id: `p${idx}`,
      prompt: "",
      figureIdentifier: "",
      figureFileName: "",
      grading: { retryOnWrong: true },
      onCorrect: { scoreboard: [] },
      choice: null,
      shortAnswer: null
    };

    if (kind === "choice") {
      base.choice = { options: ["", "", "", ""], correctIndex: 0 };
    } else {
      base.shortAnswer = {
        operator: "and",
        conditions: [{ type: "contains", value: "", ignoreCase: true }]
      };
    }

    this.state.problems.push(base);
    this.renderProblems();
  }

  renderProblems() {
    const host = this.shadowRoot.getElementById("problem-list");
    host.innerHTML = "";

    this.state.problems.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="problem-head">
          <div class="problem-index">문제 ${i + 1}</div>
          <div class="row">
            <button class="ghost" data-act="up">위로</button>
            <button class="ghost" data-act="down">아래로</button>
            <button class="danger" data-act="remove">삭제</button>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <label>문제 ID</label>
            <input type="text" data-field="id" value="${this.escape(p.id)}" />
          </div>
          <div>
            <label>문제 타입</label>
            <select data-field="type">
              <option value="choice" ${p.choice ? "selected" : ""}>객관식</option>
              <option value="shortAnswer" ${p.shortAnswer ? "selected" : ""}>단답형</option>
            </select>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label>지문</label>
          <textarea data-field="prompt">${this.escape(p.prompt)}</textarea>
        </div>

        <div style="margin-top:8px;">
          <label>참고 이미지(선택)</label>
          <input type="file" accept="image/*" data-field="image" />
          <div class="muted">JSON에는 figure: probfig:(identifier) 형식으로 저장됩니다.</div>
          <div class="muted">현재: ${p.figureIdentifier ? `probfig:(${this.escape(p.figureIdentifier)})` : "없음"}</div>
        </div>

        <div class="type-panel"></div>
      `;

      this.bindProblemCard(el, p, i);
      host.appendChild(el);
    });
  }

  bindProblemCard(card, problem, index) {
    const idEl = card.querySelector("input[data-field=\"id\"]");
    const typeEl = card.querySelector("select[data-field=\"type\"]");
    const promptEl = card.querySelector("textarea[data-field=\"prompt\"]");
    const imageEl = card.querySelector("input[data-field=\"image\"]");

    idEl.addEventListener("input", () => {
      problem.id = this.sanitizeId(idEl.value || `p${index + 1}`);
      idEl.value = problem.id;
    });

    typeEl.addEventListener("change", () => {
      if (typeEl.value === "choice") {
        problem.choice = problem.choice || { options: ["", "", "", ""], correctIndex: 0 };
        problem.shortAnswer = null;
      } else {
        problem.shortAnswer = problem.shortAnswer || { operator: "and", conditions: [{ type: "contains", value: "", ignoreCase: true }] };
        problem.choice = null;
      }
      this.renderProblems();
    });

    promptEl.addEventListener("input", () => {
      problem.prompt = promptEl.value;
    });

    imageEl.addEventListener("change", async () => {
      const file = imageEl.files && imageEl.files[0];
      if (!file) {
        problem.figureIdentifier = "";
        problem.figureFileName = "";
        return;
      }
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const base = this.sanitizeId(file.name.replace(/\.[^/.]+$/, "")) || `problem_${index + 1}_figure`;
      const unique = this.uniqueFigureId(base);
      const arrayBuffer = await file.arrayBuffer();
      this.state.imageStore.set(unique, { fileName: `${unique}.${ext}`, data: arrayBuffer, mime: file.type || "image/png" });
      problem.figureIdentifier = unique;
      problem.figureFileName = `${unique}.${ext}`;
      this.renderProblems();
    });

    card.querySelector("[data-act=\"remove\"]").addEventListener("click", () => {
      this.state.problems.splice(index, 1);
      this.renderProblems();
    });
    card.querySelector("[data-act=\"up\"]").addEventListener("click", () => {
      if (index <= 0) return;
      const tmp = this.state.problems[index - 1];
      this.state.problems[index - 1] = this.state.problems[index];
      this.state.problems[index] = tmp;
      this.renderProblems();
    });
    card.querySelector("[data-act=\"down\"]").addEventListener("click", () => {
      if (index >= this.state.problems.length - 1) return;
      const tmp = this.state.problems[index + 1];
      this.state.problems[index + 1] = this.state.problems[index];
      this.state.problems[index] = tmp;
      this.renderProblems();
    });

    const typePanel = card.querySelector(".type-panel");
    if (problem.choice) {
      this.renderChoicePanel(typePanel, problem);
    } else {
      this.renderShortAnswerPanel(typePanel, problem);
    }

    this.renderBehaviorPanel(typePanel, problem);
  }

  renderBehaviorPanel(host, problem) {
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="section-title" style="margin-top:12px;">채점/보상 설정</div>
      <div class="row" style="margin-bottom:8px;">
        <label style="display:flex; align-items:center; gap:6px; margin:0;">
          <input type="checkbox" data-field="retry-on-wrong" ${problem?.grading?.retryOnWrong !== false ? "checked" : ""} />
          오답 시 재도전 허용
        </label>
      </div>
      <div class="section-title" style="margin-top:10px;">정답 시 Scoreboard 변경</div>
      <div class="scoreboard-list"></div>
      <div class="row" style="margin-top:8px;">
        <button class="ghost" data-act="add-score-action">스코어 변경 추가</button>
      </div>
    `;
    host.appendChild(panel);

    problem.grading = problem.grading || { retryOnWrong: true };
    problem.onCorrect = problem.onCorrect || { scoreboard: [] };
    problem.onCorrect.scoreboard = Array.isArray(problem.onCorrect.scoreboard) ? problem.onCorrect.scoreboard : [];

    const retryEl = panel.querySelector("input[data-field=\"retry-on-wrong\"]");
    retryEl.addEventListener("change", () => {
      problem.grading.retryOnWrong = retryEl.checked;
    });

    const listHost = panel.querySelector(".scoreboard-list");
    this.renderScoreboardActions(listHost, problem);

    panel.querySelector("[data-act=\"add-score-action\"]").addEventListener("click", () => {
      problem.onCorrect.scoreboard.push({ objective: "", criteria: "dummy", operation: "add", value: 1 });
      this.renderProblems();
    });
  }

  renderScoreboardActions(host, problem) {
    host.innerHTML = "";
    const actions = problem?.onCorrect?.scoreboard || [];
    actions.forEach((action, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <input type="text" data-field="objective" value="${this.escape(action.objective || "")}" style="flex:1; min-width:180px;" placeholder="objective identifier" />
        <select data-field="criteria" style="width:110px;">
          <option value="dummy" ${(action.criteria || "dummy") === "dummy" ? "selected" : ""}>dummy</option>
          <option value="trigger" ${(action.criteria || "dummy") === "trigger" ? "selected" : ""}>trigger</option>
        </select>
        <select data-field="operation" style="width:110px;">
          <option value="add" ${(action.operation || "add") === "add" ? "selected" : ""}>add</option>
          <option value="set" ${(action.operation || "add") === "set" ? "selected" : ""}>set</option>
          <option value="remove" ${(action.operation || "add") === "remove" ? "selected" : ""}>remove</option>
        </select>
        <input type="number" data-field="value" value="${Number.isFinite(action.value) ? action.value : 1}" style="width:100px;" />
        <button class="ghost" data-act="remove-score-action">삭제</button>
      `;

      const objectiveEl = row.querySelector("input[data-field=\"objective\"]");
      const criteriaEl = row.querySelector("select[data-field=\"criteria\"]");
      const operationEl = row.querySelector("select[data-field=\"operation\"]");
      const valueEl = row.querySelector("input[data-field=\"value\"]");
      const removeEl = row.querySelector("button[data-act=\"remove-score-action\"]");

      objectiveEl.addEventListener("input", () => {
        action.objective = this.sanitizeId(objectiveEl.value || "");
        objectiveEl.value = action.objective;
      });
      criteriaEl.addEventListener("change", () => {
        action.criteria = criteriaEl.value === "trigger" ? "trigger" : "dummy";
      });
      operationEl.addEventListener("change", () => {
        action.operation = ["add", "set", "remove"].includes(operationEl.value) ? operationEl.value : "add";
      });
      valueEl.addEventListener("input", () => {
        const n = Number.parseInt(valueEl.value, 10);
        action.value = Number.isFinite(n) ? n : 0;
      });
      removeEl.addEventListener("click", () => {
        problem.onCorrect.scoreboard.splice(i, 1);
        this.renderProblems();
      });

      host.appendChild(row);
    });
  }

  renderChoicePanel(host, problem) {
    host.innerHTML = `
      <div class="section-title" style="margin-top:10px;">객관식 설정</div>
      <div class="option-list"></div>
      <div class="row" style="margin-top:8px;">
        <button class="ghost" data-act="add-opt">선택지 추가</button>
      </div>
    `;

    const optList = host.querySelector(".option-list");
    problem.choice.options.forEach((opt, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <input type="text" value="${this.escape(opt)}" style="flex:1;" />
        <label style="display:flex; align-items:center; gap:5px; margin:0;">
          <input type="radio" name="correct-${problem.id}" ${problem.choice.correctIndex === i ? "checked" : ""} />
          정답
        </label>
        <button class="ghost">삭제</button>
      `;
      const input = row.querySelector("input[type=\"text\"]");
      const radio = row.querySelector("input[type=\"radio\"]");
      const del = row.querySelector("button");

      input.addEventListener("input", () => {
        problem.choice.options[i] = input.value;
      });
      radio.addEventListener("change", () => {
        if (radio.checked) problem.choice.correctIndex = i;
      });
      del.addEventListener("click", () => {
        if (problem.choice.options.length <= 2) return;
        problem.choice.options.splice(i, 1);
        if (problem.choice.correctIndex >= problem.choice.options.length) {
          problem.choice.correctIndex = problem.choice.options.length - 1;
        }
        this.renderProblems();
      });

      optList.appendChild(row);
    });

    host.querySelector("[data-act=\"add-opt\"]").addEventListener("click", () => {
      if (problem.choice.options.length >= 5) return;
      problem.choice.options.push("");
      this.renderProblems();
    });
  }

  renderShortAnswerPanel(host, problem) {
    host.innerHTML = `
      <div class="section-title" style="margin-top:10px;">단답형 조건 설정</div>
      <div class="row" style="margin-bottom:8px;">
        <label style="margin:0;">연산자</label>
        <select data-field="op" style="width:140px;">
          <option value="and" ${problem.shortAnswer.operator === "and" ? "selected" : ""}>and</option>
          <option value="or" ${problem.shortAnswer.operator === "or" ? "selected" : ""}>or</option>
        </select>
      </div>
      <div class="condition-list"></div>
      <div class="row" style="margin-top:8px;">
        <button class="ghost" data-act="add-cond">조건 추가</button>
      </div>
    `;

    const opEl = host.querySelector("select[data-field=\"op\"]");
    opEl.addEventListener("change", () => {
      problem.shortAnswer.operator = opEl.value;
    });

    const condList = host.querySelector(".condition-list");
    problem.shortAnswer.conditions.forEach((cond, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <select style="width:150px;">
          <option value="exact" ${cond.type === "exact" ? "selected" : ""}>exact</option>
          <option value="contains" ${cond.type === "contains" ? "selected" : ""}>contains</option>
          <option value="not_contains" ${cond.type === "not_contains" ? "selected" : ""}>not_contains</option>
        </select>
        <input type="text" value="${this.escape(cond.value || "")}" style="flex:1;" placeholder="조건 문자열" />
        <label style="display:flex; align-items:center; gap:5px; margin:0;">
          <input type="checkbox" ${cond.ignoreCase ? "checked" : ""} />
          ignoreCase
        </label>
        <button class="ghost">삭제</button>
      `;

      const [typeEl, valEl, caseEl, delEl] = [
        row.querySelector("select"),
        row.querySelector("input[type=\"text\"]"),
        row.querySelector("input[type=\"checkbox\"]"),
        row.querySelector("button")
      ];

      typeEl.addEventListener("change", () => cond.type = typeEl.value);
      valEl.addEventListener("input", () => cond.value = valEl.value);
      caseEl.addEventListener("change", () => cond.ignoreCase = caseEl.checked);
      delEl.addEventListener("click", () => {
        if (problem.shortAnswer.conditions.length <= 1) return;
        problem.shortAnswer.conditions.splice(i, 1);
        this.renderProblems();
      });

      condList.appendChild(row);
    });

    host.querySelector("[data-act=\"add-cond\"]").addEventListener("click", () => {
      problem.shortAnswer.conditions.push({ type: "contains", value: "", ignoreCase: true });
      this.renderProblems();
    });
  }

  toProblemSetJson() {
    const problems = this.state.problems.map((p) => {
      const out = {
        id: this.sanitizeId(p.id || "problem"),
        prompt: p.prompt || ""
      };

      if (p.figureIdentifier) {
        out.figure = `probfig:(${p.figureIdentifier})`;
      }

      if (p.choice) {
        out.choice = {
          options: p.choice.options.map(x => x || ""),
          correctIndex: Number.isInteger(p.choice.correctIndex) ? p.choice.correctIndex : 0
        };
      }

      if (p.shortAnswer) {
        out.shortAnswer = {
          operator: p.shortAnswer.operator === "or" ? "or" : "and",
          conditions: p.shortAnswer.conditions.map(c => ({
            type: c.type || "contains",
            value: c.value || "",
            ignoreCase: c.ignoreCase !== false
          }))
        };
      }

      out.grading = {
        retryOnWrong: p?.grading?.retryOnWrong !== false
      };

      const scoreboard = Array.isArray(p?.onCorrect?.scoreboard)
        ? p.onCorrect.scoreboard
          .map(a => ({
            objective: this.sanitizeId(a?.objective || ""),
            criteria: a?.criteria === "trigger" ? "trigger" : "dummy",
            operation: ["add", "set", "remove"].includes(a?.operation) ? a.operation : "add",
            value: Number.isFinite(Number(a?.value)) ? Number(a.value) : 1
          }))
          .filter(a => !!a.objective)
        : [];

      if (scoreboard.length > 0) {
        out.onCorrect = { scoreboard };
      }

      return out;
    });

    return {
      identifier: this.sanitizeId(this.state.identifier || "problem_set"),
      title: this.state.title || "",
      problems
    };
  }

  async downloadZip() {
    const status = this.shadowRoot.getElementById("status");
    try {
      status.textContent = "ZIP 생성 중...";
      const data = this.toProblemSetJson();

      const zip = new JSZip();
      const figures = zip.folder("figures");

      zip.file(`${data.identifier}.json`, JSON.stringify(data, null, 2));
      zip.file("problem-pack.manifest", JSON.stringify({
        format: "ktas-problem-pack-v1",
        problemJson: data.identifier,
        figuresBasePath: "figures"
      }, null, 2));

      for (const [id, info] of this.state.imageStore.entries()) {
        const used = data.problems.some(p => p.figure === `probfig:(${id})`);
        if (!used) continue;
        figures.file(info.fileName, info.data);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${data.identifier}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);

      status.textContent = "완료: ZIP 다운로드 생성됨";
    } catch (err) {
      console.error(err);
      status.textContent = "실패: ZIP 생성 중 오류 발생";
    }
  }

  async importFromFile(file) {
    const status = this.shadowRoot.getElementById("status");
    try {
      status.textContent = "불러오는 중...";

      const lowerName = (file.name || "").toLowerCase();
      if (lowerName.endsWith(".json") || file.type === "application/json") {
        const text = await file.text();
        const parsed = JSON.parse(text);
        this.hydrateStateFromProblemSet(parsed, new Map());
        status.textContent = "완료: JSON 불러오기 성공";
        return;
      }

      const zip = await JSZip.loadAsync(file);
      await this.importFromZip(zip);
      status.textContent = "완료: ZIP 불러오기 성공";
    } catch (err) {
      console.error(err);
      status.textContent = "실패: 불러오기 중 오류 발생";
    }
  }

  async importFromZip(zip) {
    let manifest = null;
    let problemJsonName = "";

    const manifestEntry = this.findZipEntry(zip, /(^|\/)problem-pack\.manifest$/i);
    if (manifestEntry) {
      const manifestText = await manifestEntry.async("text");
      manifest = JSON.parse(manifestText);
      if (manifest && manifest.problemJson) {
        problemJsonName = String(manifest.problemJson || "").trim().replace(/\\/g, "/");
        if (!problemJsonName.toLowerCase().endsWith(".json")) problemJsonName += ".json";
      }
    }

    let jsonEntry = null;
    if (problemJsonName) {
      jsonEntry = zip.file(problemJsonName) || this.findZipEntry(zip, new RegExp(`(^|/)${this.escapeRegExp(problemJsonName)}$`, "i"));
    }

    if (!jsonEntry) {
      jsonEntry = this.findZipEntry(zip, /(^|\/)[^/]+\.json$/i);
    }

    if (!jsonEntry) {
      throw new Error("문제세트 JSON 파일을 찾을 수 없습니다.");
    }

    const jsonText = await jsonEntry.async("text");
    const parsed = JSON.parse(jsonText);

    const imageStore = new Map();
    const figureFiles = this.findZipEntries(zip, /(^|\/)figures\/[^/]+\.[^/.]+$/i);
    for (const entry of figureFiles) {
      const path = entry.name.replace(/\\/g, "/");
      const fileName = path.substring(path.lastIndexOf("/") + 1);
      const dot = fileName.lastIndexOf(".");
      const id = this.sanitizeId(dot > 0 ? fileName.substring(0, dot) : fileName);
      if (!id) continue;

      const ext = dot > 0 ? fileName.substring(dot + 1).toLowerCase() : "png";
      const data = await entry.async("arraybuffer");
      imageStore.set(id, {
        fileName: `${id}.${ext}`,
        data,
        mime: this.mimeFromExtension(ext)
      });
    }

    this.hydrateStateFromProblemSet(parsed, imageStore);
  }

  hydrateStateFromProblemSet(parsed, imageStore) {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("유효한 문제세트 JSON이 아닙니다.");
    }

    const identifier = this.sanitizeId(parsed.identifier || "problem_set");
    const title = String(parsed.title || "");
    const srcProblems = Array.isArray(parsed.problems) ? parsed.problems : [];

    const problems = srcProblems.map((src, i) => {
      const id = this.sanitizeId(src?.id || `p${i + 1}`) || `p${i + 1}`;
      const problem = {
        id,
        prompt: String(src?.prompt || ""),
        figureIdentifier: "",
        figureFileName: "",
        grading: { retryOnWrong: src?.grading?.retryOnWrong !== false },
        onCorrect: {
          scoreboard: Array.isArray(src?.onCorrect?.scoreboard)
            ? src.onCorrect.scoreboard.map(a => ({
                objective: this.sanitizeId(a?.objective || ""),
                criteria: a?.criteria === "trigger" ? "trigger" : "dummy",
                operation: ["add", "set", "remove"].includes(a?.operation) ? a.operation : "add",
                value: Number.isFinite(Number(a?.value)) ? Number(a.value) : 1
              })).filter(a => !!a.objective)
            : []
        },
        choice: null,
        shortAnswer: null
      };

      if (typeof src?.figure === "string") {
        const fig = src.figure.trim();
        const match = /^probfig:\((.+)\)$/i.exec(fig);
        const figId = this.sanitizeId(match ? match[1] : fig);
        if (figId) {
          problem.figureIdentifier = figId;
          const info = imageStore.get(figId);
          problem.figureFileName = info?.fileName || `${figId}.png`;
        }
      }

      if (src?.choice && Array.isArray(src.choice.options)) {
        problem.choice = {
          options: src.choice.options.map(x => String(x || "")).slice(0, 5),
          correctIndex: Number.isInteger(src.choice.correctIndex) ? src.choice.correctIndex : 0
        };
        if (problem.choice.options.length < 2) {
          while (problem.choice.options.length < 2) problem.choice.options.push("");
        }
      }

      if (src?.shortAnswer && Array.isArray(src.shortAnswer.conditions)) {
        problem.shortAnswer = {
          operator: src.shortAnswer.operator === "or" ? "or" : "and",
          conditions: src.shortAnswer.conditions.map(c => ({
            type: c?.type || "contains",
            value: String(c?.value || ""),
            ignoreCase: c?.ignoreCase !== false
          }))
        };
        if (problem.shortAnswer.conditions.length === 0) {
          problem.shortAnswer.conditions.push({ type: "contains", value: "", ignoreCase: true });
        }
      }

      if (!problem.choice && !problem.shortAnswer) {
        problem.choice = { options: ["", ""], correctIndex: 0 };
      }

      return problem;
    });

    this.state.identifier = identifier || "problem_set";
    this.state.title = title;
    this.state.problems = problems.length > 0 ? problems : [{
      id: "p1", prompt: "", figureIdentifier: "", figureFileName: "",
      grading: { retryOnWrong: true }, onCorrect: { scoreboard: [] },
      choice: { options: ["", "", "", ""], correctIndex: 0 }, shortAnswer: null
    }];
    this.state.imageStore = imageStore instanceof Map ? imageStore : new Map();
    this.render();
  }

  findZipEntry(zip, pattern) {
    const entries = this.findZipEntries(zip, pattern);
    return entries.length > 0 ? entries[0] : null;
  }

  findZipEntries(zip, pattern) {
    const files = [];
    zip.forEach((relativePath, entry) => {
      if (entry && !entry.dir && pattern.test(relativePath)) files.push(entry);
    });
    return files;
  }

  mimeFromExtension(ext) {
    switch ((ext || "").toLowerCase()) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      case "gif":
        return "image/gif";
      default:
        return "image/png";
    }
  }

  escapeRegExp(v) {
    return String(v ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  uniqueFigureId(base) {
    let id = base;
    let n = 1;
    while (this.state.imageStore.has(id)) {
      n += 1;
      id = `${base}_${n}`;
    }
    return id;
  }

  sanitizeId(v) {
    return (v || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  escape(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }
}
