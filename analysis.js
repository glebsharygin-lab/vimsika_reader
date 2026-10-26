const ANALYSIS_TABS = [
  ["lexicon", "Lexicon"],
  ["concordance", "Concordance"],
  ["morphology", "Morphology"],
  ["syntax", "Syntax"],
  ["statistics", "Statistics"],
];

const UD_PARTS_OF_SPEECH = [
  "ADJ",
  "ADP",
  "ADV",
  "AUX",
  "CCONJ",
  "DET",
  "INTJ",
  "NOUN",
  "NUM",
  "PART",
  "PRON",
  "PROPN",
  "PUNCT",
  "SCONJ",
  "SYM",
  "VERB",
  "X",
];

function analysisAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function normalizeAnalysisForm(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
}

const LEXICON_LANGUAGE_LABELS = {
  en: "English",
  sa: "Sanskrit",
  bo: "Tibetan",
  zh: "Chinese",
  fr: "French",
  de: "German",
  ru: "Russian",
  pl: "Polish",
  hu: "Hungarian",
  hi: "Hindi",
  ja: "Japanese",
  it: "Italian",
  es: "Spanish",
  sl: "Slovenian",
};

const DEVANAGARI_CONSONANTS = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ṅ",
  च: "c", छ: "ch", ज: "j", झ: "jh", ञ: "ñ",
  ट: "ṭ", ठ: "ṭh", ड: "ḍ", ढ: "ḍh", ण: "ṇ",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v",
  श: "ś", ष: "ṣ", स: "s", ह: "h", ळ: "ḷ",
};

const DEVANAGARI_VOWELS = {
  अ: "a", आ: "ā", इ: "i", ई: "ī", उ: "u", ऊ: "ū",
  ऋ: "ṛ", ॠ: "ṝ", ऌ: "ḷ", ॡ: "ḹ", ए: "e", ऐ: "ai",
  ओ: "o", औ: "au",
};

const DEVANAGARI_VOWEL_SIGNS = {
  "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "ृ": "ṛ",
  "ॄ": "ṝ", "ॢ": "ḷ", "ॣ": "ḹ", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

function transliterateDevanagari(value) {
  const characters = [...String(value || "").normalize("NFKC")];
  return characters
    .map((character, index) => {
      if (DEVANAGARI_CONSONANTS[character]) {
        const next = characters[index + 1];
        const inherentA = next !== "्" && !DEVANAGARI_VOWEL_SIGNS[next];
        return DEVANAGARI_CONSONANTS[character] + (inherentA ? "a" : "");
      }
      if (DEVANAGARI_VOWELS[character]) return DEVANAGARI_VOWELS[character];
      if (DEVANAGARI_VOWEL_SIGNS[character]) return DEVANAGARI_VOWEL_SIGNS[character];
      if (character === "ं") return "ṃ";
      if (character === "ँ") return "m̐";
      if (character === "ः") return "ḥ";
      if (character === "्" || character === "़") return "";
      return character;
    })
    .join("");
}

function foldAnalysisText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function normalizeLexicalForm(value) {
  return foldAnalysisText(transliterateDevanagari(value)).replace(/[^a-z0-9\p{Script=Han}]/gu, "");
}

function glossaryEntries() {
  return [
    ...(window.VIMSIKA_LEXICON?.entries || []),
    ...(window.VIMSIKA_CORPUS_LEXICON?.entries || []),
  ];
}

function isCuratedGlossaryEntry(entry) {
  return Boolean(entry && window.VIMSIKA_LEXICON?.entries?.includes(entry));
}

function glossaryPriority(entry) {
  return entry.priority ?? (isCuratedGlossaryEntry(entry) ? 1000 : 0);
}

function lexicalPartsFor(form, language) {
  if (language === "zho") {
    return [...String(form || "").replace(/\s+/g, "")]
      .map(normalizeLexicalForm)
      .filter(Boolean);
  }
  return String(form || "")
    .trim()
    .split(/\s+/)
    .map(normalizeLexicalForm)
    .filter(Boolean);
}

function glossaryFormsForEntry(entry) {
  const forms = [...(entry.forms || [])];
  // Slashes in a lemma often separate alternatives, not an attested phrase.
  if (entry.lemma && !entry.lemma.includes("/")) forms.unshift(entry.lemma);
  return [...new Set(forms.filter(Boolean))];
}

function glossaryIndexForLanguage(language) {
  const cache = renderCache();
  cache.glossaryIndexesByLanguage ||= new Map();
  if (cache.glossaryIndexesByLanguage.has(language)) {
    return cache.glossaryIndexesByLanguage.get(language);
  }
  const index = new Map();
  glossaryEntries().forEach((entry, order) => {
    if ((entry.language || "san") !== language) return;
    glossaryFormsForEntry(entry).forEach((form) => {
      const parts = lexicalPartsFor(form, language);
      if (!parts.length) return;
      parts.forEach((part, position) => {
        if (!index.has(part)) index.set(part, []);
        index.get(part).push({ entry, parts, position, order, priority: glossaryPriority(entry) });
      });
    });
  });
  index.forEach((candidates) => {
    candidates.sort(
      (left, right) =>
        right.parts.length - left.parts.length ||
        right.priority - left.priority ||
        left.order - right.order,
    );
  });
  cache.glossaryIndexesByLanguage.set(language, index);
  return index;
}

function glossaryRecordsForSource(sourceId) {
  const cache = renderCache();
  cache.glossaryRecordsBySource ||= new Map();
  if (cache.glossaryRecordsBySource.has(sourceId)) {
    return cache.glossaryRecordsBySource.get(sourceId);
  }
  const records = analysisTokenRecords(sourceId);
  const byTokenId = new Map();
  records.forEach((record, index) => {
    record.lexicalNormalized = normalizeLexicalForm(record.token.text);
    if (!byTokenId.has(record.token.id)) byTokenId.set(record.token.id, index);
  });
  const result = { records, byTokenId };
  cache.glossaryRecordsBySource.set(sourceId, result);
  return result;
}

function glossaryMatchFor(sourceId, tokenId, surface, languageOverride = "") {
  const source = sourceId ? sourceById(sourceId) : null;
  const language = source?.languageCode || languageOverride || "san";
  if (!["san", "bod", "zho"].includes(language)) return null;
  const normalized = normalizeLexicalForm(surface);
  if (!normalized) return null;
  const cache = renderCache();
  cache.glossaryMatches ||= new Map();
  const cacheKey = `${sourceId || language}:${tokenId || ""}:${normalized}`;
  if (cache.glossaryMatches.has(cacheKey)) return cache.glossaryMatches.get(cacheKey);
  const index = glossaryIndexForLanguage(language);
  let match = null;

  if (sourceId && tokenId) {
    const { records, byTokenId } = glossaryRecordsForSource(sourceId);
    const recordIndex = byTokenId.get(tokenId);
    if (Number.isInteger(recordIndex)) {
      const record = records[recordIndex];
      const candidates = index.get(record.lexicalNormalized) || [];
      for (const candidate of candidates) {
        const start = recordIndex - candidate.position;
        if (start < 0 || start + candidate.parts.length > records.length) continue;
        const span = records.slice(start, start + candidate.parts.length);
        if (!span.every(
          (item, offset) =>
            item.passageId === record.passageId &&
            item.lexicalNormalized === candidate.parts[offset],
        )) continue;
        match = {
          entry: candidate.entry,
          start,
          end: start + candidate.parts.length,
          matchedText: span.map((item) => item.token.text).join(language === "zho" ? "" : " "),
          matchedTokenIds: span.map((item) => item.token.id),
        };
        break;
      }
    }
  }

  if (!match) {
    const surfaceParts = lexicalPartsFor(surface, language);
    const candidates = index.get(surfaceParts[0]) || [];
    const candidate = candidates.find(
      (item) =>
        item.position === 0 &&
        item.parts.length === surfaceParts.length &&
        item.parts.every((part, offset) => part === surfaceParts[offset]),
    );
    if (candidate) {
      match = { entry: candidate.entry, matchedText: surface, matchedTokenIds: tokenId ? [tokenId] : [] };
    }
  }
  cache.glossaryMatches.set(cacheKey, match);
  return match;
}

function glossaryEntryForSurface(surface, language = "san") {
  return glossaryMatchFor("", "", surface, language)?.entry || null;
}

function glossaryEntryFor(sourceId, tokenId, surface) {
  return glossaryMatchFor(sourceId, tokenId, surface)?.entry || null;
}

function lexicalEntryOrigin(entry) {
  if (!entry) return "Unannotated";
  if (entry.status === "dictionary-extract") return "Dictionary extract";
  if (entry.status === "text-critical") return "Text-critical working note";
  if (isCuratedGlossaryEntry(entry)) return "Curated working glossary · draft";
  return "Corpus working entry · draft";
}

function resolvedLexicalRecord(sourceId, tokenId, surface) {
  const editorial = lexiconEntryFor(sourceId, tokenId, surface);
  const lexicalMatch = glossaryMatchFor(sourceId, tokenId, surface);
  const glossary = lexicalMatch?.entry || null;
  const normalized = normalizeLexicalForm(surface);
  const morphologyKey = Object.keys(glossary?.morphology || {}).find(
    (form) => normalizeLexicalForm(form) === normalized,
  );
  return {
    editorial,
    glossary,
    lexicalMatch,
    matchedText: lexicalMatch?.matchedText || surface,
    matchedTokenIds: lexicalMatch?.matchedTokenIds || [],
    lemma: editorial?.lemma || glossary?.lemma || "",
    partOfSpeech: editorial?.partOfSpeech || glossary?.partOfSpeech || "",
    morphology:
      editorial?.morphology ||
      (morphologyKey ? glossary.morphology[morphologyKey] : "") ||
      glossary?.analysis ||
      "",
    reading: editorial?.reading || glossary?.reading || "",
    gloss: editorial?.gloss || glossary?.gloss || "",
    notes: editorial?.notes || glossary?.note || "",
    sources: glossary?.sources || [],
    status: glossary?.status || (isCuratedGlossaryEntry(glossary) ? "draft" : ""),
  };
}

function analysisRecordMatchesQuery(record, query = state.analysisQuery) {
  const foldedQuery = foldAnalysisText(query);
  if (!foldedQuery) return true;
  const resolved = resolvedLexicalRecord(record.sourceId, record.token.id, record.token.text);
  const { editorial, glossary } = resolved;
  const equivalents = Object.values(glossary?.equivalents || {}).flat();
  const haystack = foldAnalysisText(
    [
      record.token.text,
      transliterateDevanagari(record.token.text),
      resolved.matchedText,
      editorial?.lemma,
      editorial?.gloss,
      editorial?.notes,
      glossary?.lemma,
      glossary?.reading,
      glossary?.gloss,
      glossary?.analysis,
      glossary?.note,
      ...equivalents,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(foldedQuery);
}

function allLexiconEntries() {
  const entries = [
    ...(state.corpus.lexiconEntries || []),
    ...(state.publishedEditorData.lexiconEntries || []),
    ...(state.editorData.lexiconEntries || []),
  ];
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

function allSyntaxAnnotations() {
  const annotations = [
    ...(state.corpus.syntaxAnnotations || []),
    ...(state.publishedEditorData.syntaxAnnotations || []),
    ...(state.editorData.syntaxAnnotations || []),
  ];
  return [
    ...new Map(annotations.map((annotation) => [annotation.id, annotation])).values(),
  ];
}

function analysisSource() {
  return (
    sourceById(state.analysisSourceId) ||
    sourceById("san_levi_1925") ||
    state.corpus.sources[0]
  );
}

function analysisTokenRecords(sourceId = analysisSource().id) {
  return state.corpus.passages.flatMap((passage) => {
    const witness = effectiveWitness(passage, sourceId);
    const sentenceByToken = new Map();
    effectiveSentenceUnits(passage).forEach((unit) => {
      (unit.targetTokenIds?.[sourceId] || []).forEach((tokenId) => {
        sentenceByToken.set(tokenId, unit);
      });
    });
    return (witness.tokens || []).map((token, index) => ({
      token,
      index,
      sourceId,
      passage,
      passageId: passage.id,
      verse: passage.number,
      witness,
      sentence: sentenceByToken.get(token.id) || null,
      normalized: normalizeAnalysisForm(token.text),
    }));
  });
}

function analysisFrequencyRows(sourceId = analysisSource().id) {
  const forms = new Map();
  analysisTokenRecords(sourceId).forEach((record) => {
    if (!record.normalized) return;
    const current = forms.get(record.normalized) || {
      normalized: record.normalized,
      form: record.token.text,
      count: 0,
      passages: new Set(),
      representative: record,
    };
    current.count += 1;
    current.passages.add(record.passageId);
    forms.set(record.normalized, current);
  });
  return [...forms.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.form.localeCompare(right.form, undefined, { sensitivity: "base" }),
  );
}

function selectedAnalysisRecord() {
  const records = analysisTokenRecords();
  return (
    records.find(
      (record) =>
        record.token.id === state.analysisSelectedTokenId &&
        record.passageId === state.analysisSelectedPassageId,
    ) ||
    records.find((record) => analysisRecordMatchesQuery(record)) ||
    records[0] ||
    null
  );
}

function ensureAnalysisState() {
  const source = analysisSource();
  state.analysisSourceId = source.id;
  const selected = selectedAnalysisRecord();
  if (selected) {
    state.analysisSelectedTokenId = selected.token.id;
    state.analysisSelectedPassageId = selected.passageId;
    state.analysisPassageId =
      passageById(state.analysisPassageId)?.id || selected.passageId;
  } else {
    state.analysisSelectedTokenId = "";
    state.analysisSelectedPassageId = "";
    state.analysisPassageId = state.corpus.passages[0]?.id || "";
  }
  const passage = passageById(state.analysisPassageId);
  const units = passage
    ? phraseAlignments(passage).filter((unit) => unit.level === "sentence")
    : [];
  if (!units.some((unit) => unit.id === state.analysisSentenceId)) {
    state.analysisSentenceId = units[0]?.id || "";
  }
}

function analysisSourceOptions() {
  return state.corpus.sources
    .map(
      (source) => `
        <option value="${analysisAttribute(source.id)}" ${
          source.id === analysisSource().id ? "selected" : ""
        }>${escapeHtml(source.label)}</option>
      `,
    )
    .join("");
}

function analysisPassageOptions() {
  return state.corpus.passages
    .map(
      (passage) => `
        <option value="${analysisAttribute(passage.id)}" ${
          passage.id === state.analysisPassageId ? "selected" : ""
        }>Verse ${passage.number}</option>
      `,
    )
    .join("");
}

function analysisSentenceOptions() {
  const passage = passageById(state.analysisPassageId);
  if (!passage) return "";
  return phraseAlignments(passage)
    .filter((unit) => unit.level === "sentence")
    .map(
      (unit) => `
        <option value="${analysisAttribute(unit.id)}" ${
          unit.id === state.analysisSentenceId ? "selected" : ""
        }>${escapeHtml(unit.number || unit.label)}</option>
      `,
    )
    .join("");
}

function analysisContextHtml(record) {
  const text = record.witness.text || "";
  const start = Math.max(0, record.token.start - 72);
  const end = Math.min(text.length, record.token.end + 100);
  return `${start ? "… " : ""}${escapeHtml(text.slice(start, record.token.start))}<mark>${escapeHtml(record.token.text)}</mark>${escapeHtml(text.slice(record.token.end, end))}${end < text.length ? " …" : ""}`;
}

function lexicalEquivalentsHtml(glossary, compact = false) {
  const equivalents = Object.entries(glossary?.equivalents || {});
  if (!equivalents.length) return "";
  return `
    <div class="lexical-equivalents ${compact ? "compact" : ""}">
      ${equivalents
        .map(
          ([languageCode, values]) => `
            <div class="lexical-equivalent-row">
              <span>${escapeHtml(LEXICON_LANGUAGE_LABELS[languageCode] || languageCode)}</span>
              <div lang="${analysisAttribute(languageCode)}">
                ${values.map((value) => `<strong>${escapeHtml(value)}</strong>`).join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function lexicalEvidenceFor(record) {
  const unit = record.sentence;
  if (!unit) return [];
  const languagePriority = [
    "eng", "tib", "zho", "san", "fra", "de", "rus", "pol", "hun", "hin", "jpn", "ita", "spa", "slv",
  ];
  const recordLanguage = sourceById(record.sourceId)?.languageCode;
  const byLanguage = new Map();
  state.corpus.sources.forEach((source) => {
    if (source.languageCode === recordLanguage || byLanguage.has(source.languageCode)) return;
    const text = alignmentTargetText(unit, record.passage, source.id).replace(/\s+/g, " ").trim();
    if (!text) return;
    byLanguage.set(source.languageCode, { source, text, unit });
  });
  return [...byLanguage.values()].sort(
    (left, right) =>
      (languagePriority.indexOf(left.source.id.split("_")[0]) + 1 || 99) -
      (languagePriority.indexOf(right.source.id.split("_")[0]) + 1 || 99),
  );
}

function lexicalEvidenceHtml(record, limit = 0) {
  const evidence = lexicalEvidenceFor(record);
  const visible = limit ? evidence.slice(0, limit) : evidence;
  if (!visible.length) {
    return '<p class="lexical-evidence-empty">No aligned sentence in another language is available for this token.</p>';
  }
  return `
    <div class="lexical-evidence-list">
      ${visible
        .map(
          ({ source, text, unit }) => `
            <article class="lexical-evidence-item">
              <header>
                <strong>${escapeHtml(source.language)}</strong>
                <span>${escapeHtml(source.shortLabel || source.label)} · ${escapeHtml(unit.number || unit.label)}</span>
              </header>
              <p lang="${analysisAttribute(source.languageCode)}">${escapeHtml(text)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function analysisLexicalWorkbench(record) {
  const resolved = resolvedLexicalRecord(
    record.sourceId,
    record.token.id,
    record.token.text,
  );
  const glossary = resolved.glossary;
  const evidence = lexicalEvidenceFor(record);
  if (!glossary && !evidence.length) return "";
  const language = sourceById(record.sourceId)?.language || "Multilingual";
  const description = isCuratedGlossaryEntry(glossary)
    ? window.VIMSIKA_LEXICON?.description
    : window.VIMSIKA_CORPUS_LEXICON?.description;
  const sources = resolved.sources.join(" · ");
  return `
    <section class="analysis-card analysis-multilingual-card">
      <div class="analysis-card-heading">
        <div>
          <p class="eyebrow">${escapeHtml(language)} lexical inspector</p>
          <h3>${escapeHtml(resolved.lemma || record.token.text)} · multilingual correspondences</h3>
        </div>
        <span class="analysis-origin">${glossary ? escapeHtml(lexicalEntryOrigin(glossary)) : "Witness evidence"}</span>
      </div>
      ${
        glossary
          ? `<div class="analysis-glossary-summary">
              <div>
                <span>Lexical gloss</span>
                <strong>${escapeHtml(resolved.gloss)}</strong>
              </div>
              <div>
                <span>Grammar</span>
                <strong>${escapeHtml([resolved.partOfSpeech, glossary.gender].filter(Boolean).join(" · ") || "Not specified")}</strong>
              </div>
              ${resolved.reading ? `<div><span>Reading</span><strong>${escapeHtml(resolved.reading)}</strong></div>` : ""}
              ${resolved.matchedTokenIds.length > 1 ? `<div><span>Matched term</span><strong>${escapeHtml(resolved.matchedText)}</strong></div>` : ""}
              ${glossary.analysis ? `<div><span>Form / compound analysis</span><strong>${escapeHtml(glossary.analysis)}</strong></div>` : ""}
            </div>
            ${lexicalEquivalentsHtml(glossary)}
            ${sources ? `<p class="analysis-guidance"><strong>Lexical sources:</strong> ${escapeHtml(sources)}</p>` : ""}
            <p class="analysis-guidance">${escapeHtml(description || "Lexical equivalents are reading aids, not reviewed token-level alignments.")}${resolved.notes ? ` ${escapeHtml(resolved.notes)}` : ""}</p>`
          : ""
      }
      <div class="lexical-evidence-heading">
        <div>
          <p class="eyebrow">In this passage</p>
          <h4>Aligned sentence witnesses</h4>
        </div>
        <span>${evidence.length} language${evidence.length === 1 ? "" : "s"}</span>
      </div>
      <p class="analysis-guidance">These are sentence-level translation contexts for the selected token, not reviewed word-for-word alignments.</p>
      ${lexicalEvidenceHtml(record)}
    </section>
  `;
}

function analysisEntryOrigin(entry, collection = "lexiconEntries") {
  if (!entry) return "Unannotated";
  if (state.editorData[collection].some((item) => item.id === entry.id)) {
    return "Local draft";
  }
  if (state.publishedEditorData[collection].some((item) => item.id === entry.id)) {
    return "Published editorial record";
  }
  return "Imported corpus record";
}

function analysisTopFormsList(limit = 80) {
  const rows = analysisFrequencyRows()
    .filter((row) => analysisRecordMatchesQuery(row.representative))
    .slice(0, limit);
  if (!rows.length) {
    return '<div class="analysis-empty">No forms, lemmas, glosses, or equivalents match this search.</div>';
  }
  return rows
    .map((row) => {
      const resolved = resolvedLexicalRecord(
        row.representative.sourceId,
        row.representative.token.id,
        row.form,
      );
      const active =
        row.representative.token.id === state.analysisSelectedTokenId &&
        row.representative.passageId === state.analysisSelectedPassageId;
      return `
        <button
          class="analysis-form-row ${active ? "active" : ""}"
          data-analysis-select-token="${analysisAttribute(row.representative.token.id)}"
          data-analysis-passage="${analysisAttribute(row.representative.passageId)}"
          type="button"
        >
          <span class="analysis-form-main">
            <strong>${escapeHtml(row.form)}</strong>
            <small>${escapeHtml([resolved.lemma, resolved.gloss].filter(Boolean).join(" · ") || "No lexical annotation")}</small>
          </span>
          <span class="analysis-count">${row.count.toLocaleString()}</span>
        </button>
      `;
    })
    .join("");
}

function lexiconPanel() {
  const record = selectedAnalysisRecord();
  if (!record) {
    return '<div class="analysis-empty">This witness has no addressable tokens.</div>';
  }
  const resolved = resolvedLexicalRecord(
    record.sourceId,
    record.token.id,
    record.token.text,
  );
  const entry = resolved.editorial;
  const editable = canEdit();
  const partOfSpeech = resolved.partOfSpeech;
  const frequency = analysisFrequencyRows().find(
    (row) => row.normalized === record.normalized,
  );
  return `
    <div class="analysis-two-column">
      <section class="analysis-card analysis-index-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">Form index</p>
            <h3>${escapeHtml(analysisSource().label)}</h3>
          </div>
          <span>${analysisFrequencyRows().length.toLocaleString()} distinct forms</span>
        </div>
        <div class="analysis-form-list">${analysisTopFormsList()}</div>
      </section>
      <section class="analysis-card analysis-editor-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">Lexical record</p>
            <h3>${escapeHtml(record.token.text)}</h3>
          </div>
          <span class="analysis-origin">${escapeHtml(entry ? analysisEntryOrigin(entry) : lexicalEntryOrigin(resolved.glossary))}</span>
        </div>
        <div class="analysis-token-meta">
          <code>${escapeHtml(record.token.id)}</code>
          <span>Verse ${record.verse}${record.sentence ? ` · ${escapeHtml(record.sentence.number)}` : ""}</span>
          <span>${escapeHtml(record.token.type || "token")}</span>
          <button data-analysis-concordance-selected type="button">${(frequency?.count || 1).toLocaleString()} occurrence${(frequency?.count || 1) === 1 ? "" : "s"}</button>
        </div>
        <p class="analysis-context">${analysisContextHtml(record)}</p>
        <form class="analysis-lexicon-form" data-analysis-lexicon-form>
          <input type="hidden" name="tokenId" value="${analysisAttribute(record.token.id)}">
          <input type="hidden" name="passageId" value="${analysisAttribute(record.passageId)}">
          <div class="analysis-field-grid">
            <label>
              Lemma
              <input name="lemma" value="${analysisAttribute(resolved.lemma)}" ${editable ? "" : "disabled"}>
            </label>
            <label>
              Universal POS
              <select name="partOfSpeech" ${editable ? "" : "disabled"}>
                <option value="">—</option>
                ${UD_PARTS_OF_SPEECH.map(
                  (value) =>
                    `<option value="${value}" ${value === partOfSpeech ? "selected" : ""}>${value}</option>`,
                ).join("")}
              </select>
            </label>
            <label>
              Morphology / UD FEATS
              <input name="morphology" value="${analysisAttribute(resolved.morphology)}" placeholder="Case=Loc|Number=Sing" ${editable ? "" : "disabled"}>
            </label>
            <label>
              Reading / transliteration
              <input name="reading" value="${analysisAttribute(resolved.reading)}" ${editable ? "" : "disabled"}>
            </label>
            <label class="analysis-wide-field">
              Gloss
              <input name="gloss" value="${analysisAttribute(resolved.gloss)}" ${editable ? "" : "disabled"}>
            </label>
            <label>
              Confidence
              <select name="confidence" ${editable ? "" : "disabled"}>
                ${["", "low", "medium", "high", "reviewed"].map(
                  (value) =>
                    `<option value="${value}" ${value === (entry?.confidence || "") ? "selected" : ""}>${value || "—"}</option>`,
                ).join("")}
              </select>
            </label>
            <label>
              Scope
              <select name="scope" ${editable ? "" : "disabled"}>
                <option value="surface" ${(entry?.scope || "surface") === "surface" ? "selected" : ""}>Every identical form</option>
                <option value="token" ${entry?.scope === "token" ? "selected" : ""}>This token only</option>
              </select>
            </label>
            <label class="analysis-wide-field">
              Notes
              <textarea name="notes" rows="4" ${editable ? "" : "disabled"}>${escapeHtml(resolved.notes)}</textarea>
            </label>
          </div>
          <div class="analysis-editor-actions">
            ${
              editable
                ? '<button class="editor-primary" type="submit">Save lexical record</button>'
                : '<span>Sign in as a trusted collaborator to edit.</span>'
            }
            ${
              entry && state.editorData.lexiconEntries.some((item) => item.id === entry.id)
                ? `<button data-delete-lexicon-entry="${analysisAttribute(entry.id)}" type="button">Discard local record</button>`
                : ""
            }
          </div>
          <div class="editor-status" data-analysis-status aria-live="polite"></div>
        </form>
      </section>
    </div>
    ${analysisLexicalWorkbench(record)}
  `;
}

function concordancePanel() {
  const query = normalizeAnalysisForm(state.analysisQuery);
  const records = analysisTokenRecords().filter(
    (record) => query && analysisRecordMatchesQuery(record),
  );
  const frequencies = analysisFrequencyRows()
    .filter((row) => analysisRecordMatchesQuery(row.representative))
    .slice(0, 30);
  return `
    <div class="analysis-two-column concordance-layout">
      <section class="analysis-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">Frequency list</p>
            <h3>${query ? `Forms matching “${escapeHtml(state.analysisQuery)}”` : "Most frequent forms"}</h3>
          </div>
          <span>${query ? `${records.length.toLocaleString()} token hits` : "choose a form"}</span>
        </div>
        <div class="analysis-frequency-table">
          ${frequencies
            .map(
              (row, index) => `
                <button
                  class="analysis-frequency-row"
                  data-analysis-search-form="${analysisAttribute(row.form)}"
                  type="button"
                >
                  <span>${index + 1}</span>
                  <strong>${escapeHtml(row.form)}</strong>
                  <span>${row.count.toLocaleString()}</span>
                  <span>${row.passages.size} verses</span>
                </button>
              `,
            )
            .join("") || '<div class="analysis-empty">No concordance results.</div>'}
        </div>
      </section>
      <section class="analysis-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">KWIC concordance</p>
            <h3>${query ? escapeHtml(state.analysisQuery) : "Select a form"}</h3>
          </div>
          <span>${query ? `first ${Math.min(records.length, 120).toLocaleString()} occurrences` : ""}</span>
        </div>
        <div class="analysis-concordance-list">
          ${records
            .slice(0, 120)
            .map(
              (record) => `
                <button
                  class="analysis-concordance-row"
                  data-analysis-open-lexicon="${analysisAttribute(record.token.id)}"
                  data-analysis-passage="${analysisAttribute(record.passageId)}"
                  type="button"
                >
                  <span class="analysis-location">v.${record.verse}${record.sentence ? ` · ${escapeHtml(record.sentence.number)}` : ""}</span>
                  <span>${analysisContextHtml(record)}</span>
                </button>
              `,
            )
            .join("") || '<div class="analysis-empty">Enter a word or choose one from the frequency list.</div>'}
        </div>
      </section>
    </div>
  `;
}

function selectedAnalysisSentence() {
  const passage = passageById(state.analysisPassageId);
  if (!passage) return { passage: null, unit: null, tokens: [] };
  const unit = phraseAlignments(passage).find(
    (item) => item.id === state.analysisSentenceId,
  );
  const ids = new Set(unit?.targetTokenIds?.[analysisSource().id] || []);
  const tokens = (effectiveWitness(passage, analysisSource().id).tokens || []).filter(
    (token) => ids.has(token.id),
  );
  return { passage, unit, tokens };
}

function morphologyPanel() {
  const { passage, unit, tokens } = selectedAnalysisSentence();
  return `
    <section class="analysis-card">
      <div class="analysis-card-heading">
        <div>
          <p class="eyebrow">Token morphology</p>
          <h3>${unit ? `${escapeHtml(unit.number)} · ${escapeHtml(analysisSource().label)}` : "Choose a sentence"}</h3>
        </div>
        <span>${tokens.length} tokens · ${canEdit() ? "click a row to annotate" : "read-only"}</span>
      </div>
      ${
        tokens.length
          ? `<div class="analysis-table-wrap">
              <table class="analysis-table">
                <thead>
                  <tr><th>#</th><th>Form</th><th>Lemma</th><th>UPOS</th><th>Features</th><th>Gloss</th></tr>
                </thead>
                <tbody>
                  ${tokens
                    .map((token, index) => {
                      const resolved = resolvedLexicalRecord(
                        analysisSource().id,
                        token.id,
                        token.text,
                      );
                      return `
                        <tr
                          data-analysis-open-lexicon="${analysisAttribute(token.id)}"
                          data-analysis-passage="${analysisAttribute(passage.id)}"
                          tabindex="0"
                        >
                          <td>${index + 1}</td>
                          <td><strong>${escapeHtml(token.text)}</strong></td>
                          <td>${escapeHtml(resolved.lemma || "—")}</td>
                          <td>${escapeHtml(resolved.partOfSpeech || "—")}</td>
                          <td><code>${escapeHtml(resolved.morphology || "—")}</code></td>
                          <td>${escapeHtml(resolved.gloss || "—")}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>`
          : '<div class="analysis-empty">No token span is assigned to this witness for the selected sentence.</div>'
      }
    </section>
  `;
}

function syntaxAnnotationFor(sourceId, passageId, sentenceId) {
  return [...allSyntaxAnnotations()]
    .reverse()
    .find(
      (annotation) =>
        annotation.sourceId === sourceId &&
        annotation.passageId === passageId &&
        annotation.sentenceId === sentenceId,
    );
}

function conlluValue(value) {
  return String(value || "_").replaceAll("\t", " ").replaceAll("\n", " ") || "_";
}

function starterConllu() {
  const { passage, unit, tokens } = selectedAnalysisSentence();
  if (!passage || !unit) return "";
  const rows = tokens.map((token, index) => {
    const resolved = resolvedLexicalRecord(analysisSource().id, token.id, token.text);
    return [
      index + 1,
      conlluValue(token.text),
      conlluValue(resolved.lemma),
      conlluValue(resolved.partOfSpeech),
      "_",
      conlluValue(resolved.morphology),
      "_",
      "_",
      "_",
      `TokenId=${conlluValue(token.id)}`,
    ].join("\t");
  });
  return [
    `# sent_id = ${passage.id}.${unit.id}.${analysisSource().id}`,
    `# text = ${conlluValue(tokenTextFromIds(passage, analysisSource().id, unit.targetTokenIds?.[analysisSource().id] || []))}`,
    ...rows,
  ].join("\n");
}

function parseConllu(conllu) {
  return String(conllu || "")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const fields = line.split("\t");
      while (fields.length < 10) fields.push("_");
      return fields.slice(0, 10);
    });
}

function syntaxPanel() {
  const { unit, tokens } = selectedAnalysisSentence();
  const annotation = syntaxAnnotationFor(
    analysisSource().id,
    state.analysisPassageId,
    state.analysisSentenceId,
  );
  const key = `${analysisSource().id}:${state.analysisPassageId}:${state.analysisSentenceId}`;
  const conllu =
    state.analysisSyntaxDraft?.key === key
      ? state.analysisSyntaxDraft.value
      : annotation?.conllu || starterConllu();
  const rows = parseConllu(conllu);
  return `
    <div class="analysis-syntax-layout">
      <section class="analysis-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">Dependency annotation</p>
            <h3>${unit ? `${escapeHtml(unit.number)} · CoNLL-U draft` : "Choose a sentence"}</h3>
          </div>
          <span>${annotation ? analysisEntryOrigin(annotation, "syntaxAnnotations") : "Unsaved scaffold"}</span>
        </div>
        <p class="analysis-guidance">
          The generated rows preserve permanent corpus token IDs in MISC. Add HEAD and DEPREL values only after scholarly review.
        </p>
        <textarea class="analysis-conllu-editor" data-analysis-conllu rows="18" spellcheck="false" ${canEdit() ? "" : "disabled"}>${escapeHtml(conllu)}</textarea>
        <div class="analysis-editor-actions">
          ${
            canEdit()
              ? '<button data-generate-conllu type="button">Regenerate token scaffold</button><button class="editor-primary" data-save-conllu type="button">Save syntax draft</button>'
              : '<span>Sign in as a trusted collaborator to edit syntax.</span>'
          }
        </div>
        <div class="editor-status" data-analysis-status aria-live="polite"></div>
      </section>
      <section class="analysis-card">
        <div class="analysis-card-heading">
          <div>
            <p class="eyebrow">Structured preview</p>
            <h3>${tokens.length} sentence tokens</h3>
          </div>
          <span>UD / CoNLL-U columns</span>
        </div>
        <div class="analysis-table-wrap">
          <table class="analysis-table syntax-table">
            <thead><tr><th>ID</th><th>Form</th><th>Lemma</th><th>UPOS</th><th>FEATS</th><th>HEAD</th><th>DEPREL</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (fields) => `
                    <tr>
                      <td>${escapeHtml(fields[0])}</td>
                      <td><strong>${escapeHtml(fields[1])}</strong></td>
                      <td>${escapeHtml(fields[2])}</td>
                      <td>${escapeHtml(fields[3])}</td>
                      <td><code>${escapeHtml(fields[5])}</code></td>
                      <td>${escapeHtml(fields[6])}</td>
                      <td>${escapeHtml(fields[7])}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function analysisLexicalEligible(record) {
  const source = sourceById(record.sourceId);
  const text = record.token.text;
  if (!/\p{L}/u.test(text) || /^\d+$/.test(text)) return false;
  if (source?.languageCode === "san" && text === "Vvs") return false;
  if (source?.languageCode === "bod" && (
    /^[A-Z]$/.test(text) ||
    /^[IVXLCDM]+$/.test(text) ||
    /^\d+[a-z]+$/i.test(text) ||
    /^(?:Colophon|EF)$/i.test(text)
  )) return false;
  if (source?.languageCode === "zho") return /\p{Script=Han}/u.test(text);
  return true;
}

function analysisGlossaryCoverage(sourceId = analysisSource().id) {
  const cache = renderCache();
  cache.glossaryCoverageBySource ||= new Map();
  if (cache.glossaryCoverageBySource.has(sourceId)) {
    return cache.glossaryCoverageBySource.get(sourceId);
  }
  const records = analysisTokenRecords(sourceId);
  const types = new Map();
  let tokens = 0;
  let coveredTokens = 0;
  records.forEach((record) => {
    if (!analysisLexicalEligible(record)) return;
    const normalized = normalizeLexicalForm(record.token.text);
    if (!normalized) return;
    const found = Boolean(glossaryMatchFor(record.sourceId, record.token.id, record.token.text));
    tokens += 1;
    if (found) coveredTokens += 1;
    const type = types.get(normalized) || { covered: false };
    if (found) type.covered = true;
    types.set(normalized, type);
  });
  const coveredTypes = [...types.values()].filter((type) => type.covered).length;
  const result = {
    tokens,
    coveredTokens,
    types: types.size,
    coveredTypes,
    tokenCoverage: tokens ? 100 * coveredTokens / tokens : 0,
    typeCoverage: types.size ? 100 * coveredTypes / types.size : 0,
  };
  cache.glossaryCoverageBySource.set(sourceId, result);
  return result;
}

function statisticsPanel() {
  const sourceRows = state.corpus.sources.map((source) => {
    const records = analysisTokenRecords(source.id);
    const unique = new Set(records.map((record) => record.normalized)).size;
    const sentenceCount = state.corpus.passages.reduce(
      (total, passage) =>
        total +
        (passage.sentenceUnits || []).filter(
          (unit) => unit.targetTokenIds?.[source.id]?.length,
        ).length,
      0,
    );
    return {
      source,
      tokens: records.length,
      unique,
      sentenceCount,
      diversity: records.length ? unique / records.length : 0,
      average: sentenceCount ? records.length / sentenceCount : 0,
    };
  });
  const selected = sourceRows.find((row) => row.source.id === analysisSource().id);
  const coverage = analysisGlossaryCoverage(analysisSource().id);
  const top = analysisFrequencyRows().slice(0, 20);
  const maximum = top[0]?.count || 1;
  return `
    <div class="analysis-stat-grid">
      <section class="analysis-card analysis-metric-card">
        <p class="eyebrow">Selected witness</p>
        <h3>${escapeHtml(analysisSource().label)}</h3>
        <div class="analysis-metrics">
          <div><strong>${selected.tokens.toLocaleString()}</strong><span>tokens</span></div>
          <div><strong>${selected.unique.toLocaleString()}</strong><span>distinct forms</span></div>
          <div><strong>${(selected.diversity * 100).toFixed(1)}%</strong><span>type-token ratio</span></div>
          <div><strong>${selected.average.toFixed(1)}</strong><span>tokens per sentence</span></div>
        </div>
      </section>
      <section class="analysis-card analysis-metric-card">
        <p class="eyebrow">Lexical atlas</p>
        <h3>${coverage.tokenCoverage.toFixed(1)}% token coverage</h3>
        <div class="analysis-metrics">
          <div><strong>${coverage.coveredTokens.toLocaleString()} / ${coverage.tokens.toLocaleString()}</strong><span>tokens with a glossary entry</span></div>
          <div><strong>${coverage.coveredTypes.toLocaleString()} / ${coverage.types.toLocaleString()}</strong><span>distinct lexical forms (${coverage.typeCoverage.toFixed(1)}%)</span></div>
        </div>
        <p class="analysis-guidance">Coverage includes dictionary extracts and provisional working notes; it is not a measure of reviewed word alignment. Editorial markers are excluded.</p>
      </section>
      <section class="analysis-card analysis-frequency-chart">
        <div class="analysis-card-heading">
          <div><p class="eyebrow">Distribution</p><h3>Most frequent forms</h3></div>
          <span>top 20</span>
        </div>
        ${top
          .map(
            (row) => `
              <button data-analysis-search-form="${analysisAttribute(row.form)}" type="button">
                <span>${escapeHtml(row.form)}</span>
                <i style="--frequency:${Math.max(4, (row.count / maximum) * 100)}%"></i>
                <strong>${row.count}</strong>
              </button>
            `,
          )
          .join("")}
      </section>
      <section class="analysis-card analysis-cross-table">
        <div class="analysis-card-heading">
          <div><p class="eyebrow">Corpus comparison</p><h3>Witness statistics</h3></div>
          <span>${state.corpus.sources.length} witnesses</span>
        </div>
        <div class="analysis-table-wrap">
          <table class="analysis-table">
            <thead><tr><th>Witness</th><th>Tokens</th><th>Forms</th><th>TTR</th><th>Sentences</th><th>Avg.</th></tr></thead>
            <tbody>
              ${sourceRows
                .map(
                  (row) => `
                    <tr class="${row.source.id === analysisSource().id ? "active" : ""}">
                      <td>${escapeHtml(row.source.label)}</td>
                      <td>${row.tokens.toLocaleString()}</td>
                      <td>${row.unique.toLocaleString()}</td>
                      <td>${(row.diversity * 100).toFixed(1)}%</td>
                      <td>${row.sentenceCount}</td>
                      <td>${row.average.toFixed(1)}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function analysisPanel() {
  return (
    {
      lexicon: lexiconPanel,
      concordance: concordancePanel,
      morphology: morphologyPanel,
      syntax: syntaxPanel,
      statistics: statisticsPanel,
    }[state.analysisTab]?.() || lexiconPanel()
  );
}

function renderAnalysisWorkspace() {
  ensureAnalysisState();
  const sentenceControls = ["morphology", "syntax"].includes(state.analysisTab);
  return `
    <div class="analysis-workspace">
      <header class="analysis-hero">
        <div>
          <p class="eyebrow">Corpus laboratory</p>
          <h2>Linguistic & statistical analysis</h2>
          <p>Lexical annotation, concordance, morphology, syntax, and corpus statistics share the same permanent token IDs and editorial publication workflow.</p>
        </div>
        <div class="analysis-standard-badges">
          <span>TEI-ready</span><span>W3C annotations</span><span>UD / CoNLL-U</span>
        </div>
      </header>
      <nav class="analysis-tabs" aria-label="Analysis tools">
        ${ANALYSIS_TABS.map(
          ([id, label]) => `
            <button class="${state.analysisTab === id ? "active" : ""}" data-analysis-tab="${id}" type="button">${label}</button>
          `,
        ).join("")}
      </nav>
      <section class="analysis-toolbar">
        <label>
          Witness
          <select data-analysis-source>${analysisSourceOptions()}</select>
        </label>
        ${
          sentenceControls
            ? `
              <label>Passage<select data-analysis-passage-select>${analysisPassageOptions()}</select></label>
              <label>Sentence<select data-analysis-sentence-select>${analysisSentenceOptions()}</select></label>
            `
            : `
              <form data-analysis-search-form>
                <label>
                  Search forms
                  <span class="analysis-search-row">
                    <input data-analysis-query value="${analysisAttribute(state.analysisQuery)}" placeholder="lemma, form, or character">
                    <button type="submit">Search</button>
                    ${state.analysisQuery ? '<button data-clear-analysis-search type="button">Clear</button>' : ""}
                  </span>
                </label>
              </form>
            `
        }
      </section>
      ${analysisPanel()}
    </div>
  `;
}

function setAnalysisStatus(reader, message, error = false) {
  const status = reader.querySelector("[data-analysis-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", error);
}

function bindAnalysisControls(reader) {
  reader.querySelectorAll("[data-analysis-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.analysisTab = button.dataset.analysisTab;
      renderReader();
    });
  });

  reader.querySelector("[data-analysis-source]")?.addEventListener("change", (event) => {
    state.analysisSourceId = event.target.value;
    state.analysisSelectedTokenId = "";
    state.analysisSelectedPassageId = "";
    state.analysisSentenceId = "";
    state.analysisSyntaxDraft = null;
    renderReader();
  });

  reader.querySelector("[data-analysis-search-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.analysisQuery =
      reader.querySelector("[data-analysis-query]")?.value.trim() || "";
    state.analysisSelectedTokenId = "";
    state.analysisSelectedPassageId = "";
    renderReader();
  });

  reader.querySelector("[data-clear-analysis-search]")?.addEventListener("click", () => {
    state.analysisQuery = "";
    renderReader();
  });

  reader.querySelectorAll("[data-analysis-search-form]").forEach((button) => {
    if (button.tagName === "FORM") return;
    button.addEventListener("click", () => {
      state.analysisQuery = button.dataset.analysisSearchForm;
      state.analysisTab = "concordance";
      renderReader();
    });
  });

  reader.querySelector("[data-analysis-concordance-selected]")?.addEventListener("click", () => {
    const record = selectedAnalysisRecord();
    if (!record) return;
    state.analysisQuery = record.token.text;
    state.analysisTab = "concordance";
    renderReader();
  });

  reader.querySelectorAll("[data-analysis-select-token]").forEach((button) => {
    button.addEventListener("click", () => {
      state.analysisSelectedTokenId = button.dataset.analysisSelectToken;
      state.analysisSelectedPassageId = button.dataset.analysisPassage;
      renderReader();
    });
  });

  reader.querySelectorAll("[data-analysis-open-lexicon]").forEach((element) => {
    const open = () => {
      state.analysisSelectedTokenId = element.dataset.analysisOpenLexicon;
      state.analysisSelectedPassageId = element.dataset.analysisPassage;
      state.analysisTab = "lexicon";
      renderReader();
    };
    element.addEventListener("click", open);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open();
    });
  });

  reader
    .querySelector("[data-analysis-passage-select]")
    ?.addEventListener("change", (event) => {
      state.analysisPassageId = event.target.value;
      state.analysisSentenceId = "";
      state.analysisSyntaxDraft = null;
      renderReader();
    });

  reader
    .querySelector("[data-analysis-sentence-select]")
    ?.addEventListener("change", (event) => {
      state.analysisSentenceId = event.target.value;
      state.analysisSyntaxDraft = null;
      renderReader();
    });

  reader
    .querySelector("[data-analysis-lexicon-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canEdit()) return;
      const form = new FormData(event.target);
      const tokenId = form.get("tokenId");
      const passageId = form.get("passageId");
      const record = analysisTokenRecords().find(
        (item) => item.token.id === tokenId && item.passageId === passageId,
      );
      if (!record) {
        setAnalysisStatus(reader, "The selected token could not be found.", true);
        return;
      }
      const existing = lexiconEntryFor(
        record.sourceId,
        tokenId,
        record.token.text,
      );
      const scope = form.get("scope") || "surface";
      const entry = {
        id:
          existing &&
          state.editorData.lexiconEntries.some((item) => item.id === existing.id)
            ? existing.id
            : nextAnnotationId("lexicon", record.sourceId),
        sourceId: record.sourceId,
        tokenId: scope === "token" ? tokenId : null,
        surface: record.token.text,
        normalizedSurface: record.normalized,
        scope,
        lemma: form.get("lemma").trim(),
        partOfSpeech: form.get("partOfSpeech"),
        morphology: form.get("morphology").trim(),
        reading: form.get("reading").trim(),
        gloss: form.get("gloss").trim(),
        confidence: form.get("confidence"),
        notes: form.get("notes").trim(),
        updatedAt: new Date().toISOString(),
      };
      if (existing && existing.id !== entry.id) {
        entry.supersedes = existing.id;
      }
      state.editorData.lexiconEntries = [
        ...state.editorData.lexiconEntries.filter((item) => item.id !== entry.id),
        entry,
      ];
      saveEditorData();
      renderSummary();
      renderReader();
      setAnalysisStatus(
        document.querySelector("#reader"),
        "Lexical record saved in this browser.",
      );
    });

  reader
    .querySelector("[data-delete-lexicon-entry]")
    ?.addEventListener("click", (event) => {
      state.editorData.lexiconEntries = state.editorData.lexiconEntries.filter(
        (entry) => entry.id !== event.currentTarget.dataset.deleteLexiconEntry,
      );
      saveEditorData();
      renderSummary();
      renderReader();
    });

  reader.querySelector("[data-generate-conllu]")?.addEventListener("click", () => {
    state.analysisSyntaxDraft = {
      key: `${analysisSource().id}:${state.analysisPassageId}:${state.analysisSentenceId}`,
      value: starterConllu(),
    };
    renderReader();
  });

  reader.querySelector("[data-save-conllu]")?.addEventListener("click", () => {
    if (!canEdit()) return;
    const conllu = reader.querySelector("[data-analysis-conllu]")?.value || "";
    const existing = syntaxAnnotationFor(
      analysisSource().id,
      state.analysisPassageId,
      state.analysisSentenceId,
    );
    const annotation = {
      id:
        existing &&
        state.editorData.syntaxAnnotations.some((item) => item.id === existing.id)
          ? existing.id
          : nextAnnotationId("syntax", state.analysisSentenceId),
      sourceId: analysisSource().id,
      passageId: state.analysisPassageId,
      sentenceId: state.analysisSentenceId,
      format: "conllu",
      status: "draft",
      conllu,
      updatedAt: new Date().toISOString(),
    };
    if (existing && existing.id !== annotation.id) {
      annotation.supersedes = existing.id;
    }
    state.editorData.syntaxAnnotations = [
      ...state.editorData.syntaxAnnotations.filter(
        (item) => item.id !== annotation.id,
      ),
      annotation,
    ];
    state.analysisSyntaxDraft = null;
    saveEditorData();
    renderSummary();
    renderReader();
    setAnalysisStatus(
      document.querySelector("#reader"),
      "Syntax draft saved in this browser.",
    );
  });
}
