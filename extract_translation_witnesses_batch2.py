import argparse
import json
import re
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from lxml import etree
from pypdf import PdfReader


RIGHTS = "Cleared by project owner for this research corpus"

WITNESSES = {
    "rus_lyssenko_2008": {
        "label": "Russian · Lyssenko 2008",
        "language": "Russian",
        "languageCode": "rus",
        "role": "modern-translation",
        "citation": (
            "В. Г. Лысенко, пер. и прим., «Вимшатика-карика-вритти. "
            "Комментарий к двадцатистишию», Вопросы философии 1 (2008), 113–131."
        ),
        "pages": (1, 16),
        "engine": "pypdf custom Cyrillic-font recovery",
        "status": (
            "machine-extracted from a custom Cyrillic text layer; "
            "bracket glyphs and transliteration require scholarly proofing"
        ),
    },
    "jpn_yuda_issue32": {
        "label": "Japanese · Yuda",
        "language": "Japanese",
        "languageCode": "jpn",
        "role": "modern-translation",
        "citation": (
            "湯田豊, 「ヴァスバンドゥの『唯識二十論』—新しい翻訳および解説」, "
            "『法華文化研究』32."
        ),
        "pages": (1, 15),
        "engine": "pypdf Shift-JIS legacy-font recovery",
        "status": (
            "machine-recovered from a legacy Japanese text layer; "
            "layout order, punctuation, and Sanskrit forms require scholarly proofing"
        ),
    },
    "eng_kochumuttom_1982": {
        "label": "English · Kochumuttom 1982",
        "language": "English",
        "languageCode": "eng",
        "role": "modern-translation",
        "citation": (
            "Thomas A. Kochumuttom, A Buddhist Doctrine of Experience: "
            "A New Translation and Interpretation of the Works of Vasubandhu "
            "the Yogācārin, Motilal Banarsidass, 1982."
        ),
        "pages": (25, 32),
        "engine": "pypdf searchable text layer",
        "status": "machine-extracted full translation and auto-commentary; requires proofing",
    },
    "fra_cornu_2008": {
        "label": "French · Cornu 2008",
        "language": "French",
        "languageCode": "fra",
        "role": "modern-translation",
        "citation": (
            "Philippe Cornu, trans., Cinq traités sur l’esprit seulement, "
            "Fayard, 2008."
        ),
        "engine": "EPUB XHTML structure",
        "status": "structured EPUB extraction of the translation and auto-commentary",
    },
    "eng_wood_1991": {
        "label": "English · Wood 1991",
        "language": "English",
        "languageCode": "eng",
        "role": "modern-translation",
        "citation": (
            "Thomas E. Wood, Mind Only: A Philosophical and Doctrinal Analysis "
            "of the Vijñānavāda, University of Hawai‘i Press, 1991."
        ),
        "pages": (113, 118),
        "engine": "pypdf searchable text layer",
        "status": "machine-extracted verse translation; accompanying Sanskrit removed during segmentation",
    },
    "eng_cook_1999": {
        "label": "English · Cook 1999",
        "language": "English",
        "languageCode": "eng",
        "role": "modern-translation-from-chinese",
        "citation": (
            "Francis H. Cook, trans., “The Treatise in Twenty Verses on "
            "Consciousness Only,” in Three Texts on Consciousness Only, "
            "Numata Center for Buddhist Translation and Research, 1999."
        ),
        "pages": (7, 24),
        "engine": "pypdf OCR text layer",
        "status": (
            "machine-extracted English translation from Xuanzang’s Chinese; "
            "OCR punctuation and transliteration require proofing"
        ),
    },
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


def clean_pdf_page(text, witness_id):
    text = normalize(text).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            lines.append("")
            continue
        if re.fullmatch(r"\d{1,3}", line):
            continue
        if witness_id == "rus_lyssenko_2008":
            if re.fullmatch(r"стр\.\s*\d+", line, flags=re.IGNORECASE):
                continue
        elif witness_id == "jpn_yuda_issue32":
            if "法華文化研究" in line and len(line) < 90:
                continue
            if "ヴァスバンドゥ" in line and "湯田" in line and len(line) < 90:
                continue
        elif witness_id == "eng_kochumuttom_1982":
            if re.fullmatch(r"\d{3}\s+A Buddhist Doctrine .*", line):
                continue
            if re.fullmatch(r"A Treat\w* in Twenty Stanzas\s+\d{3}", line):
                continue
        elif witness_id == "eng_wood_1991":
            if re.fullmatch(r"\d+\s+Mind Only", line):
                continue
            if line == "Mind Only":
                continue
            if "Cheng wei shilun" in line and len(line) < 90:
                continue
            if line.startswith("THE TWENTY VERSES"):
                continue
        elif witness_id == "eng_cook_1999":
            if line == "Twenty Verses on Consciousness Only":
                continue
            if line.startswith("PDF compression, OCR, web optimization"):
                continue
        lines.append(line)
    return compact_lines(lines)


def recover_russian_text(text):
    output = []
    encoded = bytearray()

    def flush():
        nonlocal encoded
        if encoded:
            output.append(encoded.decode("cp1251", errors="replace"))
            encoded = bytearray()

    for character in text:
        codepoint = ord(character)
        if 0x17A <= codepoint <= 0x279:
            encoded.append(codepoint - 0x17A)
        else:
            flush()
            output.append(character)
    flush()
    recovered = "".join(output)
    recovered = re.sub(
        r"Д(?=(?:Васубандху|Оппонент|Возражение|Ответ|Тезис|Критика|Познание)[^\]\n]*\])",
        "[",
        recovered,
    )
    return recovered


def recover_japanese_text(text):
    encoded = bytearray()
    for character in text:
        codepoint = ord(character)
        if codepoint <= 255:
            encoded.append(codepoint)
        else:
            encoded.extend(character.encode("cp932", errors="replace"))
    return encoded.decode("cp932", errors="replace")


def extract_pdf_pages(path, witness_id, first_page, last_page, decoder=None):
    reader = PdfReader(str(path), strict=False)
    pages = []
    for page_number in range(first_page, last_page + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        if decoder:
            text = decoder(text)
        pages.append(
            {
                "pdfPage": page_number,
                "text": clean_pdf_page(text, witness_id),
            }
        )
    return pages


def truncate_russian(text):
    marker = "Создан Учителем Васубандху"
    position = text.find(marker)
    if position >= 0:
        return text[: position + len(marker)].strip()
    return text.strip()


def truncate_japanese(text):
    match = re.search(r"〔\s*註\s*〕", text)
    if match:
        return text[: match.start()].strip()
    return text.strip()


def extract_cornu_blocks(path):
    with zipfile.ZipFile(path) as archive:
        raw = archive.read("OEBPS/Text/part0006.html")
    root = etree.fromstring(raw)
    namespaces = {"x": "http://www.w3.org/1999/xhtml"}
    blocks = []
    elements = root.xpath(
        "//x:h1|//x:h2|//x:h3|//x:div[@class='fmp']",
        namespaces=namespaces,
    )
    for element in elements:
        text = " ".join("".join(element.itertext()).split())
        if not text:
            continue
        blocks.append(
            {
                "index": len(blocks),
                "element": element.tag.split("}")[-1],
                "class": element.get("class", ""),
                "text": normalize(text),
            }
        )
    return blocks


def write_witness(output_root, witness_id, source_path, text, pages=None, blocks=None):
    config = WITNESSES[witness_id]
    witness_dir = output_root / witness_id
    witness_dir.mkdir(parents=True, exist_ok=True)
    (witness_dir / "translation.txt").write_text(
        text.strip() + "\n",
        encoding="utf-8",
    )
    if pages is not None:
        (witness_dir / "pages.json").write_text(
            json.dumps(pages, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if blocks is not None:
        (witness_dir / "blocks.json").write_text(
            json.dumps(blocks, ensure_ascii=False, indent=2) + "\n",
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
        "primaryOutput": "translation.txt",
        "extractionEngine": config["engine"],
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "status": config["status"],
        "characterCount": len(text),
        "wordCount": len(re.findall(r"\S+", text)),
    }
    if "pages" in config:
        metadata["pdfPages"] = {
            "first": config["pages"][0],
            "last": config["pages"][1],
        }
    (witness_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def combined_page_text(pages):
    return "\n\n".join(page["text"] for page in pages if page["text"]).strip()


def main():
    parser = argparse.ArgumentParser(
        description="Extract the second batch of Viṃśikā translation witnesses."
    )
    parser.add_argument("--lyssenko", type=Path, required=True)
    parser.add_argument("--japanese", type=Path, required=True)
    parser.add_argument("--kochumuttom", type=Path, required=True)
    parser.add_argument("--cornu", type=Path, required=True)
    parser.add_argument("--wood", type=Path, required=True)
    parser.add_argument("--cook", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("source-witnesses"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    pdf_jobs = [
        ("rus_lyssenko_2008", args.lyssenko, recover_russian_text, truncate_russian),
        ("jpn_yuda_issue32", args.japanese, recover_japanese_text, truncate_japanese),
        ("eng_kochumuttom_1982", args.kochumuttom, None, lambda text: text.strip()),
        ("eng_wood_1991", args.wood, None, lambda text: text.strip()),
        ("eng_cook_1999", args.cook, None, lambda text: text.strip()),
    ]
    for witness_id, source_path, decoder, finalizer in pdf_jobs:
        config = WITNESSES[witness_id]
        pages = extract_pdf_pages(
            source_path,
            witness_id,
            config["pages"][0],
            config["pages"][1],
            decoder=decoder,
        )
        text = finalizer(combined_page_text(pages))
        manifest.append(
            write_witness(
                args.output_dir,
                witness_id,
                source_path,
                text,
                pages=pages,
            )
        )

    cornu_blocks = extract_cornu_blocks(args.cornu)
    cornu_text = "\n\n".join(
        block["text"]
        for block in cornu_blocks
        if block["index"] >= 18
    )
    manifest.append(
        write_witness(
            args.output_dir,
            "fra_cornu_2008",
            args.cornu,
            cornu_text,
            blocks=cornu_blocks,
        )
    )

    (args.output_dir / "translation-witnesses-batch2-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for item in manifest:
        print(f"{item['id']}: {item['wordCount']} words")


if __name__ == "__main__":
    main()
