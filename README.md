# Viṃśikā Parallel Text Laboratory

This workspace contains a local trial reader generated from the supplied Viṃśikā source bundle.

## Included in the pilot

- Verses 1–22 with the supplied commentary.
- Sanskrit, Tibetan, three Chinese translations, English, French, and German.
- Foldable reading mode and multi-column comparison mode.
- Foldable sentence units numbered `1.1`, `1.2`, and so on, derived from
  Sanskrit dandas, vertical strokes, slashes, and source paragraph boundaries.
- Resizable witness columns with saved user preferences.
- Collapsible navigation panel with a remembered full-width reading mode.
- Synchronized phrase rows with sticky subsection labels.
- Stable IDs for 39,965 atomic tokens across all supplied witnesses.
- An embedded Editor mode plus inline text and annotation editing in Reading and Comparison.
- Source provenance and provisional copyright labels.
- Reproducible extraction from DOCX, PDF, and UTF-8 text sources.

All passage boundaries and phrase alignments are provisional and require scholarly review.
Sanskrit sentence boundaries are mechanically derived from the supplied
edition. Corresponding spans in the other witnesses initially use low-confidence
monotonic projection and are intended to be replaced by reviewed alignments in
the embedded editor.
The supplied English draft does not contain verses 5–10; the reader marks those passages explicitly rather than synthesizing missing text.
The project owner has confirmed that all supplied witnesses are public domain or openly available for public scholarly publication.

## Build the corpus

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  '.\scripts\build_trial_corpus.py' `
  'C:\Users\glebs\OneDrive\Dokumente\Vimsika\Vimsika\texts' `
  '.\data\corpus.json'
```

The build also writes `data/corpus.js` and a root-level `corpus.js`. The root-level
file keeps GitHub Pages deployment simple and allows `index.html` to work directly
from a `file://` URL.

## Publish with GitHub Pages

Upload `index.html`, `styles.css`, `app.js`, `auth-config.js`,
`editorial-overrides.json`, and `corpus.js` to the repository root.
The `data`, `scripts`, and `reference-source` folders are not required by the
published reader.

In Comparison or Alignment view, drag the boundary at the right edge of a
witness heading to change its width. Widths are saved in the browser.

## Embedded editor

In `Reading` or `Comparison`, press `Edit text & annotations`; alternatively open the
dedicated `Editor` view. Drag across tokens, or Shift-click, to select spans in
Sanskrit and corresponding witnesses. The shared editor creates sections,
subsections, subsubsections, phrases, notes, and reviewed sentence, phrase, or
token-span correspondences. Sentence and phrase correspondences automatically
become synchronized rows in Comparison. Editorial annotations are saved in the
browser and can be exported as `vimsika-editor-annotations.json`.

Each visible witness also receives an `Edit text` control. Revised text is
retokenized immediately, stored as a reversible local override, and included in
the annotation export with its original imported text, revision note, and
timestamp. `Revert` restores the imported witness without changing the raw
corpus files.

When `auth-config.js` has an empty `apiBaseUrl`, every edit remains only in that
browser's `localStorage`. This is expected: a static GitHub Pages site cannot
write back to its repository. After the collaboration Worker is deployed and
its URL is configured, administrators and editors can publish those drafts to
`editorial-overrides.json`.

## External alignment imports

The corpus build accepts an optional shell-native alignment export:

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  '.\scripts\build_trial_corpus.py' `
  'C:\Users\glebs\OneDrive\Dokumente\Vimsika\Vimsika\texts' `
  '.\data\corpus.json' `
  --authorized-alignments '.\authorized-alignments.json'
```

An example schema is in
`reference-source/dharmanexus-authorized-import.example.json`. DharmaNexus
describes its links as algorithmic intertextual matches, and its published terms
prohibit using its database API to populate a third-party presentation layer
without authorization. The shell therefore records the DharmaNexus source and
is ready for an explicitly authorized export, but does not copy the public API.
Contact `dharmamitra.project@gmail.com` to request permission or a collaboration
export.

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
into the generated `corpus.js`. This preserves the imported corpus, provides
Git history and rollback, and allows the build pipeline to incorporate reviewed
corrections later. Deployment instructions are in
`collaboration-worker/README.md`.

Tokenization is exhaustive and mechanical. Semantic alignment remains a
scholarly annotation task: the interface stores reviewed many-to-many links,
omissions, additions, paraphrases, and uncertain correspondences without
pretending that automatically suggested equivalences are final.

The build also generates a preliminary candidate mapping for every alignable
Sanskrit token. These candidates use monotonic proportional projection within
each passage. They are useful for rapidly locating a probable region in each
witness, but they are explicitly marked `machine-suggested`, `low` confidence,
and must not be cited as reviewed philological equivalences. Existing reviewed
and editorial links always take priority over projected candidates.

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
