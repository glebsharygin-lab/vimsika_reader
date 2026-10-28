# Manuscript package contract — 1.0.0 pilot

This workspace links physical evidence to the existing corpus. It does not
create new corpus witnesses or change any existing token identifier.

## Loading and identity

`manuscripts.js` is the UI controller. The registry, core validator, selected
package and OpenSeadragon load only when Manuscripts opens. The canonical
JSON files have generated JavaScript wrappers so local `file:` previews work
without a server. Only the selected external image is requested.

Registry entries identify the holding institution, shelfmark, source and
catalogue URLs, image rights/attribution, manifest availability, bibliography
and related corpus witness. A manifest URL is not evidence of a successful
manifest retrieval; check `manifestStatus`.

Packages contain `id`, `schemaVersion`, `version`, project editor, status,
scope/provenance, and these independent collections:

| Record | Required relationships and meaning |
| --- | --- |
| Surface | Stable ID, sequence, display label, original image width/height, image URL/delivery, optional verified IIIF canvas ID and folio label |
| Region | Stable ID, surface ID, rectangle `[x,y,width,height]` in the original image pixels, revision, status and provenance |
| Written line | Stable ID, surface ID, reading order, region IDs, script/hand and four independent textual layers |
| Textual anchor | Many line IDs to zero or more passage IDs; separate token IDs, level, relation, review status and evidence |
| Annotation | Stable ID, image-region and/or line targets, type, text, author, dates, status and provenance |

Unknown foliation, hand, transcription or IIIF canvas identifiers are `null`,
never guessed. A composite source photograph may supply more than one surface.
Each surface then has its own viewport, while all coordinates remain in the
original photograph. Display labels never serve as IDs.

## Text and evidence

Layers are `diplomatic`, `transliteration`, `normalized`, and `translation`.
Absent text is `null`. A recorded layer has text, `scope` (`excerpt` or
`complete`), status, evidence note, provenance, and an optional `derivedFrom`
reference to another named line/layer. The application never substitutes an
available layer for an absent one.

Normalization is explicitly editorial. Its lookup links use the existing
lexical workspace; they do not create reviewed manuscript token anchors.
Line-level anchors must have an empty token list. The pilot permits independent
physical and logical selection and optional synchronization.

TEI marks, when supplied, use nonoverlapping Unicode code-point offsets and
the types `unclear`, `damage`, `supplied`, `add`, `del`. Export escapes literal
markup and retains separate layer divisions, image URLs, zones and line breaks.
Current checks establish well-formed XML and retained targets/markup; full TEI
customization/schema conformance is still pending.

## Private drafts and conflict handling

Existing Reader draft storage is untouched. Manuscript drafts use
`vimsika-manuscript-draft-v1:<manuscriptId>`. Unsaved form inputs have a separate
local buffer, retained when moving between lines/layers. There is no automatic
submission or publication.

A draft identifies the manuscript and base package version. Each change records
its stable ID, record kind/target, base revision, proposed value, author, dates,
status and previous local revisions. Applying a draft produces a copy of the
base package. Version/revision conflicts are retained and reported rather than
applied. Import rejects the entire merge if it conflicts with existing edits.
Malformed saved drafts are not overwritten; their raw JSON can be exported.
JSON export/import preserves all record values and provenance.

The schema recognizes draft/submitted/reviewed/published states. The current UI
creates only private drafts. A status carried in an imported file is not an
authentication claim. Review/submission/publication still need to extend the
existing editorial service contract; a second backend is not introduced.

## Image delivery and security

Package images must use HTTPS. The IIIF adapter accepts simple single-image
Presentation 2/3 canvases whose dimensions match the painting resource. It
rejects partial paintings, multiple bodies and unhandled coordinate transforms.
Verified IIIF image services can be opened by OpenSeadragon directly. The PT797
pilot currently uses a documented single-image fallback, not tiled delivery.
Source imagery is never embedded in `corpus.js`, manuscript JSON or local drafts.

Draft text is rendered as text, not HTML. Region coordinates and references are
validated. The import size is bounded, and rejected imports leave saved drafts
unchanged. Fullscreen includes the source attribution and rights block.

## Remaining work before the full plan is complete

- Verify the BnF manifest/image service and migrate to tiled delivery without
  changing physical IDs or using coordinates from resized images.
- Verify foliation, transcribe/proof more consecutive surfaces and establish the
  difficult pilot cases (cross-surface sentence, uncertain reading, variant).
- Add geometry creation/reading-order editing and target-specific review UI.
- Extend the existing editorial payload/backend for versioned manuscript
  changes, explicit review and conflict resolution; test without publishing.
- Add reviewed word anchors, variants/concordance and refined TEI interchange
  only where the manuscript evidence supports them.
