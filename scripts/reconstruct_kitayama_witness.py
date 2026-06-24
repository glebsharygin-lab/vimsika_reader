from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

VERSE_NUMBERS = range(1, 23)


@dataclass
class TextLine:
    page: int
    text: str


def page_dimensions(path: str) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def clean_fragment(text: str) -> str:
    text = re.sub(r"\s+", " ", text.strip())
    replacements = {
        "Bewu lit": "Bewußt",
        "Bewu l}": "Bewuß",
        "Bewu l!": "Bewußt",
        "Bessmßt": "Bewußt",
        "Bess u l!": "Bewußt",
        "l)ie": "Die",
        "(lie": "die",
        "(1er": "der",
        "Iler": "Der",
        "wartilll": "warum",
        "wartun": "warum",
        "Inöglich": "möglich",
        "ntöglich": "möglich",
        "überall": "überall",
        "iiberall": "überall",
        "iiber": "über",
        "zuriick": "zurück",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def merge_rows(lines: list[dict[str, object]]) -> list[str]:
    rows: list[list[dict[str, object]]] = []
    for line in sorted(lines, key=lambda item: (float(item["y"]), float(item["x"]))):
        if not rows:
            rows.append([line])
            continue
        last_y = sum(float(item["y"]) for item in rows[-1]) / len(rows[-1])
        if abs(float(line["y"]) - last_y) <= 10:
            rows[-1].append(line)
        else:
            rows.append([line])

    merged: list[str] = []
    for row in rows:
        fragments = [clean_fragment(str(item["text"])) for item in sorted(row, key=lambda item: float(item["x"]))]
        text = clean_fragment(" ".join(fragment for fragment in fragments if fragment))
        if text:
            merged.append(text)
    return merged


def select_column_lines(
    all_lines: list[dict[str, object]],
    width: int,
    height: int,
    column: str,
) -> list[dict[str, object]]:
    if column == "single":
        xmin = max(260, width * 0.25)
        xmax = width - 20
    elif column == "left":
        xmin = width * 0.17
        xmax = width * 0.50
    elif column == "right":
        xmin = width * 0.70
        xmax = width - 20
    else:
        raise ValueError(column)

    selected: list[dict[str, object]] = []
    for line in all_lines:
        text = clean_fragment(str(line.get("text", "")))
        if not text:
            continue
        x = float(line["x"])
        x2 = float(line["x2"])
        y = float(line["y"])
        center_x = (x + x2) / 2
        if center_x < xmin or center_x > xmax:
            continue
        if y > height * 0.89:
            continue
        selected.append(line)
    return selected


def reconstruct_pages(ocr_pages: list[dict[str, object]]) -> list[TextLine]:
    reconstructed: list[TextLine] = []
    for page in ocr_pages:
        width, height = page_dimensions(str(page["path"]))
        scan_start = int(page["scanPageStart"])
        scan_end = int(page["scanPageEnd"])
        columns: list[tuple[int, str]]
        if scan_start == scan_end or width < 1100:
            columns = [(scan_start, "single")]
        else:
            columns = [(scan_start, "left"), (scan_end, "right")]
        for scan_page, column in columns:
            selected = select_column_lines(
                list(page["lines"]),
                width,
                height,
                column,
            )
            reconstructed.append(TextLine(scan_page, f"===== KITAYAMA PAGE {scan_page} ====="))
            for text in merge_rows(selected):
                reconstructed.append(TextLine(scan_page, text))
    return reconstructed


def parse_heading(text: str, current: int | None = None) -> int | None:
    lowered = text.lower()
    lowered = lowered.replace("qrs", "vers").replace("vrs", "vers")
    lowered = lowered.replace("rers", "vers").replace("v ers", "vers")
    lowered = lowered.replace("l' ers", "vers").replace("i' ers", "vers")
    lowered = lowered.replace("l ’ers", "vers").replace("i ’ers", "vers")
    lowered = lowered.replace("l ers", "vers").replace("i ers", "vers")
    lowered = lowered.replace("l qrs", "vers").replace("i qrs", "vers")
    lowered = lowered.replace("j 'ers", "vers").replace("j -ers", "vers")
    lowered = lowered.replace("i -ers", "vers").replace("l -ers", "vers")
    lowered = re.sub(r"^\s*[ijil]\s*[^\w\d]{0,3}\s*ers\b", "vers", lowered)
    lowered = re.sub(r"^\s*[rj]\s*[^\w\d]{0,3}\s*ers\b", "vers", lowered)
    lowered = re.sub(r"^\s*[ijil]\s+vers\b", "vers", lowered)
    lowered = re.sub(r"^\s*ers\b", "vers", lowered)
    lowered = re.sub(r"\b[il]\s*([0-9])", r"1\1", lowered)

    if re.fullmatch(r"\s*(?:[ijil]\s*)?vers\s*\.?\s*", lowered) and current is not None:
        next_number = current + 1
        if next_number in VERSE_NUMBERS:
            return next_number

    match = re.search(r"^\s*vers\W*([0-9ilr?/,']{1,4})\s*[abcuw]?\b", lowered)
    if not match:
        return None
    number_text = (
        match.group(1)
        .replace("i", "1")
        .replace("l", "1")
        .replace("r", "7")
        .replace("?", "7")
        .replace("/", "1")
        .replace(",", "")
        .replace("'", "")
    )
    if number_text == "1" and current is not None and current >= 10:
        number_text = str(current + 1)
    if number_text.startswith("201"):
        number_text = "20"
    if number_text.startswith("21"):
        number_text = "21"
    try:
        number = int(number_text)
    except ValueError:
        return None
    if number in VERSE_NUMBERS:
        return number
    return None


def segment(lines: list[TextLine]) -> list[dict[str, object]]:
    buckets: dict[int, list[str]] = {number: [] for number in VERSE_NUMBERS}
    current: int | None = None
    for line in lines:
        if line.text.startswith("====="):
            continue
        heading = parse_heading(line.text, current)
        if heading is not None:
            current = heading
        if current is None:
            continue
        buckets[current].append(line.text)

    records: list[dict[str, object]] = []
    for number in VERSE_NUMBERS:
        text = "\n".join(buckets[number]).strip()
        records.append(
            {
                "verse": number,
                "text": text,
                "status": "windows-ocr-segmented-needs-proofing" if text else "ocr-missing",
                "method": "kitayama-1934-german-screenshot-ocr-heading-boundaries-v1",
                "note": (
                    "Segmented from user-supplied screenshots of Kitayama 1934. "
                    "The source is old German print; OCR and verse boundaries are "
                    "provisional and require scholarly proofing against the scans."
                ),
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("source-witnesses")
        / "de_kitayama_1934"
        / "kitayama_ocr_lines.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("source-witnesses") / "de_kitayama_1934",
    )
    args = parser.parse_args()

    ocr_pages = json.loads(args.input.read_text(encoding="utf-8-sig"))
    lines = reconstruct_pages(ocr_pages)
    records = segment(lines)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "translation_ocr.txt").write_text(
        "\n".join(f"{line.text}" for line in lines) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "passages.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "INGESTION-NOTE.md").write_text(
        "# German · Kitayama 1934\n\n"
        "This is a provisional Windows OCR extraction from the user-supplied "
        "screenshots of Kitayama's 1934 German translation, chapter 4, pages "
        "234-268. The OCR is segmented at the printed `Vers` headings. Old type, "
        "marginal headings, and footnotes make this a review witness rather than "
        "a corrected edition.\n",
        encoding="utf-8",
    )
    for record in records:
        chars = len(str(record["text"]))
        print(f"Verse {record['verse']:>2}: {chars:>5} chars {record['status']}")


if __name__ == "__main__":
    main()
