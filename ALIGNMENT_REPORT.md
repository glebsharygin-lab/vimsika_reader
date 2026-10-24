# Alignment repair · build 0.24.0

Prepared 23 October 2026. Scholarly review remains pending.

Silk now appears in **263 of 265 phrase units**, up from 18. Its 4,933 assigned
tokens represent **98.9% of its 4,986 tokens**. Thirty-five blocks were moved
across extracted passage boundaries: for example, the Daṇḍaka-forest verse and
its first commentary paragraphs previously sat under verse 19 and now sit under
verse 20. Objections introducing the next argument were also misplaced.
The source extraction files remain intact; moved tokens retain their original
IDs and carry `originVerse` provenance.

Units **1.6 and 1.7 remain without Silk**: the supplied text has the prose
paraphrase of the opening verse, not a separately translated root verse. That
prose has not been relabelled as the missing root verse.

Across the corpus, phrase-to-witness assignments increase from **2,514 to
3,474**. These count a shared span once for each canonical unit it covers, so
they are not counts of independent phrases. There are 360 shared-span groups.
The new work includes 355 screened semantic suggestions covering 504 unit/source
cells in 27 witnesses, and 211 transferred unit/source cells in three parallel
Chinese/Tibetan witnesses. Together with Silk, 31 witnesses gain coverage.

All **45 source records and 180,739 original token identities and token surfaces
are unchanged**. Assigned unique tokens increase from 31,584 to 48,923.
**131,816 tokens remain unassigned**; coverage outside Silk is still partial.
These include difficult OCR, commentary, notes, and genuinely unmatched text.
The full witness remains accessible rather than disappearing when unmatched.
No new Slavic translation was ingested.

## How to read the labels

- **Anchored draft**: explicit source selection or inherited/table-based span;
  it is not a claim of expert review.
- **Suggested · check span**: local multilingual model proposal, with a boundary
  screen. It may cover only part of a unit and still requires philological review.
- **Text match · draft**: close character correspondence between editions of a
  translation, rather than cross-language semantic inference.
- **Shared span**: one translation passage corresponds to several canonical
  units. Reading displays its tokens once; focusing any member displays the full
  shared span.

No length-proportional projection is used. The semantic model ran locally, with
no corpus text sent to an inference service. It proposed sentence/phrase matches
against the corrected English reference. Its scores are ranking signals, not
probabilities of correctness. The boundary screen corrected over-broad groups
and rejected 12 unreliable candidates. Frozen suggestions still carry unreviewed
provenance; original proposal scores are not recomputed after boundary changes.
The pinned model and hashes are in `alignment-provenance/model.json`.

Chinese transfer compares ideographs, excluding editorial section headings,
and requires matched endpoints, complete target tokens and at least 90% agreement
in both directions. Tibetan requires 94% and only normalizes diacritics and
myi/rmyi spelling. These passes do not overwrite existing selections.

## Verification

- Exact span, token reference, collision, shared-group and common-backbone checks.
- Previous-release comparison: all original tokens and all 45 source records preserved.
- All 937 available witness/passages render every token exactly once in Reading.
- Focused Silk spans, moved verse-20 tokens, shared Chinese focus, existing local
  editorial edits and suggestion labels checked in a browser.
- General reader regression covers selection, comparison, alignment, editing,
  lexical links, syntax, resizing, and lazy video loading.

## Coverage by witness

Cells are canonical units with a selected span; they are not completeness scores
for partial editions. The token percentage counts unique selected tokens.

| Witness | Before / 265 | After / 265 | Tokens assigned |
| --- | ---: | ---: | ---: |
| Sanskrit · Lévi 1925 | 265 | 265 | 1,639 / 1,679 (97.6%) |
| Sanskrit · Silk 2016 | 206 | 206 | 1,320 / 1,592 (82.9%) |
| Sanskrit · Tola & Dragonetti 2004 | 239 | 239 | 1,483 / 1,671 (88.7%) |
| Sanskrit · Ruzsa & Szegedi 2015 | 247 | 247 | 1,605 / 1,751 (91.7%) |
| Sanskrit · Balcerowicz & Nowakowska 1999 | 214 | 214 | 1,254 / 1,877 (66.8%) |
| Sanskrit · Tiwari 1995 | 36 | 36 | 131 / 211 (62.1%) |
| Sanskrit · Kalupahana 1987 | 30 | 30 | 127 / 229 (55.5%) |
| Tibetan · Derge | 207 | 207 | 3,917 / 5,263 (74.4%) |
| Tibetan · Dunhuang PT 797 (Silk 2017) | 20 | 152 | 2,974 / 5,383 (55.2%) |
| Tibetan · La Vallée-Poussin 1911 | 22 | 47 | 849 / 5,055 (16.8%) |
| Chinese · Xuanzang | 214 | 214 | 3,253 / 4,475 (72.7%) |
| Chinese · Xuanzang / Hamilton 1938 | 19 | 73 | 941 / 3,410 (27.6%) |
| Chinese · Paramārtha | 228 | 228 | 3,467 / 4,502 (77.0%) |
| Chinese · Prajñāruci | 211 | 211 | 5,961 / 9,184 (64.9%) |
| English · Nilanjan Das | 0 | 31 | 554 / 3,796 (14.6%) |
| English · Silk 2016 | 18 | 263 | 4,933 / 4,986 (98.9%) |
| English · Siderits 2007 | 12 | 21 | 768 / 4,737 (16.2%) |
| English · Frauwallner/Sangpo 2010 | 21 | 68 | 1,320 / 4,712 (28.0%) |
| English · Kalupahana 1987 | 5 | 9 | 117 / 6,223 (1.9%) |
| English · Kachru 2021 | 20 | 53 | 1,031 / 5,708 (18.1%) |
| English · Kellner & Taber 2014 | 13 | 17 | 323 / 3,690 (8.8%) |
| English · Anacker 2005 | 0 | 60 | 1,060 / 4,580 (23.1%) |
| English · Tola & Dragonetti 2004 | 0 | 33 | 793 / 6,455 (12.3%) |
| English · Kochumuttom 1982 | 0 | 19 | 325 / 4,891 (6.6%) |
| English · Wood 1991 | 0 | 2 | 38 / 882 (4.3%) |
| English · Cook 1999 | 0 | 20 | 422 / 5,795 (7.3%) |
| English · Hamilton 1938 | 22 | 35 | 628 / 13,549 (4.6%) |
| English · Cronk 1998 | 10 | 12 | 243 / 3,615 (6.7%) |
| Polish · Balcerowicz & Nowakowska 1999 | 58 | 80 | 1,261 / 4,682 (26.9%) |
| Hungarian · Szanyi 2015 | 0 | 7 | 80 / 547 (14.6%) |
| Hindi · Tiwari 1995 | 0 | 1 | 9 / 3,280 (0.3%) |
| Russian · Lyssenko 2008 | 64 | 89 | 1,273 / 4,088 (31.1%) |
| Russian · Lyssenko 2022 | 21 | 45 | 667 / 4,253 (15.7%) |
| Japanese · Yuda | 0 | 23 | 272 / 3,365 (8.1%) |
| Japanese · Yuda, “Watakushi no Yuishiki” | 9 | 12 | 103 / 679 (15.2%) |
| French · Lévi 1932 | 0 | 9 | 153 / 6,910 (2.2%) |
| French · Cornu 2008 | 0 | 15 | 272 / 4,402 (6.2%) |
| French · La Vallée-Poussin 1911 | 22 | 37 | 683 / 6,606 (10.3%) |
| Italian · Sferra | 22 | 40 | 690 / 4,770 (14.5%) |
| Spanish · Losang Gyatso 2021 | 19 | 55 | 1,097 / 5,295 (20.7%) |
| German · Frauwallner | 0 | 23 | 404 / 4,156 (9.7%) |
| German · Kitayama 1934 | 15 | 21 | 435 / 6,447 (6.7%) |
| German · Schmithausen 1967 | 1 | 1 | 14 / 1,324 (1.1%) |
| Russian · Kiy 2001 (opening excerpt) | 2 | 2 | 19 / 19 (100.0%) |
| Slovenian · Petek 2022 (verse 1 excerpt) | 2 | 2 | 15 / 15 (100.0%) |

## Reproduction and source files

The GitHub checkout is the static deployment bundle. Rebuilding the complete
corpus also requires the original supplied source collection, authorized legacy
alignment snapshot and extraction files in the full research workspace. They
are not re-uploaded by this update.

The release includes the new `semantic-plan.json`, frozen semantic suggestions,
alignment modules and relevant regression scripts for audit.
The model/runtime cache under `work/` is not part of the deployment. Ordinary
rebuilds consume the frozen selections and do not need the model runtime.
