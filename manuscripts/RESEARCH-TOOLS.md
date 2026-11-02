# Manuscript research tools — 0.36.0

The Research panel works with the selected manuscript package and any valid private
draft. It never rewrites corpus witnesses or token identities.

## Search and concordance

Search manuscript restricts a query to diplomatic text, transliteration, normalized
text, translation, or scholarly notes. Filters select loaded surface, hand, script,
review status and note type. Unidentified hands stay unidentified. Searching an
empty layer cannot establish an omission. Results open the physical line and scan.

The normalized concordance counts spelling forms in the recorded normalized text.
It uses Unicode letters, marks, numbers and internal apostrophes; it does not perform
lemmatization or infer Sanskrit/Tibetan word equivalence. Search the form list,
open its occurrences or use the existing lexical inspector. The display is capped
at100 forms, clearly labelled; export includes the complete recorded concordance.

## Comparison and passage export

Collect selected line saves a private snapshot containing all four layers,
original-pixel regions, image references, anchors, notes, rights and provenance.
Snapshots remain unchanged after a draft edit. The comparison tray displays these
readings together and can open the related passage in the Reader's Comparison view.
That action opens the existing witnesses; it does not turn a snapshot into a corpus
witness or assert word alignment. Duplicate snapshots are avoided; the limit is50.
Export preserves the saved tray unchanged, including an unreadable file for recovery.
Failed saves/removal preserve the previous stored tray. No tray-file import is supplied.

Passage export includes all recorded physical lines associated with the selected
passage, including lines crossing its boundaries, with every layer, geometry,
image reference, notes and source metadata. Original many-to-many targets are kept;
targets outside the selection refer to the full package at its recorded version.
The JSON is a research selection, not a replacement manuscript package or complete
passage transcription. Images are referenced rather than embedded.

## Variant assertions

The apparatus distinguishes recorded additions, deletions, damage, uncertain and
supplied readings, and structured editorial assertions. The pilot's two additions
come from existing Silk source notes. No automatic differences become assertions.

Edit private draft → Record a variant assertion supports orthographic, lexical,
addition, omission, transposition, uncertain, restoration and unresolved categories.
It requires a unique exact manuscript span, source location and evidence. An omission
requires an existing transcribed layer and a comparison reading. Every new assertion
is a draft, regardless of whether its author reports personally checking the source.
The complete original text basis and Unicode character range are retained. A later
change to that layer produces a recheck warning; it does not silently retarget the
assertion. Typed assertions can be reviewed/exported through existing draft records.

TEI preserves structured fields as linked `variant-record` notes containing JSON,
alongside readable scholarly notes. This is validated TEI interchange, not a complete
TEI critical-apparatus editor. Full local decision history remains in the draft JSON.

## Bookmarks, storage and shared review

Private bookmarks now optionally include an individual annotation. Opening one
restores the physical/logical location and highlights the note. The link and saved
citation identify the annotation. Existing location-only bookmarks continue to work.

Tray, bookmarks, draft changes and pending imports use separate browser storage.
No private research action sends a proposal or publishes data. Back up local files
before clearing browser data. Browser storage and export are not authentication.

Structured-variant submission requires `manuscriptVariants: "1.0.0"` from the review
service, advertised only when manuscript review is enabled. An older service can
still review its supported draft records; structured variants remain private until
the user deploys the updated Worker. No deployment is performed by the assistant.

Validation: `validate_manuscript_research.cjs`, `smoke_manuscript_research.cjs`,
the existing manuscript/review tests, and five schema/profile TEI fixtures. Browser
fixtures and synthetic comparison readings are tests only, never source evidence.
