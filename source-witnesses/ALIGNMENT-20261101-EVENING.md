# Sharma alignment continuation - 1 November 2026

This second pass adds 63 draft phrase cells in Sharma 1993, from 53 exact spans
of the existing imported text. It follows the 98-cell pass documented separately
in ALIGNMENT-20261101.md. The ten document witnesses now have 561 phrase cells;
Sharma has 129. All 498 earlier cells are preserved, including their group IDs,
notes and offsets. No source text or token identity has been changed.

| Passage | Added cells | Printed pages | PDF pages visually checked |
| --- | ---: | --- | --- |
| 13 | 6 | 94 | 106 |
| 14 | 19 | 95-97 | 107-109 |
| 17 | 10 | 105-106 | 117-118 |
| 18 | 11 | 109-111 | 121-123 |
| 20 | 10 | 114-115 | 126-127 |
| 22 | 7 | 119 | 131 |

The links identify translated root verses, autocommentary clauses and the final
colophon. Sharma's modern explanatory paragraphs remain outside these selections.
Where one English sentence crosses several Sanskrit units, an explicit shared
group preserves that relationship without inventing smaller correspondences.

The source-page check verifies where the translated passage belongs. It is not a
claim that the OCR is clean or that the English exactly agrees with the Sanskrit.
In particular, the alignment notes record these printed differences:

- At 13.3 and 13.5 the English does not preserve the Sanskrit's negation of the
  proposed explanation for non-conjunction.
- At 14.6 the English condition affirms directional differentiation where the
  Sanskrit asks about its non-acceptance.
- At 17.11 the English refers to giving up previously acquired impure knowledge;
  the Sanskrit describes the presence of subsequently obtained pure knowledge.

The existing OCR at 14.3 includes a stray digit absent from the scan. At 18.5 it
reads "Tf" and "allied stage" where the scan has "If" and "waking stage". These
are specifically flagged in the notes. They remain unchanged to preserve the
published witness and its token IDs pending an explicit editorial revision.

Material stored under an adjacent passage was not moved or forced into the wrong
unit. This includes the opening of Sharma 14 (Sanskrit 13.8), the opening of
Sharma 18 (Sanskrit 17.13-15), and the later objection in Sanskrit 20.12-15 held
with Sharma 21. Such boundaries require a separate migration decision.

The selections in phrase-selections.json generate document-witness-plan.json and
witness-integration.js. Preservation checks compare every earlier phrase cell
and all non-phrase plan data with 0.36.1; text/token validation covers all ten
document witnesses. The isolated browser check exercises all 215 nonempty
passage views and 561 Focus spans, including lookup on new root-verse selections
in each of the six passages above. Manuscript data, the original witnesses,
editorial overrides and user browser storage remain untouched.

The Manuscripts workspace remains at its validated 0.36.0 pilot scope. Petek's
existing verse-1 excerpt is unchanged; full-text ingestion still depends on
readable source pages. The wider Slavic catalogue remains outside the Reader.
