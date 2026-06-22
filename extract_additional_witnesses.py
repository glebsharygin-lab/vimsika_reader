import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
from pypdf import PdfReader
from reportlab.pdfbase.ttfonts import TTFontFile


WITNESSES = {
    "san_silk_2016": {
        "label": "Sanskrit · Silk 2016",
        "language": "Sanskrit",
        "languageCode": "san",
        "role": "sanskrit-edition",
        "citation": (
            "Jonathan A. Silk, Materials Toward the Study of Vasubandhu’s "
            "Viṃśikā (I), Harvard Oriental Series 81, 2016; 2018 open-access edition."
        ),
        "pages": (215, 225),
        "output": "edition.txt",
        "engine": "pdfplumber-layout",
        "status": "machine-extracted; requires final scholarly proofing",
    },
    "san_tola_dragonetti_2004": {
        "label": "Sanskrit · Tola & Dragonetti 2004",
        "language": "Sanskrit",
        "languageCode": "san",
        "role": "sanskrit-edition",
        "citation": (
            "Fernando Tola and Carmen Dragonetti, Being as Consciousness: "
            "Yogācāra Philosophy of Buddhism, Motilal Banarsidass, 2004."
        ),
        "pages": (165, 175),
        "output": "edition.txt",
        "engine": "pdfplumber-layout",
        "status": (
            "machine-extracted from a legacy Latin text layer; "
            "diacritics and note markers require scholarly proofing"
        ),
    },
    "san_ruzsa_szegedi_2015": {
        "label": "Sanskrit · Ruzsa & Szegedi 2015",
        "language": "Sanskrit",
        "languageCode": "san",
        "role": "critical-sanskrit-edition",
        "citation": (
            "Ferenc Ruzsa and Mónika Szegedi, “Vasubandhu’s Viṁśikā: "
            "A Critical Edition,” Távol-keleti Tanulmányok 2015/1, 127–158."
        ),
        "pages": (8, 31),
        "output": "edition.txt",
        "engine": "pypdf and pdfplumber",
        "status": "machine-extracted; reading text and critical apparatus require proofing",
    },
    "san_balcerowicz_nowakowska_1999": {
        "label": "Sanskrit · Balcerowicz & Nowakowska 1999",
        "language": "Sanskrit",
        "languageCode": "san",
        "role": "sanskrit-edition",
        "citation": (
            "Piotr Balcerowicz and Monika Nowakowska, “Wasubandhu: ‘Dowód na "
            "wyłączne istnienie treści świadomości w dwudziestu strofach’ "
            "(Viṃśatikā – Vijñapti-mātratā-siddhi),” Studia Indologiczne 6 "
            "(1999), 5–44."
        ),
        "pages": (6, 17),
        "output": "edition-legacy.txt",
        "engine": "pypdf legacy-font extraction",
        "status": (
            "source text extracted, but still encoded in the custom AMRITA "
            "Devanāgarī font; not yet safe for tokenization or collation"
        ),
    },
    "pol_balcerowicz_nowakowska_1999": {
        "label": "Polish · Balcerowicz & Nowakowska 1999",
        "language": "Polish",
        "languageCode": "pol",
        "role": "modern-translation",
        "citation": (
            "Piotr Balcerowicz and Monika Nowakowska, “Wasubandhu: ‘Dowód na "
            "wyłączne istnienie treści świadomości w dwudziestu strofach’ "
            "(Viṃśatikā – Vijñapti-mātratā-siddhi),” Studia Indologiczne 6 "
            "(1999), 18–35."
        ),
        "pages": (18, 35),
        "output": "translation.txt",
        "engine": "pdfplumber with PolishTimes CP1250 recovery",
        "status": "machine-extracted main translation; requires scholarly proofing",
    },
    "hun_szanyi_2015": {
        "label": "Hungarian · Szanyi 2015",
        "language": "Hungarian",
        "languageCode": "hun",
        "role": "modern-translation",
        "citation": (
            "Szilvia Szanyi, “Buddhista idealizmus: Vasubandhu Viṃśatikā című "
            "művének filozófiai elemzése,” Távol-keleti Tanulmányok 2015/2, 107–136."
        ),
        "pages": (4, 26),
        "output": "translation.txt",
        "engine": "pdfplumber CID/glyph recovery",
        "status": (
            "machine-extracted translated quotations and verses from the article; "
            "requires scholarly proofing"
        ),
    },
}

RIGHTS = "Cleared by project owner for this research corpus"

SZANYI_SPECIAL_GLYPHS = {
    0x0081: "ü",
    0x00AB: "…",
    0x00B2: "–",
    0x00B5: "”",
    0x00B6: "“",
    0x00B7: "’",
    0x00C0: "fi",
    0x00C5: "„",
    0x00C9: "Á",
    0x00CC: "Í",
    0x00D0: "Ó",
    0x00EF: "–",
    0x0103: "ā",
    0x0126: "ī",
    0x0143: "ő",
    0x014A: "Ś",
    0x014B: "ś",
    0x0157: "ū",
    0x015D: "ű",
    0x02BD: "ḍ",
    0x02F1: "ṃ",
    0x02F3: "ṃ",
    0x02F5: "ṅ",
    0x02F7: "ṇ",
    0x0313: "ṣ",
    0x031D: "ṭ",
}


def normalize(text):
    replacements = {
        "\u00a0": " ",
        "\u00ad": "",
        "\u2007": " ",
        "\u202f": " ",
        "\ufeff": "",
        "\x00": "",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    return unicodedata.normalize("NFC", text)


def compact_lines(lines):
    output = []
    blank = False
    for raw_line in lines:
        line = re.sub(r"[ \t]+", " ", normalize(raw_line)).strip()
        if line:
            output.append(line)
            blank = False
        elif output and not blank:
            output.append("")
            blank = True
    return "\n".join(output).strip()


def is_running_header(line):
    if not line:
        return False
    if re.fullmatch(r"\d{1,3}", line):
        return True
    if re.fullmatch(r"\d+\s*STUDIA INDOLOGICZNE\s+NR 6 \(1999\)", line):
        return True
    if re.fullmatch(r"NR 6 \(1999\).+\d+", line):
        return True
    if re.fullmatch(r"[¯Ż]{20,}", line):
        return True
    if re.fullmatch(r"\d+\s+Being as Consciousness", line):
        return True
    if re.match(r"The Vimsatik.+Vasubandhu\s+\d+$", line):
        return True
    if re.fullmatch(r"\d+\s+Ruzsa Ferenc – Szegedi Mónika", line):
        return True
    if re.fullmatch(r"Vasubandhu’s Viṁśikā\. A critical edition\s+\d+", line):
        return True
    if line.startswith("Aacayrâ}aîvâsöbâNzöivâòâicâta Svop"):
        return True
    return False


def clean_generic_page(text, witness_id):
    lines = []
    skip_polish_note = False
    for raw_line in normalize(text).splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if is_running_header(line):
            continue
        if witness_id == "san_silk_2016":
            line = re.sub(r"\(cid:\d+\)", "", line)
            line = re.sub(r"(?<!\S)[A-P]{1,4}\)(?=\s|$)", "", line)
            line = re.sub(r"[ \t]+", " ", line).strip()
        if witness_id == "san_balcerowicz_nowakowska_1999":
            if line.startswith("* Do edycji tekstu sanskryckiego"):
                skip_polish_note = True
            if skip_polish_note:
                if line.startswith("2 L om.") or line.startswith("3 B:"):
                    skip_polish_note = False
                else:
                    continue
        lines.append(line)
    return compact_lines(lines)


def extract_layout_pages(path, witness_id, first_page, last_page):
    pages = []
    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            text = pdf.pages[page_number - 1].extract_text(
                layout=True,
                x_tolerance=2,
                y_tolerance=3,
            ) or ""
            pages.append(
                {
                    "pdfPage": page_number,
                    "text": clean_generic_page(text, witness_id),
                }
            )
    return pages


def extract_pypdf_pages(path, witness_id, first_page, last_page):
    reader = PdfReader(str(path), strict=False)
    pages = []
    for page_number in range(first_page, last_page + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        pages.append(
            {
                "pdfPage": page_number,
                "text": clean_generic_page(text, witness_id),
            }
        )
    return pages


def decode_polish_character(character):
    text = character["text"]
    if "PolishTimes" not in character["fontname"]:
        return text
    try:
        return text.encode("cp1252").decode("cp1250")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def group_pdfplumber_lines(characters, top_tolerance=2.0):
    groups = []
    for character in sorted(characters, key=lambda item: (item["top"], item["x0"])):
        if not groups:
            groups.append([character])
            continue
        average_top = sum(item["top"] for item in groups[-1]) / len(groups[-1])
        if abs(character["top"] - average_top) > top_tolerance:
            groups.append([character])
        else:
            groups[-1].append(character)
    return groups


def extract_polish_pages(path, first_page, last_page):
    pages = []
    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            page = pdf.pages[page_number - 1]
            characters = [
                character
                for character in page.chars
                if character["size"] >= 10.4
            ]
            lines = []
            for group in group_pdfplumber_lines(characters):
                group.sort(key=lambda item: item["x0"])
                line = "".join(decode_polish_character(item) for item in group)
                line = re.sub(r"[ \t]+", " ", normalize(line)).strip()
                if is_running_header(line):
                    continue
                lines.append(line)
            pages.append(
                {
                    "pdfPage": page_number,
                    "text": compact_lines(lines),
                }
            )
    return pages


def font_glyph_maps():
    roman = TTFontFile(r"C:\Windows\Fonts\times.ttf").glyphToChar
    italic = TTFontFile(r"C:\Windows\Fonts\timesi.ttf").glyphToChar
    return roman, italic


def decode_szanyi_character(character, roman_map, italic_map):
    text = character["text"]
    match = re.fullmatch(r"\(cid:(\d+)\)", text)
    if not match:
        return text
    glyph_id = int(match.group(1))
    if glyph_id in SZANYI_SPECIAL_GLYPHS:
        return SZANYI_SPECIAL_GLYPHS[glyph_id]
    glyph_map = italic_map if "Italic" in character["fontname"] else roman_map
    codepoints = glyph_map.get(glyph_id)
    if not codepoints:
        return "�"
    return chr(codepoints[0])


def extract_szanyi_pages(path, first_page, last_page):
    roman_map, italic_map = font_glyph_maps()
    pages = []
    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            page = pdf.pages[page_number - 1]
            decoded_lines = []
            groups = group_pdfplumber_lines(page.chars, top_tolerance=3.2)
            for group in groups:
                group.sort(key=lambda item: item["x0"])
                text = "".join(
                    decode_szanyi_character(item, roman_map, italic_map)
                    for item in group
                )
                text = re.sub(r"[ \t]+", " ", normalize(text)).strip()
                if not text:
                    continue
                decoded_lines.append(
                    {
                        "text": text,
                        "top": sum(item["top"] for item in group) / len(group),
                        "x0": min(item["x0"] for item in group),
                        "size": sum(item["size"] for item in group) / len(group),
                    }
                )

            candidates = [
                line
                for line in decoded_lines
                if line["size"] >= 13.0 and 90 < line["top"] < 690
            ]
            blocks = []
            current = []
            for line in candidates:
                indented = line["x0"] >= 104
                close_to_previous = (
                    current and line["top"] - current[-1]["top"] <= 27
                )
                if indented and (not current or close_to_previous):
                    current.append(line)
                else:
                    if len(current) >= 2:
                        blocks.append(current)
                    current = [line] if indented else []
            if len(current) >= 2:
                blocks.append(current)

            selected = []
            for block in blocks:
                text = "\n".join(line["text"] for line in block)
                if re.search(r"\(\d+\)\s*$", text) or page_number == 5:
                    selected.append(text)
            pages.append(
                {
                    "pdfPage": page_number,
                    "blocks": selected,
                    "text": "\n\n".join(selected),
                }
            )
    return pages


def extract_ruzsa_reading_text(path, first_page, last_page):
    pages = []
    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            page = pdf.pages[page_number - 1]
            characters = [
                character
                for character in page.chars
                if character["size"] >= 10.5 and character["top"] > 75
            ]
            lines = []
            for group in group_pdfplumber_lines(characters, top_tolerance=2.5):
                group.sort(key=lambda item: item["x0"])
                line = "".join(item["text"] for item in group)
                line = re.sub(r"[ \t]+", " ", normalize(line)).strip()
                if is_running_header(line):
                    continue
                lines.append(line)
            pages.append(
                {
                    "pdfPage": page_number,
                    "text": compact_lines(lines),
                }
            )
    return pages


def write_witness(output_root, witness_id, source_path, pages):
    config = WITNESSES[witness_id]
    witness_dir = output_root / witness_id
    witness_dir.mkdir(parents=True, exist_ok=True)
    combined = "\n\n".join(page["text"] for page in pages if page["text"]).strip()
    (witness_dir / config["output"]).write_text(
        combined + "\n",
        encoding="utf-8",
    )
    (witness_dir / "pages.json").write_text(
        json.dumps(pages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    metadata = {
        "id": witness_id,
        "label": config["label"],
        "language": config["language"],
        "languageCode": config["languageCode"],
        "role": config["role"],
        "citation": config["citation"],
        "rights": RIGHTS,
        "sourceFileName": source_path.name,
        "pdfPages": {
            "first": config["pages"][0],
            "last": config["pages"][1],
        },
        "primaryOutput": config["output"],
        "extractionEngine": config["engine"],
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "status": config["status"],
        "characterCount": len(combined),
        "wordCount": len(re.findall(r"\S+", combined)),
    }
    (witness_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="Extract additional Sanskrit, Polish, and Hungarian Viṃśikā witnesses."
    )
    parser.add_argument("--silk", type=Path, required=True)
    parser.add_argument("--tola", type=Path, required=True)
    parser.add_argument("--ruzsa", type=Path, required=True)
    parser.add_argument("--balcerowicz", type=Path, required=True)
    parser.add_argument("--szanyi", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("source-witnesses"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    source_paths = {
        "san_silk_2016": args.silk,
        "san_tola_dragonetti_2004": args.tola,
        "san_ruzsa_szegedi_2015": args.ruzsa,
        "san_balcerowicz_nowakowska_1999": args.balcerowicz,
        "pol_balcerowicz_nowakowska_1999": args.balcerowicz,
        "hun_szanyi_2015": args.szanyi,
    }
    manifest = []
    for witness_id, source_path in source_paths.items():
        config = WITNESSES[witness_id]
        first_page, last_page = config["pages"]
        if witness_id in {"san_silk_2016", "san_tola_dragonetti_2004"}:
            pages = extract_layout_pages(
                source_path,
                witness_id,
                first_page,
                last_page,
            )
        elif witness_id == "pol_balcerowicz_nowakowska_1999":
            pages = extract_polish_pages(source_path, first_page, last_page)
        elif witness_id == "hun_szanyi_2015":
            pages = extract_szanyi_pages(source_path, first_page, last_page)
        else:
            pages = extract_pypdf_pages(
                source_path,
                witness_id,
                first_page,
                last_page,
            )
        metadata = write_witness(
            args.output_dir,
            witness_id,
            source_path,
            pages,
        )
        manifest.append(metadata)

        if witness_id == "san_ruzsa_szegedi_2015":
            reading_pages = extract_ruzsa_reading_text(
                source_path,
                first_page,
                last_page,
            )
            reading_text = "\n\n".join(
                page["text"] for page in reading_pages if page["text"]
            ).strip()
            witness_dir = args.output_dir / witness_id
            (witness_dir / "reading-text.txt").write_text(
                reading_text + "\n",
                encoding="utf-8",
            )
            (witness_dir / "reading-pages.json").write_text(
                json.dumps(reading_pages, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    (args.output_dir / "additional-witnesses-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for item in manifest:
        print(
            f"{item['id']}: {item['wordCount']} words, "
            f"PDF pages {item['pdfPages']['first']}–{item['pdfPages']['last']}"
        )


if __name__ == "__main__":
    main()
