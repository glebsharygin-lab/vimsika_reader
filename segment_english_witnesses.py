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

ANACKER_MARKERS = {
    1: r"^TWENTY VERSES AND COMMENTARY$",
    2: r'^"If perception occurs without an object,$',
    3: r"^Restriction as to place, etc\. is demonstrated as in a dream\.",
    4: r"^And activity which has been performed$",
    5: r"^There is no arising of animals in hell-states,$",
    6: r"^If the arising and transformation of material elements due$",
    7: r"^It's being constructed that the process of impressions from$",
    8: r"^Speaking of sense-fields of visibles, etc\.$",
    9: r"^Because their appearances continue as perceptions,$",
    10: r"^In this way, there is entry into the selflessness of personality\.",
    11: r"^A sense-object is neither a single thing,$",
    12: r"^Through the simultaneous conjunction of six elements,$",
    13: r"^When there is no conjunction of atoms,$",
    14: r"^\(To assume\) the singleness of that which has divisions$",
    15: r"^If their unity existed, one couldn't arrive at anything gradually,$",
    16: r"^Cognizing by direct perception is like in a dream, etc\.",
    17: r"^It has been stated how perception occurs with its appearance\.$",
    18: r"^The certainty of perceptions takes place mutually,$",
    19: r"^Dying may be a modification resulting from a special perception by another,$",
    20: r"^Or else, how was it that the Dandaka Forest became empty$",
    21: r"^The knowledge of those who understand others' cittas is not$",
    22: r"^I have written this demonstration of perception-only$",
}

TOLA_DRAGONETTI_MARKERS = {
    1: r"^TRANSLATION$",
    2: r"^2\.\s+Neither the determination",
    3: r"^3\.\s+The determination",
    4: r"^4\.\s+As in the case",
    5: r"^5\s*\.\s+And as the birth",
    6: r"^6\.\s+If the birth",
    7: r"^7\s+The vasana",
    8: r"^8\.\s+The existence",
    9: r"^9\.\s+That seed",
    10: r"^10\.\s+Because in this way",
    11: r"^11\.\s+CAn external ayatana",
    12: r"^12\.\s+Owing to its simultaneous connection",
    13: r"^13\.\s+not being connection for the atom",
    14: r"^14\.\s+the unity of that",
    15: r"^15\.\s+In \(the hypothesis",
    16: r"^16\.\s+The cognition \(called\) perception",
    17: r"^17\.\s+it has already been explained",
    18: r"^18\.\s+There is reciprocally",
    19: r"^19\.\s+Death \(is produced\)",
    20: r"^20\.\s+How \(could be explained\)",
    21: r"^21\.\s+how the knowledge",
    22: r"^22\.\s+this demonstration of the theory",
}


def locate_markers(text, patterns):
    positions = {}
    cursor = 0
    for number in VERSE_NUMBERS:
        pattern = re.compile(
            patterns[number],
            flags=re.IGNORECASE | re.MULTILINE,
        )
        match = pattern.search(text, cursor)
        if not match:
            raise ValueError(f"Could not locate verse {number}")
        positions[number] = match.start()
        cursor = positions[number] + 1
    return positions


def segment_text(text, patterns):
    positions = locate_markers(text, patterns)
    passages = []
    for number in VERSE_NUMBERS:
        start = positions[number]
        end = positions.get(number + 1, len(text))
        passages.append(
            {
                "verse": number,
                "text": text[start:end].strip(),
                "status": "machine-segmented",
                "method": "translator-kārikā-heading-boundaries-v1",
            }
        )
    return passages


def segment_silk(text):
    patterns = {
        number: rf"^{ROMAN[number]}$"
        for number in VERSE_NUMBERS
    }
    return segment_text(text, patterns)


def write_passages(witness_dir, passages):
    output_path = witness_dir / "passages.json"
    output_path.write_text(
        json.dumps(passages, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Segment extracted English Viṃśikā witnesses into verses 1–22."
    )
    parser.add_argument(
        "--source-witnesses",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "source-witnesses",
    )
    args = parser.parse_args()

    jobs = {
        "eng_silk_2016": segment_silk,
        "eng_anacker_2005": lambda text: segment_text(
            text,
            ANACKER_MARKERS,
        ),
        "eng_tola_dragonetti_2004": lambda text: segment_text(
            text,
            TOLA_DRAGONETTI_MARKERS,
        ),
    }
    for witness_id, segmenter in jobs.items():
        witness_dir = args.source_witnesses / witness_id
        text = (witness_dir / "translation.txt").read_text(encoding="utf-8")
        passages = segmenter(text)
        output_path = write_passages(witness_dir, passages)
        print(
            f"{witness_id}: {len(passages)} passages, "
            f"{sum(len(item['text']) for item in passages)} characters -> {output_path}"
        )


if __name__ == "__main__":
    main()
