"""Apply explicit semantic boundaries while preserving every source token ID.

Plans refer to exact phrases in the supplied extraction, never to relative
length. A plan may move a passage-boundary objection/reply into its canonical
Sanskrit passage. All source characters and original token identities survive.
"""
from __future__ import annotations
import copy
import json
import re
from pathlib import Path


def normalized_surface(text):
    chars, offsets = [], []
    for match in re.finditer(r"\s+|\S", text):
        chars.append(" " if match.group().isspace() else match.group())
        offsets.append(match.start())
    offsets.append(len(text))
    return "".join(chars), offsets


def number_list(spec):
    if spec == "_":
        return []
    if isinstance(spec, list):
        return spec
    return spec.split(",")


def prepare_semantic_plans(passages, witness_dir):
    by_verse = {p["number"]: p for p in passages}
    anchors, report = [], []
    for path in sorted(Path(witness_dir).glob("*/semantic-plan.json")):
        plan = json.loads(path.read_text("utf8"))
        sid = plan["sourceId"]
        originals = {n: copy.deepcopy(p["texts"][sid]) for n, p in by_verse.items()}
        old_tokens = {t["id"]: t["text"] for w in originals.values() for t in w["tokens"]}
        pieces = {n: [] for n in by_verse}
        for n, witness in originals.items():
            text = witness["text"]
            normalized, offsets = normalized_surface(text)
            cuts = []
            for entry in plan["passages"].get(str(n), []):
                numbers, start = number_list(entry[0]), entry[1]
                needle = re.sub(r"\s+", " ", start)
                matches = [m.start() for m in re.finditer(re.escape(needle), normalized)]
                if len(matches) != 1:
                    raise ValueError(f"Nonunique semantic boundary {sid} {n} {numbers}: {start!r} ({len(matches)})")
                at = offsets[matches[0]]
                if cuts and at <= cuts[-1][0]:
                    raise ValueError(f"Out-of-order semantic boundary {sid} {n} {numbers}")
                destination = int(numbers[0].split('.')[0]) if numbers else n
                if any(int(x.split('.')[0]) != destination for x in numbers):
                    raise ValueError("A shared phrase must belong to one canonical passage")
                cuts.append((at, destination, numbers))
            if not cuts or cuts[0][0] > 0:
                cuts.insert(0, (0, n, []))
            for i, (start, destination, numbers) in enumerate(cuts):
                end = cuts[i + 1][0] if i + 1 < len(cuts) else len(text)
                if any(t["start"] < start < t["end"] or t["start"] < end < t["end"] for t in witness["tokens"]):
                    raise ValueError(f"Semantic boundary splits a token: {sid} {n} {numbers}")
                selected = [copy.deepcopy(t) for t in witness["tokens"] if t["start"] >= start and t["end"] <= end]
                pieces[destination].append((n, start, end, text[start:end], selected, numbers))
        for n, parts in pieces.items():
            parts.sort(key=lambda part: (part[0], part[1]))
            text, tokens = "", []
            for source_verse, start, end, segment, selected, numbers in parts:
                shift = len(text) - start
                for token in selected:
                    token["start"] += shift
                    token["end"] += shift
                    if source_verse != n:
                        token["originVerse"] = source_verse
                text += segment
                tokens.extend(selected)
                if numbers and selected:
                    anchors.append({"verse": n, "numbers": numbers, "sourceId": sid,
                                    "tokenIds": [t["id"] for t in selected],
                                    "sourceVerse": source_verse, "sourceStart": start, "sourceEnd": end,
                                    "method": "explicit-semantic-anchor-2026-10-22"})
                if source_verse != n:
                    report.append({"sourceId": sid, "fromVerse": source_verse, "toVerse": n,
                                   "numbers": numbers, "tokens": len(selected)})
                # Prevent formerly disjoint blocks from fusing at the boundary.
                text += "\n\n"
            witness = by_verse[n]["texts"][sid]
            witness.update(text=text, tokens=tokens)
            witness["segmentationMethod"] = "explicit-semantic-boundaries-v2"
        new_tokens = {t["id"]: t["text"] for p in passages for t in p["texts"][sid]["tokens"]}
        if new_tokens != old_tokens or sum(len(p["texts"][sid]["tokens"]) for p in passages) != len(old_tokens):
            raise ValueError(f"Semantic regrouping lost or duplicated token identities: {sid}")
    return anchors, report
