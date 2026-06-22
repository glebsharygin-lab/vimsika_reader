import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


WITNESSES = {
    "eng_silk_2016": {
        "label": "English · Silk 2016",
        "citation": (
            "Jonathan A. Silk, Materials Toward the Study of Vasubandhu’s "
            "Viṁśikā (I), Harvard Oriental Series 81, 2016; 2018 open-access edition."
        ),
        "pages": (229, 250),
        "engine": "pdfplumber-layout",
        "rights": "CC BY-SA (2018 open-access edition)",
    },
    "eng_anacker_2005": {
        "label": "English · Anacker 2005",
        "citation": (
            "Stefan Anacker, Seven Works of Vasubandhu: The Buddhist "
            "Psychological Doctor, revised edition, Motilal Banarsidass, 2005."
        ),
        "pages": (174, 188),
        "engine": "pypdf",
        "rights": "Cleared by project owner for this research corpus",
    },
    "eng_tola_dragonetti_2004": {
        "label": "English · Tola & Dragonetti 2004",
        "citation": (
            "Fernando Tola and Carmen Dragonetti, Being as Consciousness: "
            "Yogācāra Philosophy of Buddhism, Motilal Banarsidass, 2004."
        ),
        "pages": (176, 195),
        "engine": "pypdf",
        "rights": "Cleared by project owner for this research corpus",
    },
}

PRESERVED_LINE_BREAK_COMPOUNDS = {
    "eye-consciousnesses",
    "hell-guardians",
    "moment-series",
    "non-being",
    "non-human",
    "non-restriction",
    "perception-only",
    "sense-fields",
    "sense-object",
}


def normalize_characters(text):
    replacements = {
        "\u00a0": " ",
        "\u00ad": "",
        "\ufeff": "",
        "\u2007": " ",
        "\u202f": " ",
        "\x00": "",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    return unicodedata.normalize("NFC", text)


def is_header_or_footer(line, witness_id, first_page):
    if re.fullmatch(r"\d{1,3}", line):
        return True
    if witness_id == "eng_silk_2016":
        return bool(re.fullmatch(r"[A-Z]\)", line))
    if witness_id == "eng_anacker_2005":
        if re.fullmatch(r"\d+\s+Seven Works of Vasubandhu", line):
            return True
        if re.fullmatch(
            r"The Twenty Verses\s*(?:and|and Their)\s*Commentary\s+\d+",
            line,
            re.IGNORECASE,
        ):
            return True
        if re.fullmatch(
            r"The Twenty Versesand Their Commentary\s+\d+",
            line,
            re.IGNORECASE,
        ):
            return True
    if witness_id == "eng_tola_dragonetti_2004":
        if re.fullmatch(r"\d+\s+Being as Consciousness", line):
            return True
        if (
            re.match(r"The Vi[mrṅnšs].*Vasubandhu", line, re.IGNORECASE)
            and re.search(r"\d+\s*$", line)
        ):
            return True
        if (
            re.match(r"The Vi.*Vasu", line, re.IGNORECASE)
            and re.search(r"\d+\s*$", line)
        ):
            return True
    return False


def clean_lines(text, witness_id, first_page=False):
    text = normalize_characters(text)
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if witness_id == "eng_silk_2016":
            line = re.sub(r"(?<!\S)[A-P]{1,4}\)(?=\s|$)", "", line)
            line = re.sub(r"[ \t]+", " ", line).strip()
        if is_header_or_footer(line, witness_id, first_page):
            continue
        lines.append(line)

    cleaned = []
    index = 0
    while index < len(lines):
        line = lines[index]
        next_index = index + 1
        while next_index < len(lines) and not lines[next_index]:
            next_index += 1
        if (
            line.endswith("-")
            and next_index < len(lines)
            and re.match(r"^[a-zāīūṛṝḷḹṃṁṅñṭḍṇśṣ]", lines[next_index])
        ):
            next_line = lines[next_index]
            left_match = re.search(r"([A-Za-z]+)-$", line)
            right_match = re.match(r"([A-Za-z]+)", next_line)
            compound = (
                f"{left_match.group(1)}-{right_match.group(1)}"
                if left_match and right_match
                else ""
            )
            if compound in PRESERVED_LINE_BREAK_COMPOUNDS:
                line += next_line
            else:
                line = line[:-1] + next_line
            index = next_index
        cleaned.append(line)
        index += 1

    output = []
    blank = False
    for line in cleaned:
        if line:
            output.append(line)
            blank = False
        elif output and not blank:
            output.append("")
            blank = True
    return "\n".join(output).strip()


def extract_silk(path, first_page, last_page):
    pages = []
    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            page = pdf.pages[page_number - 1]
            text = page.extract_text(
                layout=True,
                x_tolerance=2,
                y_tolerance=3,
            ) or ""
            pages.append(
                {
                    "pdfPage": page_number,
                    "text": clean_lines(
                        text,
                        "eng_silk_2016",
                        first_page=page_number == first_page,
                    ),
                }
            )
    return pages


def extract_pypdf(path, witness_id, first_page, last_page):
    reader = PdfReader(str(path), strict=False)
    pages = []
    for page_number in range(first_page, last_page + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        pages.append(
            {
                "pdfPage": page_number,
                "text": clean_lines(
                    text,
                    witness_id,
                    first_page=page_number == first_page,
                ),
            }
        )
    return pages


def write_witness(output_root, witness_id, source_path, pages):
    config = WITNESSES[witness_id]
    witness_dir = output_root / witness_id
    witness_dir.mkdir(parents=True, exist_ok=True)
    if witness_id == "eng_anacker_2005":
        for page in pages:
            page["text"] = re.split(
                r"\nNOTES(?:\n|$)",
                page["text"],
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0].rstrip()
    combined = "\n\n".join(page["text"] for page in pages if page["text"]).strip()
    metadata = {
        "id": witness_id,
        "label": config["label"],
        "language": "English",
        "languageCode": "eng",
        "role": "modern-translation",
        "citation": config["citation"],
        "rights": config["rights"],
        "sourceFileName": source_path.name,
        "pdfPages": {
            "first": config["pages"][0],
            "last": config["pages"][1],
        },
        "extractionEngine": config["engine"],
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "status": "machine-extracted; requires final scholarly proofing",
        "characterCount": len(combined),
        "wordCount": len(re.findall(r"\S+", combined)),
    }
    (witness_dir / "translation.txt").write_text(
        combined + "\n",
        encoding="utf-8",
    )
    (witness_dir / "pages.json").write_text(
        json.dumps(pages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (witness_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="Extract the three English Viṃśikā witnesses from supplied PDFs."
    )
    parser.add_argument("--silk", type=Path, required=True)
    parser.add_argument("--anacker", type=Path, required=True)
    parser.add_argument("--tola", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("source-witnesses"),
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    sources = {
        "eng_silk_2016": args.silk,
        "eng_anacker_2005": args.anacker,
        "eng_tola_dragonetti_2004": args.tola,
    }
    manifest = []
    for witness_id, source_path in sources.items():
        config = WITNESSES[witness_id]
        first_page, last_page = config["pages"]
        if config["engine"] == "pdfplumber-layout":
            pages = extract_silk(source_path, first_page, last_page)
        else:
            pages = extract_pypdf(
                source_path,
                witness_id,
                first_page,
                last_page,
            )
        manifest.append(
            write_witness(
                args.output_dir,
                witness_id,
                source_path,
                pages,
            )
        )

    (args.output_dir / "english-witnesses-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "\n".join(
            f"{item['id']}: {item['wordCount']} words, "
            f"PDF pages {item['pdfPages']['first']}–{item['pdfPages']['last']}"
            for item in manifest
        )
    )


if __name__ == "__main__":
    main()
