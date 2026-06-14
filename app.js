const state = {
  corpus: null,
  selectedSources: new Set(),
  view: "reading",
  search: "",
  activeAlignment: null,
};

const escapeHtml = (value) =>
  value
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

function passageCard(passage, index) {
  const sources = state.corpus.sources.filter((source) =>
    state.selectedSources.has(source.id),
  );
  const sourcePanels = sources.map((source) => sourcePanel(source, passage)).join("");
  const gridClass = state.view === "comparison" || state.view === "alignment"
    ? "comparison-grid"
    : "";

  return `
    <article id="${passage.id}" class="passage-card ${index === 0 ? "open" : ""}">
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
        <div class="text-stack ${gridClass}">
          ${sourcePanels || '<div class="empty-state">Select at least one witness in the sidebar.</div>'}
        </div>
      </div>
    </article>
  `;
}

function renderReader() {
  const reader = document.querySelector("#reader");
  reader.innerHTML = state.corpus.passages.map(passageCard).join("");

  reader.querySelectorAll(".passage-header").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".passage-card")?.classList.toggle("open");
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
      state.activeAlignment =
        state.activeAlignment?.id === alignment.id ? null : alignment;
      renderReader();
      document.querySelector(`#v${alignment.verse}`)?.classList.add("open");
    });
  });
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
