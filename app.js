const state = {
  corpus: null,
  selectedSources: new Set(),
  view: "reading",
  search: "",
  activeAlignment: null,
  columnWidths: {},
  collapsedUnits: new Set(),
  openPassages: new Set(["v1"]),
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
  const alignments = state.corpus.alignments.length;
  const knownRights = state.corpus.sources.filter(
    (source) => source.rights !== "unknown",
  ).length;
  document.querySelector("#summary").innerHTML = `
    <div class="summary-item">
      <span class="summary-number">${state.corpus.passages.length}</span>
      <span class="summary-label">aligned passage units</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${state.selectedSources.size}</span>
      <span class="summary-label">visible witnesses</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${alignments}</span>
      <span class="summary-label">phrase links in demo</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${knownRights}/${state.corpus.sources.length}</span>
      <span class="summary-label">rights statuses classified</span>
    </div>
  `;
}

function alignmentRibbon(passage) {
  if (state.view !== "alignment") return "";
  const alignments = state.corpus.alignments.filter(
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
            >${alignment.label}</button>
          `,
        )
        .join("")}
      <span class="alignment-note">${state.activeAlignment?.verse === passage.number ? state.activeAlignment.note : "Select a concept to highlight corresponding phrases across witnesses."}</span>
    </div>
  `;
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
  return state.corpus.alignments
    .filter(
      (alignment) =>
        alignment.verse === passage.number &&
        (alignment.level || "phrase") === "phrase",
    )
    .sort((left, right) => (left.order || 0) - (right.order || 0));
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
          const target = alignment.targets[source.id];
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
    <div class="collation-intro">
      <strong>${alignments.length ? `${alignments.length} aligned phrase sections` : "Passage-level comparison"}</strong>
      <span>Drag the vertical boundaries to resize witnesses. Scroll horizontally for additional versions.</span>
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
        ${fullPassageRow(passage, sources, template, Boolean(alignments.length))}
      </div>
    </div>
  `;
}

function passageCard(passage, index) {
  const sources = selectedSourceRecords();
  const sourcePanels = sources.map((source) => sourcePanel(source, passage)).join("");
  const open = state.openPassages.has(passage.id);
  const content =
    state.view === "reading"
      ? `<div class="text-stack">${sourcePanels || '<div class="empty-state">Select at least one witness in the sidebar.</div>'}</div>`
      : collationView(passage, sources);

  return `
    <article id="${passage.id}" class="passage-card ${open || index === 0 ? "open" : ""}">
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

function renderReader() {
  const reader = document.querySelector("#reader");
  reader.classList.toggle("collation-active", state.view !== "reading");
  reader.innerHTML = state.corpus.passages.map(passageCard).join("");

  reader.querySelectorAll(".passage-header").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".passage-card");
      card?.classList.toggle("open");
      if (!card) return;
      if (card.classList.contains("open")) state.openPassages.add(card.id);
      else state.openPassages.delete(card.id);
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
      const alignment = state.corpus.alignments.find(
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

  document.querySelector("#notice").textContent = state.corpus.notice;
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
