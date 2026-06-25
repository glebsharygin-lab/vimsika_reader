from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from pypdf import PdfReader


VERSE_NUMBERS = range(1, 23)
KALUPAHANA_PAGE_INDICES = range(183, 203)


def clean_space(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


def join_wrapped_lines(lines: list[str]) -> str:
    text = ""
    for raw_line in lines:
        line = clean_space(raw_line)
        if not line:
            continue
        if text.endswith("-"):
            text = text[:-1] + line
        elif text:
            text += " " + line
        else:
            text = line
    return clean_space(text)


def is_page_noise(line: str) -> bool:
    normalized = clean_space(line)
    if not normalized:
        return True
    if re.fullmatch(r"\d{2,3}", normalized):
        return True
    return normalized in {
        "APPENDIX II",
        "VASUBANDHU'S VIJNAPTIMATRA TASIDDHI",
        "VASUBANDHUS VIJNAPTIMA TRA TASIDDHI",
        "VASUBANDHU'S VIJRAPTIAaTRA TASIDDHI",
        "VASUBANDHUS VIJRAPTIMiATRA TASIDDHI",
        "VASUBANDHU'S VIJNAPTIMA TRA TiSIDDHI",
        "VASUBANDHU'S VIJRAPTIMATRA TASIDDHI",
        "VASUBANDHU'S VIJ9APTI dTRA TASIDDHI1",
    }


def extract_kalupahana(pdf_path: Path, output_root: Path) -> None:
    reader = PdfReader(str(pdf_path))
    raw_pages = []
    for page_index in KALUPAHANA_PAGE_INDICES:
        page_text = reader.pages[page_index].extract_text() or ""
        raw_pages.append(
            f"\n\n===== PDF_PAGE_INDEX {page_index} PRINT_PAGE {page_index + 1} =====\n"
            + page_text
        )
    raw_text = "\n".join(raw_pages)

    body_lines = []
    for line in raw_text.splitlines():
        if line.startswith("====="):
            continue
        if is_page_noise(line):
            continue
        body_lines.append(line.rstrip())
    body = "\n".join(body_lines)

    first_verse = re.search(r"(?m)^\s*1\.\s+", body)
    trimsika = re.search(r"(?m)^\s*1\.\s+Atma-dharm", body)
    if not first_verse or not trimsika:
        raise RuntimeError("Could not locate Kalupahana Viṃśikā boundaries.")
    vimsika_text = body[first_verse.start() : trimsika.start()].strip()

    starts = [
        match
        for match in re.finditer(r"(?m)^\s*(\d{1,2})\.\s+", vimsika_text)
        if 1 <= int(match.group(1)) <= 22
    ]
    if len(starts) != 22:
        raise RuntimeError(f"Expected 22 Kalupahana verse blocks, found {len(starts)}.")

    sanskrit_records = []
    english_records = []
    sanskrit_text_lines = []
    english_text_lines = []
    for index, match in enumerate(starts):
        verse = int(match.group(1))
        end = starts[index + 1].start() if index + 1 < len(starts) else len(vimsika_text)
        block = vimsika_text[match.end() : end].strip()
        lines = [clean_space(line) for line in block.splitlines()]
        lines = [
            line
            for line in lines
            if line and not is_page_noise(line)
        ]
        if len(lines) < 3:
            raise RuntimeError(f"Kalupahana verse {verse} block is too short.")

        sanskrit = "\n".join(lines[:2])
        english = join_wrapped_lines(lines[2:])
        sanskrit_text_lines.append(f"{verse}. {sanskrit}")
        english_text_lines.append(f"{verse}. {english}")
        sanskrit_records.append(
            {
                "verse": verse,
                "text": sanskrit,
                "status": "pdf-text-layer-segmented-needs-proofing",
                "method": "kalupahana-1987-appendix-ii-text-layer-v1",
                "note": (
                    "Extracted from Appendix II of Kalupahana 1987. The PDF text "
                    "layer contains OCR-like romanization noise and requires "
                    "proofreading against the print."
                ),
            }
        )
        english_records.append(
            {
                "verse": verse,
                "text": english,
                "status": "pdf-text-layer-segmented-needs-proofing",
                "method": "kalupahana-1987-appendix-ii-text-layer-v1",
                "note": (
                    "Extracted from Appendix II of Kalupahana 1987. The passage "
                    "combines the English translation with Kalupahana's printed "
                    "annotation and requires proofreading."
                ),
            }
        )

    san_dir = output_root / "san_kalupahana_1987"
    eng_dir = output_root / "eng_kalupahana_1987"
    for target in (san_dir, eng_dir):
        target.mkdir(parents=True, exist_ok=True)

    (san_dir / "edition_text_layer.txt").write_text(
        "\n\n".join(sanskrit_text_lines) + "\n", encoding="utf-8"
    )
    (san_dir / "appendix_ii_text_layer.txt").write_text(raw_text, encoding="utf-8")
    (san_dir / "passages.json").write_text(
        json.dumps(sanskrit_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (san_dir / "INGESTION-NOTE.md").write_text(
        "# Sanskrit · Kalupahana 1987\n\n"
        "Provisional Sanskrit edition extracted from Appendix II of David J. "
        "Kalupahana, *The Principles of Buddhist Psychology* (1987). The text "
        "is based on the PDF text layer for printed pages 173-192 and preserves "
        "its OCR-like romanization noise for later scholarly correction.\n",
        encoding="utf-8",
    )

    (eng_dir / "translation_text_layer.txt").write_text(
        "\n\n".join(english_text_lines) + "\n", encoding="utf-8"
    )
    (eng_dir / "appendix_ii_text_layer.txt").write_text(raw_text, encoding="utf-8")
    (eng_dir / "passages.json").write_text(
        json.dumps(english_records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (eng_dir / "INGESTION-NOTE.md").write_text(
        "# English · Kalupahana 1987\n\n"
        "Provisional English translation and annotation extracted from Appendix II "
        "of David J. Kalupahana, *The Principles of Buddhist Psychology* (1987). "
        "The witness covers Viṃśikā verses 1-22 and must be proofread against the "
        "printed appendix.\n",
        encoding="utf-8",
    )


def normalize_japanese_line(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    return text.strip()


def reconstruct_yuda_text(ocr_json: Path, output_root: Path) -> None:
    rows = json.loads(ocr_json.read_text(encoding="utf-8-sig"))
    pages = []
    for page in rows:
        lines = sorted(page["lines"], key=lambda line: (-float(line["x"]), float(line["y"])))
        page_lines = []
        for line in lines:
            text = normalize_japanese_line(str(line.get("text", "")))
            if not text:
                continue
            if text in {"た", "し", "わ", "の", "ずいみん", "ほんっ・う"}:
                continue
            if re.match(r"^\d+わたくし", text):
                continue
            page_lines.append(text)
        pages.append(f"===== PAGE {page['page']} =====\n" + "\n".join(page_lines))

    reconstructed = "\n\n".join(pages).strip() + "\n"
    flat = reconstructed.replace("\n\n", "\n")

    def excerpt(start_marker: str, end_marker: str) -> str:
        try:
            start = flat.index(start_marker)
            end = flat.index(end_marker, start)
        except ValueError:
            return ""
        text = flat[start:end].strip()
        text = re.sub(r"(?m)^===== PAGE \d+ =====$", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    passages = {
        1: excerpt(
            "大乗において三つの領域から成る世界は唯心である",
            "「唯識二十論』カーリカー、1において",
        ),
        2: excerpt(
            "もしも、知覚",
            "このようなヴァスパンドウの考えに対して",
        ),
        17: excerpt(
            "夢におけるように、そのように目覚めている時にも",
            "アーラヤ識の解釈",
        ),
    }

    records = []
    for verse in VERSE_NUMBERS:
        text = passages.get(verse, "")
        records.append(
            {
                "verse": verse,
                "text": text,
                "status": (
                    "scan-ocr-selected-excerpt-needs-proofing"
                    if text
                    else "not-excerpted-in-source"
                ),
                "method": "yuda-watakushi-yuishiki-windows-ocr-v1",
                "note": (
                    "The supplied scan is an interpretive essay with selected "
                    "Viṃśikā quotations rather than a continuous verse-by-verse "
                    "translation. Blank records indicate verses not excerpted in "
                    "the OCRed source."
                ),
            }
        )

    target = output_root / "jpn_yuda_watakushi_yuishiki"
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ocr_json, target / "yuda_14201_ocr_lines.json")
    (target / "translation_ocr.txt").write_text(reconstructed, encoding="utf-8")
    (target / "passages.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (target / "INGESTION-NOTE.md").write_text(
        "# Japanese · Yuda, “Watakushi no Yuishiki”\n\n"
        "Provisional OCR reconstruction from the scan-only PDF `14201.pdf`. The "
        "source appears to be Yuda Yutaka's interpretive essay 「わたくしの“唯識” "
        "—ヴァスバンドゥの世界—」. It is not a complete running translation of "
        "all 22 local Viṃśikā passages; only the attested Viṃśikā excerpts are "
        "mapped, and all OCR output requires Japanese scholarly proofing.\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--kalupahana-pdf",
        type=Path,
        default=Path(
            r"C:\Users\glebs\Downloads\The Principles of Buddhist Psychology "
            r"(David J. Kalupahana) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
        ),
    )
    parser.add_argument(
        "--yuda-ocr-json",
        type=Path,
        default=Path("tmp/pdfs/jpn_14201_ocr_lines.json"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("source-witnesses"),
    )
    args = parser.parse_args()

    if not args.kalupahana_pdf.exists():
        raise FileNotFoundError(args.kalupahana_pdf)
    if not args.yuda_ocr_json.exists():
        raise FileNotFoundError(
            f"{args.yuda_ocr_json} is missing. Render/OCR 14201.pdf first."
        )

    extract_kalupahana(args.kalupahana_pdf, args.output_root)
    reconstruct_yuda_text(args.yuda_ocr_json, args.output_root)
    print("Wrote Kalupahana Sanskrit, Kalupahana English, and Yuda excerpt witnesses.")


if __name__ == "__main__":
    main()
