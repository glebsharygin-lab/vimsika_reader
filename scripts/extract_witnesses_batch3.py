from __future__ import annotations

import argparse
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


def pdf_text(path: Path, page_numbers: range) -> str:
    chunks: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page_number in page_numbers:
            page = pdf.pages[page_number - 1]
            text = page.extract_text(layout=False, x_tolerance=1, y_tolerance=3) or ""
            chunks.append(f"\n\n===== PAGE {page_number} =====\n{text.strip()}\n")
    return "\n".join(chunks).strip() + "\n"


def write_text(output_dir: Path, witness_id: str, filename: str, text: str) -> None:
    witness_dir = output_dir / witness_id
    witness_dir.mkdir(parents=True, exist_ok=True)
    (witness_dir / filename).write_text(text, encoding="utf-8")


def hamilton_note(introduction_path: Path, translation_path: Path | None = None) -> str:
    intro_reader = PdfReader(str(introduction_path))
    intro_page_count = len(intro_reader.pages)
    intro_text_chars = sum(len(page.extract_text() or "") for page in intro_reader.pages)
    translation_summary = ""
    if translation_path and translation_path.exists():
        translation_reader = PdfReader(str(translation_path))
        translation_text_chars = sum(
            len(page.extract_text() or "") for page in translation_reader.pages
        )
        translation_summary = (
            "\n\nA second supplied Hamilton PDF contains the English translation "
            "and facing Chinese text pages, but it is also scan-only. Use the "
            "existing local Windows OCR workflow to regenerate "
            "`translation_ocr.txt`, `passages.json`, and the Chinese OCR "
            "source-preparation files.\n\n"
            f"Translation-scan pages inspected: {len(translation_reader.pages)}.\n"
            f"Extractable translation-scan text characters detected: "
            f"{translation_text_chars}.\n"
        )
    return (
        "# Hamilton 1938 Ingestion Note\n\n"
        "The first supplied Hamilton PDF was inspected for text extraction; it "
        f"contains {intro_page_count} scanned introduction pages and no "
        "extractable text layer.\n\n"
        f"Extractable introduction-scan text characters detected: "
        f"{intro_text_chars}."
        f"{translation_summary}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract batch-3 Viṃśikā witnesses from supplied PDFs."
    )
    parser.add_argument(
        "--silk-dunhuang",
        type=Path,
        default=Path(
            r"C:\Users\glebs\Downloads\Materials_Toward_the_Study_of_Vasubandhu (1).pdf"
        ),
    )
    parser.add_argument(
        "--lvp",
        type=Path,
        default=Path(r"C:\Users\glebs\Downloads\lemuson30soc1i (1).pdf"),
    )
    parser.add_argument(
        "--hamilton",
        type=Path,
        default=Path(r"C:\Users\glebs\Downloads\oxford res ac\misc133033.pdf"),
    )
    parser.add_argument(
        "--hamilton-translation",
        type=Path,
        default=Path(r"C:\Users\glebs\Downloads\oxford res ac\misc133034.pdf"),
    )
    parser.add_argument(
        "--cronk",
        type=Path,
        default=Path(
            r"C:\Users\glebs\Downloads\oxford res ac\twenty-verses-on-consciousness-only-vimsatika-karika.pdf"
        ),
    )
    parser.add_argument("--output-dir", type=Path, default=Path("source-witnesses"))
    args = parser.parse_args()

    write_text(
        args.output_dir,
        "tib_silk_dunhuang_2017",
        "transcription.txt",
        pdf_text(args.silk_dunhuang, range(3, 18)),
    )
    write_text(
        args.output_dir,
        "tib_lvp_1911",
        "transcription.txt",
        pdf_text(args.lvp, range(2, 14)),
    )
    write_text(
        args.output_dir,
        "fra_lvp_1911",
        "translation.txt",
        pdf_text(args.lvp, range(15, 39)),
    )
    write_text(
        args.output_dir,
        "eng_cronk_1998",
        "translation.txt",
        pdf_text(args.cronk, range(1, 7)),
    )

    hamilton_dir = args.output_dir / "eng_hamilton_1938"
    hamilton_dir.mkdir(parents=True, exist_ok=True)
    (hamilton_dir / "INGESTION-NOTE.md").write_text(
        hamilton_note(args.hamilton, args.hamilton_translation),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
