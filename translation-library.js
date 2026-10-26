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

  let documentView = '<div class="empty-state">No library records match this search and language filter.</div>';
  if (selectedDocument) {
    const components = selectedDocument.components || [];
    const requestedComponentId = state.libraryComponentByDocument[selectedDocument.id];
    const selectedComponent = components.find((component) => component.id === requestedComponentId) || components[0];
    const alignedSource = (supplement.sources || []).find(
      (source) => source.libraryDocumentId === selectedDocument.id,
    );
    const readerSourceId = alignedSource?.id || selectedDocument.sourceId || "";
    const sourceLinks = (selectedDocument.links || []).map((sourceLink) => {
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
    const componentBody = selectedComponent ? `
      <div class="library-component-heading">
        <div>
          <p class="eyebrow">${escapeHtml(translationLibraryHumanize(selectedComponent.kind))}</p>
          <h3>${escapeHtml(selectedComponent.label)}</h3>
        </div>
        <span>${selectedComponent.blocks.length} source-located blocks</span>
      </div>
      <div class="library-blocks">
        ${selectedComponent.blocks.map((sourceBlock) => `
          <article class="library-block" id="library-${escapeAttribute(sourceBlock.id)}">
            <header>
              <strong>${escapeHtml(sourceBlock.label)}</strong>
              <span>${escapeHtml(sourceBlock.locator)}</span>
            </header>
            <div class="library-block-text">${escapeHtml(sourceBlock.text)}</div>
          </article>
        `).join("")}
      </div>
    ` : `<div class="library-empty-text">${selectedDocument.textStatus === "existing-witness" ? "This alternate copy is linked to the existing Hindi parallel witness; no duplicate body text has been created." : "No body text is imported for this bibliographic record. Its research metadata and source links are retained above."}</div>`;

    documentView = `
      <article class="library-document" data-library-current-document="${escapeAttribute(selectedDocument.id)}">
        <header class="library-document-header">
          <div>
            <div class="library-badges">
              <span class="source-kind-badge">${escapeHtml(selectedDocument.language)}</span>
              <span class="source-kind-badge">${escapeHtml(translationLibraryHumanize(selectedDocument.recordKind))}</span>
              <span class="source-kind-badge">${escapeHtml(translationLibraryHumanize(selectedDocument.textStatus))}</span>
            </div>
            <h2>${escapeHtml(selectedDocument.title)}</h2>
            <p class="library-byline">${escapeHtml(selectedDocument.creators)} · ${escapeHtml(selectedDocument.date)}</p>
          </div>
          ${readerSourceId ? `
            <button class="editor-primary library-open-reader" data-open-library-source="${escapeAttribute(readerSourceId)}" type="button">
              ${alignedSource ? "Open in parallel reader" : "Open existing witness in parallel reader"}
            </button>
          ` : ""}
        </header>
        <p class="library-citation">${escapeHtml(selectedDocument.citation)}</p>
        <dl class="library-metadata">
          <div><dt>Translation coverage</dt><dd>${escapeHtml(translationLibraryHumanize(selectedDocument.translationStatus))}</dd></div>
          <div><dt>Imported coverage</dt><dd>${escapeHtml(selectedDocument.coverage)}</dd></div>
          <div><dt>Textual basis</dt><dd>${escapeHtml(selectedDocument.textualBasis)}</dd></div>
          <div><dt>Extraction and fidelity</dt><dd>${escapeHtml(selectedDocument.fidelity)}</dd></div>
        </dl>
        ${sourceLinks ? `<ul class="library-links">${sourceLinks}</ul>` : ""}
        <details class="library-provenance">
          <summary>Source snapshot and extraction provenance</summary>
          <dl>
            <div><dt>Local source</dt><dd><code>${escapeHtml(selectedDocument.sourceSnapshot.path)}</code></dd></div>
            <div><dt>SHA-256</dt><dd><code>${escapeHtml(selectedDocument.sourceSnapshot.sha256)}</code></dd></div>
            <div><dt>Research snapshot</dt><dd>${escapeHtml(supplement.researchDate)}</dd></div>
          </dl>
        </details>
        <div class="library-reading-toolbar">${componentSelector}</div>
        ${componentBody}
      </article>
    `;
  }

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
    const sourceId = event.currentTarget.dataset.openLibrarySource;
    state.selectedSources.add(sourceId);
    const sourceToggle = document.querySelector(`#sourceFilters input[value="${sourceId}"]`);
    if (sourceToggle) sourceToggle.checked = true;
    state.openPassages.add("v1");
    state.openSourcePanels.add(`v1:${sourceId}`);
    state.search = "";
    document.querySelector("#searchInput").value = "";
    state.view = "reading";
    updateViewPresentation();
    renderSummary();
    renderReader();
    document.querySelector("#v1")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
