const APP_BUILD_VERSION = (() => {
  const scriptUrl = document.currentScript?.src;
  if (!scriptUrl) return "development";
  return new URL(scriptUrl, window.location.href).searchParams.get("v") || "development";
})();

const state = {
  corpus: null,
  selectedSources: new Set(),
  view: "reading",
  search: "",
  activeAlignment: null,
  columnWidths: {},
  collapsedUnits: new Set(),
  hideCollapsedPassages: new Set(),
  focusedSentenceByPassage: {},
  openPassages: new Set(["v1"]),
  openSourcePanels: new Set(),
  sidebarCollapsed: false,
  inlineEditing: false,
  editorData: {
    units: [],
    alignments: [],
    sentenceEdits: [],
    sectionEdits: [],
    textEdits: {},
    lexiconEntries: [],
    syntaxAnnotations: [],
  },
  publishedEditorData: {
    units: [],
    alignments: [],
    sentenceEdits: [],
    sectionEdits: [],
    textEdits: {},
    lexiconEntries: [],
    syntaxAnnotations: [],
  },
  auth: {
    configured: false,
    token: "",
    user: null,
    role: "reader",
  },
  activeTextEditor: null,
  tokenSelections: {},
  selectionAnchors: {},
  draggingSelection: null,
  dynamicFrames: [],
  lexicalPopover: null,
  analysisTab: "lexicon",
  analysisSourceId: "san_levi_1925",
  analysisQuery: "",
  analysisSelectedTokenId: "",
  analysisSelectedPassageId: "",
  analysisPassageId: "v1",
  analysisSentenceId: "",
  analysisSyntaxDraft: null,
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
    const term = state.activeAlignment.targets?.[sourceId];
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
  const alignments = [
    ...state.corpus.alignments,
    ...state.publishedEditorData.alignments,
    ...state.editorData.alignments,
  ];
  return [
    ...new Map(alignments.map((alignment) => [alignment.id, alignment])).values(),
  ];
}

function allSentenceEdits() {
  return [
    ...new Map(
      [
        ...(state.publishedEditorData.sentenceEdits || []),
        ...(state.editorData.sentenceEdits || []),
      ].map((edit) => [edit.id, edit]),
    ).values(),
  ].sort((left, right) =>
    (left.createdAt || "").localeCompare(right.createdAt || ""),
  );
}

function sentenceEditsForPassage(passageId) {
  return allSentenceEdits().filter((edit) => edit.passageId === passageId);
}

function allSectionEdits() {
  return [
    ...new Map(
      [
        ...(state.publishedEditorData.sectionEdits || []),
        ...(state.editorData.sectionEdits || []),
      ].map((edit) => [edit.unitId || edit.id, edit]),
    ).values(),
  ].sort(
    (left, right) =>
      Number(left.order ?? Number.MAX_SAFE_INTEGER) -
        Number(right.order ?? Number.MAX_SAFE_INTEGER) ||
      String(left.number || "").localeCompare(String(right.number || "")),
  );
}

function sectionEditsForPassage(passageId) {
  return allSectionEdits().filter((edit) => edit.passageId === passageId);
}

function localSectionEditFor(passageId, unitId) {
  return (state.editorData.sectionEdits || []).find(
    (edit) => edit.passageId === passageId && edit.unitId === unitId,
  );
}

function candidateAlignments() {
  return state.corpus.candidateAlignments || [];
}

function tokenAlignmentFor(passage, sourceId, tokenId) {
  const reviewed = allAlignments()
    .filter(
      (alignment) =>
        alignment.verse === passage.number &&
        alignment.level === "token-span" &&
        alignment.targetTokenIds?.[sourceId]?.includes(tokenId),
    )
    .sort(
      (left, right) =>
        (left.targetTokenIds?.[sourceId]?.length || 0) -
        (right.targetTokenIds?.[sourceId]?.length || 0),
    );
  if (reviewed.length) return reviewed[0];

  return candidateAlignments().find(
    (alignment) =>
      alignment.verse === passage.number &&
      alignment.targetTokenIds?.[sourceId]?.includes(tokenId),
  );
}

function tokenById(passage, sourceId, tokenId) {
  return effectiveWitness(passage, sourceId).tokens?.find(
    (token) => token.id === tokenId,
  );
}

function lexiconEntryFor(sourceId, tokenId, surface) {
  const entries = [...allLexiconEntries()]
    .reverse()
    .filter((entry) => entry.sourceId === sourceId);
  return (
    entries.find((entry) => entry.tokenId === tokenId) ||
    entries.find(
      (entry) =>
        normalizeAnalysisForm(entry.normalizedSurface || entry.surface) ===
        normalizeAnalysisForm(surface),
    )
  );
}

function alignmentById(alignmentId) {
  return (
    allAlignments().find((alignment) => alignment.id === alignmentId) ||
    state.corpus.passages
      .flatMap((passage) => effectiveSentenceUnits(passage))
      .find((alignment) => alignment.id === alignmentId)
  );
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
      state.editorData = {
        units: stored.units,
        alignments: stored.alignments,
        sentenceEdits: stored.sentenceEdits || [],
        sectionEdits: stored.sectionEdits || [],
        textEdits: stored.textEdits || {},
        lexiconEntries: stored.lexiconEntries || [],
        syntaxAnnotations: stored.syntaxAnnotations || [],
      };
    }
  } catch {
    state.editorData = {
      units: [],
      alignments: [],
      sentenceEdits: [],
      sectionEdits: [],
      textEdits: {},
      lexiconEntries: [],
      syntaxAnnotations: [],
    };
  }
}

async function loadPublishedEditorData() {
  try {
    const response = await fetch(`editorial-overrides.json?ts=${Date.now()}`);
    if (!response.ok) return;
    const published = await response.json();
    const textEdits = Array.isArray(published.textEdits)
      ? Object.fromEntries(
          published.textEdits.map((edit) => [
            textEditKey(edit.passageId, edit.sourceId),
            edit,
          ]),
        )
      : published.textEdits || {};
    state.publishedEditorData = {
      units: published.units || [],
      alignments: published.alignments || [],
      sentenceEdits: published.sentenceEdits || [],
      sectionEdits: published.sectionEdits || [],
      textEdits,
      lexiconEntries: published.lexiconEntries || [],
      syntaxAnnotations: published.syntaxAnnotations || [],
    };
  } catch {}
}

function saveEditorData() {
  try {
    window.localStorage.setItem(
      "vimsika-editor-annotations-v1",
      JSON.stringify(state.editorData),
    );
  } catch {}
}

function collaborationConfig() {
  return window.VIMSIKA_AUTH_CONFIG || {};
}

function canEdit() {
  return (
    !state.auth.configured ||
    ["contributor", "editor", "admin"].includes(state.auth.role)
  );
}

function canPublishDirectly() {
  return state.auth.configured && ["editor", "admin"].includes(state.auth.role);
}

function editingEnabled() {
  return (
    canEdit() &&
    (state.view === "editor" ||
      (state.inlineEditing && ["reading", "comparison"].includes(state.view)))
  );
}

function loadInlineEditingState() {
  try {
    state.inlineEditing =
      window.localStorage.getItem("vimsika-inline-editing") === "true";
  } catch {
    state.inlineEditing = false;
  }
}

function updateInlineEditorToggle() {
  const toggle = document.querySelector("#annotationToggle");
  if (!toggle) return;
  const available = ["reading", "comparison"].includes(state.view);
  const active = available && state.inlineEditing;
  toggle.hidden = !available;
  toggle.classList.toggle("active", active);
  toggle.setAttribute("aria-pressed", String(active));
  const label = toggle.querySelector("[data-editor-toggle-label]");
  if (label) {
    label.textContent = !canEdit()
      ? "Sign in to edit"
      : active
        ? "Finish editing"
        : "Edit text & annotations";
  }
}

function apiUrl(path) {
  return `${collaborationConfig().apiBaseUrl.replace(/\/$/, "")}${path}`;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (state.auth.token) {
    headers.set("Authorization", `Bearer ${state.auth.token}`);
  }
  const response = await fetch(apiUrl(path), { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function startSignIn() {
  if (!state.auth.configured) return;
  const returnTo = `${window.location.origin}${window.location.pathname}`;
  window.location.href = `${apiUrl("/auth/login")}?return_to=${encodeURIComponent(returnTo)}`;
}

function updateAuthControls() {
  const authButton = document.querySelector("#authButton");
  const accessButton = document.querySelector("#accessManagerButton");
  if (!authButton || !accessButton) return;

  if (!state.auth.configured) {
    authButton.textContent = "Local draft mode";
    authButton.title =
      "Configure auth-config.js and deploy the collaboration service to enable trusted publishing.";
    accessButton.hidden = true;
  } else if (state.auth.user) {
    authButton.textContent = `${state.auth.user.login} · ${state.auth.role}`;
    authButton.title = "Sign out";
    accessButton.hidden = state.auth.role !== "admin";
  } else {
    authButton.textContent = "Sign in with GitHub";
    authButton.title = "Trusted collaborators can edit and publish";
    accessButton.hidden = true;
  }

  document.querySelectorAll("[data-view='editor']").forEach((button) => {
    button.classList.toggle("restricted", !canEdit());
    button.title = canEdit() ? "" : "Sign in as a trusted collaborator";
  });
  updateInlineEditorToggle();
}

async function initializeAuth() {
  const config = collaborationConfig();
  state.auth.configured = Boolean(config.apiBaseUrl);
  if (!state.auth.configured) {
    updateAuthControls();
    return;
  }

  const url = new URL(window.location.href);
  const exchangeCode = url.searchParams.get("vimsika_exchange");
  if (exchangeCode) {
    try {
      const session = await apiRequest("/auth/exchange", {
        method: "POST",
        body: JSON.stringify({ code: exchangeCode }),
      });
      state.auth.token = session.token;
      window.localStorage.setItem("vimsika-auth-token", session.token);
    } catch {
      state.auth.token = "";
      window.localStorage.removeItem("vimsika-auth-token");
    } finally {
      url.searchParams.delete("vimsika_exchange");
      window.history.replaceState({}, "", url);
    }
  } else {
    state.auth.token =
      window.localStorage.getItem("vimsika-auth-token") || "";
  }

  if (state.auth.token) {
    try {
      const session = await apiRequest("/api/me");
      state.auth.user = session.user;
      state.auth.role = session.role;
    } catch {
      state.auth.token = "";
      state.auth.user = null;
      state.auth.role = "reader";
      window.localStorage.removeItem("vimsika-auth-token");
    }
  }
  updateAuthControls();
}

async function signOut() {
  if (state.auth.token) {
    apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
  }
  state.auth.token = "";
  state.auth.user = null;
  state.auth.role = "reader";
  state.inlineEditing = false;
  state.activeTextEditor = null;
  window.localStorage.removeItem("vimsika-auth-token");
  updateAuthControls();
  renderReader();
}

function textEditKey(passageId, sourceId) {
  return `${passageId}:${sourceId}`;
}

function textEditFor(passageId, sourceId) {
  const key = textEditKey(passageId, sourceId);
  return (
    state.editorData.textEdits[key] ||
    state.publishedEditorData.textEdits[key] ||
    null
  );
}

function localTextEditFor(passageId, sourceId) {
  return state.editorData.textEdits[textEditKey(passageId, sourceId)] || null;
}

function publishedTextEditFor(passageId, sourceId) {
  return (
    state.publishedEditorData.textEdits[textEditKey(passageId, sourceId)] || null
  );
}

function isCjk(character) {
  const codepoint = character.codePointAt(0);
  return (
    (codepoint >= 0x3400 && codepoint <= 0x4dbf) ||
    (codepoint >= 0x4e00 && codepoint <= 0x9fff) ||
    (codepoint >= 0xf900 && codepoint <= 0xfaff)
  );
}

function isWordCharacter(character) {
  return /[\p{L}\p{M}\p{N}]/u.test(character);
}

function tokenizeEditedText(text, passageId, sourceId) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    let end;
    let type;

    if (isCjk(character)) {
      end = index + 1;
      type = "character";
    } else if (isWordCharacter(character)) {
      end = index + 1;
      while (end < text.length) {
        const nextCharacter = text[end];
        if (isWordCharacter(nextCharacter)) {
          end += 1;
          continue;
        }
        if (
          ["'", "’", "-", "‐", "‑"].includes(nextCharacter) &&
          end + 1 < text.length &&
          isWordCharacter(text[end + 1])
        ) {
          end += 1;
          continue;
        }
        break;
      }
      type = sourceId === "tib_derge" ? "syllable" : "word";
    } else {
      index += 1;
      continue;
    }

    const tokenNumber = String(tokens.length + 1).padStart(5, "0");
    tokens.push({
      id: `${passageId}-${sourceId}-t${tokenNumber}`,
      text: text.slice(index, end),
      start: index,
      end,
      type,
    });
    index = end;
  }
  return tokens;
}

function effectiveWitness(passage, sourceId) {
  const witness = passage.texts[sourceId] || {};
  const edit = textEditFor(passage.id, sourceId);
  if (!edit) return witness;
  return {
    ...witness,
    text: edit.text,
    tokens: tokenizeEditedText(edit.text, passage.id, sourceId),
    editoriallyEdited: true,
  };
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
  const witness = effectiveWitness(passage, sourceId);
  if (!witness || !tokenIds?.length) return "";
  const selected = witness.tokens.filter((token) => tokenIds.includes(token.id));
  if (!selected.length) return "";
  return witness.text.slice(selected[0].start, selected[selected.length - 1].end);
}

function cloneSentenceUnit(unit) {
  return {
    ...unit,
    targets: { ...(unit.targets || {}) },
    targetTexts: { ...(unit.targetTexts || {}) },
    targetTokenIds: Object.fromEntries(
      Object.entries(unit.targetTokenIds || {}).map(([sourceId, tokenIds]) => [
        sourceId,
        [...tokenIds],
      ]),
    ),
  };
}

function sentenceOrderKey(unit) {
  if (Number.isFinite(Number(unit.order))) return Number(unit.order);
  const number = String(unit.number || "").split(".").at(-1);
  if (Number.isFinite(Number(number))) return Number(number);
  return Number.MAX_SAFE_INTEGER;
}

function sortSentenceUnits(units) {
  return [...units].sort(
    (left, right) =>
      sentenceOrderKey(left) - sentenceOrderKey(right) ||
      String(left.number || "").localeCompare(String(right.number || "")) ||
      String(left.id || "").localeCompare(String(right.id || "")),
  );
}

function sortedTokenIdsForSource(passage, sourceId, tokenIds) {
  const order = new Map(
    (effectiveWitness(passage, sourceId).tokens || []).map((token, index) => [
      token.id,
      index,
    ]),
  );
  return [...new Set(tokenIds)].sort(
    (left, right) =>
      (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

function effectiveSentenceUnits(passage) {
  const units = (passage.sentenceUnits || []).map(cloneSentenceUnit);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const hiddenUnitIds = new Set();

  sentenceEditsForPassage(passage.id).forEach((edit) => {
    const sourceId = edit.sourceId;
    const tokenIds = edit.tokenIds || [];
    const targetUnit = byId.get(edit.toUnitId);
    if (!sourceId || !tokenIds.length || !targetUnit) return;

    const movedIds = new Set(tokenIds);
    units.forEach((unit) => {
      const current = unit.targetTokenIds?.[sourceId] || [];
      const filtered = current.filter((tokenId) => !movedIds.has(tokenId));
      if (filtered.length !== current.length) {
        unit.targetTokenIds = {
          ...(unit.targetTokenIds || {}),
          [sourceId]: filtered,
        };
        unit.status = "editorial-boundary";
        unit.confidence = "reviewed";
        unit.sentenceEdited = true;
      }
    });

    targetUnit.targetTokenIds = {
      ...(targetUnit.targetTokenIds || {}),
      [sourceId]: sortedTokenIdsForSource(passage, sourceId, [
        ...(targetUnit.targetTokenIds?.[sourceId] || []),
        ...tokenIds,
      ]),
    };
    targetUnit.status = "editorial-boundary";
    targetUnit.confidence = "reviewed";
    targetUnit.sentenceEdited = true;
  });

  sectionEditsForPassage(passage.id).forEach((edit) => {
    const unitId = edit.unitId || edit.id;
    if (!unitId) return;
    if (edit.deleted) {
      hiddenUnitIds.add(unitId);
      return;
    }
    const existing = byId.get(unitId);
    const targetUnit =
      existing ||
      {
        id: unitId,
        verse: passage.number,
        level: edit.level || "sentence",
        targetTokenIds: {},
        targets: {},
      };

    targetUnit.number = edit.number || targetUnit.number;
    targetUnit.label =
      edit.label || targetUnit.label || `Section ${targetUnit.number || ""}`;
    targetUnit.order = Number.isFinite(Number(edit.order))
      ? Number(edit.order)
      : sentenceOrderKey(targetUnit);
    targetUnit.level = edit.level || targetUnit.level || "sentence";
    targetUnit.note = edit.note ?? targetUnit.note ?? "";
    targetUnit.targetTexts = {
      ...(targetUnit.targetTexts || {}),
      ...(edit.targetTexts || {}),
    };
    targetUnit.status = "editorial-section";
    targetUnit.confidence = "reviewed";
    targetUnit.sentenceEdited = true;
    targetUnit.literalSection = true;

    if (!existing) {
      units.push(targetUnit);
      byId.set(unitId, targetUnit);
    }
  });

  return sortSentenceUnits(units.filter((unit) => !hiddenUnitIds.has(unit.id)));
}

function alignmentsOverlappingSanskrit(passage, tokenIds) {
  const selected = new Set(tokenIds);
  const reviewed = allAlignments().filter(
    (alignment) =>
      alignment.verse === passage.number &&
      alignment.status !== "dharmanexus-authorized" &&
      alignment.targetTokenIds?.san_levi_1925?.some((tokenId) =>
        selected.has(tokenId),
      ),
  );
  const covered = new Set(
    reviewed.flatMap(
      (alignment) => alignment.targetTokenIds?.san_levi_1925 || [],
    ),
  );
  const uncovered = new Set(
    tokenIds.filter((tokenId) => !covered.has(tokenId)),
  );
  const candidates = candidateAlignments().filter(
    (alignment) =>
      alignment.verse === passage.number &&
      alignment.targetTokenIds?.san_levi_1925?.some((tokenId) =>
        uncovered.has(tokenId),
      ),
  );
  return [...reviewed, ...candidates];
}

function alignedTokenIdsForSource(alignments, sourceId) {
  return [
    ...new Set(
      alignments.flatMap(
        (alignment) => alignment.targetTokenIds?.[sourceId] || [],
      ),
    ),
  ];
}

function contextSnippet(passage, sourceId, tokenIds) {
  const witness = effectiveWitness(passage, sourceId);
  if (!witness || !tokenIds.length) return "";
  const selected = witness.tokens.filter((token) => tokenIds.includes(token.id));
  if (!selected.length) return "";

  const selectionStart = selected[0].start;
  const selectionEnd = selected[selected.length - 1].end;
  let start = Math.max(0, selectionStart - 110);
  let end = Math.min(witness.text.length, selectionEnd + 150);
  const paragraphStart = witness.text.lastIndexOf("\n\n", selectionStart);
  const paragraphEnd = witness.text.indexOf("\n\n", selectionEnd);
  if (paragraphStart >= 0 && selectionStart - paragraphStart < 220) {
    start = paragraphStart + 2;
  }
  if (paragraphEnd >= 0 && paragraphEnd - selectionEnd < 280) {
    end = paragraphEnd;
  }

  return `${start ? "… " : ""}${escapeHtml(witness.text.slice(start, selectionStart))}<mark>${escapeHtml(witness.text.slice(selectionStart, selectionEnd))}</mark>${escapeHtml(witness.text.slice(selectionEnd, end))}${end < witness.text.length ? " …" : ""}`;
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
    const passageId = `v${button.dataset.verse}`;
    state.openPassages.add(passageId);
    if (state.view === "reading" && editingEnabled()) renderReader();
    const card = document.querySelector(`#${passageId}`);
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
  const candidates = candidateAlignments().length;
  const sentenceUnits = state.corpus.passages.reduce(
    (total, passage) => total + (passage.sentenceUnits?.length || 0),
    0,
  );
  const tokens = state.corpus.passages.reduce(
    (passageTotal, passage) =>
      passageTotal +
      state.corpus.sources.reduce(
        (witnessTotal, source) =>
          witnessTotal +
          (effectiveWitness(passage, source.id).tokens?.length || 0),
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
      <span class="summary-number">${sentenceUnits.toLocaleString()} / ${alignments} + ${candidates.toLocaleString()}</span>
      <span class="summary-label">numbered sentences / DharmaNexus, reviewed + machine token links</span>
    </div>
    <div class="summary-item">
      <span class="summary-number">${knownRights}/${state.corpus.sources.length}</span>
      <span class="summary-label">rights statuses classified</span>
    </div>
  `;
}

const rootVerseTokenCache = new Map();

function normalizedRootToken(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase();
}

function sanskritRootVerseTokenIds(passage) {
  const witness = effectiveWitness(passage, "san_levi_1925");
  const edit = textEditFor(passage.id, "san_levi_1925");
  const cacheKey = `${passage.id}:${witness.text?.length || 0}:${witness.tokens?.length || 0}:${edit?.updatedAt || "imported"}`;
  if (rootVerseTokenCache.has(cacheKey)) {
    return rootVerseTokenCache.get(cacheKey);
  }

  const witnessTokens = witness.tokens || [];
  const rootTokens = tokenizeEditedText(
    passage.root || "",
    `${passage.id}-root`,
    "san_levi_1925",
  ).map((token) => normalizedRootToken(token.text));
  const verseNumber = String(passage.number);
  const markerIndex = witnessTokens.findIndex(
    (token) =>
      token.text === verseNumber &&
      /^\s*\|\|/.test((witness.text || "").slice(token.end, token.end + 8)),
  );
  const searchableTokens =
    markerIndex >= 0 ? witnessTokens.slice(0, markerIndex) : witnessTokens;
  const searchableForms = searchableTokens.map((token) =>
    normalizedRootToken(token.text),
  );
  const rootForms =
    rootTokens.at(-1) === verseNumber ? rootTokens.slice(0, -1) : rootTokens;
  const matrix = Array.from({ length: rootForms.length + 1 }, () =>
    new Uint16Array(searchableForms.length + 1),
  );

  for (let rootIndex = 1; rootIndex <= rootForms.length; rootIndex += 1) {
    for (
      let witnessIndex = 1;
      witnessIndex <= searchableForms.length;
      witnessIndex += 1
    ) {
      matrix[rootIndex][witnessIndex] =
        rootForms[rootIndex - 1] === searchableForms[witnessIndex - 1]
          ? matrix[rootIndex - 1][witnessIndex - 1] + 1
          : Math.max(
              matrix[rootIndex - 1][witnessIndex],
              matrix[rootIndex][witnessIndex - 1],
            );
    }
  }

  const tokenIds = [];
  let rootIndex = rootForms.length;
  let witnessIndex = searchableForms.length;
  while (rootIndex && witnessIndex) {
    if (rootForms[rootIndex - 1] === searchableForms[witnessIndex - 1]) {
      tokenIds.push(searchableTokens[witnessIndex - 1].id);
      rootIndex -= 1;
      witnessIndex -= 1;
    } else if (
      matrix[rootIndex - 1][witnessIndex] >=
      matrix[rootIndex][witnessIndex - 1]
    ) {
      rootIndex -= 1;
    } else {
      witnessIndex -= 1;
    }
  }
  tokenIds.reverse();
  if (markerIndex >= 0) tokenIds.push(witnessTokens[markerIndex].id);

  const result = new Set(tokenIds);
  rootVerseTokenCache.set(cacheKey, result);
  return result;
}

function isRootVerseAlignment(alignment, passage) {
  const rootTokenIds = sanskritRootVerseTokenIds(passage);
  return (alignment.targetTokenIds?.san_levi_1925 || []).some((tokenId) =>
    rootTokenIds.has(tokenId),
  );
}

function rootVerseTokenIdsForSource(passage, sourceId) {
  if (sourceId === "san_levi_1925") {
    return sanskritRootVerseTokenIds(passage);
  }
  return new Set(
    phraseAlignments(passage)
      .filter(
        (alignment) =>
          alignment.level === "sentence" &&
          isRootVerseAlignment(alignment, passage),
      )
      .flatMap((alignment) => alignment.targetTokenIds?.[sourceId] || []),
  );
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

function tokenizedText(witness, sourceId, passage, tokenIds = null) {
  const allowedIds = tokenIds ? new Set(tokenIds) : null;
  const indexedTokens = (witness.tokens || [])
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => !allowedIds || allowedIds.has(token.id));
  const tokens = indexedTokens.map(({ token }) => token);
  if (!tokens.length) return highlightedText(witness.text || "", sourceId, passage.number);

  const activeIds = new Set(
    state.activeAlignment?.targetTokenIds?.[sourceId] || [],
  );
  const selectedIds = new Set(selectedTokenIds(passage.id, sourceId));
  const rootVerseIds = rootVerseTokenIdsForSource(passage, sourceId);
  const search = state.search.trim().toLocaleLowerCase();
  let output = "";
  let cursor = allowedIds ? tokens[0].start : 0;
  const rangeEnd = allowedIds
    ? tokens[tokens.length - 1].end
    : witness.text.length;

  indexedTokens.forEach(({ token, index }) => {
    output += escapeHtml(witness.text.slice(cursor, token.start));
    const classes = ["text-token"];
    if (rootVerseIds.has(token.id)) classes.push("root-verse-token");
    if (activeIds.has(token.id)) classes.push("alignment-active");
    if (selectedIds.has(token.id)) classes.push("editor-selected");
    if (search && token.text.toLocaleLowerCase().includes(search)) {
      classes.push("search-match");
    }
    output += `<button class="${classes.join(" ")}" data-token-id="${token.id}" data-token-index="${index}" data-token-passage="${passage.id}" data-token-source="${sourceId}" type="button" title="${token.id}">${escapeHtml(token.text)}</button>`;
    cursor = token.end;
  });
  output += escapeHtml(witness.text.slice(cursor, rangeEnd));
  return output;
}

function witnessTextEditor(passage, source, witness) {
  const edit = textEditFor(passage.id, source.id);
  const localEdit = localTextEditFor(passage.id, source.id);
  const publishedEdit = publishedTextEditFor(passage.id, source.id);
  const key = textEditKey(passage.id, source.id);
  const active = state.activeTextEditor === key;
  if (active) {
    return `
      <form
        class="witness-text-editor"
        data-text-edit-form
        data-passage-id="${passage.id}"
        data-source-id="${source.id}"
      >
        <label>
          Edit ${escapeHtml(source.label)}
          <textarea data-field="witness-text" rows="14">${escapeHtml(witness.text || "")}</textarea>
        </label>
        <label>
          Revision note (optional)
          <textarea
            data-field="witness-edit-note"
            rows="2"
            placeholder="e.g. corrected OCR against p. 12"
          >${escapeHtml(edit?.note || "")}</textarea>
        </label>
        <p>
          Saving retokenizes this witness and creates a local browser draft.
          Existing links remain, but affected alignments should be reviewed.
          ${
            state.auth.configured
              ? "Use the publication controls to update the shared corpus."
              : "The shared corpus cannot change until the collaboration Worker is configured."
          }
        </p>
        <div class="witness-text-actions">
          <button class="editor-primary" type="submit">Save revised text</button>
          <button data-cancel-text-edit type="button">Cancel</button>
        </div>
      </form>
    `;
  }

  return `
    <div class="witness-text-toolbar">
      <span class="${edit ? "locally-edited" : ""}">
        ${
          localEdit
            ? `Unpublished draft${state.auth.configured ? "" : " · saved only in this browser"}${localEdit.updatedAt ? ` · ${new Date(localEdit.updatedAt).toLocaleString()}` : ""}`
            : publishedEdit
              ? `Published revision${publishedEdit.updatedAt ? ` · ${new Date(publishedEdit.updatedAt).toLocaleString()}` : ""}`
            : "Imported text"
        }
      </span>
      <div>
        <button
          data-start-text-edit
          data-passage-id="${passage.id}"
          data-source-id="${source.id}"
          type="button"
        >Edit text</button>
        ${
          localEdit
            ? `<button
                data-revert-text-edit
                data-passage-id="${passage.id}"
                data-source-id="${source.id}"
                type="button"
              >Discard draft</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function alignmentsOverlap(left, right, sourceId = "san_levi_1925") {
  const leftIds = new Set(left.targetTokenIds?.[sourceId] || []);
  return (right.targetTokenIds?.[sourceId] || []).some((tokenId) =>
    leftIds.has(tokenId),
  );
}

function alignmentPosition(alignment, passage) {
  const ids = new Set(
    alignment.targetTokenIds?.san_levi_1925 || [],
  );
  const tokens = effectiveWitness(
    passage,
    "san_levi_1925",
  ).tokens || [];
  const position = tokens.findIndex((token) => ids.has(token.id));
  return position < 0 ? Number.MAX_SAFE_INTEGER : position;
}

function phraseAlignments(passage) {
  const sectionEdits = sectionEditsForPassage(passage.id);
  const passageAlignments = allAlignments().filter(
    (alignment) =>
      alignment.verse === passage.number &&
      ["sentence", "phrase"].includes(alignment.level || "phrase"),
  );
  const humanAlignments = passageAlignments.filter(
    (alignment) => alignment.status !== "dharmanexus-authorized",
  );
  const editorial = passageAlignments
    .filter(
      (alignment) =>
        alignment.status !== "dharmanexus-authorized" ||
        !humanAlignments.some(
          (humanAlignment) =>
            humanAlignment.level === "sentence" &&
            alignmentsOverlap(alignment, humanAlignment),
        ),
    )
    .map((alignment) => {
      const edit = sectionEdits.find(
        (item) =>
          item.unitId === alignment.id ||
          (item.number && item.number === alignment.number),
      );
      if (!edit) return alignment;
      if (edit.deleted) return null;
      const unit = cloneSentenceUnit(alignment);
      unit.number = edit.number || unit.number;
      unit.label = edit.label || unit.label;
      unit.order = Number.isFinite(Number(edit.order))
        ? Number(edit.order)
        : sentenceOrderKey(unit);
      unit.level = edit.level || unit.level || "sentence";
      unit.note = edit.note ?? unit.note ?? "";
      unit.targetTexts = {
        ...(unit.targetTexts || {}),
        ...(edit.targetTexts || {}),
      };
      unit.status = "editorial-section";
      unit.confidence = "reviewed";
      unit.sentenceEdited = true;
      unit.literalSection = true;
      return unit;
    })
    .filter(Boolean);
  const reviewedSentences = editorial.filter(
    (alignment) => alignment.level === "sentence",
  );
  const generated = effectiveSentenceUnits(passage).filter(
    (unit) =>
      !reviewedSentences.some((alignment) =>
        alignmentsOverlap(unit, alignment),
      ),
  );

  return [...generated, ...editorial].sort((left, right) => {
    if (left.level === "sentence" && right.level === "sentence") {
      return (
        sentenceOrderKey(left) - sentenceOrderKey(right) ||
        String(left.number || "").localeCompare(String(right.number || ""))
      );
    }
    const positionDifference =
      alignmentPosition(left, passage) -
      alignmentPosition(right, passage);
    if (positionDifference) return positionDifference;
    return (left.order || 0) - (right.order || 0);
  });
}

function alignmentStatusLabel(alignment, rootVerse = false) {
  const dharmanexus = alignment.status === "dharmanexus-authorized";
  if (rootVerse) return dharmanexus ? "root · DharmaNexus" : "root verse";
  if (alignment.sentenceEdited || alignment.status === "editorial-boundary") {
    return "edited";
  }
  if (dharmanexus) return "DharmaNexus base";
  if (alignment.status === "machine-segmented") return "projected";
  return "reviewed";
}

function readingSentenceControls(passage, units) {
  const focusedId = state.focusedSentenceByPassage[passage.id];
  const focusedUnit = units.find((unit) => unit.id === focusedId);
  const collapsedCount = units.filter((unit) =>
    state.collapsedUnits.has(unit.id),
  ).length;
  const hidingCollapsed = state.hideCollapsedPassages.has(passage.id);
  return `
    <div class="reading-sentence-controls">
      <div>
        <strong>${
          focusedUnit
            ? `Focused on ${escapeHtml(focusedUnit.number || focusedUnit.label)}`
            : "Sentence workspace"
        }</strong>
        <span>${
          focusedUnit
            ? "Only this sentence is shown across every open witness."
            : `${collapsedCount} collapsed sentence${collapsedCount === 1 ? "" : "s"}`
        }</span>
      </div>
      <div class="reading-sentence-actions">
        ${
          focusedUnit
            ? `<button data-clear-sentence-focus="${passage.id}" type="button">Show all sentences</button>`
            : `<button
                data-toggle-hide-collapsed="${passage.id}"
                type="button"
                ${collapsedCount ? "" : "disabled"}
              >${hidingCollapsed ? `Show ${collapsedCount} hidden` : `Hide ${collapsedCount} collapsed`}</button>`
        }
      </div>
    </div>
  `;
}

function readingSentenceList(passage, source, witness) {
  const units = phraseAlignments(passage).filter(
    (alignment) => alignment.level === "sentence",
  );
  if (!units.length) {
    return editingEnabled()
      ? tokenizedText(witness, source.id, passage)
      : highlightedText(witness.text || "", source.id, passage.number);
  }

  const focusedId = state.focusedSentenceByPassage[passage.id];
  const hidingCollapsed = state.hideCollapsedPassages.has(passage.id);
  return `
    <div class="reading-sentence-list">
      ${units
        .map((unit) => {
          const collapsed = state.collapsedUnits.has(unit.id);
          if (focusedId && unit.id !== focusedId) return "";
          if (!focusedId && hidingCollapsed && collapsed) return "";
          const tokenIds = unit.targetTokenIds?.[source.id] || [];
          const target = alignmentTargetText(unit, passage, source.id);
          const literalText =
            unit.targetTexts &&
            Object.prototype.hasOwnProperty.call(unit.targetTexts, source.id);
          const generated = unit.status === "machine-segmented";
          const adjusted =
            unit.sentenceEdited || unit.status === "editorial-boundary";
          const rootVerse = isRootVerseAlignment(unit, passage);
          return `
            <section class="reading-sentence-unit ${collapsed ? "collapsed" : ""} ${rootVerse ? "root-verse-unit" : ""}" data-sentence-unit="${unit.id}">
              <div class="reading-sentence-header">
                <button
                  class="reading-sentence-toggle"
                  data-toggle-reading-unit="${unit.id}"
                  type="button"
                >
                  <span class="reading-sentence-number">${escapeHtml(unit.number || unit.label)}</span>
                  <span class="reading-sentence-status">${alignmentStatusLabel(unit, rootVerse)}</span>
                  <span aria-hidden="true">${collapsed ? "+" : "−"}</span>
                </button>
                <button
                  class="reading-sentence-focus"
                  data-focus-sentence="${unit.id}"
                  data-passage-id="${passage.id}"
                  type="button"
                  title="Show this sentence only across every witness"
                >Focus</button>
              </div>
              <div class="reading-sentence-body">${
                target
                  ? literalText
                    ? highlightedText(
                        target,
                        source.id,
                        passage.number,
                      )
                    : tokenIds.length
                    ? tokenizedText(
                        witness,
                        source.id,
                        passage,
                        tokenIds,
                      )
                    : highlightedText(
                        target,
                        source.id,
                        passage.number,
                      )
                  : '<span class="alignment-gap">— no corresponding span assigned —</span>'
              }</div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function witnessUnavailable(witness) {
  return ["not-present-in-supplied-source", "legacy-encoding-pending"].includes(
    witness.status
  );
}

function witnessAvailabilityLabel(witness, source) {
  if (witness.status === "legacy-encoding-pending") return "Unicode conversion pending";
  if (witness.status === "not-present-in-supplied-source") {
    return "not present in supplied source";
  }
  return source.rightsLabel;
}

function sourcePanel(source, passage) {
  const witness = effectiveWitness(passage, source.id);
  const unavailable = witnessUnavailable(witness);
  const panelKey = `${passage.id}:${source.id}`;
  const open =
    state.view !== "reading" ||
    source.role === "edition" ||
    state.openSourcePanels.has(panelKey);
  const textEditorActive =
    state.activeTextEditor === textEditKey(passage.id, source.id);
  const localDraft = localTextEditFor(passage.id, source.id);
  return `
    <article
      class="source-panel ${open ? "open" : ""}"
      data-source="${source.id}"
      style="--source-color:${source.color}"
    >
      <button class="source-panel-header" type="button">
        <span>
          <span class="source-name">${source.label}</span><br>
          <span class="source-meta">${source.role.replaceAll("-", " ")} · ${witnessAvailabilityLabel(witness, source)}</span>
        </span>
        <span aria-hidden="true">${open ? "−" : "+"}</span>
      </button>
      <div class="source-text ${unavailable ? "unavailable-text" : ""}">${
        unavailable
          ? escapeHtml(witness.note)
          : editingEnabled()
            ? `${witnessTextEditor(passage, source, witness)}${
                textEditorActive
                  ? ""
                  : `<div class="witness-text-display">${readingSentenceList(
                      passage,
                      source,
                      witness,
                    )}${
                      localDraft
                        ? `<details class="full-draft-text" open>
                            <summary>Full revised witness draft</summary>
                            <div>${tokenizedText(witness, source.id, passage)}</div>
                          </details>`
                        : ""
                    }</div>`
              }`
            : readingSentenceList(passage, source, witness)
      }</div>
    </article>
  `;
}

function wordAlignmentBar(passage) {
  const alignment = state.activeAlignment;
  if (
    !alignment ||
    alignment.verse !== passage.number ||
    alignment.level !== "token-span"
  ) {
    return "";
  }
  const sanskrit = tokenTextFromIds(
    passage,
    "san_levi_1925",
    alignment.targetTokenIds?.san_levi_1925 || [],
  );
  const witnessCount = Object.values(
    alignment.targetTokenIds || {},
  ).filter((tokenIds) => tokenIds.length).length;
  const machine = alignment.status === "machine-suggested";
  return `
    <div class="word-alignment-bar ${machine ? "machine" : "reviewed"}">
      <div>
        <span class="word-alignment-kicker">${machine ? "Machine-projected word link" : "Reviewed word link"}</span>
        <strong>${escapeHtml(sanskrit || alignment.label)}</strong>
        <span>${witnessCount} witness span${witnessCount === 1 ? "" : "s"} highlighted</span>
      </div>
      <button data-clear-word-alignment type="button">Clear highlighting</button>
    </div>
  `;
}

function lexicalPopover(passage) {
  const popover = state.lexicalPopover;
  if (!popover || popover.passageId !== passage.id) return "";
  const source = sourceById(popover.sourceId);
  const token = tokenById(
    passage,
    popover.sourceId,
    popover.tokenId,
  );
  if (!source || !token) return "";

  const entry = lexiconEntryFor(
    popover.sourceId,
    popover.tokenId,
    token.text,
  );
  const alignment =
    tokenAlignmentFor(
      passage,
      popover.sourceId,
      popover.tokenId,
    ) || state.activeAlignment;
  const linkedTerms = state.corpus.sources
    .map((linkedSource) => {
      const tokenIds =
        alignment?.targetTokenIds?.[linkedSource.id] || [];
      const text = tokenTextFromIds(
        passage,
        linkedSource.id,
        tokenIds,
      );
      return text
        ? {
            label: linkedSource.shortLabel || linkedSource.label,
            text,
          }
        : null;
    })
    .filter(Boolean);
  const machine = alignment?.status === "machine-suggested";

  return `
    <aside class="lexical-popover" aria-live="polite">
      <div class="lexical-popover-heading">
        <div>
          <span class="lexical-kicker">${escapeHtml(source.language)} lexical inspector</span>
          <strong>${escapeHtml(entry?.lemma || token.text)}</strong>
        </div>
        <button data-close-lexical-popover type="button" aria-label="Close lexical inspector">×</button>
      </div>
      <dl class="lexical-details">
        <div>
          <dt>Surface</dt>
          <dd>${escapeHtml(token.text)}</dd>
        </div>
        <div>
          <dt>Analysis</dt>
          <dd>${escapeHtml(entry?.morphology || entry?.reading || "Not yet annotated")}</dd>
        </div>
        <div>
          <dt>Gloss</dt>
          <dd>${escapeHtml(entry?.gloss || "No dictionary gloss has been entered yet.")}</dd>
        </div>
      </dl>
      <div class="lexical-correspondences">
        <span>${machine ? "Projected correspondences" : "Recorded correspondences"}</span>
        ${
          linkedTerms.length
            ? `<ul>${linkedTerms
                .map(
                  (item) =>
                    `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.text)}</span></li>`,
                )
                .join("")}</ul>`
            : '<p>No token-level correspondence is recorded yet.</p>'
        }
      </div>
      <p class="lexical-note">
        This panel is dictionary-ready: reviewed lemma, morphology, reading,
        and gloss records can be attached without changing token IDs.
      </p>
    </aside>
  `;
}

function alignmentTargetText(alignment, passage, sourceId) {
  if (
    alignment.targetTexts &&
    Object.prototype.hasOwnProperty.call(alignment.targetTexts, sourceId)
  ) {
    return alignment.targetTexts[sourceId] || "";
  }
  if (
    alignment.status === "machine-segmented" &&
    !alignment.sentenceEdited &&
    alignment.targets?.[sourceId] &&
    !textEditFor(passage.id, sourceId)
  ) {
    return alignment.targets[sourceId];
  }
  const currentText = tokenTextFromIds(
    passage,
    sourceId,
    alignment.targetTokenIds?.[sourceId] || [],
  );
  return currentText || alignment.targets?.[sourceId] || "";
}

function correspondenceFrame(frame, passage, sources, live = false) {
  const alignments = alignmentsOverlappingSanskrit(
    passage,
    frame.sanskritTokenIds,
  );
  const reviewedAlignments = alignments.filter(
    (alignment) => alignment.status !== "machine-suggested",
  );
  const machineAlignments = alignments.filter(
    (alignment) => alignment.status === "machine-suggested",
  );
  const selectedText = tokenTextFromIds(
    passage,
    "san_levi_1925",
    frame.sanskritTokenIds,
  );
  return `
    <article class="correspondence-frame ${live ? "live" : "pinned"}" data-frame-id="${frame.id}">
      <header class="correspondence-frame-heading">
        <div>
          <span class="frame-kicker">${live ? "Live Sanskrit selection" : "Pinned comparison frame"}</span>
          <h4>${escapeHtml(selectedText || "Selected Sanskrit span")}</h4>
        </div>
        <div class="frame-actions">
          ${
            live
              ? '<button data-pin-frame type="button">Pin frame</button><button data-clear-live-frame type="button">Clear</button>'
              : `<button data-remove-frame="${frame.id}" type="button">Remove</button>`
          }
        </div>
      </header>
      ${
        alignments.length
          ? `
            <div class="frame-alignment-labels">
              ${reviewedAlignments
                .map(
                  (alignment) =>
                    `<span>${escapeHtml(alignment.label)}${alignment.relation ? ` · ${escapeHtml(alignment.relation)}` : ""}</span>`,
                )
                .join("")}
              ${
                machineAlignments.length
                  ? `<span class="machine-label">Machine-projected candidate · ${machineAlignments.length} Sanskrit token${machineAlignments.length === 1 ? "" : "s"} · low confidence</span>`
                  : ""
              }
            </div>
            <div class="frame-witness-grid">
              ${sources
                .map((source) => {
                  const tokenIds =
                    source.id === "san_levi_1925"
                      ? frame.sanskritTokenIds
                      : alignedTokenIdsForSource(alignments, source.id);
                  return `
                    <section class="frame-witness" style="--source-color:${source.color}">
                      <h5>${escapeHtml(source.label)}</h5>
                      ${
                        tokenIds.length
                          ? `<p>${contextSnippet(passage, source.id, tokenIds)}</p>`
                          : '<p class="frame-missing">No corresponding span recorded in this witness.</p>'
                      }
                    </section>
                  `;
                })
                .join("")}
            </div>
          `
          : `
            <div class="frame-unresolved">
              <strong>No reviewed correspondence is recorded for this selection.</strong>
              <span>No machine candidate is available either; use Editor mode to create an alignment.</span>
            </div>
          `
      }
    </article>
  `;
}

function comparisonFrames(passage, sources) {
  if (state.view !== "alignment") return "";
  const liveTokenIds = selectedTokenIds(passage.id, "san_levi_1925");
  const frames = state.dynamicFrames.filter(
    (frame) => frame.passageId === passage.id,
  );
  if (!liveTokenIds.length && !frames.length) {
    return `
      <section class="correspondence-frames empty">
        <strong>Dynamic comparison frames</strong>
        <span>Click a Sanskrit token, or Shift-click another token to extend the phrase, and reveal recorded correspondences.</span>
      </section>
    `;
  }
  return `
    <section class="correspondence-frames">
      ${
        liveTokenIds.length
          ? correspondenceFrame(
              {
                id: `live-${passage.id}`,
                passageId: passage.id,
                sanskritTokenIds: liveTokenIds,
              },
              passage,
              sources,
              true,
            )
          : ""
      }
      ${frames
        .map((frame) => correspondenceFrame(frame, passage, sources))
        .join("")}
    </section>
  `;
}

function editorUnitsForPassage(passageId) {
  const units = [
    ...state.publishedEditorData.units,
    ...state.editorData.units,
  ];
  return [
    ...new Map(units.map((unit) => [unit.id, unit])).values(),
  ]
    .filter((unit) => unit.passageId === passageId)
    .sort((left, right) =>
      (left.createdAt || "").localeCompare(right.createdAt || ""),
    );
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
                ${
                  state.editorData.units.some((item) => item.id === unit.id)
                    ? `<button data-delete-unit="${unit.id}" type="button" aria-label="Delete ${escapeHtml(unit.label)}">×</button>`
                    : '<span class="published-label">published</span>'
                }
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

function publicationButtons() {
  if (!state.auth.configured) {
    return '<span class="publishing-note">Local drafts only · publishing service not configured</span>';
  }
  if (!state.auth.user) {
    return '<button data-sign-in type="button">Sign in to publish</button>';
  }
  if (!canEdit()) return "";
  return `
    <button data-publish-editorial="review" type="button">Submit all drafts for review</button>
    ${
      canPublishDirectly()
        ? '<button data-publish-editorial="direct" type="button">Publish all drafts</button>'
        : ""
    }
  `;
}

function literalSectionEditor(passage, sources, sentenceUnits) {
  if (!sources.length) return "";
  const hiddenSections = sectionEditsForPassage(passage.id).filter(
    (edit) => edit.deleted,
  );
  const nextOrder =
    Math.max(0, ...sentenceUnits.map((unit) => sentenceOrderKey(unit))) + 1;
  const nextNumber = `${passage.number}.${nextOrder}`;
  return `
    <section class="literal-section-editor" data-literal-section-editor="${passage.id}">
      <div class="literal-section-heading">
        <div>
          <h4>Numbered sections</h4>
          <p>
            These are the actual visible sections. Edit their number, order, label,
            and the text shown for each visible witness. Hiding a section removes
            it from the shell without deleting the underlying imported witness text.
          </p>
        </div>
      </div>

      <form class="literal-section-new" data-new-section-form="${passage.id}">
        <label>
          New number
          <input data-field="new-section-number" type="text" value="${escapeHtml(nextNumber)}">
        </label>
        <label>
          Order
          <input data-field="new-section-order" type="number" min="1" step="1" value="${nextOrder}">
        </label>
        <label>
          Label
          <input data-field="new-section-label" type="text" value="Sentence ${escapeHtml(nextNumber)}">
        </label>
        <button class="editor-primary" type="submit">Create section</button>
      </form>

      <div class="literal-section-list">
        ${sentenceUnits
          .map((unit) => {
            const localEdit = localSectionEditFor(passage.id, unit.id);
            const sectionLabel = unit.label || `Sentence ${unit.number || ""}`;
            return `
              <form
                class="literal-section-card"
                data-section-edit-form="${passage.id}"
                data-unit-id="${unit.id}"
              >
                <div class="literal-section-card-heading">
                  <strong>${escapeHtml(unit.number || unit.label)}</strong>
                  <span>${unit.literalSection ? "edited section" : "generated section"}</span>
                  ${
                    localEdit
                      ? `<button data-discard-section-edit="${unit.id}" type="button">Discard local edit</button>`
                      : ""
                  }
                </div>
                <div class="literal-section-meta">
                  <label>
                    Number
                    <input data-field="section-number" type="text" value="${escapeHtml(unit.number || "")}">
                  </label>
                  <label>
                    Order
                    <input data-field="section-order" type="number" min="1" step="1" value="${sentenceOrderKey(unit)}">
                  </label>
                  <label>
                    Label
                    <input data-field="section-label" type="text" value="${escapeHtml(sectionLabel)}">
                  </label>
                  <label>
                    Note
                    <input data-field="section-note" type="text" value="${escapeHtml(unit.note || "")}">
                  </label>
                </div>
                <div class="literal-section-witnesses">
                  ${sources
                    .map(
                      (source) => `
                        <label>
                          ${escapeHtml(source.shortLabel || source.label)}
                          <textarea
                            data-section-source="${source.id}"
                            rows="4"
                          >${escapeHtml(alignmentTargetText(unit, passage, source.id))}</textarea>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
                <div class="literal-section-actions">
                  <button class="editor-primary" type="submit">Save section</button>
                  <button
                    class="editor-danger"
                    data-hide-section="${unit.id}"
                    type="button"
                  >Hide section</button>
                </div>
              </form>
            `;
          })
          .join("")}
      </div>

      ${
        hiddenSections.length
          ? `<div class="literal-section-hidden">
              <h5>Hidden sections</h5>
              ${hiddenSections
                .map(
                  (edit) => `
                    <div class="literal-hidden-row">
                      <span>${escapeHtml(edit.number || edit.label || edit.unitId)}</span>
                      <button data-restore-section="${escapeHtml(edit.unitId || edit.id)}" type="button">Restore</button>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : ""
      }
    </section>
  `;
}

function editorWorkbench(passage) {
  const units = editorUnitsForPassage(passage.id);
  const sentenceUnits = effectiveSentenceUnits(passage).filter(
    (unit) => unit.level === "sentence",
  );
  const sentenceEdits = sentenceEditsForPassage(passage.id);
  const localSentenceEditIds = new Set(
    (state.editorData.sentenceEdits || []).map((edit) => edit.id),
  );
  const sources = selectedSourceRecords();
  const selections = selectionsForPassage(passage.id);
  const selectionCount = Object.values(selections).reduce(
    (total, tokenIds) => total + tokenIds.length,
    0,
  );
  const customAlignments = state.editorData.alignments.filter(
    (alignment) => alignment.verse === passage.number,
  );
  const textEditCount = Object.values(state.editorData.textEdits).filter(
    (edit) => edit.passageId === passage.id,
  ).length;
  const sentenceEditCount = (state.editorData.sentenceEdits || []).filter(
    (edit) => edit.passageId === passage.id,
  ).length;
  const sectionEditCount = (state.editorData.sectionEdits || []).filter(
    (edit) => edit.passageId === passage.id,
  ).length;
  const inline = state.view !== "editor";
  return `
    <section class="editor-workbench ${inline ? "inline-editor" : ""}" data-editor-passage="${passage.id}">
      <div class="editor-heading">
        <div>
          <p class="eyebrow">${inline ? `Editing inside ${escapeHtml(state.view)}` : "Embedded scholarly editor"}</p>
          <h3>${inline ? "Annotate this passage" : "Structure and alignment editor"}</h3>
        </div>
        <div class="editor-actions">
          <button data-clear-selection="${passage.id}" type="button">Clear token selection</button>
          <button data-export-editor type="button">Export annotations</button>
          ${publicationButtons()}
        </div>
      </div>

      <p class="editor-guidance">
        ${
          inline
            ? "Edit numbered sections directly here. Token selection remains available below for advanced word-level correspondence only."
            : "Drag across tokens, or Shift-click, in any visible witness to create reviewed correspondences."
        }
      </p>
      <div class="editor-selection-summary">
        <strong>${selectionCount} selected tokens</strong>
        <span>${Object.keys(selections).length} witnesses represented</span>
        <span>${textEditCount} revised witness text${textEditCount === 1 ? "" : "s"}</span>
        <span>${sectionEditCount} literal section draft${sectionEditCount === 1 ? "" : "s"}</span>
        ${
          sentenceEditCount
            ? `<span>${sentenceEditCount} legacy boundary move${sentenceEditCount === 1 ? "" : "s"}</span>`
            : ""
        }
      </div>

      ${inline ? literalSectionEditor(passage, sources, sentenceUnits) : ""}

      <div class="editor-forms ${inline ? "advanced-token-forms" : ""}">
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
          <h4>Create correspondence</h4>
          <label>
            Label
            <input data-field="alignment-label" type="text" placeholder="Optional; generated automatically">
          </label>
          <div class="editor-form-row">
            <label>
              Unit type
              <select data-field="alignment-level">
                <option value="sentence" selected>Sentence</option>
                <option value="phrase">Phrase</option>
                <option value="token-span">Word / token span</option>
              </select>
            </label>
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
          </div>
          <div class="editor-form-row">
            <label>
              Confidence
              <select data-field="alignment-confidence">
                <option value="reviewed">Reviewed</option>
                <option value="provisional" selected>Provisional</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
            <label>
              Within unit
              <select data-field="alignment-parent">
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
            Alignment note
            <textarea data-field="alignment-note" rows="2"></textarea>
          </label>
          <button class="editor-primary" data-create-alignment="${passage.id}" type="submit">
            Link selected spans
          </button>
        </form>

        <form class="editor-form obsolete-boundary-form" hidden data-sentence-edit-form="${passage.id}">
          <h4>Adjust sentence boundary</h4>
          <p class="editor-form-note">
            Select words in one witness, then move that span into the sentence where it belongs.
          </p>
          <label>
            Move selected text into
            <select data-field="sentence-target">
              <option value="">Choose target sentence</option>
              ${sentenceUnits
                .map(
                  (unit) =>
                    `<option value="${unit.id}">${escapeHtml(unit.number || unit.label)} Â· ${escapeHtml(unit.label)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>
            Boundary note
            <textarea
              data-field="sentence-note"
              rows="2"
              placeholder="e.g. Sanskrit phrase belongs with 1.1"
            ></textarea>
          </label>
          <button class="editor-primary" data-create-sentence-edit="${passage.id}" type="submit">
            Move selection into sentence
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
                        <small>${escapeHtml(alignment.level || "phrase")} · ${escapeHtml(alignment.relation)} · ${escapeHtml(alignment.confidence)}</small>
                        <button data-delete-alignment="${alignment.id}" type="button" aria-label="Delete ${escapeHtml(alignment.label)}">×</button>
                      </li>
                    `,
                  )
                  .join("")}</ol>`
              : '<p class="editor-empty">No editorial alignments yet.</p>'
          }
        </section>
        <section>
          <h4>Legacy token boundary moves</h4>
          ${
            sentenceEdits.length
              ? `<ol class="editor-boundary-list">${sentenceEdits
                  .map((edit) => {
                    const source = sourceById(edit.sourceId);
                    const local = localSentenceEditIds.has(edit.id);
                    return `
                      <li>
                        <span>${escapeHtml(edit.fromNumber || "unassigned")} &rarr; ${escapeHtml(edit.toNumber || "sentence")}</span>
                        <small>${escapeHtml(source?.label || edit.sourceId)} Â· ${escapeHtml(edit.selectedText || "")}</small>
                        ${
                          local
                            ? `<button data-delete-sentence-edit="${edit.id}" type="button" aria-label="Delete boundary adjustment">Ã—</button>`
                            : '<span class="published-label">published</span>'
                        }
                      </li>
                    `;
                  })
                  .join("")}</ol>`
              : '<p class="editor-empty">No legacy token-boundary moves.</p>'
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
  const generated = alignment.status === "machine-segmented";
  const adjusted =
    alignment.sentenceEdited || alignment.status === "editorial-boundary";
  const rootVerse = isRootVerseAlignment(alignment, passage);
  return `
    <section
      class="collation-grid phrase-row ${collapsed ? "collapsed" : ""} ${active ? "active" : ""} ${rootVerse ? "root-verse-row" : ""}"
      data-alignment-row="${alignment.id}"
      style="grid-template-columns:${template}"
    >
      <button class="phrase-label" data-toggle-unit="${alignment.id}" type="button">
        <span class="phrase-index">${escapeHtml(alignment.number || `${passage.number}.${index + 1}`)}</span>
        <span class="phrase-status">${alignmentStatusLabel(alignment, rootVerse)}</span>
        <span class="phrase-title">${escapeHtml(alignment.label)}</span>
        <span class="phrase-toggle" aria-hidden="true">${collapsed ? "+" : "−"}</span>
      </button>
      ${sources
        .map((source) => {
          const target = alignmentTargetText(alignment, passage, source.id);
          const tokenIds = alignment.targetTokenIds?.[source.id] || [];
          const literalText =
            alignment.targetTexts &&
            Object.prototype.hasOwnProperty.call(
              alignment.targetTexts,
              source.id,
            );
          const witness = effectiveWitness(passage, source.id);
          return `
            <div
              class="phrase-cell"
              data-alignment="${alignment.id}"
              data-source="${source.id}"
            >${
              target
                ? literalText
                  ? highlightedText(
                      target,
                      source.id,
                      passage.number,
                    )
                  : tokenIds.length
                  ? tokenizedText(
                      witness,
                      source.id,
                      passage,
                      tokenIds,
                    )
                  : highlightedText(
                      target,
                      source.id,
                      passage.number,
                    )
                : '<span class="alignment-gap">— no aligned phrase —</span>'
            }</div>
          `;
        })
        .join("")}
      <div class="phrase-note">${escapeHtml(alignment.note || "")}</div>
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
          const witness = effectiveWitness(passage, source.id);
          const unavailable = witnessUnavailable(witness);
          return `
            <div class="phrase-cell full-text-cell" data-source="${source.id}">
              ${
                unavailable
                  ? `<span class="alignment-gap">${escapeHtml(witness.note)}</span>`
                  : editingEnabled()
                    ? `${witnessTextEditor(passage, source, witness)}${
                        state.activeTextEditor ===
                        textEditKey(passage.id, source.id)
                          ? ""
                          : `<div class="witness-text-display">${tokenizedText(
                              witness,
                              source.id,
                              passage,
                            )}</div>`
                      }`
                    : tokenizedText(witness, source.id, passage)
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
    ${editingEnabled() ? editorWorkbench(passage) : ""}
    ${comparisonFrames(passage, sources)}
    <div class="collation-intro">
      <strong>${alignments.length ? `${alignments.length} aligned phrase sections` : "Passage-level comparison"}</strong>
      <span>${
        editingEnabled()
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
          state.view === "comparison" && !editingEnabled()
            ? Boolean(alignments.length)
            : false,
        )}
      </div>
    </div>
  `;
}

function passageCard(passage) {
  const sources = selectedSourceRecords();
  const open = state.openPassages.has(passage.id);
  const sentenceUnits = phraseAlignments(passage).filter(
    (alignment) => alignment.level === "sentence",
  );
  const sourcePanels =
    state.view === "reading" && (!editingEnabled() || open)
      ? sources.map((source) => sourcePanel(source, passage)).join("")
      : "";
  const content =
    state.view === "reading"
      ? editingEnabled() && !open
        ? ""
        : `${editingEnabled() ? editorWorkbench(passage) : ""}${readingSentenceControls(passage, sentenceUnits)}<div class="text-stack">${sourcePanels || '<div class="empty-state">Select at least one witness in the sidebar.</div>'}</div>`
      : open
        ? collationView(passage, sources)
        : "";

  return `
    <article id="${passage.id}" class="passage-card ${open ? "open" : ""} ${state.focusedSentenceByPassage[passage.id] ? "sentence-focus-active" : ""}">
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
        ${wordAlignmentBar(passage)}
        ${lexicalPopover(passage)}
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
  const tokens = passage ? effectiveWitness(passage, sourceId).tokens || [] : [];
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
  const textEditCount = Object.values(state.editorData.textEdits).filter(
    (edit) => edit.passageId === passageId,
  ).length;
  const sentenceEditCount = (state.editorData.sentenceEdits || []).filter(
    (edit) => edit.passageId === passageId,
  ).length;
  const sectionEditCount = (state.editorData.sectionEdits || []).filter(
    (edit) => edit.passageId === passageId,
  ).length;
  const summary = panel.querySelector(".editor-selection-summary");
  summary.innerHTML = `
    <strong>${count} selected tokens</strong>
    <span>${Object.keys(selections).length} witnesses represented</span>
    <span>${textEditCount} revised witness text${textEditCount === 1 ? "" : "s"}</span>
    <span>${sectionEditCount} literal section draft${sectionEditCount === 1 ? "" : "s"}</span>
    ${
      sentenceEditCount
        ? `<span>${sentenceEditCount} legacy boundary move${sentenceEditCount === 1 ? "" : "s"}</span>`
        : ""
    }
  `;
}

function bindTokenInteractions(reader) {
  reader.querySelectorAll("[data-token-id]").forEach((token) => {
    token.addEventListener("click", (event) => {
      if (editingEnabled()) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      state.lexicalPopover = {
        passageId: token.dataset.tokenPassage,
        sourceId: token.dataset.tokenSource,
        tokenId: token.dataset.tokenId,
      };
      if (
        state.view === "alignment" &&
        token.dataset.tokenSource === "san_levi_1925"
      ) {
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
        setTokenRange(passageId, sourceId, anchor, tokenIndex);
        const overlaps = alignmentsOverlappingSanskrit(
          passageById(passageId),
          selectedTokenIds(
            passageId,
            sourceId,
          ),
        );
        state.activeAlignment = overlaps.length === 1 ? overlaps[0] : null;
        state.openPassages.add(passageId);
        renderReader();
        return;
      }
      const passage = passageById(token.dataset.tokenPassage);
      const alignment =
        tokenAlignmentFor(
          passage,
          token.dataset.tokenSource,
          token.dataset.tokenId,
        ) ||
        allAlignments().find((item) =>
          item.targetTokenIds?.[token.dataset.tokenSource]?.includes(
            token.dataset.tokenId,
          ),
        );
      if (!alignment) return;
      state.activeAlignment =
        state.activeAlignment?.id === alignment.id ? null : alignment;
      state.openPassages.add(`v${alignment.verse}`);
      renderReader();
    });

    token.addEventListener("pointerdown", (event) => {
      if (!editingEnabled()) return;
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
        if (!state.draggingSelection) return;
        state.draggingSelection = null;
        token.removeEventListener("pointerup", finish);
        window.removeEventListener("pointerup", finish);
        updateEditorSelectionSummary(passageId);
      };
      token.addEventListener("pointerup", finish);
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

function upsertSectionEdit(edit) {
  state.editorData.sectionEdits = (state.editorData.sectionEdits || []).filter(
    (item) => !(item.passageId === edit.passageId && item.unitId === edit.unitId),
  );
  state.editorData.sectionEdits.push(edit);
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
    schemaVersion: "0.4.0-editorial",
    workId: state.corpus.work.id,
    exportedAt: new Date().toISOString(),
    units: state.editorData.units,
    alignments: state.editorData.alignments,
    sentenceEdits: state.editorData.sentenceEdits,
    sectionEdits: state.editorData.sectionEdits,
    textEdits: Object.values(state.editorData.textEdits),
    lexiconEntries: state.editorData.lexiconEntries,
    syntaxAnnotations: state.editorData.syntaxAnnotations,
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

function localEditorialPayload() {
  return {
    units: state.editorData.units,
    alignments: state.editorData.alignments,
    sentenceEdits: state.editorData.sentenceEdits,
    sectionEdits: state.editorData.sectionEdits,
    textEdits: state.editorData.textEdits,
    lexiconEntries: state.editorData.lexiconEntries,
    syntaxAnnotations: state.editorData.syntaxAnnotations,
  };
}

function localEditorialChangeCount() {
  return (
    state.editorData.units.length +
    state.editorData.alignments.length +
    state.editorData.sentenceEdits.length +
    state.editorData.sectionEdits.length +
    Object.keys(state.editorData.textEdits).length +
    state.editorData.lexiconEntries.length +
    state.editorData.syntaxAnnotations.length
  );
}

function mergePublishedEditorialData() {
  state.publishedEditorData.units = [
    ...new Map(
      [
        ...state.publishedEditorData.units,
        ...state.editorData.units,
      ].map((unit) => [unit.id, unit]),
    ).values(),
  ];
  state.publishedEditorData.alignments = [
    ...new Map(
      [
        ...state.publishedEditorData.alignments,
        ...state.editorData.alignments,
      ].map((alignment) => [alignment.id, alignment]),
    ).values(),
  ];
  state.publishedEditorData.sentenceEdits = [
    ...new Map(
      [
        ...state.publishedEditorData.sentenceEdits,
        ...state.editorData.sentenceEdits,
      ].map((edit) => [edit.id, edit]),
    ).values(),
  ];
  state.publishedEditorData.sectionEdits = [
    ...new Map(
      [
        ...state.publishedEditorData.sectionEdits,
        ...state.editorData.sectionEdits,
      ].map((edit) => [edit.unitId || edit.id, edit]),
    ).values(),
  ];
  state.publishedEditorData.textEdits = {
    ...state.publishedEditorData.textEdits,
    ...state.editorData.textEdits,
  };
  state.publishedEditorData.lexiconEntries = [
    ...new Map(
      [
        ...state.publishedEditorData.lexiconEntries,
        ...state.editorData.lexiconEntries,
      ].map((entry) => [entry.id, entry]),
    ).values(),
  ];
  state.publishedEditorData.syntaxAnnotations = [
    ...new Map(
      [
        ...state.publishedEditorData.syntaxAnnotations,
        ...state.editorData.syntaxAnnotations,
      ].map((annotation) => [annotation.id, annotation]),
    ).values(),
  ];
  state.editorData = {
    units: [],
    alignments: [],
    sentenceEdits: [],
    sectionEdits: [],
    textEdits: {},
    lexiconEntries: [],
    syntaxAnnotations: [],
  };
  saveEditorData();
}

async function publishEditorialData(mode, panel) {
  if (!localEditorialChangeCount()) {
    editorStatus(panel, "There are no unpublished changes.", true);
    return;
  }
  editorStatus(
    panel,
    mode === "direct" ? "Publishing changes…" : "Creating a review request…",
  );
  try {
    const result = await apiRequest("/api/publish", {
      method: "POST",
      body: JSON.stringify({
        mode,
        message:
          mode === "direct"
            ? "Publish editorial changes from Viṃśikā shell"
            : "Submit editorial changes from Viṃśikā shell",
        editorial: localEditorialPayload(),
      }),
    });
    if (mode === "direct") mergePublishedEditorialData();
    editorStatus(
      panel,
      result.url
        ? `${result.message} ${result.url}`
        : result.message || "Editorial changes saved.",
    );
    renderSummary();
    if (mode === "direct") renderReader();
  } catch (error) {
    editorStatus(panel, error.message, true);
  }
}

function bindEditorControls(reader) {
  reader.querySelectorAll("[data-section-edit-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.sectionEditForm;
      const passage = passageById(passageId);
      const unitId = form.dataset.unitId;
      const targetTexts = Object.fromEntries(
        [...form.querySelectorAll("[data-section-source]")].map((field) => [
          field.dataset.sectionSource,
          field.value,
        ]),
      );
      const order = Number(form.querySelector("[data-field='section-order']").value);
      upsertSectionEdit({
        id:
          localSectionEditFor(passageId, unitId)?.id ||
          nextAnnotationId("section-edit", passageId),
        unitId,
        passageId,
        verse: passage.number,
        number: form.querySelector("[data-field='section-number']").value.trim(),
        order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
        label: form.querySelector("[data-field='section-label']").value.trim(),
        level: "sentence",
        note: form.querySelector("[data-field='section-note']").value.trim(),
        targetTexts,
        deleted: false,
        updatedAt: new Date().toISOString(),
      });
      saveEditorData();
      renderSummary();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-new-section-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.newSectionForm;
      const passage = passageById(passageId);
      const order = Number(form.querySelector("[data-field='new-section-order']").value);
      const number = form
        .querySelector("[data-field='new-section-number']")
        .value.trim();
      const label =
        form.querySelector("[data-field='new-section-label']").value.trim() ||
        `Sentence ${number}`;
      const unitId = nextAnnotationId("section", passageId);
      upsertSectionEdit({
        id: nextAnnotationId("section-edit", passageId),
        unitId,
        passageId,
        verse: passage.number,
        number,
        order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
        label,
        level: "sentence",
        note: "",
        targetTexts: Object.fromEntries(
          selectedSourceRecords().map((source) => [source.id, ""]),
        ),
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveEditorData();
      renderSummary();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-discard-section-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.closest("[data-section-edit-form]")?.dataset
        .sectionEditForm;
      const unitId = button.dataset.discardSectionEdit;
      state.editorData.sectionEdits = (state.editorData.sectionEdits || []).filter(
        (edit) => !(edit.passageId === passageId && edit.unitId === unitId),
      );
      saveEditorData();
      renderSummary();
      renderReader();
    });
  });

  reader.querySelectorAll("[data-hide-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("[data-section-edit-form]");
      const passageId = form?.dataset.sectionEditForm;
      const passage = passageById(passageId);
      const unitId = button.dataset.hideSection;
      if (!passage || !unitId) return;
      const targetTexts = Object.fromEntries(
        [...form.querySelectorAll("[data-section-source]")].map((field) => [
          field.dataset.sectionSource,
          field.value,
        ]),
      );
      const order = Number(form.querySelector("[data-field='section-order']").value);
      upsertSectionEdit({
        id:
          localSectionEditFor(passageId, unitId)?.id ||
          nextAnnotationId("section-edit", passageId),
        unitId,
        passageId,
        verse: passage.number,
        number: form.querySelector("[data-field='section-number']").value.trim(),
        order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
        label: form.querySelector("[data-field='section-label']").value.trim(),
        level: "sentence",
        note: form.querySelector("[data-field='section-note']").value.trim(),
        targetTexts,
        deleted: true,
        updatedAt: new Date().toISOString(),
      });
      saveEditorData();
      renderSummary();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-restore-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.closest("[data-literal-section-editor]")?.dataset
        .literalSectionEditor;
      const passage = passageById(passageId);
      const unitId = button.dataset.restoreSection;
      const hiddenEdit = sectionEditsForPassage(passageId).find(
        (edit) => (edit.unitId || edit.id) === unitId,
      );
      if (!passage || !hiddenEdit) return;
      upsertSectionEdit({
        ...hiddenEdit,
        id:
          localSectionEditFor(passageId, unitId)?.id ||
          nextAnnotationId("section-edit", passageId),
        passageId,
        unitId,
        verse: passage.number,
        deleted: false,
        restoredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveEditorData();
      renderSummary();
      state.openPassages.add(passageId);
      renderReader();
    });
  });

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
      const level = form.querySelector("[data-field='alignment-level']").value;
      const levelLabel = {
        sentence: "Sentence correspondence",
        phrase: "Phrase correspondence",
        "token-span": "Token correspondence",
      }[level];
      const generatedLabel = `${levelLabel} ${
        state.editorData.alignments.filter(
          (item) => item.verse === passage.number && item.level === level,
        ).length + 1
      }`;
      const generatedSentence =
        level === "sentence"
          ? effectiveSentenceUnits(passage).find((unit) =>
              alignmentsOverlap(unit, { targetTokenIds }),
            )
          : null;
      const alignment = {
        id: nextAnnotationId("alignment", passageId),
        verse: passage.number,
        order:
          generatedSentence?.order ||
          allAlignments().filter(
            (item) => item.verse === passage.number,
          ).length + 1,
        number: generatedSentence?.number,
        level,
        parentId: form.querySelector("[data-field='alignment-parent']").value,
        status: "editorial",
        label:
          label ||
          (generatedSentence
            ? `Sentence ${generatedSentence.number}`
            : generatedLabel),
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

  reader.querySelectorAll("[data-sentence-edit-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.sentenceEditForm;
      const passage = passageById(passageId);
      const panel = form.closest(".editor-workbench");
      const targetTokenIds = selectionsForPassage(passageId);
      const selectedSources = Object.keys(targetTokenIds);

      if (selectedSources.length !== 1) {
        editorStatus(
          panel,
          "Select a text span in exactly one witness before moving a boundary.",
          true,
        );
        return;
      }

      const sourceId = selectedSources[0];
      const tokenIds = targetTokenIds[sourceId];
      const toUnitId = form.querySelector("[data-field='sentence-target']").value;
      const sentenceUnits = effectiveSentenceUnits(passage);
      const targetUnit = sentenceUnits.find((unit) => unit.id === toUnitId);
      if (!targetUnit) {
        editorStatus(panel, "Choose the sentence that should receive the selected text.", true);
        return;
      }

      const originUnits = sentenceUnits.filter((unit) =>
        (unit.targetTokenIds?.[sourceId] || []).some((tokenId) =>
          tokenIds.includes(tokenId),
        ),
      );
      if (
        originUnits.length === 1 &&
        originUnits[0].id === targetUnit.id
      ) {
        editorStatus(
          panel,
          "That selected text already belongs to the chosen sentence.",
          true,
        );
        return;
      }

      state.editorData.sentenceEdits.push({
        id: nextAnnotationId("sentence-edit", passageId),
        passageId,
        verse: passage.number,
        sourceId,
        sourceLabel: sourceById(sourceId)?.label || sourceId,
        fromUnitIds: originUnits.map((unit) => unit.id),
        fromNumber: originUnits.map((unit) => unit.number || unit.label).join(", "),
        toUnitId,
        toNumber: targetUnit.number || targetUnit.label,
        tokenIds,
        selectedText: tokenTextFromIds(passage, sourceId, tokenIds),
        note: form.querySelector("[data-field='sentence-note']").value.trim(),
        createdAt: new Date().toISOString(),
      });

      clearSourceSelection(passageId, sourceId);
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

  reader.querySelectorAll("[data-delete-sentence-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editorData.sentenceEdits = state.editorData.sentenceEdits.filter(
        (edit) => edit.id !== button.dataset.deleteSentenceEdit,
      );
      saveEditorData();
      renderSummary();
      renderReader();
    });
  });

  reader.querySelectorAll("[data-export-editor]").forEach((button) => {
    button.addEventListener("click", exportEditorAnnotations);
  });
  reader.querySelectorAll("[data-sign-in]").forEach((button) => {
    button.addEventListener("click", startSignIn);
  });
  reader.querySelectorAll("[data-publish-editorial]").forEach((button) => {
    button.addEventListener("click", () => {
      publishEditorialData(
        button.dataset.publishEditorial,
        button.closest(".editor-workbench"),
      );
    });
  });
}

function clearSourceSelection(passageId, sourceId) {
  delete state.tokenSelections[selectionKey(passageId, sourceId)];
  delete state.selectionAnchors[selectionKey(passageId, sourceId)];
}

function bindTextEditingControls(reader) {
  reader.querySelectorAll("[data-start-text-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTextEditor = textEditKey(
        button.dataset.passageId,
        button.dataset.sourceId,
      );
      renderReader();
    });
  });

  reader.querySelectorAll("[data-cancel-text-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTextEditor = null;
      renderReader();
    });
  });

  reader.querySelectorAll("[data-text-edit-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passageId = form.dataset.passageId;
      const sourceId = form.dataset.sourceId;
      const passage = passageById(passageId);
      const source = sourceById(sourceId);
      const text = form.querySelector("[data-field='witness-text']").value;
      const note = form
        .querySelector("[data-field='witness-edit-note']")
        .value.trim();
      const originalText = passage.texts[sourceId]?.text || "";
      const publishedText =
        publishedTextEditFor(passageId, sourceId)?.text || originalText;
      const key = textEditKey(passageId, sourceId);

      if (text === publishedText) {
        delete state.editorData.textEdits[key];
      } else {
        state.editorData.textEdits[key] = {
          id:
            state.editorData.textEdits[key]?.id ||
            nextAnnotationId("text-edit", passageId),
          passageId,
          verse: passage.number,
          sourceId,
          sourceLabel: source.label,
          text,
          originalText,
          note,
          updatedAt: new Date().toISOString(),
        };
      }

      clearSourceSelection(passageId, sourceId);
      state.activeAlignment = null;
      state.activeTextEditor = null;
      saveEditorData();
      renderSummary();
      renderReader();
    });
  });

  reader.querySelectorAll("[data-revert-text-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.dataset.passageId;
      const sourceId = button.dataset.sourceId;
      delete state.editorData.textEdits[textEditKey(passageId, sourceId)];
      clearSourceSelection(passageId, sourceId);
      state.activeAlignment = null;
      state.activeTextEditor = null;
      saveEditorData();
      renderSummary();
      renderReader();
    });
  });
}

function bindFrameControls(reader) {
  reader.querySelectorAll("[data-pin-frame]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.closest("[data-frame-id]").dataset.frameId.replace(
        "live-",
        "",
      );
      const sanskritTokenIds = [
        ...selectedTokenIds(passageId, "san_levi_1925"),
      ];
      if (!sanskritTokenIds.length) return;
      state.dynamicFrames.push({
        id: nextAnnotationId("frame", passageId),
        passageId,
        sanskritTokenIds,
      });
      renderReader();
    });
  });

  reader.querySelectorAll("[data-clear-live-frame]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.closest("[data-frame-id]").dataset.frameId.replace(
        "live-",
        "",
      );
      delete state.tokenSelections[
        selectionKey(passageId, "san_levi_1925")
      ];
      state.activeAlignment = null;
      renderReader();
    });
  });

  reader.querySelectorAll("[data-remove-frame]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dynamicFrames = state.dynamicFrames.filter(
        (frame) => frame.id !== button.dataset.removeFrame,
      );
      renderReader();
    });
  });
}

function renderReader() {
  const reader = document.querySelector("#reader");
  reader.classList.toggle("collation-active", state.view !== "reading");
  reader.classList.toggle("analysis-active", state.view === "analysis");
  if (state.view === "analysis") {
    reader.innerHTML = renderAnalysisWorkspace();
    bindAnalysisControls(reader);
    return;
  }
  reader.innerHTML = state.corpus.passages.map(passageCard).join("");

  reader.querySelectorAll(".passage-header").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".passage-card");
      if (!card) return;
      if (card.classList.contains("open")) state.openPassages.delete(card.id);
      else state.openPassages.add(card.id);
      if (state.view === "reading" && !editingEnabled()) {
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
      const passageId = button.closest(".passage-card")?.id;
      const panelKey = `${passageId}:${panel?.dataset.source}`;
      panel?.classList.toggle("open");
      if (panel?.classList.contains("open")) {
        state.openSourcePanels.add(panelKey);
      } else {
        state.openSourcePanels.delete(panelKey);
      }
      const indicator = button.querySelector("[aria-hidden='true']");
      if (indicator) indicator.textContent = panel?.classList.contains("open") ? "−" : "+";
    });
  });

  reader.querySelectorAll("[data-alignment]").forEach((button) => {
    button.addEventListener("click", () => {
      const alignment = alignmentById(button.dataset.alignment);
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

  reader.querySelectorAll("[data-toggle-reading-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitId = button.dataset.toggleReadingUnit;
      if (state.collapsedUnits.has(unitId)) state.collapsedUnits.delete(unitId);
      else state.collapsedUnits.add(unitId);
      renderReader();
    });
  });

  reader.querySelectorAll("[data-toggle-hide-collapsed]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.dataset.toggleHideCollapsed;
      if (state.hideCollapsedPassages.has(passageId)) {
        state.hideCollapsedPassages.delete(passageId);
      } else {
        state.hideCollapsedPassages.add(passageId);
      }
      renderReader();
    });
  });

  reader.querySelectorAll("[data-focus-sentence]").forEach((button) => {
    button.addEventListener("click", () => {
      const passageId = button.dataset.passageId;
      const unitId = button.dataset.focusSentence;
      state.collapsedUnits.delete(unitId);
      state.focusedSentenceByPassage[passageId] = unitId;
      renderReader();
    });
  });

  reader.querySelectorAll("[data-clear-sentence-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      delete state.focusedSentenceByPassage[
        button.dataset.clearSentenceFocus
      ];
      renderReader();
    });
  });

  reader.querySelectorAll("[data-clear-word-alignment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAlignment = null;
      state.lexicalPopover = null;
      renderReader();
    });
  });

  reader.querySelectorAll("[data-close-lexical-popover]").forEach((button) => {
    button.addEventListener("click", () => {
      state.lexicalPopover = null;
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
  bindTextEditingControls(reader);
  bindTokenInteractions(reader);
  bindEditorControls(reader);
  bindFrameControls(reader);
}

function renderSourceLedger() {
  const witnesses = state.corpus.sources
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
  const alignmentSources = (state.corpus.externalAlignmentSources || [])
    .map(
      (source) => {
        const authorized = source.importStatus.includes("authorized");
        return `
        <article class="ledger-entry external-alignment-source">
          <div class="ledger-topline">
            <strong>${escapeHtml(source.label)}</strong>
            <span class="rights-badge ${authorized ? "open" : "unknown"}">${escapeHtml(source.importStatus.replaceAll("-", " "))}</span>
          </div>
          <p>${escapeHtml(source.note)}</p>
          <p><strong>Method:</strong> ${escapeHtml(source.type.replaceAll("-", " "))}</p>
          ${source.license ? `<p><strong>Authorization:</strong> ${escapeHtml(source.license)}</p>` : ""}
          ${source.authorizationReference ? `<p><strong>Permission record:</strong> <code>${escapeHtml(source.authorizationReference)}</code></p>` : ""}
          <p><strong>Contact:</strong> ${escapeHtml(source.contact)}</p>
          <p><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Open external record</a></p>
        </article>
      `;
      },
    )
    .join("");
  document.querySelector("#sourceLedger").innerHTML =
    witnesses + alignmentSources;
}

function renderAccessList(users) {
  const list = document.querySelector("#accessList");
  if (!users.length) {
    list.innerHTML = '<p class="editor-empty">No additional trusted users yet.</p>';
    return;
  }
  list.innerHTML = `
    <ol>
      ${users
        .map(
          (user) => `
            <li>
              <strong>${escapeHtml(user.login)}</strong>
              <span>${escapeHtml(user.role)}</span>
              ${
                user.fixed
                  ? '<small>administrator</small>'
                  : `<button data-remove-access="${escapeHtml(user.login)}" type="button">Remove</button>`
              }
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
  list.querySelectorAll("[data-remove-access]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = document.querySelector("#accessStatus");
      try {
        await apiRequest(
          `/api/users/${encodeURIComponent(button.dataset.removeAccess)}`,
          { method: "DELETE" },
        );
        status.textContent = "Access removed.";
        await loadAccessList();
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    });
  });
}

async function loadAccessList() {
  const status = document.querySelector("#accessStatus");
  status.textContent = "Loading collaborators…";
  status.classList.remove("error");
  try {
    const payload = await apiRequest("/api/users");
    renderAccessList(payload.users || []);
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }
}

function bindControls() {
  document.querySelector("#sidebarToggle").addEventListener("click", () => {
    setSidebarCollapsed(true);
  });
  document.querySelector("#sidebarOpen").addEventListener("click", () => {
    setSidebarCollapsed(false);
  });
  document.querySelector("#authButton").addEventListener("click", () => {
    if (!state.auth.configured) return;
    if (state.auth.user) signOut();
    else startSignIn();
  });
  document.querySelector("#annotationToggle").addEventListener("click", () => {
    if (!canEdit()) {
      startSignIn();
      return;
    }
    state.inlineEditing = !state.inlineEditing;
    if (!state.inlineEditing) state.activeTextEditor = null;
    try {
      window.localStorage.setItem(
        "vimsika-inline-editing",
        String(state.inlineEditing),
      );
    } catch {}
    updateInlineEditorToggle();
    renderReader();
  });

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "editor" && !canEdit()) {
        startSignIn();
        return;
      }
      state.view = button.dataset.view;
      state.activeAlignment = null;
      state.activeTextEditor = null;
      document.querySelectorAll(".view-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      document.querySelector("#pageTitle").textContent = {
        reading: "Parallel reading shell",
        comparison: "Multi-witness comparison",
        alignment: "Phrase alignment laboratory",
        analysis: "Linguistic and statistical analysis",
        editor: "Embedded structure and alignment editor",
      }[state.view];
      updateInlineEditorToggle();
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

  const accessDialog = document.querySelector("#accessDialog");
  document
    .querySelector("#accessManagerButton")
    .addEventListener("click", async () => {
      accessDialog.showModal();
      await loadAccessList();
    });
  document
    .querySelector("#closeAccessDialog")
    .addEventListener("click", () => accessDialog.close());
  accessDialog.addEventListener("click", (event) => {
    if (event.target === accessDialog) accessDialog.close();
  });
  document.querySelector("#accessForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#accessStatus");
    status.classList.remove("error");
    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          login: document.querySelector("#accessLogin").value.trim(),
          role: document.querySelector("#accessRole").value,
        }),
      });
      event.target.reset();
      status.textContent = "Access saved.";
      await loadAccessList();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
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
  document.querySelector("#buildVersion").textContent = APP_BUILD_VERSION;
  document.querySelector("#corpusSchemaVersion").textContent =
    state.corpus.schemaVersion || "unversioned";
  state.selectedSources = new Set([
    "san_levi_1925",
    "tib_derge",
    "zho_xuanzang",
    "eng_silk_2016",
  ]);
  loadColumnWidths();
  loadSidebarState();
  loadEditorData();
  loadInlineEditingState();
  await loadPublishedEditorData();
  await initializeAuth();
  applySidebarState();
  updateAuthControls();

  const hasTokenData = state.corpus.passages.some((passage) =>
    Object.values(passage.texts).some((witness) => witness.tokens?.length),
  );
  const hasCandidateData = Array.isArray(state.corpus.candidateAlignments);
  const hasSentenceData = state.corpus.passages.some(
    (passage) => passage.sentenceUnits?.length,
  );
  document.querySelector("#notice").textContent = !hasTokenData
    ? `${state.corpus.notice} Token data is unavailable because corpus.js is from an older build; upload the current corpus.js file.`
    : !hasCandidateData
      ? `${state.corpus.notice} Alignment candidates are unavailable because corpus.js is from an older build; upload the current corpus.js file (schema 0.4.0-trial or later).`
      : !hasSentenceData
        ? `${state.corpus.notice} Numbered foldable sentences are unavailable because GitHub Pages is loading an older corpus.js. Upload the current corpus.js together with index.html.`
        : state.corpus.notice;
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
