# Viṃśikā Parallel Text Laboratory

This workspace contains a local trial reader for the Vimsika research corpus.

## Included in the pilot

- Verses 1–22 with the supplied commentary.
- Six readable Sanskrit editions, including the Balcerowicz Sanskrit
  Unicode draft requiring proofing; three Tibetan witnesses; three Chinese
  translations; eight English translations/adaptations; Polish; Hungarian;
  Hindi; two Russian translations; Japanese; three French translations; and
  German.
- Foldable reading mode and multi-column comparison mode.
- Foldable sentence units numbered `1.1`, `1.2`, and so on, derived from
  Sanskrit dandas, vertical strokes, slashes, and source paragraph boundaries.
- Bold root-verse typography in Sanskrit and in the corresponding aligned
  portions of every witness, including kārikās split by intervening commentary.
- A synchronized Reading focus workspace: collapsed sentences can be hidden
  across all witnesses, or one sentence can be isolated with `Focus`; focusing
  automatically opens every currently selected witness, and witnesses selected
  while Focus remains active open directly on the focused line.
- Clickable Sanskrit words in Reading. Reviewed token links take priority;
  otherwise the shell highlights the existing low-confidence projected spans.
- Clickable token surfaces in Reading, Comparison, and Alignment, with a
  floating lexical inspector showing the selected form and linked witness
  spans.
- A five-part Analysis workspace: editable lexical records, searchable KWIC
  concordance and frequency lists, sentence-level morphology tables, draft
  UD/CoNLL-U syntax annotation, and cross-witness corpus statistics.
- Lexical glosses, readings, lemmas, parts of speech, morphology, and syntax
  drafts use the same permanent token IDs as the reading and alignment views.
  The interface never invents missing scholarly analysis.
- Resizable witness columns with saved user preferences.
- Collapsible navigation panel with a remembered full-width reading mode.
- Synchronized phrase rows with sticky subsection labels.
- An authorized DharmaNexus sentence backbone: 264 source segments become 265
  local rows because one segment crosses a local verse boundary.
- Preliminary word candidates constrained inside those sentence spans rather
  than projected across an entire verse.
- Stable IDs for 133,481 atomic tokens across all supplied witnesses.
- An embedded Editor mode plus inline text and annotation editing in Reading and Comparison.
- Provisional rights labels.

All passage boundaries and phrase alignments remain provisional and require
scholarly review. Sanskrit, Tibetan, and Paramārtha Chinese spans use the
authorized DharmaNexus data wherever a local anchor could be located. Other
witnesses, and unresolved target records, use low-confidence monotonic
projection within each DharmaNexus segment and are intended to be corrected in
the embedded editor.
The supplied Nilanjan Das English draft does not contain verses 5–10; the
reader marks those passages explicitly rather than synthesizing missing text.
The Silk, Anacker, Tola?Dragonetti, Kochumuttom, Cornu, La Vall?e-Poussin,
Lyssenko, Tiwari, Yuda, and Cook witnesses contain all 22 passages with
commentary or a provisional transcription of it. Wood supplies a verse-only
English translation. Cronk supplies a partial adapted English rendition marked
for 17 of the 22 local passages. Cook and Hamilton translate Xuanzang?s Chinese
and are mapped semantically from their twenty-one numbered verses to the
shell?s twenty-two Sanskrit passages. Hamilton 1938 is a provisional OCR
witness recovered from scan-only pages; its English text, notes, typography,
and passage boundaries require proofing. The facing Hamilton Chinese text has
been OCRed as source-preparation material, but it is not yet promoted as a live
witness because vertical Chinese OCR order still requires manual checking.
The Balcerowicz Sanskrit draft, the La Vall?e-Poussin OCR witnesses, the
Tiwari Sanskrit and Hindi witnesses, the 2022 Lyssenko witness, and the
Japanese witness require line-by-line scholarly proofing of layout, punctuation,
transcription, transliteration, and language separation. The 2022 Lyssenko witness is a
revised Russian translation distinct from the 2008 article version.
The project owner has confirmed the previously supplied witnesses for this
research corpus. Some modern witnesses remain marked `Rights status requires
verification` until their publication rights are confirmed.

## Build the corpus

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  '.\scripts\build_trial_corpus.py' `
  'C:\Users\glebs\OneDrive\Dokumente\Vimsika\Vimsika\texts' `
  '.\data\corpus.json'
```

The build also writes `data/corpus.js` and a root-level `corpus.js`. The
root-level script keeps GitHub Pages deployment simple.

The main-page announcement is the corpus `notice` field. For a quick manual
change, edit it in `data/corpus.json` and in the deployed root `corpus.js`.
For a permanent rebuild-safe change, edit the `notice` string in
`scripts/build_trial_corpus.py`.

Maintainer-only build helpers are kept out of the public upload package.

## Publish with GitHub Pages

Upload `index.html`, `styles.css`, `app.js`, `analysis.js`, `auth-config.js`,
`editorial-overrides.json`, and `corpus.js` to the repository root.
Development folders are not required by the published reader.

Do not upload `data/corpus.json` to GitHub Pages. It is the readable,
indent-formatted build artifact and exceeds GitHub's browser-upload limit.
The live reader uses the compact root-level `corpus.js`, which contains the
same corpus data and reconstructs duplicated token surface strings in the
browser.

In Comparison or Alignment view, drag the boundary at the right edge of a
witness heading to change its width. Widths are saved in the browser.

## Embedded editor

In `Reading` or `Comparison`, press `Edit text & annotations`; alternatively open the
dedicated `Editor` view. The inline editor starts with `Numbered sections`, where
visible units such as `1.1`, `1.2`, and `15.3` are literal editable records. You can
change a section number, display order, label, note, and the text shown for each
visible witness, create a new numbered section, or hide an unnecessary section.
Hidden sections disappear from Reading and Comparison but remain restorable from
the editor. These section edits are saved as `sectionEdits`, so the shell no
longer depends on token-boundary moves for basic sentence/phrase correction.

Drag across tokens, or Shift-click, to select spans in Sanskrit and corresponding
witnesses for advanced word-level correspondence. The shared editor still creates
sections, subsections, subsubsections, phrases, notes, and reviewed sentence,
phrase, or token-span correspondences. Sentence and phrase correspondences
automatically become synchronized rows in Comparison. Editorial annotations are
saved in the browser and can be exported as `vimsika-editor-annotations.json`.

Each visible witness also receives an `Edit text` control. Revised text is
retokenized immediately, stored as a reversible local override, and included in
the annotation export with its original base text, revision note, and timestamp.
`Revert` restores the base witness text without changing the generated corpus.

When `auth-config.js` has an empty `apiBaseUrl`, every edit remains only in that
browser's `localStorage`. This is expected: a static GitHub Pages site cannot
write back to its repository. After the collaboration Worker is deployed and
its URL is configured, administrators and editors can publish those drafts to
`editorial-overrides.json`.

## External alignment data

The corpus build accepts an optional shell-native alignment export:

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  '.\scripts\build_trial_corpus.py' `
  'C:\Users\glebs\OneDrive\Dokumente\Vimsika\Vimsika\texts' `
  '.\data\corpus.json' `
  --authorized-alignments '.\authorized-alignments.json'
```

The explicit permission to export and reuse the DharmaNexus alignments was
received by the project owner on 20 June 2026.

The authorized snapshot contains 264 Sanskrit source segments and 416 target
match records: 239 Tibetan records and 177 Paramārtha Chinese records. Local
anchoring directly located 211 Tibetan and 170 Chinese target spans. The
remaining 37 target records and all other translations receive explicitly
provisional segment-bounded projections. One DharmaNexus segment crosses the
local Verse 7/8 partition, so it is represented as two local parts, yielding
265 numbered alignment rows. DharmaNexus invited corrected alignments to be
shared back for possible integration into its database.

## Trusted collaboration and publication

The root reader remains a static GitHub Pages site. Secure editing and
publication are provided by the deployable Cloudflare Worker in
`collaboration-worker`.

- Public visitors remain readers.
- Contributors can edit and submit reviewable GitHub pull requests.
- Editors can publish directly.
- The administrator can publish directly and manage trusted GitHub logins.

The initial administrator is configured as `glebsharygin-lab`. If the personal
GitHub account that should administer the project has a different login, change
`ADMIN_GITHUB_LOGIN` in `collaboration-worker/wrangler.toml` and
`administratorLogin` in `auth-config.js`.

Published corrections are written to `editorial-overrides.json`, not directly
into the generated `corpus.js`. This preserves the base corpus, provides Git
history and rollback, and allows the build pipeline to incorporate reviewed
corrections later. The editorial schema includes structural units, alignments,
sentence-boundary overrides, text corrections, lexical entries, and
sentence-level syntax annotations.
Deployment instructions are in
`collaboration-worker/README.md`.

Tokenization is exhaustive and mechanical. Semantic alignment remains a
scholarly annotation task: the interface stores reviewed many-to-many links,
omissions, additions, paraphrases, and uncertain correspondences without
pretending that automatically suggested equivalences are final.

The build also generates a preliminary candidate mapping for every alignable
Sanskrit token. These candidates use monotonic proportional projection inside
the corresponding DharmaNexus sentence span, not across the whole passage.
They are useful for rapidly locating a probable region in each witness, but
they are explicitly marked `machine-suggested`, `low` confidence, and must not
be cited as reviewed philological equivalences. Existing human-reviewed and
editorial links always take priority over DharmaNexus-based projections.

In `Alignment` view, click a Sanskrit token or Shift-click a later token to
extend the selected Sanskrit phrase.
The Shell creates a live comparison frame containing contextual excerpts for
every recorded correspondence. Frames can be pinned so several Sanskrit
phrases remain visible for comparison. Unaligned selections are identified
explicitly and can then be annotated in `Editor` mode.

## Run the reader

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m http.server 8000
```

Open `http://localhost:8000`.
