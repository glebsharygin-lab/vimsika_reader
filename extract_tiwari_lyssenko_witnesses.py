import argparse
import json
import re
import statistics
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


TIWARI_CITATION = (
    "Mahesh Tiwari, ed. and trans., Vijñaptimātratāsiddhiḥ: "
    "Viṃśatikā-Triṃśikābhidhāna-prakaraṇadvayātmikā, "
    "Chaukhambha Vidyabhavan, Varanasi, 1995."
)

LYSSENKO_CITATION = (
    "В. Г. Лысенко, Индийские философы о природе восприятия: "
    "Дигнага и его оппоненты. Тексты и исследования, 2022."
)

RIGHTS_STATUS = "Rights status requires verification before public redistribution"

TIWARI_SANSKRIT_SLICES = {
    1: [(45, 2, 3)],
    2: [(45, 4, 5)],
    3: [(45, 6, 7)],
    4: [(45, 8, 8), (45, 10, 10)],
    5: [(45, 11, 12)],
    6: [(45, 13, 14)],
    7: [(45, 15, 15), (45, 17, 17)],
    8: [(45, 18, 19)],
    9: [(45, 26, 27)],
    10: [(45, 28, 29)],
    11: [(45, 30, 31)],
    12: [(45, 32, 33)],
    13: [(45, 34, 35)],
    14: [(45, 36, 37)],
    15: [(45, 38, 39)],
    16: [(45, 40, 41)],
    17: [(45, 42, 43)],
    18: [(45, 44, 45)],
    19: [(45, 46, 47)],
    20: [(45, 48, 49)],
    21: [(46, 2, 3)],
    22: [(46, 4, 5)],
}

TIWARI_HINDI_STARTS = {
    1: (1, 1),
    2: (2, 2),
    3: (3, 16),
    4: (4, 17),
    5: (6, 5),
    6: (6, 42),
    7: (7, 54),
    8: (8, 11),
    9: (9, 3),
    10: (9, 43),
    11: (11, 23),
    12: (12, 47),
    13: (13, 36),
    14: (14, 5),
    15: (15, 43),
    16: (17, 3),
    17: (17, 37),
    18: (19, 19),
    19: (20, 22),
    20: (21, 9),
    21: (22, 14),
    22: (23, 7),
}

LYSSENKO_STARTS = {
    1: (83, 1),
    2: (84, 6),
    3: (86, 1),
    4: (87, 1),
    5: (88, 3),
    6: (89, 3),
    7: (90, 2),
    8: (91, 1),
    9: (91, 6),
    10: (92, 2),
    11: (94, 1),
    12: (95, 2),
    13: (96, 3),
    14: (97, 1),
    15: (99, 1),
    16: (100, 3),
    17: (101, 2),
    18: (103, 3),
    19: (104, 4),
    20: (105, 2),
    21: (106, 7),
    22: (107, 3),
}

HINDI_WORDS = {
    "अतः",
    "अथवा",
    "अर्थ",
    "और",
    "कर",
    "करता",
    "करते",
    "करना",
    "कारण",
    "का",
    "कि",
    "की",
    "किया",
    "किस",
    "किसी",
    "के",
    "कैसे",
    "को",
    "क्यों",
    "क्या",
    "गया",
    "गयी",
    "जाता",
    "जाती",
    "जिस",
    "जो",
    "तो",
    "था",
    "थी",
    "थे",
    "द्वारा",
    "नहीं",
    "पर",
    "प्रकार",
    "प्रश्न",
    "फिर",
    "बिना",
    "भी",
    "में",
    "यदि",
    "यह",
    "ये",
    "रूप",
    "लिए",
    "लेकिन",
    "वह",
    "वहाँ",
    "विषय",
    "से",
    "सभी",
    "सकता",
    "सकते",
    "समान",
    "समझना",
    "इस",
    "इसका",
    "इसलिए",
    "इसी",
    "उस",
    "उसका",
    "उसी",
    "उत्तर",
    "उन",
    "उनके",
    "एक",
    "ऐसा",
    "हो",
    "है",
    "हैं",
    "होता",
    "होती",
    "होते",
}

HINDI_OCR_FRAGMENTS = (
    " क्यो",
    " कसे",
    " हृए",
    " होताद",
    " होतीद",
    " नदीं",
    " श्रथ",
    " एेस",
    " रेता",
    " दै",
    " टै",
    " टे",
)


def normalize(text):
    replacements = {
        "\u00a0": " ",
        "\u00ad": "",
        "\u200c": "",
        "\u200d": "",
        "\ufeff": "",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    return unicodedata.normalize("NFC", text)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def line_text(line):
    return normalize(" ".join((word.text or "") for word in line.findall(".//WORD"))).strip()


def object_lines(root):
    pages = []
    for obj in root.findall(".//OBJECT"):
        pages.append([text for line in obj.findall(".//LINE") if (text := line_text(line))])
    return pages


def split_tiwari_spread(obj, split_x=3300):
    sides = {"L": [], "R": []}
    for line in obj.findall(".//LINE"):
        groups = {"L": [], "R": []}
        coordinates = {"L": [], "R": []}
        for word in line.findall(".//WORD"):
            coords = [int(value) for value in word.attrib["coords"].split(",")]
            side = "L" if (coords[0] + coords[2]) / 2 < split_x else "R"
            groups[side].append((coords[0], normalize(word.text or "")))
            coordinates[side].append(coords)
        for side in ("L", "R"):
            if not groups[side]:
                continue
            text = " ".join(value for _, value in sorted(groups[side])).strip()
            if not text:
                continue
            y_position = max(coords[1] for coords in coordinates[side])
            x_position = min(coords[0] for coords in coordinates[side])
            sides[side].append((y_position, x_position, text))
    return {
        side: [text for _, _, text in sorted(rows)]
        for side, rows in sides.items()
    }


def tiwari_printed_pages(root):
    objects = root.findall(".//OBJECT")
    pages = []
    for leaf in range(33, 46):
        sides = split_tiwari_spread(objects[leaf])
        selected_sides = ("R",) if leaf == 33 else ("L", "R")
        for side in selected_sides:
            pages.append(
                {
                    "printedPage": len(pages) + 1,
                    "ocrLeaf": leaf,
                    "spreadSide": side,
                    "lines": sides[side],
                }
            )
    return pages


def clean_tiwari_sanskrit(text):
    text = re.sub(r"\s+", " ", normalize(text)).strip()
    text = text.replace("।।", "॥")
    return text


def extract_tiwari_sanskrit(root):
    pages = object_lines(root)
    passages = []
    for verse, slices in TIWARI_SANSKRIT_SLICES.items():
        lines = []
        for leaf, first_line, last_line in slices:
            lines.extend(pages[leaf][first_line - 1 : last_line])
        if verse == 22:
            lines[0] = lines[0].split("।", 1)[0].strip() + " ।"
            lines[-1] = lines[-1].split("॥", 1)[0].strip() + " ॥ २२ ॥"
        passages.append(
            {
                "verse": verse,
                "text": "\n".join(clean_tiwari_sanskrit(line) for line in lines),
                "status": "machine-extracted-ocr",
                "method": "numbered-karika-appendix-layout-slices-v1",
                "note": (
                    "Extracted from the numbered Sanskrit kārikā appendix on printed "
                    "pages 25–26. Devanagari OCR requires line-by-line proofing against the scan."
                ),
            }
        )
    return passages


def devnagari_count(text):
    return sum("\u0900" <= character <= "\u097f" for character in text)


def is_hindi_line(text):
    text = normalize(text).strip()
    if devnagari_count(text) < 4:
        return False
    if len(re.sub(r"[\W_०-९]", "", text, flags=re.UNICODE)) < 4:
        return False
    if "विज्ञ" in text and ("सिद्धि" in text or "प्रकरणवृत्ति" in text) and len(text) < 55:
        return False
    tokens = [
        token.strip("।॥()[]{}'\"“”‘’.,;:!?-—–|/\\")
        for token in re.split(r"\s+", text)
    ]
    score = sum(token in HINDI_WORDS for token in tokens)
    has_ocr_hindi = any(fragment in f" {text}" for fragment in HINDI_OCR_FRAGMENTS)
    if score >= 2 or has_ocr_hindi:
        return True
    if len(tokens) >= 7 and any(text.endswith(ending) for ending in (" है", " हे", " दै", " टै", " टे")):
        return True
    return False


def join_ocr_lines(lines):
    output = []
    for raw_line in lines:
        line = re.sub(r"\s+", " ", normalize(raw_line)).strip()
        if not line:
            continue
        if output and output[-1].endswith("-") and line[:1].islower():
            output[-1] = output[-1][:-1] + line
        else:
            output.append(line)
    return "\n".join(output).strip()


def extract_tiwari_hindi(printed_pages):
    positions = []
    page_lines = {}
    for page in printed_pages[:23]:
        page_number = page["printedPage"]
        page_lines[page_number] = page["lines"]
        positions.extend((page_number, index, text) for index, text in enumerate(page["lines"], 1))

    starts = {verse: positions.index(next(item for item in positions if item[:2] == position)) for verse, position in TIWARI_HINDI_STARTS.items()}
    passages = []
    for verse in range(1, 23):
        first = starts[verse]
        last = starts.get(verse + 1, len(positions))
        source_lines = [text for _, _, text in positions[first:last]]
        hindi_lines = [line for line in source_lines if is_hindi_line(line)]
        text = join_ocr_lines(hindi_lines)
        passages.append(
            {
                "verse": verse,
                "text": text,
                "status": "machine-extracted-ocr",
                "method": "spread-reconstruction-and-hindi-line-classification-v1",
                "note": (
                    "Preliminary Hindi extraction from printed pages 1–24. Sanskrit lines, "
                    "running heads, and most apparatus lines were removed heuristically; "
                    "OCR and verse boundaries require scholarly proofing."
                ),
            }
        )
    return passages


def russian_blocks(obj):
    blocks = []
    hidden_text = obj.find("HIDDENTEXT")
    if hidden_text is None:
        return blocks
    for column in hidden_text.findall("PAGECOLUMN"):
        rows = []
        heights = []
        y_positions = []
        for line in column.findall(".//LINE"):
            words = line.findall(".//WORD")
            text = line_text(line)
            if not words or not text:
                continue
            coords = [int(value) for value in words[0].attrib["coords"].split(",")]
            rows.append(text)
            y_positions.append(coords[1])
            heights.append(coords[1] - coords[3])
        if rows:
            blocks.append(
                {
                    "lines": rows,
                    "startY": min(y_positions),
                    "medianHeight": statistics.median(heights),
                }
            )
    footnote_start = len(blocks)
    for index, block in enumerate(blocks):
        if (
            block["startY"] >= 2800
            and len(block["lines"]) >= 10
            and block["medianHeight"] <= 67
        ):
            footnote_start = index
            break
    return blocks[:footnote_start]


def clean_russian_block(lines):
    selected = []
    for line in lines:
        line = re.sub(r"\s+", " ", normalize(line)).strip()
        line = line.replace("Внм", "Вим")
        if not line or re.fullmatch(r"[\d\W_]+", line, flags=re.UNICODE):
            continue
        cyrillic = sum("\u0400" <= character <= "\u04ff" for character in line)
        letters = sum(character.isalpha() for character in line)
        if letters and cyrillic / letters < 0.3:
            continue
        selected.append(line)
    return join_ocr_lines(selected)


def extract_lyssenko(root):
    objects = root.findall(".//OBJECT")
    records = []
    for leaf in range(83, 108):
        for block_index, block in enumerate(russian_blocks(objects[leaf]), 1):
            text = clean_russian_block(block["lines"])
            if text:
                records.append((leaf, block_index, text))

    starts = {
        verse: records.index(next(item for item in records if item[:2] == position))
        for verse, position in LYSSENKO_STARTS.items()
    }
    passages = []
    for verse in range(1, 23):
        first = starts[verse]
        last = starts.get(verse + 1, len(records))
        text = "\n\n".join(record[2] for record in records[first:last]).strip()
        passages.append(
            {
                "verse": verse,
                "text": text,
                "status": "machine-extracted-ocr",
                "method": "djvu-layout-blocks-and-karika-boundaries-v1",
                "note": (
                    "Extracted from OCR leaves 83–107. Translator footnotes were excluded "
                    "using page-layout blocks; OCR spellings and internal section boundaries "
                    "require scholarly proofing."
                ),
            }
        )
    pages = [
        {
            "ocrLeaf": leaf,
            "text": "\n\n".join(
                text
                for block in russian_blocks(objects[leaf])
                if (text := clean_russian_block(block["lines"]))
            ),
        }
        for leaf in range(83, 108)
    ]
    return passages, pages


def witness_text(passages):
    return "\n\n".join(
        f"VERSE {passage['verse']}\n{passage['text']}" for passage in passages
    ) + "\n"


def metadata(source_id, label, language, language_code, script, role, citation, source_file, primary_output, engine, status, passages):
    text = "\n".join(passage["text"] for passage in passages)
    return {
        "id": source_id,
        "label": label,
        "language": language,
        "languageCode": language_code,
        "script": script,
        "role": role,
        "citation": citation,
        "rights": RIGHTS_STATUS,
        "sourceFileName": source_file,
        "primaryOutput": primary_output,
        "extractionEngine": engine,
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "characterCount": len(text),
        "wordCount": len(text.split()),
    }


def save_witness(output_dir, source_id, primary_name, passages, pages, meta):
    witness_dir = output_dir / source_id
    witness_dir.mkdir(parents=True, exist_ok=True)
    write_json(witness_dir / "metadata.json", meta)
    write_json(witness_dir / "pages.json", pages)
    write_json(witness_dir / "passages.json", passages)
    (witness_dir / primary_name).write_text(witness_text(passages), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tiwari-xml", type=Path, required=True)
    parser.add_argument("--lyssenko-xml", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("source-witnesses"))
    args = parser.parse_args()

    tiwari_root = ET.parse(args.tiwari_xml).getroot()
    lyssenko_root = ET.parse(args.lyssenko_xml).getroot()

    printed_pages = tiwari_printed_pages(tiwari_root)
    sanskrit_passages = extract_tiwari_sanskrit(tiwari_root)
    hindi_passages = extract_tiwari_hindi(printed_pages)
    russian_passages, russian_pages = extract_lyssenko(lyssenko_root)

    save_witness(
        args.output_dir,
        "san_tiwari_1995",
        "edition.txt",
        sanskrit_passages,
        [
            {
                "ocrLeaf": page["ocrLeaf"],
                "text": "\n".join(object_lines(tiwari_root)[page["ocrLeaf"]]),
            }
            for page in ({"ocrLeaf": 45}, {"ocrLeaf": 46})
        ],
        metadata(
            "san_tiwari_1995",
            "Sanskrit · Tiwari 1995",
            "Sanskrit",
            "san",
            "Devanagari",
            "edition",
            TIWARI_CITATION,
            "Internet Archive DjVu OCR",
            "edition.txt",
            "Internet Archive DjVu OCR with manual appendix line slices",
            "machine-extracted Sanskrit kārikās; requires proofing against the scan",
            sanskrit_passages,
        ),
    )

    save_witness(
        args.output_dir,
        "hin_tiwari_1995",
        "translation.txt",
        hindi_passages,
        [
            {
                "printedPage": page["printedPage"],
                "ocrLeaf": page["ocrLeaf"],
                "spreadSide": page["spreadSide"],
                "text": "\n".join(page["lines"]),
            }
            for page in printed_pages[:24]
        ],
        metadata(
            "hin_tiwari_1995",
            "Hindi · Tiwari 1995",
            "Hindi",
            "hin",
            "Devanagari",
            "modern-translation",
            TIWARI_CITATION,
            "Internet Archive DjVu OCR",
            "translation.txt",
            "Internet Archive DjVu OCR with spread reconstruction and language filtering",
            "preliminary Hindi translation extraction; OCR and segmentation require proofing",
            hindi_passages,
        ),
    )

    save_witness(
        args.output_dir,
        "rus_lyssenko_2022",
        "translation.txt",
        russian_passages,
        russian_pages,
        metadata(
            "rus_lyssenko_2022",
            "Russian · Lyssenko 2022",
            "Russian",
            "rus",
            "Cyrillic",
            "modern-translation",
            LYSSENKO_CITATION,
            "Индийские философы о природе восприятия … (2022).djvu",
            "translation.txt",
            "Internet Archive DjVu OCR with page-layout block filtering",
            "machine-extracted revised Russian translation and commentary; requires proofing",
            russian_passages,
        ),
    )

    print(
        json.dumps(
            {
                "san_tiwari_1995": len(sanskrit_passages),
                "hin_tiwari_1995": len(hindi_passages),
                "rus_lyssenko_2022": len(russian_passages),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
