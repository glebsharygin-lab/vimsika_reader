import argparse
import json
import re
from pathlib import Path


VERSE_NUMBERS = range(1, 23)

JAPANESE_PATTERNS = {
    1: r"大乗において",
    2: r"もしも、知覚が",
    3: r"良く知られているように",
    4: r"一切の効用を生み出す作用は",
    5: r"動物／畜生は、天に生まれるように",
    6: r"もしも、彼ら",
    7: r"行為の薫習",
    8: r"このように形",
    9: r"それから［識",
    10: r"実に、個人に自己の存在しない",
    11: r"感覚対象は一つでもなければ",
    12: r"六\s+個",
    13: r"原子が結合しない",
    14: r"方角の、区分が存在する",
    15: r"単一の場合",
    16: r"知覚による認識は",
    17: r"どのようにして、識／知覚がそれの出現",
    18: r"は相\s*互的\s*であ\s*る\s*相\s*互\s*に支\s*配的",
    19: r"死\s+ぬことは",
    20: r"あるいは、どうして、聖仙",
    21: r"他人のチッタを知っている人は",
    22: r"み\s*ず\s*から自身の能力に応じて",
}

KOCHUMUTTOM_PATTERNS = {
    1: r"^\s*1\.\s+It is",
    2: r"^\s*2\.\s+If the",
    3: r"^\s*3\.\s+Determination",
    4: r"^\s*4\.\s+Determined actions",
    5: r"^\s*5\.\s+Animals",
    6: r"^\s*6\.\s+If the birth",
    7: r"^\s*7\.\s+An impression",
    8: r"^\s*8\.\s+It was",
    9: r"^\s*9\.\s+What the sage",
    10: r"^\s*10\.\s+By this",
    11: r"^\s*1\s+1\.\s+The object",
    12: r"^\s*12\.\s+One atom",
    13: r"^\s*13\.\s+As there is no joining",
    14: r"^\s*14\.\s+['‘]?That which has different parts",
    15: r"^\s*15\.\s+",
    16: r"^\s*16\.\s+Perception",
    17: r"^\s*17\.\s+It has",
    18: r"^\s*18\.\s+The representations",
    19: r"^\s*19\.\s+Death",
    20: r"^\s*20\.\s+Otherwise",
    21: r"^\s*21\.\s+Knowledge",
    22: r"^\s*22,?\.\s+This treatise",
}

COOK_PATTERNS = {
    1: r"The three realms are consciousness only",
    2: r"If consciousness is without real objects of perception",
    3: r"Time and place are restricted as in dreams",
    4: r"All \[four concepts",
    5: r"What is true of animals in the celestial realm",
    6: r"If you admit that as a result of the power of action",
    7: r"Perfuming \([^)]*\) of action is in one place",
    8: r"For those beings to be instructed",
    9: r"Consciousness is born from its own seeds",
    10: r"On the basis of this teaching one can enter",
    11: r"That object of perception is not one thing",
    12: r"If an atom is united with six",
    13: r"Since atoms do not unite",
    14: r"If an atom has parts",
    15: r"In the case of unity, there would be no piecemeal going",
    16: r"Direct awareness is as in dreams",
    17: r"As we have said, there is consciousness that resembles",
    18: r"By means of the interchange of dominant power",
    19: r"As a result of the transformation of another.s\s+consciousness",
    20: r"The emptiness of the Dandaka",
    21: r"How does knowledge of others. minds",
    22: r"According to my ability",
}

WOOD_SANSKRIT_STARTS = {
    1: r"^\[\s*vij",
    2: r"^yadi ",
    3: r"^def",
    4: r"^svapnop",
    5: r"^tiras",
    6: r"^yadi tat",
    7: r"^kanna",
    8: r"^n.",
    9: r"^yata",
    10: r"^tath",
    11: r"^na tad",
    12: r"^\$at",
    13: r"^param",
    14: r"^dig",
    15: r"^ekatve",
    16: r"^praty",
    17: r"^ukt",
    18: r"^anyon",
    19: r"^mar",
    20: r"^katha",
    21: r"^para",
    22: r"^vij",
}

CORNU_COMMENTARY_RANGES = {
    1: (111, 113),
    2: (114, 117),
    3: (118, 121),
    4: (122, 124),
    5: (125, 128),
    6: (129, 130),
    7: (131, 131),
    8: (132, 134),
    9: (135, 135),
    10: (136, 140),
    11: (141, 143),
    12: (144, 145),
    13: (146, 147),
    14: (148, 153),
    15: (154, 160),
    16: (161, 165),
    17: (166, 171),
    18: (172, 174),
    19: (175, 176),
    20: (177, 178),
    21: (179, 182),
    22: (183, 184),
}


def clean_text(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def segment_by_patterns(text, patterns, method, first_start=None, flags=None):
    search_flags = flags if flags is not None else re.IGNORECASE | re.MULTILINE
    positions = {}
    cursor = 0
    for number in VERSE_NUMBERS:
        match = re.compile(patterns[number], flags=search_flags).search(text, cursor)
        if not match:
            raise ValueError(f"Could not locate verse {number}: {patterns[number]}")
        positions[number] = match.start()
        cursor = match.start() + 1
    if first_start is not None:
        positions[1] = first_start
    return [
        {
            "verse": number,
            "text": clean_text(
                text[positions[number] : positions.get(number + 1, len(text))]
            ),
            "status": "machine-segmented",
            "method": method,
        }
        for number in VERSE_NUMBERS
    ]


def segment_russian(text):
    patterns = {
        number: rf"^\s*{number}(?:[^0-9\s.]{{0,5}})?\."
        for number in VERSE_NUMBERS
    }
    intro = re.search(r"В махаяне", text, flags=re.IGNORECASE)
    if not intro:
        raise ValueError("Could not locate the Russian introduction")
    passages = segment_by_patterns(
        text,
        patterns,
        "translator-karika-number-boundaries-v1",
        first_start=intro.start(),
    )
    for passage in passages:
        passage["status"] = "machine-segmented-legacy-font-recovery"
        passage["note"] = (
            "The Russian text layer was recovered from a custom font. "
            "Bracket glyphs and transliteration require scholarly proofing."
        )
    return passages


def segment_japanese(text):
    passages = segment_by_patterns(
        text,
        JAPANESE_PATTERNS,
        "semantic-karika-opening-boundaries-v1",
        flags=re.MULTILINE,
    )
    moved = re.search(
        r"(夢において、チッタ.*?存在することが.*?ではない。)",
        passages[18]["text"],
        flags=re.DOTALL,
    )
    if moved:
        passages[17]["text"] = clean_text(
            passages[17]["text"] + "\n\n" + moved.group(1)
        )
        passages[18]["text"] = clean_text(
            passages[18]["text"].replace(moved.group(1), "", 1)
        )
    for passage in passages:
        passage["status"] = "machine-segmented-legacy-font-recovery"
        passage["note"] = (
            "The Japanese text was recovered from a legacy Shift-JIS PDF layer. "
            "Several page-layout sequences, punctuation marks, and Sanskrit forms "
            "require manual Japanese scholarly proofing."
        )
    return passages


def segment_kochumuttom(text):
    intro = re.search(r"In the Mah.y.na system", text, flags=re.IGNORECASE)
    if not intro:
        raise ValueError("Could not locate the Kochumuttom introduction")
    passages = segment_by_patterns(
        text,
        KOCHUMUTTOM_PATTERNS,
        "translator-numbered-karika-boundaries-v1",
        first_start=intro.start(),
    )
    for passage in passages:
        passage["status"] = "machine-segmented-full-translation"
        passage["note"] = (
            "Full English translation and auto-commentary; OCR typography "
            "and Sanskrit transliteration require proofing."
        )
    return passages


def segment_wood(text):
    markers = list(re.finditer(r"(?m)^\s*(\d{1,2})\.\s+", text))
    positions = {}
    for marker in markers:
        number = int(marker.group(1))
        if number in VERSE_NUMBERS and number not in positions:
            positions[number] = marker.start()
    missing = [number for number in VERSE_NUMBERS if number not in positions]
    if missing:
        raise ValueError(f"Wood extraction is missing verse markers: {missing}")

    passages = []
    for number in VERSE_NUMBERS:
        segment = text[positions[number] : positions.get(number + 1, len(text))]
        segment = re.sub(rf"^\s*{number}\.\s*", "", segment, count=1)
        sanskrit = re.search(
            WOOD_SANSKRIT_STARTS[number],
            segment,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        if not sanskrit:
            raise ValueError(f"Could not locate Wood Sanskrit line for verse {number}")
        english = clean_text(segment[: sanskrit.start()])
        english = re.sub(
            r"\b\d{2,3}\s+(?:Mind Only|Mirui Only)\b",
            "",
            english,
        )
        english = re.sub(
            r"\bV\S+\s+and Cheng wei shilun\s+\d+\b",
            "",
            english,
        )
        english = clean_text(english)
        passages.append(
            {
                "verse": number,
                "text": english,
                "status": "machine-segmented-verse-translation",
                "method": "numbered-verse-paragraphs-with-sanskrit-removed-v1",
                "note": (
                    "Wood supplies a verse translation here; the following printed "
                    "Sanskrit and surrounding chapter analysis are excluded."
                ),
            }
        )
    return passages


def segment_cook(text):
    passages = segment_by_patterns(
        text,
        COOK_PATTERNS,
        "xuanzang-semantic-karika-boundaries-v1",
    )
    for passage in passages:
        passage["status"] = "machine-segmented-chinese-based-translation"
        passage["note"] = (
            "Cook translates Xuanzang’s Chinese T1590. Xuanzang’s twenty-one "
            "numbered verses are mapped here to the shell’s twenty-two Sanskrit "
            "passages by content."
        )
    return passages


def cornu_root_ranges():
    starts = {number: 20 + (number - 1) * 4 for number in VERSE_NUMBERS}
    starts[1] = 19
    return {
        number: (
            starts[number],
            starts.get(number + 1, 108) - 1,
        )
        for number in VERSE_NUMBERS
    }


def segment_cornu(blocks):
    by_index = {int(block["index"]): block["text"] for block in blocks}
    root_ranges = cornu_root_ranges()
    passages = []
    for number in VERSE_NUMBERS:
        root_start, root_end = root_ranges[number]
        commentary_start, commentary_end = CORNU_COMMENTARY_RANGES[number]
        root_text = "\n".join(
            by_index[index]
            for index in range(root_start, root_end + 1)
            if index in by_index
        )
        commentary_text = "\n\n".join(
            by_index[index]
            for index in range(commentary_start, commentary_end + 1)
            if index in by_index
        )
        passages.append(
            {
                "verse": number,
                "text": clean_text(root_text + "\n\n" + commentary_text),
                "status": "structured-epub-segmentation",
                "method": "epub-root-verse-and-autocommentary-block-map-v1",
                "note": (
                    "Cornu’s French root-verse translation is paired with the "
                    "corresponding section of his translated auto-commentary."
                ),
            }
        )
    return passages


def write_passages(witness_dir, passages):
    missing = [
        passage["verse"]
        for passage in passages
        if not clean_text(passage.get("text", ""))
    ]
    if len(passages) != 22 or missing:
        raise ValueError(
            f"{witness_dir.name}: expected 22 nonempty passages; missing {missing}"
        )
    output_path = witness_dir / "passages.json"
    output_path.write_text(
        json.dumps(passages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Segment the second batch of Viṃśikā translations into verses 1–22."
    )
    parser.add_argument(
        "--source-witnesses",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "source-witnesses",
    )
    args = parser.parse_args()

    text_jobs = {
        "rus_lyssenko_2008": segment_russian,
        "jpn_yuda_issue32": segment_japanese,
        "eng_kochumuttom_1982": segment_kochumuttom,
        "eng_wood_1991": segment_wood,
        "eng_cook_1999": segment_cook,
    }
    for witness_id, segmenter in text_jobs.items():
        witness_dir = args.source_witnesses / witness_id
        text = (witness_dir / "translation.txt").read_text(encoding="utf-8")
        passages = segmenter(text)
        output_path = write_passages(witness_dir, passages)
        print(f"{witness_id}: {len(passages)} passages -> {output_path}")

    witness_dir = args.source_witnesses / "fra_cornu_2008"
    blocks = json.loads((witness_dir / "blocks.json").read_text(encoding="utf-8"))
    passages = segment_cornu(blocks)
    output_path = write_passages(witness_dir, passages)
    print(f"fra_cornu_2008: {len(passages)} passages -> {output_path}")


if __name__ == "__main__":
    main()
