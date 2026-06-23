from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path


DEFAULT_SOURCE = (
    Path(__file__).resolve().parents[1]
    / "source-witnesses"
    / "san_balcerowicz_nowakowska_1999"
    / "edition-legacy.txt"
)

DEFAULT_OUTPUT = DEFAULT_SOURCE.with_name("edition-unicode-draft-devanagari.txt")
DEFAULT_REPORT = DEFAULT_SOURCE.with_name("conversion-report.md")


SPECIAL_SEQUENCES = {
    "\u0026aa": "ज्ञा",
    "\u0026a\u00e2": "ज्ञ",
    "\u0026a": "ज्ञ",
    "i\u00a7a\u00e2": "प्ति",
    "i\u00a7": "प्ति",
    "\u00a7a\u00e2": "प्त",
    "\u00a7": "प्त्",
    "i\u00cf\u00e2": "द्धि",
    "\u00cf\u00e2": "द्ध",
    "\u00cf": "द्ध्",
    "\u00e5i@a\u00e2": "ृत्ति",
    "i@a\u00e2": "त्ति",
    "@a\u00e2": "त्त",
    "@": "त्त्",
    "\u00e5i": "ृ",
    "{a\u00e2": "श्च",
    "\u201a\u00c2a": "क्ता",
    "\u201a": "क्त",
    "\u201ea\u00e2": "क्ष",
    "\u201ee": "क्षे",
    "C\u00d1\u00e2": "च्छ",
    "C\u00d1e": "च्छे",
    "C\u00d1": "च्छ्",
    "S\u00bfa": "स्था",
    "S\u00bf\u00e2": "स्थ",
    "\u00bfar\u00e2": "र्था",
    "\u00bfr\u00e2": "र्थ",
    "\u00bf\u00a5": "र्थं",
    "\u00ab": "रु",
    "\u00cce": "द्दे",
    "\u00cc": "द्द्",
    "\u0153ar\u00e2": "र्श",
    "yar\u00e2": "र्या",
    "Vy": "व्य",
    "pR": "प्र",
    "dR": "द्र",
    "tR": "त्र",
    "kR": "क्र",
    "gR": "ग्र",
    "bR": "ब्र",
    "mR": "म्र",
    "nR": "न्र",
    "sR": "स्र",
    "vR": "व्र",
    "cR": "च्र",
    "A\u00bf\u00e2": "अथ",
    "co\u00dc\u00e2": "चोद्य",
    "\u00dc\u00e2": "द्य",
    "\u00dc": "द्य",
    "\u0081": "क्र",
    "\u201e": "क्ष्",
}


CHARACTERS = {
    "A": "अ",
    "B": "ब्",
    "C": "छ",
    "G": "घ",
    "I": "ई",
    "J": "झ्",
    "K": "क्",
    "L": "ल्",
    "M": "म्",
    "N": "न्",
    "P": "प्",
    "Q": "ख्",
    "R": "्र",
    "S": "स्",
    "T": "त्",
    "U": "उ",
    "V": "व्",
    "a": "ा",
    "\u00e2": "",
    "\u00c2": "",
    "b": "ब",
    "c": "च",
    "d": "द",
    "e": "े",
    "f": "फ",
    "g": "ग",
    "h": "ह",
    "j": "ज",
    "k": "क",
    "l": "ल",
    "m": "म",
    "n": "न",
    "o": "ो",
    "p": "प",
    "q": "ख",
    "r": "",
    "s": "स",
    "t": "त",
    "u": "ु",
    "v": "व",
    "w": "भ",
    "y": "य",
    "z": "ध",
    "\u00e5": "ृ",
    "\u00ea": "ै",
    "\u00ee": "ी",
    "\u00f0": "ड",
    "\u00f2": "र",
    "\u00f6": "ु",
    "\u00fb": "ू",
    "\u00df": "न्न",
    "\u00d2": "ण",
    "\u00d4": "ं",
    "\u00dc": "द्य",
    "\u00de": "ष्",
    "\u0153": "श",
    "\u0152": "श्",
    "\u0161": "ष",
    "\u0160": "ष्",
    "\u0192": "क्व",
    "\u00aa": "॥",
    "\u00b5": "्",
    "\u00ba": "",
    "\u00a5": "ं",
    "\u00bf": "थ",
    "\u00ae": "्न",
    "\u00ac": "रू",
    "\u00a7": "प्त्",
    "\u0026": "ज्ञ्",
    "'": "ऽ",
    "(": "(",
    ")": ")",
    "*": "*",
    "$": "ष्ठ",
    ",": ",",
    ".": "",
    "/": "/",
    "0": "०",
    "1": "१",
    "2": "२",
    "3": "३",
    "4": "४",
    "5": "५",
    "6": "६",
    "7": "७",
    "8": "८",
    "9": "९",
    ":": "ः",
    ";": ";",
    "<": "<",
    ">": ">",
    "@": "त्त्",
    "^": "त्र",
    "|": "।",
    "\u2013": "–",
    "\u2014": "कृ",
    "\u201a": "क्त",
    "\u2022": "•",
}


SPECIALS_BY_LENGTH = sorted(SPECIAL_SEQUENCES, key=len, reverse=True)
PROTECTED_BRACKET = re.compile(r"\[[^\]]+\]")


def append_i(value: str) -> str:
    if not value:
        return "ि"
    return f"{value}ि"


def convert_fragment(source: str) -> tuple[str, Counter[str]]:
    output: list[str] = []
    unresolved: Counter[str] = Counter()
    index = 0
    pending_i = False

    while index < len(source):
        char = source[index]

        if char == "[":
            match = PROTECTED_BRACKET.match(source, index)
            if match:
                output.append(match.group(0))
                index = match.end()
                continue

        if char == "i":
            pending_i = True
            index += 1
            continue

        if char == "a" and index + 1 < len(source) and source[index + 1] == "\u00e2":
            index += 2
            continue

        matched = False
        for sequence in SPECIALS_BY_LENGTH:
            if source.startswith(sequence, index):
                value = SPECIAL_SEQUENCES[sequence]
                if pending_i:
                    value = append_i(value)
                    pending_i = False
                output.append(value)
                index += len(sequence)
                matched = True
                break

        if matched:
            continue

        if char in CHARACTERS:
            value = CHARACTERS[char]
            if pending_i and value and value not in "ाेैोौुूृंः्।॥,[]()* ":
                value = append_i(value)
                pending_i = False
            output.append(value)
            index += 1
            continue

        if char.isspace() or ord(char) < 128:
            if pending_i and char.isspace():
                output.append("ि")
                pending_i = False
            output.append(char)
            index += 1
            continue

        marker = f"⟦U+{ord(char):04X}⟧"
        unresolved[marker] += 1
        output.append(marker)
        index += 1

    if pending_i:
        output.append("ि")

    return "".join(output), unresolved


def convert_text(source: str) -> tuple[str, Counter[str]]:
    lines = source.splitlines()
    converted_lines: list[str] = []
    unresolved: Counter[str] = Counter()

    for line in lines:
        if line.strip() == "I. Tekst sanskrycki*":
            converted_lines.append(line)
            continue
        converted, line_unresolved = convert_fragment(line)
        converted = converted.replace("व्यव स्थाप्यते", "व्यवस्थाप्यते")
        converted = converted.replace("प्त्ि", "प्ति")
        converted = converted.replace("द्ध्ि", "द्धि")
        converted = converted.replace(
            "\u092a\u094d\u0924\u093f \u0936\u091a\u0947\u0924\u093f",
            "\u092a\u094d\u0924\u093f\u0936\u094d\u091a\u0947\u0924\u093f",
        )
        converted_lines.append(converted)
        unresolved.update(line_unresolved)

    return "\n".join(converted_lines) + ("\n" if source.endswith("\n") else ""), unresolved


def write_report(output_path: Path, unresolved: Counter[str], report_path: Path) -> None:
    unresolved_lines = [
        f"- `{marker}`: {count}" for marker, count in unresolved.most_common()
    ]
    if not unresolved_lines:
        unresolved_lines = ["- None"]

    report_path.write_text(
        "\n".join(
            [
                "# Balcerowicz Sanskrit Unicode Conversion Report",
                "",
                "Status: draft for scholarly proofing; not yet integrated as the public corpus witness.",
                "",
                f"Draft output: `{output_path.name}`",
                "",
                "Method: rule-based conversion from the embedded AmritaA visual font encoding into Unicode Devanāgarī.",
                "",
                "Known limitations:",
                "- Conjunct handling is provisional.",
                "- Apparatus signs and uncommon ligatures require manual review.",
                "- The result should be checked against the page image before replacing the pending witness.",
                "",
                "Unresolved or explicitly marked codes:",
                *unresolved_lines,
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    source_text = args.source.read_text(encoding="utf-8")
    converted_text, unresolved = convert_text(source_text)

    args.output.write_text(converted_text, encoding="utf-8")
    write_report(args.output, unresolved, args.report)

    print(f"Wrote {args.output}")
    print(f"Wrote {args.report}")
    print(f"Unresolved markers: {sum(unresolved.values())}")


if __name__ == "__main__":
    main()
