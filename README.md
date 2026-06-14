# Viṃśikā Parallel Text Laboratory

This workspace contains a local trial reader generated from the supplied Viṃśikā source bundle.

## Included in the pilot

- Verses 1–22 with the supplied commentary.
- Sanskrit, Tibetan, three Chinese translations, English, French, and German.
- Foldable reading mode and multi-column comparison mode.
- Resizable witness columns with saved user preferences.
- Collapsible navigation panel with a remembered full-width reading mode.
- Synchronized phrase rows with sticky subsection labels.
- A five-part phrase-alignment pilot for verse 15.
- Stable IDs for 39,965 atomic tokens across all supplied witnesses.
- An embedded Editor mode for hierarchical units and multilingual token-span links.
- Source provenance and provisional copyright labels.
- Reproducible extraction from DOCX, PDF, and UTF-8 text sources.

All passage boundaries and phrase alignments are provisional and require scholarly review.
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

Upload `index.html`, `styles.css`, `app.js`, and `corpus.js` to the repository root.
The `data`, `scripts`, and `reference-source` folders are not required by the
published reader.

In Comparison or Alignment view, drag the boundary at the right edge of a
witness heading to change its width. Widths are saved in the browser. Verse 15
contains the first nested phrase-level pilot; click a phrase label to fold it,
or click a phrase in any witness to activate the cross-witness alignment.

## Embedded editor

Open a verse and choose `Editor`. Drag across tokens, or Shift-click, to select
spans in Sanskrit and corresponding witnesses. The editor can create sections,
subsections, subsubsections, phrases, notes, and reviewed token-span
alignments. Editorial annotations are saved in the browser and can be exported
as `vimsika-editor-annotations.json`.

Tokenization is exhaustive and mechanical. Semantic alignment remains a
scholarly annotation task: the interface stores reviewed many-to-many links,
omissions, additions, paraphrases, and uncertain correspondences without
pretending that automatically suggested equivalences are final.

## Run the reader

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m http.server 8000
```

Open `http://localhost:8000`.
