const translationLibrarySearchCache = new Map();

function translationLibraryHumanize(value) {
  return String(value || "").replaceAll("-", " ");
}

function translationLibraryExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function translationLibrarySearchText(documentRecord) {
  if (!translationLibrarySearchCache.has(documentRecord.id)) {
    translationLibrarySearchCache.set(
      documentRecord.id,
      JSON.stringify(documentRecord).toLocaleLowerCase(),
    );
  }
  return translationLibrarySearchCache.get(documentRecord.id);
}

function integrateResearchedTranslations(corpus, supplement, tokenizer) {
  if (!supplement) {
    return { sources: 0, passages: 0, documents: 0, importedDocuments: 0 };
  }
  if (corpus.researchedTranslationIntegration?.schemaVersion === supplement.schemaVersion) {
    return corpus.researchedTranslationIntegration;
  }
  if (typeof tokenizer !== "function") {
    throw new Error("A text tokenizer is required for researched translations.");
  }

  const documentsById = new Map(
    (supplement.documents || []).map((documentRecord) => [documentRecord.id, documentRecord]),
  );
  const passagesById = new Map(corpus.passages.map((passage) => [passage.id, passage]));
  const sourcesById = new Map(corpus.sources.map((source) => [source.id, source]));
  const blocksByDocument = new Map();

  for (const documentRecord of supplement.documents || []) {
    const blocks = new Map();
    for (const component of documentRecord.components || []) {
      for (const sourceBlock of component.blocks || []) {
        if (blocks.has(sourceBlock.id)) {
          throw new Error(`Duplicate researched block: ${sourceBlock.id}`);
        }
        blocks.set(sourceBlock.id, { ...sourceBlock, componentId: component.id });
      }
    }
    blocksByDocument.set(documentRecord.id, blocks);
  }

  for (const source of supplement.sources || []) {
    const existing = sourcesById.get(source.id);
    if (existing && existing.libraryDocumentId !== source.libraryDocumentId) {
      throw new Error(`Researched source conflicts with an existing witness: ${source.id}`);
    }
    if (!existing) {
      corpus.sources.push(source);
      sourcesById.set(source.id, source);
    }
    if (!documentsById.has(source.libraryDocumentId)) {
      throw new Error(`Missing library document for ${source.id}.`);
    }
  }

  let mappingCount = 0;
  for (const mapping of supplement.passageMappings || []) {
    if (mapping.level !== "passage") {
      throw new Error(`Unsupported researched mapping level: ${mapping.level}`);
    }
    const passage = passagesById.get(mapping.passageId);
    const source = sourcesById.get(mapping.sourceId);
    if (!passage || !source) {
      throw new Error(`Unresolved researched mapping: ${mapping.sourceId} / ${mapping.passageId}`);
    }
    const documentRecord = documentsById.get(source.libraryDocumentId);
    const blocks = blocksByDocument.get(documentRecord.id);
    const mappedBlocks = mapping.blockIds.map((blockId) => {
      const sourceBlock = blocks.get(blockId);
      if (!sourceBlock || sourceBlock.componentId !== mapping.componentId) {
        throw new Error(`Unresolved researched block: ${blockId}`);
      }
      return sourceBlock;
    });
    const text = mappedBlocks.map((sourceBlock) => sourceBlock.text).join("\n\n");
    if (!text.trim()) {
      throw new Error(`Empty researched passage: ${mapping.sourceId} / ${mapping.passageId}`);
    }
    const tokens = tokenizer(text, passage.id, source.id);
    for (const token of tokens) {
      if (token.text !== text.slice(token.start, token.end)) {
        throw new Error(`Invalid token offsets in ${mapping.sourceId} / ${mapping.passageId}`);
      }
    }
    passage.texts[source.id] = {
      status: "text-imported",
      text,
      tokens,
      mappingLevel: "passage",
      mappingNote: mapping.note,
      libraryDocumentId: documentRecord.id,
      componentId: mapping.componentId,
      blockIds: [...mapping.blockIds],
      sourceLocators: mappedBlocks.map((sourceBlock) => ({
        blockId: sourceBlock.id,
        locator: sourceBlock.locator,
      })),
    };
    mappingCount += 1;
  }

  corpus.researchedTranslationIntegration = {
    schemaVersion: supplement.schemaVersion,
    sources: (supplement.sources || []).length,
    passages: mappingCount,
    documents: (supplement.documents || []).length,
    importedDocuments: (supplement.documents || []).filter(
      (documentRecord) => documentRecord.textStatus === "text-imported",
    ).length,
  };
  return corpus.researchedTranslationIntegration;
}

const researchedDocumentPresentation = Object.freeze({
  ron_nedu_2011: {
    label: "Romanian · Nedu 2011",
    description: "Twenty-two numbered Romanian verses, plus the continuous autocommentary and printed notes.",
  },
  vie_nguyen_hong: {
    label: "Vietnamese · Nguyên Hồng",
    description: "Complete Vietnamese relay of Xuanzang’s Chinese, mapped at whole-passage level.",
  },
  kor_lee_gilsan_2021: {
    label: "Korean · Lee Gil-san 2021",
    description: "Part II in full: Sanskrit, Korean translation, and annotations in the author’s sixteen argument sections.",
  },
  zho_lu_cheng_2009: {
    label: "Modern Chinese · Lü Cheng 2009",
    description: "Complete vernacular translation in 24 source blocks, mapped to all 22 shell passages.",
  },
  eng_chatterjee_1980: {
    label: "English · K. N. Chatterjee 1980",
    description: "The Viṃśikā work-section with Sanskrit and English translation; unproofed OCR navigation text.",
  },
  jpn_inazu_1929: {
    label: "Japanese · Kizō Inazu 1929",
    description: "Introduction, Japanese translation, annotations, and appended material from the full 81-page scan.",
  },
  eng_sharma_1993: {
    label: "English · T. R. Sharma 1993",
    description: "The translation-and-commentary section in continuous, source-located OCR.",
  },
  hin_chogdub_tripathi_1972: {
    label: "Hindi · Chogdub–Tripāṭhī 1972",
    description: "Sanskrit verses, Hindi translation, autocommentary, and Gūḍhārthadīpanī in document order.",
  },
  tha_soraj_2012: {
    label: "Thai · Soraj 2012 · abridged",
    description: "Substantial abridged Thai relay of George Cronk’s English rendition; continuous article text.",
  },
  hin_tiwary_1995_alternate: {
    label: "Hindi · Tiwary 1995 · alternate scan",
    description: "A second readable scan of the existing Hindi witness, with its Sanskrit verse collection.",
  },
});

function researchedDocumentLabel(documentRecord) {
  return researchedDocumentPresentation[documentRecord.id]?.label
    || `${documentRecord.language} · ${documentRecord.creators}`;
}

function researchedDocumentBlockCount(documentRecord) {
  return (documentRecord.components || []).reduce(
    (count, component) => count + (component.blocks || []).length,
    0,
  );
}

function collapseSidebarForDocument() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    setSidebarCollapsed(true);
  }
}

function openLibrarySource(sourceId) {
  if (!sourceById(sourceId)) return;
  collapseSidebarForDocument();
  state.selectedSources.add(sourceId);
  const sourceToggle = document.querySelector(`#sourceFilters input[value="${sourceId}"]`);
  if (sourceToggle) sourceToggle.checked = true;
  state.openPassages.add("v1");
  state.openSourcePanels.add(`v1:${sourceId}`);
  state.search = "";
  document.querySelector("#searchInput").value = "";
  state.activeDocumentId = "";
  state.view = "reading";
  updateViewPresentation();
  renderSummary();
  renderReader();
  document.querySelector("#v1")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openResearchedDocument(documentId) {
  const documentRecord = (state.researchLibrary?.documents || []).find(
    (candidate) => candidate.id === documentId,
  );
  if (!documentRecord) return;
  if (documentRecord.textStatus !== "text-imported") {
    openTranslationLibraryRecord(documentId);
    return;
  }
  collapseSidebarForDocument();
  state.activeDocumentId = documentId;
  state.librarySelectedDocumentId = documentId;
  state.libraryLanguage = "all";
  state.search = "";
  state.activeAlignment = null;
  state.activeTextEditor = null;
  document.querySelector("#searchInput").value = "";
  state.view = "document";
  updateViewPresentation();
  renderReader();
  window.scrollTo(0, 0);
}

function openTranslationLibraryRecord(documentId) {
  const documents = state.researchLibrary?.documents || [];
  if (!documents.some((documentRecord) => documentRecord.id === documentId)) return;
  collapseSidebarForDocument();
  state.librarySelectedDocumentId = documentId;
  state.libraryLanguage = "all";
  state.activeDocumentId = "";
  state.search = "";
  state.activeAlignment = null;
  state.activeTextEditor = null;
  document.querySelector("#searchInput").value = "";
  state.view = "library";
  updateViewPresentation();
  renderReader();
  window.scrollTo(0, 0);
}

function closeResearchedDocument() {
  state.activeDocumentId = "";
  state.search = "";
  document.querySelector("#searchInput").value = "";
  state.view = "reading";
  updateViewPresentation();
  renderReader();
  document.querySelector("#documentShelf")?.scrollIntoView({ block: "start" });
}

function renderResearchedDocumentBlocks(documentRecord, selectedComponent, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searching = Boolean(normalizedQuery);
  const sourceBlocks = searching
    ? (documentRecord.components || []).flatMap((component) => component.blocks || [])
    : selectedComponent?.blocks || [];
  const visibleBlocks = sourceBlocks.filter((sourceBlock) => {
    if (!searching) return true;
    return `${sourceBlock.label}\n${sourceBlock.locator}\n${sourceBlock.text}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const heading = searching
    ? `Search results across ${documentRecord.components.length} components`
    : selectedComponent?.label || "Document text";
  const kind = searching ? "document search" : translationLibraryHumanize(selectedComponent?.kind);
  const body = visibleBlocks.length ? visibleBlocks.map((sourceBlock) => `
    <article class="library-block" id="library-${escapeAttribute(sourceBlock.id)}">
      <header>
        <strong>${escapeHtml(sourceBlock.label)}</strong>
        <span>${escapeHtml(sourceBlock.locator)}</span>
      </header>
      <div class="library-block-text">${searching ? highlightedText(sourceBlock.text, "", "") : escapeHtml(sourceBlock.text)}</div>
    </article>
  `).join("") : `
    <div class="library-empty-text">No text blocks in this document match the current search.</div>
  `;
  return `
    <div class="library-component-heading">
      <div>
        <p class="eyebrow">${escapeHtml(kind)}</p>
        <h3>${escapeHtml(heading)}</h3>
      </div>
      <span>${visibleBlocks.length}${searching ? ` of ${sourceBlocks.length}` : ""} source-located blocks</span>
    </div>
    <div class="library-blocks">${body}</div>
  `;
}

function renderResearchedDocumentArticle(documentRecord, supplement, standalone = false) {
  const components = documentRecord.components || [];
  const requestedComponentId = state.libraryComponentByDocument[documentRecord.id];
  const selectedComponent = components.find((component) => component.id === requestedComponentId) || components[0];
  const alignedSource = (supplement.sources || []).find(
    (source) => source.libraryDocumentId === documentRecord.id,
  );
  const readerSourceId = alignedSource?.id || documentRecord.sourceId || "";
  const sourceLinks = (documentRecord.links || []).map((sourceLink) => {
    const url = translationLibraryExternalUrl(sourceLink.url);
    if (!url) return "";
    return `<li><a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(sourceLink.label)}</a></li>`;
  }).join("");
  const componentSelector = components.length > 1 ? `
    <label class="library-component-selector">
      Reading component
      <select data-library-component>
        ${components.map((component) => `
          <option value="${escapeAttribute(component.id)}" ${component.id === selectedComponent?.id ? "selected" : ""}>
            ${escapeHtml(component.label)} · ${component.blocks.length} blocks
          </option>
        `).join("")}
      </select>
    </label>
  ` : "";
  const query = standalone ? state.search : "";
  const componentBody = selectedComponent
    ? renderResearchedDocumentBlocks(documentRecord, selectedComponent, query)
    : `<div class="library-empty-text">No body text is imported for this bibliographic record. Its research metadata and source links are retained above.</div>`;

  return `
    <article class="library-document${standalone ? " standalone-document" : ""}" data-library-current-document="${escapeAttribute(documentRecord.id)}">
      <header class="library-document-header">
        <div>
          <div class="library-badges">
            <span class="source-kind-badge">${escapeHtml(documentRecord.language)}</span>
            <span class="source-kind-badge">${escapeHtml(translationLibraryHumanize(documentRecord.recordKind))}</span>
            <span class="source-kind-badge">${escapeHtml(translationLibraryHumanize(documentRecord.textStatus))}</span>
          </div>
          <h2>${escapeHtml(documentRecord.title)}</h2>
          <p class="library-byline">${escapeHtml(documentRecord.creators)} · ${escapeHtml(documentRecord.date)}</p>
        </div>
        <div class="library-document-actions">
          ${standalone ? '<button class="secondary-button" data-close-document type="button">← Reading shelf</button>' : ""}
          ${readerSourceId ? `
            <button class="editor-primary library-open-reader" data-open-library-source="${escapeAttribute(readerSourceId)}" type="button">
              ${alignedSource ? "Open in parallel reader" : "Open existing witness in parallel reader"}
            </button>
          ` : ""}
        </div>
      </header>
      <p class="library-citation">${escapeHtml(documentRecord.citation)}</p>
      <dl class="library-metadata">
        <div><dt>Translation coverage</dt><dd>${escapeHtml(translationLibraryHumanize(documentRecord.translationStatus))}</dd></div>
        <div><dt>Imported coverage</dt><dd>${escapeHtml(documentRecord.coverage)}</dd></div>
        <div><dt>Textual basis</dt><dd>${escapeHtml(documentRecord.textualBasis)}</dd></div>
        <div><dt>Extraction and fidelity</dt><dd>${escapeHtml(documentRecord.fidelity)}</dd></div>
      </dl>
      ${sourceLinks ? `<ul class="library-links">${sourceLinks}</ul>` : ""}
      <details class="library-provenance">
        <summary>Source snapshot and extraction provenance</summary>
        <dl>
          <div><dt>Local source</dt><dd><code>${escapeHtml(documentRecord.sourceSnapshot.path)}</code></dd></div>
          <div><dt>SHA-256</dt><dd><code>${escapeHtml(documentRecord.sourceSnapshot.sha256)}</code></dd></div>
          <div><dt>Research snapshot</dt><dd>${escapeHtml(supplement.researchDate)}</dd></div>
        </dl>
      </details>
      <div class="library-reading-toolbar">
        ${componentSelector}
        ${query.trim() ? '<p class="document-search-note">Searching all components. Clear the sidebar search to return to the selected component.</p>' : ""}
      </div>
      ${componentBody}
    </article>
  `;
}

function renderDocumentShelf() {
  const documents = state.researchLibrary?.documents || [];
  const readable = documents.filter((documentRecord) => documentRecord.textStatus === "text-imported");
  const records = documents.filter((documentRecord) => documentRecord.textStatus !== "text-imported");
  return `
    <section id="documentShelf" class="document-shelf" aria-labelledby="documentShelfTitle">
      <header class="document-shelf-heading">
        <div>
          <p class="eyebrow">Researched translations</p>
          <h2 id="documentShelfTitle">Continuous reading shelf</h2>
          <p>Open complete documents in source order. Only Romanian, Vietnamese, and Lü Cheng’s Chinese have whole-passage mappings; the other texts are not assigned to individual verses. OCR and abridged material are labelled explicitly.</p>
        </div>
        <button class="secondary-button" data-open-translation-library type="button">Translation library · all ${documents.length} records</button>
      </header>
      <div class="document-shelf-grid">
        ${readable.map((documentRecord) => `
          <article class="document-shelf-card" data-shelf-document="${escapeAttribute(documentRecord.id)}">
            <div class="library-badges">
              <span class="source-kind-badge">${escapeHtml(documentRecord.language)}</span>
              <span class="source-kind-badge">${escapeHtml(translationLibraryHumanize(documentRecord.recordKind))}</span>
            </div>
            <h3>${escapeHtml(researchedDocumentLabel(documentRecord))}</h3>
            <p>${escapeHtml(researchedDocumentPresentation[documentRecord.id]?.description || documentRecord.coverage)}</p>
            <footer>
              <span>${researchedDocumentBlockCount(documentRecord)} source-located blocks</span>
              <button class="document-card-open" data-open-document="${escapeAttribute(documentRecord.id)}" type="button" aria-label="Read ${escapeAttribute(researchedDocumentLabel(documentRecord))}">Read document →</button>
            </footer>
          </article>
        `).join("")}
      </div>
      <section class="document-record-shelf" aria-labelledby="documentRecordShelfTitle">
        <div class="document-record-heading">
          <h3 id="documentRecordShelfTitle">Print & research records</h3>
          <p>${records.length} bibliographic records without imported body text. These are research leads, not additional readable translations.</p>
        </div>
        <div class="document-record-grid">
          ${records.map((documentRecord) => `
            <article class="document-record-card" data-shelf-record="${escapeAttribute(documentRecord.id)}">
              <span class="document-record-language">${escapeHtml(documentRecord.language)} · ${escapeHtml(translationLibraryHumanize(documentRecord.recordKind))}</span>
              <h4>${escapeHtml(documentRecord.title)}</h4>
              <p>${escapeHtml(documentRecord.creators)} · ${escapeHtml(documentRecord.date)}</p>
              <p>${escapeHtml(documentRecord.coverage)}</p>
              <button class="text-record-open" data-open-library-record="${escapeAttribute(documentRecord.id)}" type="button">View research record →</button>
            </article>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function bindDocumentShelf(reader) {
  reader.querySelectorAll("[data-open-document]").forEach((button) => {
    button.addEventListener("click", () => openResearchedDocument(button.dataset.openDocument));
  });
  reader.querySelectorAll("[data-open-library-record]").forEach((button) => {
    button.addEventListener("click", () => openTranslationLibraryRecord(button.dataset.openLibraryRecord));
  });
  reader.querySelector("[data-open-translation-library]")?.addEventListener("click", () => {
    openTranslationLibraryRecord(state.librarySelectedDocumentId || state.researchLibrary?.documents?.[0]?.id);
  });
}

function buildDocumentShortcuts() {
  const container = document.querySelector("#documentShortcuts");
  if (!container) return;
  const documents = (state.researchLibrary?.documents || []).filter(
    (documentRecord) => documentRecord.textStatus === "text-imported",
  );
  container.innerHTML = documents.map((documentRecord) => `
    <button class="document-shortcut" data-sidebar-document="${escapeAttribute(documentRecord.id)}" type="button">
      <span>${escapeHtml(researchedDocumentLabel(documentRecord))}</span>
      <span aria-hidden="true">→</span>
    </button>
  `).join("");
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sidebar-document]");
    if (button) openResearchedDocument(button.dataset.sidebarDocument);
  });
  updateDocumentShortcutState();
}

function updateDocumentShortcutState() {
  document.querySelectorAll("[data-sidebar-document]").forEach((button) => {
    const active = state.view === "document" && button.dataset.sidebarDocument === state.activeDocumentId;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function renderDocumentReader(reader) {
  const documentRecord = (state.researchLibrary?.documents || []).find(
    (candidate) => candidate.id === state.activeDocumentId && candidate.textStatus === "text-imported",
  );
  if (!documentRecord) {
    reader.innerHTML = '<div class="empty-state">This document is not available in the continuous reader.</div>';
    return;
  }
  reader.innerHTML = `
    <section class="standalone-document-reader" aria-label="Continuous translation document">
      <nav class="document-reader-nav" aria-label="Document navigation">
        <button class="secondary-button" data-close-document type="button">← Reading shelf</button>
        <span>${escapeHtml(researchedDocumentLabel(documentRecord))} · continuous source order</span>
        <button class="text-record-open" data-open-translation-library type="button">Open in translation library</button>
      </nav>
      ${renderResearchedDocumentArticle(documentRecord, state.researchLibrary, true)}
    </section>
  `;
  reader.querySelectorAll("[data-close-document]").forEach((button) => {
    button.addEventListener("click", closeResearchedDocument);
  });
  reader.querySelector("[data-open-translation-library]")?.addEventListener("click", () => {
    openTranslationLibraryRecord(documentRecord.id);
  });
  reader.querySelector("[data-library-component]")?.addEventListener("change", (event) => {
    state.libraryComponentByDocument[documentRecord.id] = event.target.value;
    renderReader();
  });
  reader.querySelector("[data-open-library-source]")?.addEventListener("click", (event) => {
    openLibrarySource(event.currentTarget.dataset.openLibrarySource);
  });
}

function renderTranslationLibrary(reader) {
  const supplement = state.researchLibrary || { documents: [], sources: [] };
  const documents = supplement.documents || [];
  const query = state.search.trim().toLocaleLowerCase();
  const languages = [...new Map(
    documents.map((documentRecord) => [
      documentRecord.languageCode,
      { code: documentRecord.languageCode, label: documentRecord.language },
    ]),
  ).values()].sort((left, right) => left.label.localeCompare(right.label));
  const visibleDocuments = documents.filter((documentRecord) => {
    if (state.libraryLanguage !== "all" && documentRecord.languageCode !== state.libraryLanguage) {
      return false;
    }
    return !query || translationLibrarySearchText(documentRecord).includes(query);
  });
  const selectedDocument = visibleDocuments.find(
    (documentRecord) => documentRecord.id === state.librarySelectedDocumentId,
  ) || visibleDocuments[0];
  const importedCount = documents.filter(
    (documentRecord) => documentRecord.textStatus === "text-imported",
  ).length;

  if (!documents.length) {
    reader.innerHTML = '<div class="empty-state">The researched translation supplement is not loaded.</div>';
    return;
  }

  const documentList = visibleDocuments.map((documentRecord) => `
    <button
      class="library-record ${selectedDocument?.id === documentRecord.id ? "selected" : ""}"
      data-library-document="${escapeAttribute(documentRecord.id)}"
      type="button"
      aria-pressed="${selectedDocument?.id === documentRecord.id}"
    >
      <span class="library-record-language">${escapeHtml(documentRecord.language)}</span>
      <strong>${escapeHtml(documentRecord.title)}</strong>
      <span>${escapeHtml(documentRecord.creators)}</span>
      <small>${documentRecord.textStatus === "text-imported" ? "Imported text" : documentRecord.textStatus === "existing-witness" ? "Existing parallel witness" : "Bibliographic record"}</small>
    </button>
  `).join("");

  const documentView = selectedDocument
    ? renderResearchedDocumentArticle(selectedDocument, supplement)
    : '<div class="empty-state">No library records match this search and language filter.</div>';

  reader.innerHTML = `
    <section class="translation-library">
      <aside class="library-browser">
        <div class="library-browser-heading">
          <p class="eyebrow">Research snapshot · ${escapeHtml(supplement.researchDate)}</p>
          <h2>Translation library</h2>
          <p>${documents.length} records · ${importedCount} with imported text</p>
        </div>
        <label class="library-language-filter">
          Language
          <select data-library-language>
            <option value="all" ${state.libraryLanguage === "all" ? "selected" : ""}>All languages</option>
            ${languages.map((language) => `
              <option value="${escapeAttribute(language.code)}" ${state.libraryLanguage === language.code ? "selected" : ""}>${escapeHtml(language.label)}</option>
            `).join("")}
          </select>
        </label>
        <p class="library-result-count">Showing ${visibleDocuments.length} of ${documents.length} records</p>
        <div class="library-record-list">${documentList}</div>
      </aside>
      <div class="library-document-pane">${documentView}</div>
    </section>
  `;

  reader.querySelectorAll("[data-library-document]").forEach((button) => {
    button.addEventListener("click", () => {
      state.librarySelectedDocumentId = button.dataset.libraryDocument;
      renderReader();
    });
  });
  reader.querySelector("[data-library-language]")?.addEventListener("change", (event) => {
    state.libraryLanguage = event.target.value;
    renderReader();
  });
  reader.querySelector("[data-library-component]")?.addEventListener("change", (event) => {
    if (!selectedDocument) return;
    state.libraryComponentByDocument[selectedDocument.id] = event.target.value;
    renderReader();
  });
  reader.querySelector("[data-open-library-source]")?.addEventListener("click", (event) => {
    openLibrarySource(event.currentTarget.dataset.openLibrarySource);
  });
}
