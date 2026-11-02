# Source-supported English alignment pass - 1 November 2026

This pass adds 98 draft phrase cells to the ten imported document witnesses:

| Witness | Passages | Added cells | Source PDF pages visually checked |
| --- | --- | ---: | --- |
| K. N. Chatterjee 1980 | 6, 8, 10, 13, 17, 18, 21 | 62 | 56-61, 63, 68-71, 74 |
| T. R. Sharma 1993 | 8, 10, 16, 21 | 36 | 89, 94-96, 115, 128-130 |

Each selection is an exact span of the existing imported text. The source-page
check establishes the location and clause correspondence, not a clean corrected
transcription. Existing OCR irregularities and translation choices are preserved.
All earlier phrase assignments and every published word/token identity remain
unchanged. The total for the ten document witnesses is now 498 phrase cells.

Selections cover root verses and identifiable autocommentary clauses. Where one
English sentence represents several Sanskrit units, a shared group records that
relationship. It is not subdivided into speculative word correspondences. Modern
explanatory prose outside the selected translation is left unassigned.

Two differences in Sharma's printed English deserve explicit attention:

- At 10.3, the English says "eightfold" while the Sanskrit unit has six cognitions.
- At 21.1, the English question uses "real" while the Sanskrit has *ayathartham*.

Both differences are documented in the alignment notes. Neither was silently
corrected or represented as identical wording.

Some introductory or closing material is held under an adjacent passage in the
existing witness. No passage moves or token renumbering were made in this pass.
For example, Chatterjee's introduction to passage 18 corresponds to Sanskrit
material at the end of passage 17; it has not been forced into a passage-18 unit.
Existing source omissions, including Chatterjee's early scan gap and Sharma 4a,
remain labelled. The Thai abridgment and Japanese/Hindi OCR warnings are unchanged.

The reproducible boundary choices are in `phrase-selections.json`. The generated
plan is `document-witness-plan.json`, mirrored in `witness-integration.js` for the
Reader. The document-witness validation checks all prior text/token identities,
source offsets and phrase references. The isolated browser check covers all 215
nonempty imported passage views, all 498 Focus spans, and word lookup in the eleven
newly aligned witness/passages as well as the Sanskrit and imported openings.

The Manuscripts workspace remains at its validated 0.36.0 functionality. Petek's
full book translation still awaits source pages; her existing verse-1 excerpt is
unchanged. The Slavic catalogue remains outside the Reader.
