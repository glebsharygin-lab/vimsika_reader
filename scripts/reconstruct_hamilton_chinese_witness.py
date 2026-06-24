from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from collate_hamilton_chinese import OCR_REPLACEMENTS, build_collation, clean_ocr_text, write_outputs


CJK_RE = re.compile(r"[\u3400-\u9fff]")
DISPLAY_RE = re.compile(r"[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]")
PAGE_HEADER_RE = re.compile(r"\n?===== PAGE \d+ =====\n?")


def cjk_count(text: str) -> int:
    return len(CJK_RE.findall(text))


def normalize_ocr_text(text: str) -> str:
    text = text.replace("論日", "論曰").replace("頌日", "頌曰")
    return "".join(OCR_REPLACEMENTS.get(char, char) for char in text)


def display_text_from_words(words: list[dict[str, object]]) -> str:
    ordered_words = sorted(words, key=lambda word: (float(word["y"]), float(word["x"])))
    raw = "".join(str(word["text"]) for word in ordered_words)
    return normalize_ocr_text("".join(DISPLAY_RE.findall(raw)))


def reconstruct_pages(lines_path: Path) -> list[dict[str, object]]:
    pages = json.loads(lines_path.read_text(encoding="utf-8-sig"))
    reconstructed = []
    for page in pages:
        columns: list[dict[str, object]] = []
        for line in page["lines"]:
            text = display_text_from_words(line.get("words", []))
            if not cjk_count(text):
                continue
            width = max(1.0, float(line["width"]))
            height = float(line["height"])
            if height <= width * 2:
                continue
            columns.append(
                {
                    "x": float(line["x"]),
                    "y": float(line["y"]),
                    "text": text,
                    "cjk": cjk_count(text),
                }
            )
        columns.sort(key=lambda column: (-float(column["x"]), float(column["y"])))
        reconstructed.append(
            {
                "page": int(page["page"]),
                "image": page["image"],
                "columns": columns,
                "text": "".join(str(column["text"]) for column in columns),
            }
        )
    return reconstructed


def write_ordered_ocr(pages: list[dict[str, object]], target: Path) -> None:
    chunks = [
        f"===== PAGE {page['page']} =====\n{page['text']}"
        for page in pages
        if str(page.get("text", "")).strip()
    ]
    target.write_text("\n\n".join(chunks) + "\n", encoding="utf-8")


def cleaned_mapping(raw_text: str) -> tuple[str, list[int]]:
    cleaned_chars: list[str] = []
    raw_indices: list[int] = []
    for index, char in enumerate(normalize_ocr_text(raw_text)):
        if CJK_RE.match(char):
            cleaned_chars.append(char)
            raw_indices.append(index)
    return "".join(cleaned_chars), raw_indices


def raw_slice_for_clean_offsets(raw_text: str, start: int | None, end: int | None) -> str:
    if start is None or end is None or end <= start:
        return ""
    cleaned, raw_indices = cleaned_mapping(raw_text)
    if start >= len(raw_indices):
        return ""
    end = min(end, len(raw_indices))
    raw_start = raw_indices[start]
    raw_end = raw_indices[end - 1] + 1
    slice_text = normalize_ocr_text(raw_text[raw_start:raw_end])
    slice_text = PAGE_HEADER_RE.sub("\n", slice_text)
    slice_text = re.sub(r"[ \t]+", "", slice_text)
    slice_text = re.sub(r"\n{2,}", "\n", slice_text).strip()
    if cleaned[start:end] != clean_ocr_text(slice_text).text[: end - start]:
        return slice_text
    return slice_text


def format_passage_text(text: str) -> str:
    text = PAGE_HEADER_RE.sub("\n", text)
    text = re.sub(r"[ \t]+", "", text)
    text = re.sub(r"([。！？])", r"\1\n", text)
    text = re.sub(r"\n{2,}", "\n\n", text)
    return text.strip()


def write_passages(collation: dict[str, object], raw_ocr_path: Path, target: Path) -> None:
    raw_text = raw_ocr_path.read_text(encoding="utf-8")
    passages = []
    for passage in collation["passages"]:
        slice_text = raw_slice_for_clean_offsets(
            raw_text,
            passage.get("hamiltonOcrStart"),
            passage.get("hamiltonOcrEnd"),
        )
        coverage = float(passage["coverage"])
        status = "ocr-collated-needs-proofing"
        if coverage < 0.6:
            status = "partial-ocr-collation-needs-proofing"
        passages.append(
            {
                "verse": int(passage["verse"]),
                "text": format_passage_text(slice_text),
                "status": status,
                "method": "hamilton-1938-column-aware-windows-ocr-collation-v1",
                "note": (
                    "Segmented from Hamilton's facing-page vertical Chinese scan "
                    "using column-aware Windows OCR and base-assisted collation "
                    f"against the clean Xuanzang witness; coverage {coverage:.1%}. "
                    "OCR variants and passage boundaries require proofing."
                ),
            }
        )
    target.write_text(json.dumps(passages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reconstruct Hamilton 1938 vertical Chinese OCR and segment it as a live witness."
    )
    parser.add_argument(
        "--lines",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938/chinese_ocr_lines.json"),
    )
    parser.add_argument(
        "--ocr-output",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938/chinese_ocr.txt"),
    )
    parser.add_argument(
        "--pages-output",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938/chinese_ocr_pages.json"),
    )
    parser.add_argument(
        "--passages-output",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938/passages.json"),
    )
    parser.add_argument("--corpus", type=Path, default=Path("data/corpus.json"))
    parser.add_argument(
        "--collation-output",
        type=Path,
        default=Path("source-witnesses/zho_hamilton_xuanzang_1938"),
    )
    args = parser.parse_args()

    pages = reconstruct_pages(args.lines)
    write_ordered_ocr(pages, args.ocr_output)
    args.pages_output.write_text(json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    collation = build_collation(args.corpus, args.ocr_output)
    write_outputs(collation, args.collation_output)
    write_passages(collation, args.ocr_output, args.passages_output)
    metadata = collation["metadata"]
    print(
        "Hamilton Chinese reconstructed: "
        f"{metadata['matchedBaseChars']}/{metadata['baseLength']} base chars "
        f"({metadata['overallCoverage']:.1%})"
    )
    print(f"Wrote {args.ocr_output}")
    print(f"Wrote {args.passages_output}")


if __name__ == "__main__":
    main()
