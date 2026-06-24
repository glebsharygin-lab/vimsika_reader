from __future__ import annotations

import argparse
import csv
import difflib
import json
from dataclasses import dataclass
from pathlib import Path


CJK_START = "\u3400"
CJK_END = "\u9fff"


OCR_REPLACEMENTS = {
    "卽": "即",
    "眞": "真",
    "綠": "緣",
    "绿": "緣",
    "川": "用",
    "玔": "理",
    "玶": "理",
    "丆": "不",
    "毗": "比",
    "齻": "類",
}

NOISE_CHARACTERS = set("丆玔玶齻弸ㄡ")
EDITORIAL_HEADINGS = (
    "正辨本宗",
    "破計釋難",
    "立宗",
    "小乘",
    "論主",
    "外人",
    "問難",
    "陳難",
    "結難",
    "辨",
    "釋",
    "結成",
)
TITLE_LINES = (
    "唯識二十論一卷",
    "世親菩薩造",
    "大唐三藏法師玄奘奉",
)


@dataclass
class CleanedText:
    text: str
    raw_length: int


def is_cjk(char: str) -> bool:
    return CJK_START <= char <= CJK_END


def strip_between(text: str, left: str, right: str) -> str:
    while left in text:
        start = text.find(left)
        end = text.find(right, start + 1)
        if end < 0:
            break
        text = text[:start] + text[end + 1 :]
    return text


def looks_editorial_heading(line: str) -> bool:
    compact = "".join(char for char in line if is_cjk(char))
    if any(marker in compact for marker in TITLE_LINES):
        return True
    if any(marker in compact for marker in EDITORIAL_HEADINGS) and len(compact) <= 24:
        return True
    if compact.startswith(("壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖")):
        return True
    return False


def clean_base_text(text: str) -> CleanedText:
    pieces: list[str] = []
    raw_length = 0
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or looks_editorial_heading(line):
            continue
        line = strip_between(line, "〔", "〕")
        if "：" in line or ":" in line:
            line = strip_between(line, "（", "）")
            line = strip_between(line, "(", ")")
        chars = "".join(char for char in line if is_cjk(char))
        raw_length += len(chars)
        pieces.append(chars)
    return CleanedText("".join(pieces), raw_length)


def clean_ocr_text(text: str) -> CleanedText:
    text = text.replace("論日", "論曰").replace("頌日", "頌曰")
    normalized = "".join(OCR_REPLACEMENTS.get(char, char) for char in text)
    chars = "".join(char for char in normalized if is_cjk(char))
    return CleanedText(chars, len(chars))


def compact_fragment(text: str, limit: int = 36) -> str:
    if len(text) <= limit:
        return text
    half = max(8, (limit - 1) // 2)
    return f"{text[:half]}…{text[-half:]}"


def classify_difference(base_text: str, ocr_text: str, tag: str) -> str:
    if tag == "delete":
        return "not-seen-in-hamilton-ocr"
    if tag == "insert":
        return "extra-in-hamilton-ocr"
    if any(char in NOISE_CHARACTERS for char in base_text + ocr_text):
        return "probable-ocr-noise"
    if len(base_text) == len(ocr_text) == 1:
        if OCR_REPLACEMENTS.get(ocr_text, ocr_text) == base_text:
            return "probable-ocr-substitution"
        return "possible-single-character-variant"
    return "review-required"


def source_passages(corpus_path: Path) -> list[dict[str, object]]:
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    passages = []
    for passage in corpus["passages"]:
        cleaned = clean_base_text(passage["texts"]["zho_xuanzang"]["text"])
        passages.append(
            {
                "number": passage["number"],
                "id": passage["id"],
                "label": passage["label"],
                "baseText": cleaned.text,
                "baseRawCjkLength": cleaned.raw_length,
            }
        )
    return passages


def passage_offsets(passages: list[dict[str, object]]) -> dict[int, tuple[int, int]]:
    offsets: dict[int, tuple[int, int]] = {}
    cursor = 0
    for passage in passages:
        text = str(passage["baseText"])
        start = cursor
        cursor += len(text)
        offsets[int(passage["number"])] = (start, cursor)
    return offsets


def overlapping_amount(start: int, end: int, block_start: int, block_end: int) -> int:
    return max(0, min(end, block_end) - max(start, block_start))


def build_collation(
    corpus_path: Path,
    hamilton_ocr_path: Path,
) -> dict[str, object]:
    passages = source_passages(corpus_path)
    base_text = "".join(str(passage["baseText"]) for passage in passages)
    hamilton_ocr = clean_ocr_text(hamilton_ocr_path.read_text(encoding="utf-8"))

    matcher = difflib.SequenceMatcher(None, base_text, hamilton_ocr.text, autojunk=False)
    blocks = matcher.get_matching_blocks()
    opcodes = matcher.get_opcodes()
    offsets = passage_offsets(passages)

    passage_records = []
    review_rows = []
    for passage in passages:
        number = int(passage["number"])
        base_start, base_end = offsets[number]
        base_passage = str(passage["baseText"])
        matched_chars = sum(
            overlapping_amount(base_start, base_end, block.a, block.a + block.size)
            for block in blocks
        )
        matching_ocr_indices = [
            block.b + max(0, base_start - block.a)
            for block in blocks
            if overlapping_amount(base_start, base_end, block.a, block.a + block.size)
        ]
        matching_ocr_ends = [
            block.b
            + min(block.size, base_end - block.a)
            for block in blocks
            if overlapping_amount(base_start, base_end, block.a, block.a + block.size)
        ]
        ocr_start = min(matching_ocr_indices) if matching_ocr_indices else None
        ocr_end = max(matching_ocr_ends) if matching_ocr_ends else None
        ocr_slice = (
            hamilton_ocr.text[ocr_start:ocr_end]
            if ocr_start is not None and ocr_end is not None
            else ""
        )

        differences = []
        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue
            overlap_start = max(base_start, i1)
            overlap_end = min(base_end, i2)
            if overlap_start >= overlap_end and tag != "insert":
                continue
            if tag == "insert" and not (base_start <= i1 <= base_end):
                continue
            base_fragment = base_text[overlap_start:overlap_end]
            ocr_fragment = hamilton_ocr.text[j1:j2]
            if not base_fragment and not ocr_fragment:
                continue
            category = classify_difference(base_fragment, ocr_fragment, tag)
            base_context_start = max(base_start, overlap_start - 12)
            base_context_end = min(base_end, overlap_end + 12)
            row = {
                "tag": tag,
                "category": category,
                "baseStart": overlap_start - base_start,
                "baseEnd": overlap_end - base_start,
                "ocrStart": j1,
                "ocrEnd": j2,
                "base": base_fragment,
                "hamiltonOcr": ocr_fragment,
                "baseContext": base_text[base_context_start:base_context_end],
            }
            differences.append(row)
            review_rows.append({"verse": number, **row})

        coverage = matched_chars / len(base_passage) if base_passage else 0
        if coverage >= 0.75:
            status = "strong-ocr-support"
        elif coverage >= 0.45:
            status = "partial-ocr-support"
        elif coverage > 0:
            status = "weak-ocr-support"
        else:
            status = "not-located"

        passage_records.append(
            {
                "verse": number,
                "label": passage["label"],
                "status": status,
                "baseCjkLength": len(base_passage),
                "matchedBaseChars": matched_chars,
                "coverage": round(coverage, 4),
                "hamiltonOcrStart": ocr_start,
                "hamiltonOcrEnd": ocr_end,
                "baseText": base_passage,
                "hamiltonOcrSlice": ocr_slice,
                "differenceCount": len(differences),
                "differences": differences,
            }
        )

    return {
        "metadata": {
            "baseWitness": "zho_xuanzang",
            "collatedWitness": "zho_hamilton_xuanzang_1938",
            "method": "character-level-difflib-collation-v1",
            "status": "source-preparation-review",
            "note": (
                "The existing clean Xuanzang witness is used as base text. "
                "Hamilton's scan OCR is treated as a comparator, not as a "
                "published edition. Reported differences are review prompts; "
                "many are expected OCR or vertical-column-order artifacts."
            ),
            "ocrNormalization": OCR_REPLACEMENTS,
            "baseLength": len(base_text),
            "hamiltonOcrLength": len(hamilton_ocr.text),
            "matchedBaseChars": sum(block.size for block in blocks),
            "overallCoverage": round(
                sum(block.size for block in blocks) / len(base_text), 4
            )
            if base_text
            else 0,
        },
        "passages": passage_records,
        "reviewRows": review_rows,
    }


def write_outputs(collation: dict[str, object], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "collation.json").write_text(
        json.dumps(
            {key: value for key, value in collation.items() if key != "reviewRows"},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    rows = list(collation["reviewRows"])
    with (output_dir / "collation-review.tsv").open(
        "w", encoding="utf-8", newline=""
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "verse",
                "tag",
                "category",
                "baseStart",
                "baseEnd",
                "ocrStart",
                "ocrEnd",
                "base",
                "hamiltonOcr",
                "baseContext",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(rows)

    metadata = dict(collation["metadata"])
    lines = [
        "# Hamilton 1938 Chinese Collation",
        "",
        "Base witness: `Chinese · Xuanzang`.",
        "Comparator: Hamilton 1938 facing-page Chinese OCR.",
        "",
        (
            "This is a review collation, not a published Chinese edition. "
            "Differences are prompts for checking the scan; many are OCR or "
            "vertical-column-order artifacts."
        ),
        "",
        "## Summary",
        "",
        f"- Base CJK characters: {metadata['baseLength']}",
        f"- Hamilton OCR CJK characters: {metadata['hamiltonOcrLength']}",
        f"- Matched base characters: {metadata['matchedBaseChars']}",
        f"- Overall coverage: {metadata['overallCoverage']:.1%}",
        "",
        "## Passage Coverage",
        "",
        "| Verse | Status | Base chars | Matched | Coverage | Review rows |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for passage in collation["passages"]:
        lines.append(
            "| {verse} | {status} | {baseCjkLength} | {matchedBaseChars} | "
            "{coverage:.1%} | {differenceCount} |".format(**passage)
        )

    lines.extend(
        [
            "",
            "## First Review Prompts",
            "",
        ]
    )
    for row in rows[:80]:
        lines.append(
            "- Verse {verse} · {category}: base `{base}` / Hamilton OCR `{hamiltonOcr}` "
            "· context `{baseContext}`".format(
                verse=row["verse"],
                category=row["category"],
                base=compact_fragment(row["base"]),
                hamiltonOcr=compact_fragment(row["hamiltonOcr"]),
                baseContext=compact_fragment(row["baseContext"], 44),
            )
        )

    (output_dir / "collation-summary.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Collate Hamilton's Chinese OCR against the clean Xuanzang witness."
    )
    parser.add_argument(
        "--corpus",
        type=Path,
        default=Path("data/corpus.json"),
        help="Readable corpus JSON containing the clean zho_xuanzang witness.",
    )
    parser.add_argument(
        "--hamilton-ocr",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938/chinese_ocr.txt"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938"),
    )
    args = parser.parse_args()

    collation = build_collation(args.corpus, args.hamilton_ocr)
    write_outputs(collation, args.output_dir)
    metadata = collation["metadata"]
    print(
        "Hamilton Chinese collation: "
        f"{metadata['matchedBaseChars']}/{metadata['baseLength']} base chars "
        f"({metadata['overallCoverage']:.1%})"
    )
    print(f"Wrote {args.output_dir / 'collation.json'}")
    print(f"Wrote {args.output_dir / 'collation-review.tsv'}")
    print(f"Wrote {args.output_dir / 'collation-summary.md'}")


if __name__ == "__main__":
    main()
