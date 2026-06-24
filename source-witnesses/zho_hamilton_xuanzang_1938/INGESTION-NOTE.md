# Hamilton 1938 Chinese Text OCR Note

The supplied Hamilton translation scan includes facing-page Chinese text attributed in Hamilton's bibliography to the critically established Xuanzang text published by the Chinese Academy of Buddhist Learning in Nanking in 1930.

The PDF is image-only for practical extraction purposes, but the scanned vertical Chinese pages are legible enough for Windows OCR. The first OCR pass read the vertical columns in Western left-to-right order, so `scripts/extract_hamilton_chinese_columns.ps1` records OCR line boxes and `scripts/reconstruct_hamilton_chinese_witness.py` reconstructs the page text by ordering vertical columns right-to-left.

The reconstructed Chinese text is saved as `chinese_ocr.txt` and segmented as a provisional live witness in `passages.json`. It should still be proofed against the scan before being treated as a final edition.

Supporting files:

- `chinese_ocr_lines.json`: raw OCR line and word boxes for the Chinese pages.
- `chinese_ocr_pages.json`: reconstructed per-page column text.
- `collation-summary.md`: readable coverage summary and first review prompts.
- `collation-review.tsv`: spreadsheet-friendly review table.
- `collation.json`: full machine-readable collation with per-passage differences.

The current collation uses the clean Xuanzang witness as the base text. It matches 3,014 out of 3,695 clean Xuanzang CJK characters, or 81.6% preliminary OCR support. Differences are review prompts, not a critical apparatus.
