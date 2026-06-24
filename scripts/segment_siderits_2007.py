from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader

VERSE_NUMBERS = range(1, 23)

DEFAULT_PDF = Path(
    r"C:\Users\glebs\Downloads\[Ashgate World Philosophies Series] Mark Siderits - Buddhism as Philosophy_ An Introduction (2007, Ashgate Publishing Limited) - libgen.li (1).pdf"
)

SPAN_LINES = {
    1: (50, 93),
    2: (113, 145),
    3: (247, 262),
    4: (263, 293),
    5: (294, 314),
    6: (315, 320),
    7: (321, 332),
    10: (1222, 1250),
    11: (526, 540),
    12: (541, 556),
    13: (557, 565),
    14: (566, 596),
    15: (601, 624),
    16: (888, 910),
    17: (911, 949),
    18: (950, 963),
    19: (964, 982),
}

RUNNING_HEADER_RE = re.compile(
    r"^(?:\d+\s*)?(?:Buddhism as Philosophy|Yogi\S*: Impressions|Yogac\S*: Impressions|Yogiiciira: Impressions)"
)


def extract_pdf_lines(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    lines: list[str] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        lines.append(f"===== PDF PAGE {page_number} =====")
        lines.extend(text.splitlines())
    return lines


def clean_lines(lines: list[str]) -> str:
    cleaned: list[str] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("====="):
            continue
        if RUNNING_HEADER_RE.match(line):
            continue
        if re.fullmatch(r"\d{2,3}", line):
            continue
        cleaned.append(line)

    text = " ".join(cleaned)
    text = re.sub(r"\s+", " ", text)
    text = text.replace("imp ression", "impression")
    text = text.replace("imp ressions", "impressions")
    text = text.replace("obje ct", "object")
    text = text.replace("obje cts", "objects")
    text = text.replace("simi lar", "similar")
    text = text.replace("determ in", "determin")
    text = text.replace("Vasuband hu", "Vasubandhu")
    text = text.replace("Subandhu", "Vasubandhu")
    return text.strip()


def build_records(lines: list[str]) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for verse in VERSE_NUMBERS:
        if verse in SPAN_LINES:
            start, end = SPAN_LINES[verse]
            text = clean_lines(lines[start - 1 : end])
            status = "pdf-text-layer-segmented-needs-proofing"
        else:
            text = ""
            status = "not-excerpted-in-supplied-chapter"
        records.append(
            {
                "verse": verse,
                "text": text,
                "status": status,
                "method": "siderits-2007-selected-printed-passages-v1",
                "note": (
                    "Segmented from the supplied PDF text layer. Siderits 2007 "
                    "prints selected passages from Viṃśatikā rather than a "
                    "continuous complete witness; blank verses were not excerpted "
                    "in the supplied chapter."
                ),
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("source-witnesses") / "eng_siderits_2007",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    lines = extract_pdf_lines(args.pdf)
    records = build_records(lines)
    (args.output_dir / "translation_ocr.txt").write_text(
        "\n\n".join(
            f"Verse {record['verse']}\n{record['text']}"
            for record in records
            if record["text"]
        )
        + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "passages.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "INGESTION-NOTE.md").write_text(
        "# English · Siderits 2007\n\n"
        "This is a provisional extraction from the supplied PDF text layer of "
        "Mark Siderits, *Buddhism as Philosophy: An Introduction* (2007), "
        "chapter 8. The chapter quotes selected passages from Vasubandhu's "
        "Viṃśatikā and surrounding commentary, rather than printing a complete "
        "continuous witness. Empty passage records mark verses not excerpted in "
        "the supplied chapter.\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.output_dir / 'passages.json'}")


if __name__ == "__main__":
    main()
