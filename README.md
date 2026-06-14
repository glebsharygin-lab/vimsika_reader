# Viṃśikā Parallel Text Laboratory

This workspace contains a local trial reader generated from the supplied Viṃśikā source bundle.

## Included in the pilot

- Verses 1–22 with the supplied commentary.
- Sanskrit, Tibetan, three Chinese translations, English, French, and German.
- Foldable reading mode and multi-column comparison mode.
- Source provenance and provisional copyright labels.
- A small phrase-alignment demonstration for verse 15.
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

The build also writes `data/corpus.js`, allowing `index.html` to work directly from a `file://` URL.

## Run the reader

```powershell
& 'C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m http.server 8000
```

Open `http://localhost:8000`.
