# PT 797 opening: physical boundary correction and extension

The 0.4.0-draft package contains six full-line draft transliterations on the first
surface and a continuation excerpt on the next surface. They follow the supplied
Silk 2017 transcription, pp.344–345, sections0–II K. Combining these seven entries
reproduces that source text exactly after removing only editorial section/page
labels and the printed verse number. Punctuation, reversed-i notation and wording
are retained. This check is independent of the browser rendering.

The physical extents were checked against consecutive original-pixel crops of
the two verified scans. The first image contains one surface; the second image's
upper surface provides the continuation. No original folio number is asserted.

| Physical line | End of this line | Start of following line |
| --- | --- | --- |
| Image1, line2 | skra lastsogs pa | mthong ba bzhïn te |
| Image1, line3 | gzugs | lastsogs pa’ï |
| Image1, line4 | nges pa myed | bar ’byung la |
| Image1, line5 | bza’ ba | dang btung ba |
| Image1, line6 | yul dang dus nges | pa dang |

This corrects an error in versions0.2/0.3: the line2 transcription extended too
far, through the start of the objection. Those words belong to physical line3.
They have been moved to that line, not omitted or duplicated. Line3 now links to
both the opening explanation and verse2. Line2 links to the opening explanation.
The older claim that line2 ends at `ces` is superseded by this check.

Section II K crosses from image1 line6 to the opening of image2 upper line1.
Only that opening continuation is transcribed on the second surface; its rest
remains untranscribed. A note records this physical/logical crossing explicitly.

The verse2 text is pale in the monochrome image. Silk reports rubrication of
verses in red on p.343; the image's contrast alone does not establish physical
damage. The existing annotation was updated to preserve this distinction.

Two actual scribal additions reported by Silk on p.358 are now represented as
draft `add` marks and typed correction notes: the final `d` of `cad` in section
II D (physical line4), and `dang` in `skra dang` in II H (physical line5). The
reading text is unchanged. These are explicitly attributed to Silk's notes and
are not asserted to be new independent palaeographic findings. No scribal hand
or additional image-region boundary is invented. Both explanations survive TEI
export through linked notes.

All surface, line and region IDs and rectangles remain unchanged. Existing
anchor/annotation IDs survive; new anchors are added. Source package0.4.0-draft
and affected record revisions require explicit reconciliation of older private
drafts, preserving both readings. The inspected upstream had no published
manuscript review ledger requiring migration.

Readings remain drafts based on the published transcription, with physical
positions checked against the scan. This is not a new critical edition or an
independently reviewed diplomatic transcription. The diplomatic layer remains
the earlier excerpt; normalized forms are separately derived search readings.

Reproducible inputs: `pt797-opening-line-map.json`, `build_manuscript_pilot.py`,
the user-supplied `silk_dunhuang_raw.txt`, and the original verified images.
Local evidence: `inspection/pt797-line2-inspection.png` through
`pt797-line6-inspection.png`, `pt797-surface2-line1-inspection.png`, and
`pt797-opening-source-check.json`. Inspection files are not website assets.
