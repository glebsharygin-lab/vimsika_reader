from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


VERSE_NUMBERS = range(1, 23)


ROMAN_TO_INT = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8,
    "IX": 9,
    "X": 10,
    "XI": 11,
    "XII": 12,
    "XIII": 13,
    "XIV": 14,
    "XV": 15,
    "XVI": 16,
    "XVII": 17,
    "XVIII": 18,
    "XIX": 19,
    "XX": 20,
    "XXI": 21,
    "XXII": 22,
}


def clean_text(text: str) -> str:
    text = text.replace("\u00ad", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def content_lines(text: str) -> list[str]:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append("")
            continue
        if stripped.startswith("===== PAGE "):
            continue
        if re.fullmatch(r"\d{2,3}\s+Revue d.Etudes Tibétaines", stripped):
            continue
        if re.fullmatch(r"Dunhuang Manuscript Pelliot tibétain 797\s+\d+", stripped):
            continue
        header_upper = stripped.upper()
        if any(
            marker in header_upper
            for marker in ("MISÉON", "MLSEON", "MLSÉON", "MISKON", "MUSÉON")
        ):
            continue
        if re.fullmatch(r"VIMSAKAK.*", stripped, flags=re.IGNORECASE):
            continue
        if re.fullmatch(r"\d+\s+(LE|LK|Lt|I\.E|IF,|MIS).*", stripped):
            continue
        lines.append(stripped)
    return lines


def passages_from_starts(
    lines: list[str],
    starts: dict[int, int],
    *,
    status: str,
    method: str,
    note: str,
) -> list[dict[str, str | int]]:
    passages = []
    for number in VERSE_NUMBERS:
        start = starts.get(number)
        if start is None:
            passages.append(
                {
                    "verse": number,
                    "text": "",
                    "status": "not-present-in-supplied-source",
                    "method": method,
                    "note": "No usable passage boundary was identified in the supplied witness.",
                }
            )
            continue
        next_starts = [value for verse, value in starts.items() if verse > number]
        end = min(next_starts) if next_starts else len(lines)
        passages.append(
            {
                "verse": number,
                "text": clean_text("\n".join(lines[start:end])),
                "status": status,
                "method": method,
                "note": note,
            }
        )
    return passages


def segment_silk_dunhuang(text: str) -> list[dict[str, str | int]]:
    lines = content_lines(text)
    starts: dict[int, int] = {}
    for index, line in enumerate(lines):
        number = ROMAN_TO_INT.get(line)
        if number:
            starts[number] = index + 1
    return passages_from_starts(
        lines,
        starts,
        status="machine-segmented",
        method="silk-2017-roman-divisions-v1",
        note=(
            "Segmented from Silk's imposed Roman divisions in the Pelliot "
            "tibétain 797 transcription. Verse rubrics and line notes require "
            "scholarly review."
        ),
    )


def first_line_matching(lines: list[str], pattern: str) -> int:
    regex = re.compile(pattern, re.IGNORECASE)
    for index, line in enumerate(lines):
        normalized = re.sub(r"^[\s/;:]+", "", line)
        if regex.search(normalized):
            return index
    raise ValueError(f"Could not find segmentation anchor: {pattern}")


def segment_lvp_tibetan(text: str) -> list[dict[str, str | int]]:
    lines = content_lines(text)
    anchors = {
        1: r"^ni çu pai",
        2: r"^gai te rnam rig",
        3: r"^yul la sogs pa",
        4: r"^thams cad sems eau dmyal ba",
        5: r"^ji Itar dud hgro",
        6: r"^gai te de yi las",
        7: r"^gzb?han na las kyi bag|^gzban na las kyi bag",
        8: r"^gzugs sogs skye",
        9: r"^ran gi sa bon",
        10: r"^bstau.*clios.*bdag med",
        11: r"^de ni gcig na",
        12: r"^drug gis cig car",
        13: r"^rdul phrau sbyor ba",
        14: r"^gan la phyogs cha",
        15: r"^gcig na rim gyis",
        16: r"^mûon sum blo",
        17: r"^dper na der snan",
        18: r"^gcig la gcig gi",
        19: r"^hchi ba gzhan",
        20: r"^yid fies kha",
        21: r"^gzhan sems rig",
        22: r"^rnain rig tsani",
    }
    starts = {number: first_line_matching(lines, pattern) for number, pattern in anchors.items()}
    return passages_from_starts(
        lines,
        starts,
        status="ocr-segmented-needs-proofing",
        method="lvp-1911-tibetan-ocr-verse-anchors-v1",
        note=(
            "Segmented from the Le Muséon OCR layer by visible Tibetan verse "
            "anchors. The OCR is noisy and requires line-by-line correction."
        ),
    )


def segment_lvp_french(text: str) -> list[dict[str, str | int]]:
    lines = content_lines(text)
    anchors = {
        1: r"^II\.$",
        2: r"^2\.",
        3: r"^3 a-b\.",
        4: r"^4 a\.",
        5: r"^5\.",
        6: r"^6\.",
        7: r"^7\.",
        8: r"^8\.",
        9: r"^9\.",
        10: r"^10 a-b\.",
        11: r"^11\.",
        12: r"^12 a-b\.",
        13: r"^13 a-b\.",
        14: r"^14 a-b\.",
        15: r"^15",
        16: r"^16 a\.",
        17: r"^17 a-b\.",
        18: r"^18 a-b\.",
        19: r"^19\.",
        20: r"^20 a-b\.",
        21: r"^21 a-c\.",
        22: r"^22 a-d\.",
    }
    starts = {number: first_line_matching(lines, pattern) for number, pattern in anchors.items()}
    return passages_from_starts(
        lines,
        starts,
        status="ocr-segmented-needs-proofing",
        method="lvp-1911-french-numbered-headings-v1",
        note=(
            "Segmented from La Vallée-Poussin's numbered French headings in "
            "the Le Muséon OCR layer. OCR accents and punctuation require proofing."
        ),
    )


def segment_cronk(text: str) -> list[dict[str, str | int]]:
    lines = content_lines(text)
    full_text = clean_text("\n".join(lines))
    positions: dict[int, int] = {}
    for match in re.finditer(r"\[Verse\s+(\d+)", full_text):
        number = int(match.group(1))
        positions.setdefault(number, match.start())
    passages = []
    for number in VERSE_NUMBERS:
        start = positions.get(number)
        if start is None:
            passages.append(
                {
                    "verse": number,
                    "text": "",
                    "status": "not-present-in-supplied-source",
                    "method": "cronk-1998-verse-labels-v1",
                    "note": (
                        "Cronk's supplied adaptation does not mark this verse "
                        "as a separate translated unit."
                    ),
                }
            )
            continue
        next_positions = [value for verse, value in positions.items() if verse > number]
        end = min(next_positions) if next_positions else len(full_text)
        passages.append(
            {
                "verse": number,
                "text": clean_text(full_text[start:end]),
                "status": "machine-segmented",
                "method": "cronk-1998-verse-labels-v1",
                "note": (
                    "Segmented from Cronk's bracketed verse labels. This is an "
                    "adapted/rendition witness rather than a literal full translation."
                ),
            }
        )
    return passages


HAMILTON_ENGLISH_PATTERNS = {
    1: r"it is established that the three worlds",
    2: r"If representations are without real objects",
    3: r"Place and time are determined as in a dream",
    4: r"All\s+\d*\s*\[are exemplified\]\s+as\s+\[those\]\s+in hell",
    5: r"As the animals in heaven",
    6: r"If you grant that from the force of deeds",
    7: r"The impression of the deed",
    8: r"Conforming to the creatures",
    9: r"\[Perceptive\]\s+consciousness is born from its own seed",
    10: r"By reason of this teaching one enters into",
    11: r"That realm\s+\d*\s+is neither one",
    12: r"One atom joined with six",
    13: r"Since \[it is stated\] that atoms do not join",
    14: r"If the atom has spatial divisions",
    15: r"\[Assuming\]\s+unity",
    16: r"Immediate awareness is the same as in dreams",
    17: r"As has been said, the apparent object is a representation",
    18: r"By the power of reciprocal influence",
    19: r"Because of transformation in another.s representation",
    20: r"The emptiness of D[amnp]daka forest",
    21: r"(?:I-low|How) does knowledge of another.s mind",
    22: r"I, according to my ability",
}


def hamilton_ocr_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("===== PAGE "):
            continue
        lines.append(stripped)
    flat = clean_text(" ".join(lines))
    flat = re.sub(r"\bTranslation and Notes\s+\d*\s*", "", flat)
    return clean_text(flat)


def segment_hamilton_english(text: str) -> list[dict[str, str | int]]:
    flat = hamilton_ocr_text(text)
    starts: dict[int, int] = {}
    cursor = 0
    for number in VERSE_NUMBERS:
        pattern = HAMILTON_ENGLISH_PATTERNS[number]
        match = re.compile(pattern, re.IGNORECASE).search(flat, cursor)
        if not match:
            raise ValueError(f"Could not locate Hamilton passage {number}: {pattern}")
        starts[number] = match.start()
        cursor = match.start() + 1
    passages = []
    for number in VERSE_NUMBERS:
        start = starts[number]
        end = starts.get(number + 1, len(flat))
        passages.append(
            {
                "verse": number,
                "text": clean_text(flat[start:end]),
                "status": "ocr-segmented-needs-proofing",
                "method": "hamilton-1938-windows-ocr-semantic-anchors-v1",
                "note": (
                    "Segmented from Windows OCR of Hamilton's scanned English "
                    "translation from Xuanzang's Chinese. OCR typography, "
                    "footnotes, and boundaries require scholarly proofing."
                ),
            }
        )
    return passages


def write_passages(witness_dir: Path, passages: list[dict[str, str | int]]) -> None:
    witness_dir.mkdir(parents=True, exist_ok=True)
    (witness_dir / "passages.json").write_text(
        json.dumps(passages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Segment batch-3 Viṃśikā witnesses.")
    parser.add_argument("--source-witnesses", type=Path, default=Path("source-witnesses"))
    args = parser.parse_args()

    jobs = {
        "tib_silk_dunhuang_2017": ("transcription.txt", segment_silk_dunhuang),
        "tib_lvp_1911": ("transcription.txt", segment_lvp_tibetan),
        "fra_lvp_1911": ("translation.txt", segment_lvp_french),
        "eng_cronk_1998": ("translation.txt", segment_cronk),
        "eng_hamilton_1938": ("translation_ocr.txt", segment_hamilton_english),
    }
    for witness_id, (filename, segmenter) in jobs.items():
        witness_dir = args.source_witnesses / witness_id
        passages = segmenter((witness_dir / filename).read_text(encoding="utf-8"))
        write_passages(witness_dir, passages)
        present = sum(1 for passage in passages if passage["text"])
        print(f"{witness_id}: {present}/22 passages -> {witness_dir / 'passages.json'}")


if __name__ == "__main__":
    main()
