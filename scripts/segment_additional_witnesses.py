import argparse
import json
import re
from pathlib import Path


VERSE_NUMBERS = range(1, 23)
ROMAN = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
    13: "XIII",
    14: "XIV",
    15: "XV",
    16: "XVI",
    17: "XVII",
    18: "XVIII",
    19: "XIX",
    20: "XX",
    21: "XXI",
    22: "XXII",
}

TOLA_MARKERS = {
    1: r"^\[mahayane",
    2: r"^\[Section II:",
    3: r"^na khalu na yujyate yasmat/",
    4: r"^svapnopaghatavat krtyakriya$",
    5: r"^tirascam sambhavah\d* svarge",
    6: r"^yadi tatkarmabhis\d* tatra",
    7: r"^karmano\S*\s+vasananyatra",
    8: r"^rupadyayatanastitvam",
    9: r"^yatah svabijad",
    10: r"^tathapudgalanairatmyapraveso",
    11: r"^na tad ekam na c.nekam",
    12: r"^satkena yugapadyogat",
    13: r"^paramanor asamyoge",
    14: r"^digbhagabhedo",
    15: r"^ekatve na kramenetir",
    16: r"^pratyaksabuddhi",
    17: r"^uktam yatha tadabhasa",
    18: r"^anyo.*dhipatitvena",
    19: r"^maranarr",
    20: r"^katham va dandakaranya",
    21: r"^paracittavid",
    22: r"^vijnaptim.trat.siddhih",
}


def clean_text(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def segment_by_patterns(text, patterns, method, first_start=None):
    positions = {}
    cursor = 0
    for number in VERSE_NUMBERS:
        match = re.compile(
            patterns[number],
            flags=re.IGNORECASE | re.MULTILINE,
        ).search(text, cursor)
        if not match:
            raise ValueError(f"Could not locate verse {number}")
        positions[number] = match.start()
        cursor = match.start() + 1
    if first_start is not None:
        positions[1] = first_start

    passages = []
    for number in VERSE_NUMBERS:
        start = positions[number]
        end = positions.get(number + 1, len(text))
        passages.append(
            {
                "verse": number,
                "text": clean_text(text[start:end]),
                "status": "machine-segmented",
                "method": method,
            }
        )
    return passages


def segment_silk(text):
    passages = segment_by_patterns(
        text,
        {number: rf"^{ROMAN[number]}$" for number in VERSE_NUMBERS},
        "editorial-roman-section-boundaries-v1",
    )
    for passage in passages:
        passage["text"] = re.sub(
            rf"^{ROMAN[passage['verse']]}\s*",
            "",
            passage["text"],
            count=1,
        )
    passages[0]["status"] = "partial-source-text"
    passages[0]["note"] = (
        "Silk's published Sanskrit reading text begins verse I with an ellipsis; "
        "only the surviving supplied portion is represented."
    )
    return passages


def segment_tola(text):
    passages = segment_by_patterns(
        text,
        TOLA_MARKERS,
        "sanskrit-karika-opening-boundaries-v1",
    )
    section_heading = re.compile(
        r"(?ims)^(?:\[|I)?Section\s*[A-Z]+:.*?\]\s*"
    )
    for passage in passages:
        passage["text"] = clean_text(section_heading.sub("", passage["text"]))
    return passages


def segment_numbered_headings(text, method, first_start_pattern=None):
    first_start = None
    if first_start_pattern:
        match = re.search(first_start_pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if not match:
            raise ValueError(f"Could not locate first witness boundary: {first_start_pattern}")
        first_start = match.start()
    passages = segment_by_patterns(
        text,
        {number: rf"^\s*{number}\.\s" for number in VERSE_NUMBERS},
        method,
        first_start=first_start,
    )
    for passage in passages:
        passage["text"] = re.sub(
            rf"(?m)^\s*{passage['verse']}\.\s*",
            "",
            passage["text"],
            count=1,
        )
    return passages


def segment_hungarian(text):
    blocks = [
        clean_text(block)
        for block in re.split(r"\n\s*\n", text)
        if clean_text(block)
    ]
    passages = {number: [] for number in VERSE_NUMBERS}
    current_verse = 1
    for block in blocks:
        matches = re.findall(r"\((\d{1,2})\)\s*$", block)
        if matches:
            current_verse = int(matches[-1])
        passages[current_verse].append(block)

    missing = [number for number in VERSE_NUMBERS if not passages[number]]
    if missing:
        raise ValueError(f"Hungarian extraction is missing verses: {missing}")
    return [
        {
            "verse": number,
            "text": "\n\n".join(passages[number]),
            "status": "machine-segmented-verse-translation",
            "method": "translated-quotation-number-boundaries-v1",
            "note": (
                "Szanyi's translated verse quotation is included. "
                "The surrounding Hungarian analytical article is excluded."
            ),
        }
        for number in VERSE_NUMBERS
    ]


def pending_balcerowicz():
    note = (
        "The supplied Sanskrit edition uses the custom AMRITA Devanagari font. "
        "Unicode transcription is required before this witness can be tokenized."
    )
    return [
        {
            "verse": number,
            "text": "",
            "status": "legacy-encoding-pending",
            "method": "not-segmented-until-unicode-transcription",
            "note": note,
        }
        for number in VERSE_NUMBERS
    ]


def segment_balcerowicz_unicode_draft(text):
    starts = {
        1: 2,
        2: 10,
        3: 20,
        4: 31,
        5: 51,
        6: 66,
        7: 69,
        8: 76,
        9: 91,
        10: 98,
        11: 128,
        12: 145,
        13: 153,
        14: 169,
        15: 197,
        16: 209,
        17: 228,
        18: 250,
        19: 259,
        20: 267,
        21: 280,
        22: 287,
    }
    lines = text.splitlines()
    passages = []
    for number in VERSE_NUMBERS:
        start = starts[number] - 1
        end = starts.get(number + 1, len(lines) + 1) - 1
        passages.append(
            {
                "verse": number,
                "text": clean_text("\n".join(lines[start:end])),
                "status": "unicode-draft-needs-proofing",
                "method": "amrita-font-rule-conversion-explicit-verse-boundaries-v1",
                "note": (
                    "Rule-based Unicode Devanagari draft converted from the "
                    "embedded AmritaA font encoding; requires scholarly proofing "
                    "against the PDF page image before use in final collation."
                ),
            }
        )
    return passages


def write_passages(witness_dir, passages):
    output_path = witness_dir / "passages.json"
    output_path.write_text(
        json.dumps(passages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Segment the additional Viṃśikā witnesses into verses 1–22."
    )
    parser.add_argument(
        "--source-witnesses",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "source-witnesses",
    )
    args = parser.parse_args()

    jobs = {
        "san_silk_2016": (
            "edition.txt",
            segment_silk,
        ),
        "san_tola_dragonetti_2004": (
            "edition.txt",
            segment_tola,
        ),
        "san_ruzsa_szegedi_2015": (
            "reading-text.txt",
            lambda text: segment_numbered_headings(
                text,
                "critical-edition-numbered-karika-boundaries-v1",
            ),
        ),
        "pol_balcerowicz_nowakowska_1999": (
            "translation.txt",
            lambda text: segment_numbered_headings(
                text,
                "translator-numbered-karika-boundaries-v1",
                first_start_pattern=r"^\[Wasubandhu:\]",
            ),
        ),
        "hun_szanyi_2015": (
            "translation.txt",
            segment_hungarian,
        ),
    }
    for witness_id, (filename, segmenter) in jobs.items():
        witness_dir = args.source_witnesses / witness_id
        text = (witness_dir / filename).read_text(encoding="utf-8")
        passages = segmenter(text)
        output_path = write_passages(witness_dir, passages)
        print(f"{witness_id}: {len(passages)} passages -> {output_path}")

    witness_id = "san_balcerowicz_nowakowska_1999"
    witness_dir = args.source_witnesses / witness_id
    draft_path = witness_dir / "edition-unicode-draft-devanagari.txt"
    if draft_path.exists():
        passages = segment_balcerowicz_unicode_draft(
            draft_path.read_text(encoding="utf-8")
        )
        output_path = write_passages(witness_dir, passages)
        print(f"{witness_id}: {len(passages)} draft passages -> {output_path}")
    else:
        output_path = write_passages(witness_dir, pending_balcerowicz())
        print(f"{witness_id}: 22 pending records -> {output_path}")


if __name__ == "__main__":
    main()
