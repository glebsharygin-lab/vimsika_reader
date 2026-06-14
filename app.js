const state = {
  corpus: null,
  selectedSources: new Set(),
  view: "reading",
  search: "",
  activeAlignment: null,
  columnWidths: {},
  collapsedUnits: new Set(),
  openPassages: new Set(["v1"]),
  sidebarCollapsed: false,
  editorData: {
    units: [],
    alignments: [],
  },
  tokenSelections: {},
  selectionAnchors: {},
  draggingSelection: null,
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function highlightedText(text, sourceId, verse) {
  const terms = [];

  if (state.search.trim()) {
    terms.push(state.search.trim());
  }

  if (state.activeAlignment && state.activeAlignment.verse === verse) {
    const term = state.activeAlignment.targets[sourceId];
    if (term) terms.push(term);
  }

  const uniqueTerms = [...new Set(terms
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))];

  if (!uniqueTerms.length) return escapeHtml(text);

  const pattern = new RegExp(
    uniqueTerms.map((term) => escapeRegExp(term)).join("|"),
    "giu",
  );
  let output = "";
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    output += escapeHtml(text.slice(lastIndex, match.index));
    output += `<mark>${escapeHtml(match[0])}</mark>`;
    lastIndex = match.index + match[0].length;
  }
  output += escapeHtml(text.slice(lastIndex));
  return output;
}

function sourceById(sourceId) {
  return state.corpus.sources.find((source) => source.id === sourceId);
}

function allAlignments() {
  return [...state.corpus.alignments, ...state.editorData.alignments];
}

function alignmentById(alignmentId) {
  return allAlignments().find((alignment) => alignment.id === alignmentId);
}

function passageById(passageId) {
  return state.corpus.passages.find((passage) => passage.id === passageId);
}

function loadEditorData() {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem("vimsika-editor-annotations-v1") || "null",
    );
    if (stored?.units && stored?.alignments) {
      state.editorData = stored;
    }
  } catch {
    state.editorData = { units: [], alignments: [] };
  }
}

function saveEditorData() {
  try {
    window.localStorage.setItem(
      "vimsika-editor-annotations-v1",
      JSON.stringify(state.editorData),
    );
  } catch {}
}

function selectionKey(passageId, sourceId) {
  return `${passageId}:${sourceId}`;
}

function selectedTokenIds(passageId, sourceId) {
  return state.tokenSelections[selectionKey(passageId, sourceId)] || [];
}

function selectionsForPassage(passageId) {
  return Object.fromEntries(
    state.corpus.sources
      .map((source) => [
        source.id,
        selectedTokenIds(passageId, source.id),
      ])
      .filter(([, tokenIds]) => tokenIds.length),
  );
}

function tokenTextFromIds(passage, sourceId, tokenIds) {
  const witness = passage.texts[sourceId];
  if (!witness || !tokenIds?.length) return "";
  const selected = witness.tokens.filter((token) => tokenIds.includes(token.id));
  if (!selected.length) return "";
  return witness.text.slice(selected[0].start, selected[selected.length - 1].end);
}

function loadColumnWidths() {
  try {
    state.columnWidths = JSON.parse(
      window.localStorage.getItem("vimsika-column-widths") || "{}",
    );
  } catch {
    state.columnWidths = {};
  }
}

function saveColumnWidths() {
  try {
    window.localStorage.setItem(
      "vimsika-column-widths",
      JSON.stringify(state.columnWidths),
    );
  } catch {}
}

function loadSidebarState() {
  try {
    state.sidebarCollapsed =
      window.localStorage.getItem("vimsika-sidebar-collapsed") === "true";
  } catch {
    state.sidebarCollapsed = false;
  }
}

function applySidebarState() {
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  const toggle = document.querySelector("#sidebarToggle");
  const opener = document.querySelector("#sidebarOpen");
  toggle?.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  opener?.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  applySidebarState();
  try {
    window.localStorage.setItem(
      "vimsika-sidebar-collapsed",
      String(state.sidebarCollapsed),
    );
  } catch {}
}

function selectedSourceRecords() {
  return state.corpus.sources.filter((source) =>
    state.selectedSources.has(source.id),
  );
}

function sourceWidth(sourceId) {
  return Math.max(220, Math.min(720, state.columnWidths[sourceId] || 340));
}

function collationTemplate(sources) {
  return `178px ${sources
    .map((source) => `${sourceWidth(source.id)}px`)
    .join(" ")}`;
}

function buildSidebar() {
  const verseNav = document.querySelector("#verseNav");
  verseNav.innerHTML = state.corpus.passages
    .map(
      (passage) =>
        `<button class="verse-link" data-verse="${passage.number}" type="button">${passage.number}</button>`,
    )
    .join("");

  verseNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-verse]");
    if (!button) return;
    const card = document.querySelector(`#v${button.dataset.verse}`);
    state.openPassages.add(`v${button.dataset.verse}`);
    card?.classList.add("open");
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const sourceFilters = document.querySelector("#sourceFilters");
  sourceFilters.innerHTML = state.corpus.sources
    .map(
      (source) => `
        <label class="source-filter">
          <input type="checkbox" value="${source.id}" ${state.selectedSources.has(source.id) ? "checked" : ""}>
          <span class="source-dot" style="background:${source.color}"></span>
          <span>${source.label}</span>
        </label>
      `,
    )
    .join("");

  sourceFilters.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.checked) state.selectedSources.add(event.target.value);
    else state.selectedSources.delete(event.target.value);
    renderSummary();
    renderReader();
  });
}

function renderSummary() {
  const alignments = allAlignments().length;
  const tokens = state.corpus.passages.reduce(
    (passageTotal, passage) =>
      passageTotal +
      Object.values(passage.texts).reduce(
        (witnessTotal, witness) => witnessTotal + (witness.tokens?.length || 0),
        0,
      ),
    0,
  );
  const knownRights = state.corpus.sources.filter(
    (source) => source.rights !== "unknown",
  ).length;
  const tokenSummary = tokens
    ? tokens.toLocaleString()
    : "Update needed";
  document.querySelector("#summary").innerHTML = `
    <div class="summary-item">
      <span class="summary-number">${tokenSummary}</span>
      <span class="summary-label">${
        tokens
          ? `addressable tokens in ${state.corpus.passages.length} passages`
          : "corpus.js does not contain token data"
      }</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${state.selectedSources.size}</span>
      <span class="summary-label">visible witnesses</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${alignments}</span>
      <span class="summary-label">saved alignment groups</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${knownRights}/${state.corpus.sources.length}</span>
      <span class="summary-label">rights statuses classified</span>
    </div>
  `;
}

function alignmentRibbon(passage) {
  if (state.view !== "alignment") return "";
  const alignments = allAlignments().filter(
    (alignment) => alignment.verse === passage.number,
  );
  if (!alignments.length) {
    return `
      <div class="alignment-ribbon">
        <span class="alignment-label">Alignment workspace</span>
        <span class="alignment-note">No reviewed phrase links yet for this verse.</span>
      </div>
    `;
  }
  return `
    <div class="alignment-ribbon">
      <span class="alignment-label">Provisional linked concepts</span>
      ${alignments
        .map(
          (alignment) => `
            <button
              class="alignment-chip ${state.activeAlignment?.id === alignment.id ? "active" : ""}"
              data-alignment="${alignment.id}"
              type="button"
            >${escapeHtml(alignment.label)}</button>
          `,
        )
        .join("")}
      <span class="alignment-note">${state.activeAlignment?.verse === passage.number ? state.activeAlignment.note : "Select a concept to highlight corresponding phrases across witnesses."}</span>
    </div>
  `;
}

function tokenizedText(witness, sourceId, passage) {
  const tokens = witness.tokens || [];
  if (!tokens.length) return highlightedText(witness.text || "", sourceId, passage.number);

  const activeIds = new Set(
    state.activeAlignment?.targetTokenIds?.[sourceId] || [],
  );
  const selectedIds = new Set(selectedTokenIds(passage.id, sourceId));
  const search = state.search.trim().toLocaleLowerCase();
  let output = "";
  let cursor = 0;

  tokens.forEach((token, index) => {
    output += escapeHtml(witness.text.slice(cursor, token.start));
    const classes = ["text-token"];
    if (activeIds.has(token.id)) classes.push("alignment-active");
    if (selectedIds.has(token.id)) classes.push("editor-selected");
    if (search && token.text.toLocaleLowerCase().includes(search)) {
      classes.push("search-match");
    }
    output += `<button class="${classes.join(" ")}" data-token-id="${token.id}" data-token-index="${index}" data-token-passage="${passage.id}" data-token-source="${sourceId}" type="button" title="${token.id}">${escapeHtml(token.text)}</button>`;
    cursor = token.end;
  });
  output += escapeHtml(witness.text.slice(cursor));
  return output;
}

function sourcePanel(source, passage) {
  const witness = passage.texts[source.id] || {};
  const text = witness.text || "";
  const unavailable = witness.status === "not-present-in-supplied-source";
  const open = state.view !== "reading" || source.role === "edition";
  return `
    <article
      class="source-panel ${open ? "open" : ""}"
      data-source="${source.id}"
      style="--source-color:${source.color}"
    >
      <button class="source-panel-header" type="button">
        <span>
          <span class="source-name">${source.label}</span><br>
          <span class="source-meta">${source.role.replaceAll("-", " ")} · ${unavailable ? "not present in supplied source" : source.rightsLabel}</span>
        </span>
        <span aria-hidden="true">${open ? "−" : "+"}</span>
      </button>
      <div class="source-text ${unavailable ? "unavailable-text" : ""}">${
        unavailable
          ? escapeHtml(witness.note)
          : highlightedText(text, source.id, passage.number)
      }</div>
    </article>
  `;
}

function phraseAlignments(passage) {
  return allAlignments()
    .filter(
      (alignment) =>
        alignment.verse === passage.number &&
        (alignment.level || "phrase") === "phrase",
    )
    .sort((left, right) => (left.order || 0) - (right.order || 0));
}

function alignmentTargetText(alignment, passage, sourceId) {
  if (alignment.targets?.[sourceId]) return alignment.targets[sourceId];
  return tokenTextFromIds(
    passage,
    sourceId,
    alignment.targetTokenIds?.[sourceId] || [],
  );
}

function editorUnitsForPassage(passageId) {
  return state.editorData.units
    .filter((unit) => unit.passageId === passageId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function renderUnitTree(passageId, parentId = "") {
  const children = editorUnitsForPassage(passageId).filter(
    (unit) => (unit.parentId || "") === parentId,
  );
  if (!children.length) return "";
  return `
    <ol class="editor-unit-tree">
      ${children
        .map(
          (unit) => `
            <li>
              <div class="editor-unit-entry">
                <span class="editor-level">${escapeHtml(unit.level)}</span>
                <strong>${escapeHtml(unit.label)}</strong>
                <span class="editor-anchor-count">${Object.values(unit.targetTokenIds || {}).flat().length} tokens</span>
                <button data-delete-unit="${unit.id}" type="button" aria-label="Delete ${escapeHtml(unit.label)}">×</button>
              </div>
              ${unit.note ? `<p>${escapeHtml(unit.note)}</p>` : ""}
              ${renderUnitTree(passageId, unit.id)}
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function editorWorkbench(passage) {
  const units = editorUnitsForPassage(passage.id);
  const selections = selectionsForPassage(passage.id);
  const selectionCount = Object.values(selections).reduce(
    (total, tokenIds) => total + tokenIds.length,
    0,
  );
  const customAlignments = state.editorData.alignments.filter(
    (alignment) => alignment.verse === passage.number,
  );
  return `
    <section class="editor-workbench" data-editor-passage="${passage.id}">
      <div class="editor-heading">
        <div>
          <p class="eyebrow">Embedded scholarly editor</p>
          <h3>Structure and alignment editor</h3>
        </div>
        <div class="editor-actions">
          <button data-clear-selection="${passage.id}" type="button">Clear token selection</button>
          <button data-export-editor type="button">Export annotations</button>
        </div>
      </div>

      <p class="editor-guidance">
        Drag across tokens, or Shift-click, to select spans in Sanskrit and corresponding witnesses.
        Selected spans can anchor a structural unit or a reviewed alignment.
      </p>
      <div class="editor-selection-summary">
        <strong>${selectionCount} selected tokens</strong>
        <span>${Object.keys(selections).length} witnesses represented</span>
      </div>

      <div class="editor-forms">
        <form class="editor-form" data-unit-form="${passage.id}">
          <h4>Create structural unit</h4>
          <label>
            Label
            <input data-field="unit-label" type="text" placeholder="e.g. First objection">
          </label>
          <div class="editor-form-row">
            <label>
              Level
              <select data-field="unit-level">
                <option value="section">Section</option>
                <option value="subsection">Subsection</option>
                <option value="subsubsection">Subsubsection</option>
                <option value="phrase">Phrase</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label>
              Parent
              <select data-field="unit-parent">
                <option value="">Verse ${passage.number}</option>
                ${units
                  .map(
                    (unit) =>
                      `<option value="${unit.id}">${escapeHtml(unit.level)} · ${escapeHtml(unit.label)}</option>`,
                  )
                  .join("")}
              </select>
            </label>
          </div>
          <label>
            Scholarly note
            <textarea data-field="unit-note" rows="2"></textarea>
          </label>
          <button class="editor-primary" data-create-unit="${passage.id}" type="submit">
            Create unit from selection
          </button>
        </form>

        <form class="editor-form" data-alignment-form="${passage.id}">
          <h4>Create token-span alignment</h4>
          <label>
            Alignment label
            <input data-field="alignment-label" type="text" placeholder="e.g. cognition only">
          </label>
          <div class="editor-form-row">
            <label>
              Relation
              <select data-field="alignment-relation">
                <option value="equivalent">Equivalent</option>
                <option value="literal">Literal rendering</option>
                <option value="paraphrase">Paraphrase</option>
                <option value="technical-term">Technical term</option>
                <option value="addition">Translator addition</option>
                <option value="omission">Omission</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
            <label>
              Confidence
              <select data-field="alignment-confidence">
                <option value="reviewed">Reviewed</option>
                <option value="provisional" selected>Provisional</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
          </div>
          <label>
            Alignment note
            <textarea data-field="alignment-note" rows="2"></textarea>
          </label>
          <button class="editor-primary" data-create-alignment="${passage.id}" type="submit">
            Link selected spans
          </button>
        </form>
      </div>

      <div class="editor-status" aria-live="polite"></div>
      <div class="editor-results">
        <section>
          <h4>Hierarchy</h4>
          ${renderUnitTree(passage.id) || '<p class="editor-empty">No custom structural units yet.</p>'}
        </section>
        <section>
          <h4>Editorial alignments</h4>
          ${
            customAlignments.length
              ? `<ol class="editor-alignment-list">${customAlignments
                  .map(
                    (alignment) => `
                      <li>
                        <span>${escapeHtml(alignment.label)}</span>
                        <small>${escapeHtml(alignment.relation)} · ${escapeHtml(alignment.confidence)}</small>
                        <button data-delete-alignment="${alignment.id}" type="button" aria-label="Delete ${escapeHtml(alignment.label)}">×</button>
                      </li>
                    `,
                  )
                  .join("")}</ol>`
              : '<p class="editor-empty">No editorial alignments yet.</p>'
          }
        </section>
      </div>
    </section>
  `;
}

function collationHeader(sources, template) {
  return `
    <div class="collation-grid collation-header" style="grid-template-columns:${template}">
      <div class="collation-corner">
        <span>Phrase unit</span>
        <button class="column-reset" type="button" title="Reset column widths">Reset widths</button>
      </div>
      ${sources
        .map(
          (source) => `
            <div class="collation-source-heading" style="--source-color:${source.color}">
              <span class="source-name">${source.label}</span>
              <span class="source-meta">${source.role.replaceAll("-", " ")}</span>
              <button
                class="column-resizer"
                data-resize-source="${source.id}"
                type="button"
                role="separator"
                aria-label="Resize ${escapeHtml(source.label)} column"
                title="Drag to resize"
              ></button>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function phraseRow(alignment, passage, sources, template, index) {
  const collapsed = state.collapsedUnits.has(alignment.id);
  const active = state.activeAlignment?.id === alignment.id;
  return `
    <section
      class="collation-grid phrase-row ${collapsed ? "collapsed" : ""} ${active ? "active" : ""}"
      data-alignment-row="${alignment.id}"
      style="grid-template-columns:${template}"
    >
      <button class="phrase-label" data-toggle-unit="${alignment.id}" type="button">
        <span class="phrase-index">${passage.number}.${index + 1}</span>
        <span class="phrase-title">${escapeHtml(alignment.label)}</span>
        <span class="phrase-toggle" aria-hidden="true">${collapsed ? "+" : "−"}</span>
      </button>
      ${sources
        .map((source) => {
          const target = alignmentTargetText(alignment, passage, source.id);
          return `
            <button
              class="phrase-cell"
              data-alignment="${alignment.id}"
              data-source="${source.id}"
              type="button"
            >${
              target
                ? highlightedText(target, source.id, passage.number)
                : '<span class="alignment-gap">— no aligned phrase —</span>'
            }</button>
          `;
        })
        .join("")}
      <div class="phrase-note">${escapeHtml(alignment.note)}</div>
    </section>
  `;
}

function fullPassageRow(passage, sources, template, collapsedByDefault) {
  const unitId = `${passage.id}-full`;
  const collapsed =
    state.collapsedUnits.has(unitId) ||
    (collapsedByDefault && !state.collapsedUnits.has(`${unitId}-opened`));
  return `
    <section
      class="collation-grid phrase-row full-passage-row ${collapsed ? "collapsed" : ""}"
      style="grid-template-columns:${template}"
    >
      <button class="phrase-label" data-toggle-full="${unitId}" type="button">
        <span class="phrase-index">${passage.number}.∞</span>
        <span class="phrase-title">Full passage & commentary</span>
        <span class="phrase-toggle" aria-hidden="true">${collapsed ? "+" : "−"}</span>
      </button>
      ${sources
        .map((source) => {
          const witness = passage.texts[source.id] || {};
          const unavailable = witness.status === "not-present-in-supplied-source";
          return `
            <div class="phrase-cell full-text-cell" data-source="${source.id}">
              ${
                unavailable
                  ? `<span class="alignment-gap">${escapeHtml(witness.note)}</span>`
                  : state.view === "alignment" || state.view === "editor"
                    ? tokenizedText(witness, source.id, passage)
                    : highlightedText(witness.text || "", source.id, passage.number)
              }
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function collationView(passage, sources) {
  if (!sources.length) {
    return '<div class="empty-state">Select at least one witness in the sidebar.</div>';
  }
  const alignments = phraseAlignments(passage);
  const template = collationTemplate(sources);
  return `
    ${state.view === "editor" ? editorWorkbench(passage) : ""}
    <div class="collation-intro">
      <strong>${alignments.length ? `${alignments.length} aligned phrase sections` : "Passage-level comparison"}</strong>
      <span>${
        state.view === "editor"
          ? "Expand the full passage row and select tokens to create structure or alignment annotations."
          : "Drag the vertical boundaries to resize witnesses. Scroll horizontally for additional versions."
      }</span>
    </div>
    <div class="collation-shell" data-collation-verse="${passage.number}">
      <div class="collation-table">
        ${collationHeader(sources, template)}
        ${
          alignments.length
            ? alignments
                .map((alignment, index) =>
                  phraseRow(alignment, passage, sources, template, index),
                )
                .join("")
            : ""
        }
        ${fullPassageRow(
          passage,
          sources,
          template,
          state.view === "editor" ? false : Boolean(alignments.length),
        )}
      </div>
    </div>
  `;
}

function passageCard(passage) {
  const sources = selectedSourceRecords();
  const sourcePanels = sources.map((source) => sourcePanel(source, passage)).join("");
  const open = state.openPassages.has(passage.id);
  const content =
    state.view === "reading"
      ? `<div class="text-stack">${sourcePanels || '<div class="empty-state">Select at least one witness in the sidebar.</div>'}</div>`
      : open
        ? collationView(passage, sources)
        : "";

  return `
    <article id="${passage.id}" class="passage-card ${open ? "open" : ""}">
      <button class="passage-header" type="button">
        <span class="passage-number">${passage.number}</span>
        <span>
          <span class="passage-title">${passage.label}</span>
          <span class="root-preview">${escapeHtml(passage.root)}</span>
        </span>
        <span class="fold-icon" aria-hidden="true">+</span>
      </button>
      <div class="passage-content">
        ${alignmentRibbon(passage)}
        ${content}
      </div>
    </article>
  `;
}

function updateCollationTemplates() {
  const sources = selectedSourceRecords();
  const template = collationTemplate(sources);
  document.querySelectorAll(".collation-grid").forEach((grid) => {
    grid.style.gridTemplateColumns = template;
  });
}

function bindColumnResizers(reader) {
  reader.querySelectorAll("[data-resize-source]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const sourceId = handle.dataset.resizeSource;
      const startX = event.clientX;
      const startWidth = sourceWidth(sourceId);
      document.body.classList.add("resizing-columns");

      const move = (moveEvent) => {
        state.columnWidths[sourceId] = Math.max(
          220,
          Math.min(720, startWidth + moveEvent.clientX - startX),
        );
        updateCollationTemplates();
      };

      const stop = () => {
        document.body.classList.remove("resizing-columns");
        saveColumnWidths();
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    });

    handle.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const sourceId = handle.dataset.resizeSource;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      state.columnWidths[sourceId] = sourceWidth(sourceId) + direction * 20;
      saveColumnWidths();
      updateCollationTemplates();
    });
  });
}

function setTokenRange(passageId, sourceId, startIndex, endIndex) {
  const passage = passageById(passageId);
  const tokens = passage?.texts[sourceId]?.tokens || [];
  const lower = Math.min(startIndex, endIndex);
  const upper = Math.max(startIndex, endIndex);
  state.tokenSelections[selectionKey(passageId, sourceId)] = tokens
    .slice(lower, upper + 1)
    .map((token) => token.id);
}

function syncTokenSelectionClasses(reader) {
  reader.querySelectorAll("[data-token-id]").forEach((token) => {
    const selected = selectedTokenIds(
      token.dataset.tokenPassage,
      token.dataset.tokenSource,
    ).includes(token.dataset.tokenId);
    token.classList.toggle("editor-selected", selected);
  });
}

function updateEditorSelectionSummary(passageId) {
  const panel = document.querySelector(
    `[data-editor-passage="${passageId}"]`,
  );
  if (!panel) return;
  const selections = selectionsForPassage(passageId);
  const count = Object.values(selections).reduce(
    (total, tokenIds) => total + tokenIds.length,
    0,
  );
  const summary = panel.querySelector(".editor-selection-summary");
  summary.innerHTML = `
    <strong>${count} selected tokens</strong>
    <span>${Object.keys(selections).length} witnesses represented</span>
  `;
}

function bindTokenInteractions(reader) {
  reader.querySelectorAll("[data-token-id]").forEach((token) => {
    token.addEventListener("click", (event) => {
      if (state.view === "editor") {
        event.preventDefault();
        return;
      }
      const alignment = allAlignments().find((item) =>
        item.targetTokenIds?.[token.dataset.tokenSource]?.includes(
          token.dataset.tokenId,
        ),
      );
      if (!alignment) return;
      state.activeAlignment = alignment;
      state.openPassages.add(`v${alignment.verse}`);
      renderReader();
    });

    token.addEventListener("pointerdown", (event) => {
      if (state.view !== "editor") return;
      event.preventDefault();
      const passageId = token.dataset.tokenPassage;
      const sourceId = token.dataset.tokenSource;
      const tokenIndex = Number(token.dataset.tokenIndex);
      const key = selectionKey(passageId, sourceId);
      const anchor =
        event.shiftKey && Number.isInteger(state.selectionAnchors[key])
          ? state.selectionAnchors[key]
          : tokenIndex;

      if (!event.shiftKey) state.selectionAnchors[key] = tokenIndex;
      state.draggingSelection = { passageId, sourceId, anchor };
      setTokenRange(passageId, sourceId, anchor, tokenIndex);
      syncTokenSelectionClasses(reader);

      const finish = () => {
        state.draggingSelection = null;
        window.removeEventListener("pointerup", finish);
        updateEditorSelectionSummary(passageId);
      };
      window.addEventListener("pointerup", finish);
    });

    token.addEventListener("pointerenter", () => {
      const drag = state.draggingSelection;
      if (
        !drag ||
        drag.passageId !== token.dataset.tokenPassage ||
        drag.sourceId !== token.dataset.tokenSource
      ) {
        return;
      }
      setTokenRange(
        drag.passageId,
        drag.sourceId,
        drag.anchor,
        Number(token.dataset.tokenIndex),
      );
      syncTokenSelectionClasses(reader);
    });
  });
}

function editorStatus(panel, message, error = false) {
  const status = panel.querySelector(".editor-status");
  status.textContent = message;
  status.classList.toggle("error", error);
}

function nextAnnotationId(prefix, passageId) {
  return `${prefix}-${passageId}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function deleteUnitAndDescendants(unitId) {
  const ids = new Set([unitId]);
  let found = true;
  while (found) {
    found = false;
    state.editorData.units.forEach((unit) => {
      if (unit.parentId && ids.has(unit.parentId) && !ids.has(unit.id)) {
        ids.add(unit.id);
        found = true;
      }
    });
  }
  state.editorData.units = state.editorData.units.filter(
    (unit) => !ids.has(unit.id),
  );
}

function exportEditorAnnotations() {
  const payload = {
    schemaVersion: "0.1.0-editorial",
    workId: state.corpus.work.id,
    exportedAt: new Date().toISOString(),
    units: state.editorData.units,
    alignments: state.editorData.alignments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "vimsika-editor-annotations.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindEditorControls(reader) {
  reader.querySelectorAll("[data-unit-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.unitForm;
      const panel = form.closest(".editor-workbench");
      const label = form.querySelector("[data-field='unit-label']").value.trim();
      if (!label) {
        editorStatus(panel, "Please give the structural unit a label.", true);
        return;
      }
      state.editorData.units.push({
        id: nextAnnotationId("unit", passageId),
        passageId,
        parentId: form.querySelector("[data-field='unit-parent']").value,
        level: form.querySelector("[data-field='unit-level']").value,
        label,
        note: form.querySelector("[data-field='unit-note']").value.trim(),
        targetTokenIds: selectionsForPassage(passageId),
        createdAt: new Date().toISOString(),
      });
      saveEditorData();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-alignment-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.alignmentForm;
      const passage = passageById(passageId);
      const panel = form.closest(".editor-workbench");
      const targetTokenIds = selectionsForPassage(passageId);
      const selectedSources = Object.keys(targetTokenIds);
      if (
        !targetTokenIds.san_levi_1925?.length ||
        selectedSources.length < 2
      ) {
        editorStatus(
          panel,
          "Select at least one Sanskrit token and a corresponding span in another witness.",
          true,
        );
        return;
      }
      const label = form
        .querySelector("[data-field='alignment-label']")
        .value.trim();
      if (!label) {
        editorStatus(panel, "Please give the alignment a label.", true);
        return;
      }
      const alignment = {
        id: nextAnnotationId("alignment", passageId),
        verse: passage.number,
        order: allAlignments().filter(
          (item) => item.verse === passage.number,
        ).length + 1,
        level: "token-span",
        status: "editorial",
        label,
        relation: form.querySelector("[data-field='alignment-relation']").value,
        confidence: form.querySelector("[data-field='alignment-confidence']").value,
        note: form.querySelector("[data-field='alignment-note']").value.trim(),
        targets: Object.fromEntries(
          selectedSources.map((sourceId) => [
            sourceId,
            tokenTextFromIds(passage, sourceId, targetTokenIds[sourceId]),
          ]),
        ),
        targetTokenIds,
        createdAt: new Date().toISOString(),
      };
      state.editorData.alignments.push(alignment);
      state.activeAlignment = alignment;
      state.tokenSelections = {};
      saveEditorData();
      renderSummary();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-clear-selection]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.dataset.clearSelection;
      Object.keys(state.tokenSelections).forEach((key) => {
        if (key.startsWith(`${passageId}:`)) delete state.tokenSelections[key];
      });
      renderReader();
    });
  });

  reader.querySelectorAll("[data-delete-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteUnitAndDescendants(button.dataset.deleteUnit);
      saveEditorData();
      renderReader();
    });
  });

  reader.querySelectorAll("[data-delete-alignment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editorData.alignments = state.editorData.alignments.filter(
        (alignment) => alignment.id !== button.dataset.deleteAlignment,
      );
      if (state.activeAlignment?.id === button.dataset.deleteAlignment) {
        state.activeAlignment = null;
      }
      saveEditorData();
      renderSummary();
      renderReader();
    });
  });

  reader.querySelectorAll("[data-export-editor]").forEach((button) => {
    button.addEventListener("click", exportEditorAnnotations);
  });
}

function renderReader() {
  const reader = document.querySelector("#reader");
  reader.classList.toggle("collation-active", state.view !== "reading");
  reader.innerHTML = state.corpus.passages.map(passageCard).join("");

  reader.querySelectorAll(".passage-header").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".passage-card");
      if (!card) return;
      if (card.classList.contains("open")) state.openPassages.delete(card.id);
      else state.openPassages.add(card.id);
      if (state.view === "reading") {
        card.classList.toggle("open");
      } else {
        renderReader();
      }
    });
  });

  reader.querySelectorAll(".source-panel-header").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.view !== "reading") return;
      const panel = button.closest(".source-panel");
      panel?.classList.toggle("open");
      const indicator = button.querySelector("[aria-hidden='true']");
      if (indicator) indicator.textContent = panel?.classList.contains("open") ? "−" : "+";
    });
  });

  reader.querySelectorAll("[data-alignment]").forEach((button) => {
    button.addEventListener("click", () => {
      const alignment = allAlignments().find(
        (item) => item.id === button.dataset.alignment,
      );
      if (!alignment) return;
      state.activeAlignment =
        state.activeAlignment?.id === alignment.id ? null : alignment;
      state.openPassages.add(`v${alignment.verse}`);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-toggle-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitId = button.dataset.toggleUnit;
      if (state.collapsedUnits.has(unitId)) state.collapsedUnits.delete(unitId);
      else state.collapsedUnits.add(unitId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-toggle-full]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitId = button.dataset.toggleFull;
      const row = button.closest(".full-passage-row");
      if (row?.classList.contains("collapsed")) {
        state.collapsedUnits.delete(unitId);
        state.collapsedUnits.add(`${unitId}-opened`);
      } else {
        state.collapsedUnits.add(unitId);
        state.collapsedUnits.delete(`${unitId}-opened`);
      }
      renderReader();
    });
  });

  reader.querySelectorAll(".column-reset").forEach((button) => {
    button.addEventListener("click", () => {
      state.columnWidths = {};
      saveColumnWidths();
      updateCollationTemplates();
    });
  });

  bindColumnResizers(reader);
  bindTokenInteractions(reader);
  bindEditorControls(reader);
}

function renderSourceLedger() {
  document.querySelector("#sourceLedger").innerHTML = state.corpus.sources
    .map(
      (source) => `
        <article class="ledger-entry" style="--source-color:${source.color}">
          <div class="ledger-topline">
            <strong>${source.label}</strong>
            <span class="rights-badge ${source.rights}">${source.rightsLabel}</span>
          </div>
          <p>${source.citation}</p>
          <p><strong>Source file:</strong> ${source.file}</p>
          <p><strong>Import:</strong> ${source.extraction}</p>
        </article>
      `,
    )
    .join("");
}

function bindControls() {
  document.querySelector("#sidebarToggle").addEventListener("click", () => {
    setSidebarCollapsed(true);
  });
  document.querySelector("#sidebarOpen").addEventListener("click", () => {
    setSidebarCollapsed(false);
  });

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      state.activeAlignment = null;
      document.querySelectorAll(".view-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      document.querySelector("#pageTitle").textContent = {
        reading: "Parallel reading shell",
        comparison: "Multi-witness comparison",
        alignment: "Phrase alignment laboratory",
        editor: "Embedded structure and alignment editor",
      }[state.view];
      renderReader();
    });
  });

  document.querySelector("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderReader();
  });

  document.querySelector("#clearSources").addEventListener("click", () => {
    state.selectedSources.clear();
    document.querySelectorAll("#sourceFilters input").forEach((input) => {
      input.checked = false;
    });
    renderSummary();
    renderReader();
  });

  const dialog = document.querySelector("#sourcesDialog");
  document.querySelector("#openSources").addEventListener("click", () => dialog.showModal());
  document.querySelector("#closeSources").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

async function init() {
  if (window.CORPUS_DATA) {
    state.corpus = window.CORPUS_DATA;
  } else {
    const response = await fetch("data/corpus.json");
    if (!response.ok) throw new Error(`Corpus request failed: ${response.status}`);
    state.corpus = await response.json();
  }
  state.selectedSources = new Set([
    "san_levi_1925",
    "tib_derge",
    "zho_xuanzang",
    "eng_das",
  ]);
  loadColumnWidths();
  loadSidebarState();
  loadEditorData();
  applySidebarState();

  const hasTokenData = state.corpus.passages.some((passage) =>
    Object.values(passage.texts).some((witness) => witness.tokens?.length),
  );
  document.querySelector("#notice").textContent = hasTokenData
    ? state.corpus.notice
    : `${state.corpus.notice} Token data is unavailable because corpus.js is from an older build; upload the current corpus.js file.`;
  buildSidebar();
  renderSummary();
  renderSourceLedger();
  renderReader();
  bindControls();
}

init().catch((error) => {
  document.querySelector("#reader").innerHTML = `
    <div class="empty-state">
      The corpus could not be loaded. Make sure <code>corpus.js</code> was uploaded beside <code>index.html</code>.
      <br><br>${escapeHtml(error.message)}
    </div>
  `;
});
