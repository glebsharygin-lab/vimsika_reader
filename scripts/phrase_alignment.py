"""Conservative, reproducible phrase alignment from attested source anchors.

Never infer cross-language correspondences from relative text length. The
Chinese table is user-supplied evidence, not a new philological collation.
"""
from __future__ import annotations

import copy
import json
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

BASE = "san_levi_1925"
CONSONANTS = dict(zip("कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह", "k kh g gh ṅ c ch j jh ñ ṭ ṭh ḍ ḍh ṇ t th d dh n p ph b bh m y r l v ś ṣ s h".split()))
VOWELS = dict(zip("अआइईउऊऋॠऌॡएऐओऔ", "a ā i ī u ū ṛ ṝ ḷ ḹ e ai o au".split()))
SIGNS = dict(zip("ािीुूृॄॢॣेैोौ", "ā i ī u ū ṛ ṝ ḷ ḹ e ai o au".split()))


def romanize(text):
    result = []
    for i, ch in enumerate(text):
        if ch in CONSONANTS:
            result.append(CONSONANTS[ch])
            if i + 1 == len(text) or text[i + 1] not in SIGNS and text[i + 1] != "्":
                result.append("a")
        elif ch in VOWELS:
            result.append(VOWELS[ch])
        elif ch in SIGNS:
            result.append(SIGNS[ch])
        elif ch in "ंँः":
            result.append("h" if ch == "ः" else "m")
        elif ch not in "्ऽ":
            result.append(ch)
    return "".join(result)


def key(text):
    text = romanize(text).casefold()
    return "".join(c for c in unicodedata.normalize("NFD", text) if "a" <= c <= "z")


def stream(witness):
    chars, owners = [], []
    for i, token in enumerate(witness["tokens"]):
        value = key(token["text"])
        if value in {"vvs"} or not value:
            continue
        chars.extend(value)
        owners.extend([i] * len(value))
    return "".join(chars), owners


def correspondence(left, right):
    return {a + j: b + j for a, b, size in SequenceMatcher(None, left, right, autojunk=False).get_matching_blocks() for j in range(size)}


def find_span(witness, text, *, unique=True):
    starts = [m.start() for m in re.finditer(re.escape(text), witness["text"])] if text else []
    if not starts or unique and len(starts) != 1:
        return None
    start = starts[0]
    end = start + len(text)
    return [t["id"] for t in witness["tokens"] if t["start"] < end and t["end"] > start]


def assign(row, source_id, witness, ids, method, ratio=None):
    chosen = set(ids)
    tokens = [t for t in witness["tokens"] if t["id"] in chosen]
    if not tokens:
        raise ValueError(f"Empty anchor {row['number']} {source_id}")
    row["targetTokenIds"][source_id] = [t["id"] for t in tokens]
    row["targets"][source_id] = witness["text"][tokens[0]["start"]:tokens[-1]["end"]]
    row.setdefault("mappingMethods", {})[source_id] = method
    if ratio is not None:
        row.setdefault("mappingRatios", {})[source_id] = round(ratio, 4)


def remove_target(row, sid):
    for field in ("targets", "targetTokenIds", "mappingMethods", "mappingRatios", "targetGroups", "targetProvenance"):
        row.get(field, {}).pop(sid, None)


def transfer_parallel_witnesses(passages, rows):
    """Transfer close textual matches between witnesses of the same translation.

    This is not a translation model. Chinese editions use exact ideographs;
    Tibetan romanizations only fold accents/apostrophe style and myi/rmyi.
    Boundaries must be matched, complete tokens; at least 90% of Chinese or
    94% of Tibetan characters must agree in both directions. Chinese editorial
    section headings are excluded from comparison. Existing selections survive.
    """
    pairs = [('zho_xuanzang', 'zho_hamilton_xuanzang_1938', 'Chinese'),
             ('tib_derge', 'tib_silk_dunhuang_2017', 'Tibetan'),
             ('tib_derge', 'tib_lvp_1911', 'Tibetan')]
    def parallel_stream(witness, language):
        chars, owners = [], []
        headings = [m.span() for m in re.finditer(r'(?m)^\s*（[一二三四五六七八九十]+）[^\n]*', witness['text'])] if language == 'Chinese' else []
        for i, token in enumerate(witness['tokens']):
            if language == 'Chinese':
                if any(a <= token['start'] < b for a,b in headings): continue
                value = ''.join(c for c in token['text'] if '\u3400' <= c <= '\u9fff').translate(str.maketrans({'旣':'既','敎':'教'}))
            else:
                value = key(token['text']).replace('rmyi', 'rmi').replace('myi', 'mi')
            chars.extend(value); owners.extend([i] * len(value))
        return ''.join(chars), owners
    for p in passages:
        verse_rows = [r for r in rows if r['verse'] == p['number']]
        for reference, sid, language in pairs:
            base, witness = p['texts'][reference], p['texts'][sid]
            left, li = parallel_stream(base, language)
            right, ri = parallel_stream(witness, language)
            mapping = correspondence(left, right)
            source_index = {t['id']: i for i, t in enumerate(base['tokens'])}
            grouped = {}
            for row in verse_rows:
                ids = row['targetTokenIds'].get(reference, [])
                if ids: grouped.setdefault(tuple(ids), []).append(row)
            occupied = {i for r in verse_rows for i in r['targetTokenIds'].get(sid, [])}
            for ids, group in grouped.items():
                if any(sid in r['targetTokenIds'] for r in group): continue
                indices = {source_index[i] for i in ids}
                positions = [i for i, owner in enumerate(li) if owner in indices]
                if len(positions) < (5 if language == 'Chinese' else 15): continue
                matched = [mapping[i] for i in positions if i in mapping]
                if not matched or positions[0] not in mapping or positions[-1] not in mapping: continue
                lo, hi = min(matched), max(matched)
                ratio = min(len(matched) / len(positions), len(matched) / (hi - lo + 1))
                if ratio < (.90 if language == 'Chinese' else .94): continue
                if lo and ri[lo - 1] == ri[lo]: continue
                if hi + 1 < len(ri) and ri[hi + 1] == ri[hi]: continue
                selected = witness['tokens'][ri[lo]:ri[hi]+1]
                tids = [t['id'] for t in selected]
                if occupied.intersection(tids): continue
                for row in group:
                    assign(row, sid, witness, tids, 'parallel-witness:character-sequence', ratio)
                    row.setdefault('targetProvenance', {})[sid] = {
                        'referenceSource': reference,
                        'reviewStatus': 'unreviewed-textual-match',
                    }
                occupied.update(tids)


def apply_semantic_suggestions(passages, rows, path):
    """Only import inspected, frozen suggestions, validated against exact text."""
    if not path.exists(): return
    by_verse = {p['number']: p for p in passages}
    lookup = {(r['verse'], r['number']): r for r in rows}
    for anchor in json.loads(path.read_text('utf8')):
        sid, verse = anchor['sourceId'], anchor['verse']
        selected = [lookup[(verse, n)] for n in anchor['numbers']]
        if any(sid in row['targetTokenIds'] for row in selected):
            raise ValueError(f'Suggestion overwrites an anchor: {sid} {anchor["numbers"]}')
        witness = by_verse[verse]['texts'][sid]
        tids = find_span(witness, anchor['text'])
        if tids != anchor['tokenIds']:
            raise ValueError(f'Stale semantic suggestion: {sid} {anchor["numbers"]}')
        occupied = {i for row in rows if row['verse'] == verse for i in row['targetTokenIds'].get(sid, [])}
        if occupied.intersection(tids):
            raise ValueError(f'Suggestion overlaps another anchor: {sid} {anchor["numbers"]}')
        for row in selected:
            assign(row, sid, witness, tids, anchor['method'], anchor['score'])
            row.setdefault('targetProvenance', {})[sid] = {
                'reviewStatus': 'unreviewed-machine-suggestion',
                'model': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
                'similarity': anchor['score'], 'margin': anchor['margin'],
                'scoreScope': 'Original model proposal; screened boundaries may differ. Not a probability.',
            }


def resolve_overlaps(rows, by_verse, report):
    """Keep coarse provider spans shared; quarantine unresolved collisions.

    An overlap alone is not evidence of a translation correspondence. Only
    adjacent spans from the original provider may be coarsened automatically.
    All other partial collisions are withheld and recorded for review.
    """
    report["withheldOverlaps"] = []
    for row in rows:
        row["targetGroups"] = {}
        for sid, ids in row["targetTokenIds"].items():
            witness = by_verse[row["verse"]]["texts"][sid]
            index = {t["id"]: i for i, t in enumerate(witness["tokens"])}
            if not ids or any(i not in index for i in ids):
                raise ValueError(f"Obsolete token IDs: {row['number']} {sid}")
            # Provider token matching skips embedded editorial line labels.
            # The stored surface already includes them: include their token IDs
            # too, so the UI does not repeat them as unassigned text.
            positions = [index[i] for i in ids]
            span = witness["tokens"][min(positions):max(positions) + 1]
            assign(row, sid, witness, [t["id"] for t in span], row["mappingMethods"][sid])
    for verse, passage in by_verse.items():
        verse_rows = [r for r in rows if r["verse"] == verse]
        for sid, witness in passage["texts"].items():
            active = [r for r in verse_rows if sid in r["targetTokenIds"]]
            pending = list(active)
            while pending:
                component = [pending.pop(0)]
                covered = set(component[0]["targetTokenIds"][sid])
                changed = True
                while changed:
                    changed = False
                    for row in pending[:]:
                        ids = set(row["targetTokenIds"][sid])
                        if covered & ids:
                            component.append(row)
                            covered.update(ids)
                            pending.remove(row)
                            changed = True
                if len(component) < 2:
                    continue
                component.sort(key=lambda r: verse_rows.index(r))
                identical = all(set(r["targetTokenIds"][sid]) == covered for r in component)
                adjacent = verse_rows.index(component[-1]) - verse_rows.index(component[0]) + 1 == len(component)
                provider = all(r["mappingMethods"][sid].startswith("dharmanexus-target:") for r in component)
                if not identical and not (adjacent and provider):
                    # Exact hand-picked anchors outrank older inherited links.
                    methods = [r["mappingMethods"][sid] for r in component]
                    priorities = [4 if m.startswith("explicit-semantic-") else 3 if m == "explicit-source-anchor-2026-09-08" else 2 if m in ("supplied-chinese-parallel-table", "parallel-sanskrit:character-sequence") else 1 for m in methods]
                    best = max(priorities)
                    survivors = [r for r, priority in zip(component, priorities) if priority == best]
                    if len(survivors) > 1:
                        survivors = []
                    for row in component:
                        if row not in survivors:
                            report["withheldOverlaps"].append({"number": row["number"], "sourceId": sid, "method": row["mappingMethods"][sid], "reason": "Conflicting overlapping anchor; retained in full witness for review."})
                            remove_target(row, sid)
                    continue
                ids = [t["id"] for t in witness["tokens"] if t["id"] in covered]
                group = {"id": f"shared-{sid}-{component[0]['number']}", "numbers": [r["number"] for r in component], "firstUnitId": component[0]["id"]}
                for row in component:
                    assign(row, sid, witness, ids, row["mappingMethods"][sid])
                    row["targetGroups"][sid] = group


def repair(passages, sources, original, witness_dir, chinese_rows, semantic_anchors=()):
    by_verse = {p["number"]: p for p in passages}
    rows = copy.deepcopy(original)
    report = {"removedPositionalSpans": 0, "methods": {}, "unassigned": {}, "scope": "Source anchors, parallel textual matches and labelled semantic suggestions; scholarly review remains pending."}
    # Old explicit selections had no provenance markers. Recover only the
    # enumerated selections, never everything under an authorized row label.
    explicit_path = witness_dir / "explicit-alignments-v1-v2.json"
    explicit = json.loads(explicit_path.read_text("utf8")) if explicit_path.exists() else []
    explicit_keys = {(x["verse"], x["number"], x["sourceId"]) for x in explicit}
    for row in rows:
        for sid in list(row.get("targets", {})):
            method = row.get("mappingMethods", {}).get(sid, "")
            keep = sid == BASE or "projection" not in method and bool(method)
            if (row["verse"], row["number"], sid) in explicit_keys:
                keep = True
                row.setdefault("mappingMethods", {})[sid] = "explicit-source-anchor-2026-09-07"
            if not keep:
                for field in ("targets", "targetTokenIds", "mappingMethods", "mappingRatios"):
                    row.get(field, {}).pop(sid, None)
                report["removedPositionalSpans"] += 1
        row["projectedSources"] = []
        row["method"] = "source-anchored-phrase-alignment-v3"
        row["note"] = "Source anchors and labelled draft suggestions. Shared spans retain their full coverage; unassigned material remains available in the full witness."
        row["alignmentPolicy"] = "source-anchors-and-labelled-suggestions"

    # Align related Sanskrit editions through matched characters. Mapping is
    # independent of token spacing, compounds and Devanagari/IAST presentation.
    candidates = []
    for p in passages:
        base = p["texts"][BASE]
        left, li = stream(base)
        base_index = {t["id"]: i for i, t in enumerate(base["tokens"])}
        per_source = {}
        for source in sources:
            sid = source["id"]
            if source["language"] != "Sanskrit" or sid == BASE:
                continue
            witness = p["texts"][sid]
            right, ri = stream(witness)
            mapping = correspondence(left, right)
            per_source[sid] = (right, ri, mapping)
            for row in [r for r in rows if r["verse"] == p["number"]]:
                indices = {base_index[i] for i in row["targetTokenIds"].get(BASE, [])}
                positions = [i for i, owner in enumerate(li) if owner in indices]
                if not positions:
                    continue
                matched = [mapping[i] for i in positions if i in mapping]
                ratio = len(matched) / len(positions)
                if not matched or ratio < .90 or positions[0] not in mapping or positions[-1] not in mapping:
                    continue
                lo, hi = min(matched), max(matched)
                if len(matched) / (hi - lo + 1) < .85:
                    continue
                tokens = witness["tokens"][ri[lo]:ri[hi] + 1]
                # Do not silently broaden a phrase to a partially matched word.
                if lo and ri[lo - 1] == ri[lo]:
                    continue
                if hi + 1 < len(ri) and ri[hi + 1] == ri[hi]:
                    continue
                assign(row, sid, witness, [t["id"] for t in tokens], "parallel-sanskrit:character-sequence", ratio)
            # Token candidates are exact textual correspondences between
            # Sanskrit editions only; no proportional translation projection.
        for i, token in enumerate(base["tokens"]):
            positions = [j for j, owner in enumerate(li) if owner == i]
            if not positions:
                continue
            targets = {BASE: [token["id"]]}
            for sid, (right, ri, mapping) in per_source.items():
                if not all(j in mapping for j in positions):
                    continue
                js = [mapping[j] for j in positions]
                if js != list(range(js[0], js[0] + len(js))):
                    continue
                ts = p["texts"][sid]["tokens"][ri[js[0]]:ri[js[-1]] + 1]
                if "".join(key(t["text"]) for t in ts) == key(token["text"]):
                    targets[sid] = [t["id"] for t in ts]
            if len(targets) > 1:
                candidates.append({"id": f"candidate-{token['id']}", "verse": p["number"], "level": "token-span", "status": "machine-suggested", "confidence": "medium", "method": "exact-normalized-sanskrit-text", "label": token["text"], "note": "Matching Sanskrit text; a candidate requiring scholarly review.", "targetTokenIds": targets})

    # Chinese translations are anchored through the supplied parallel table.
    # A table cell may cover several Sanskrit units: preserve this relation.
    for cell in chinese_rows:
        p = by_verse[cell["verse"]]
        base = p["texts"][BASE]
        left, li = stream(base)
        needle = key(cell["sanskrit"])
        if len(needle) < 8:
            continue
        mapping = correspondence(needle, left)
        if len(mapping) / len(needle) < .90 or 0 not in mapping or len(needle) - 1 not in mapping:
            continue
        lo, hi = mapping[0], mapping[len(needle) - 1]
        if len(mapping) / max(1, hi - lo + 1) < .85:
            continue
        ids = {t["id"] for t in base["tokens"][li[lo]:li[hi] + 1]}
        matching = []
        for row in [r for r in rows if r["verse"] == p["number"]]:
            rids = set(row["targetTokenIds"].get(BASE, []))
            if rids and len(rids & ids) / len(rids) >= .80:
                matching.append(row)
        if not matching:
            continue
        covered = set().union(*(set(r["targetTokenIds"].get(BASE, [])) for r in matching))
        if len(ids & covered) / len(ids) < .85:
            continue
        for sid, target in cell["targets"].items():
            witness = p["texts"][sid]
            tids = find_span(witness, target)
            if not tids:
                continue
            # A pre-existing finer explicit alignment is better than a table
            # cell encompassing multiple clauses.
            if len(matching) > 1 and all(r.get("mappingMethods", {}).get(sid, "").startswith("explicit-") for r in matching):
                continue
            for row in matching:
                assign(row, sid, witness, tids, "supplied-chinese-parallel-table", len(mapping) / len(needle))
                row.setdefault("targetProvenance", {})[sid] = {"file": "zho_xuangzan.docx", "table": 1, "row": cell["tableRow"]}
                if len(matching) > 1:
                    row.setdefault("targetGroups", {})[sid] = {"id": f"table-{cell['tableRow']}-{sid}", "numbers": [r["number"] for r in matching], "firstUnitId": matching[0]["id"]}

    # Each additional source can provide exact phrase anchors independently
    # of how the edition numbers or orders its root verses and commentary.
    row_lookup = {(r["verse"], r["number"]): r for r in rows}
    for path in sorted(witness_dir.glob("*/phrase-anchors.json")):
        for anchor in json.loads(path.read_text("utf8")):
            numbers = anchor.get("numbers", [anchor.get("number")])
            selected_rows = [row_lookup[(anchor["verse"], n)] for n in numbers]
            sid = anchor["sourceId"]
            witness = by_verse[anchor["verse"]]["texts"][sid]
            tids = find_span(witness, anchor["text"])
            if not tids:
                raise ValueError(f"Ambiguous or missing explicit phrase: {path}: {numbers}")
            for row in selected_rows:
                assign(row, sid, witness, tids, "explicit-source-anchor-2026-09-08")
                row.get("targetGroups", {}).pop(sid, None)
                if len(numbers) > 1:
                    row.setdefault("targetGroups", {})[sid] = {"id": f"explicit-{sid}-{numbers[0]}", "numbers": numbers, "firstUnitId": selected_rows[0]["id"]}

    for anchor in semantic_anchors:
        sid = anchor["sourceId"]
        witness = by_verse[anchor["verse"]]["texts"][sid]
        for number in anchor["numbers"]:
            row = row_lookup[(anchor["verse"], number)]
            assign(row, sid, witness, anchor["tokenIds"], anchor["method"])
            row.setdefault("targetProvenance", {})[sid] = {
                "sourcePassage": anchor["sourceVerse"],
                "sourceCharacterSpan": [anchor["sourceStart"], anchor["sourceEnd"]],
                "reviewStatus": "draft-semantic-selection",
            }

    rejected_path = witness_dir / "rejected-legacy-anchors.json"
    rejected = json.loads(rejected_path.read_text("utf8")) if rejected_path.exists() else []
    for item in rejected:
        remove_target(row_lookup[(item["verse"], item["number"])], item["sourceId"])
    report["rejectedLegacyAnchors"] = rejected
    resolve_overlaps(rows, by_verse, report)
    transfer_parallel_witnesses(passages, rows)
    apply_semantic_suggestions(passages, rows, witness_dir / 'semantic-suggestions.json')
    earlier_conflicts = report['withheldOverlaps'][:]
    resolve_overlaps(rows, by_verse, report)
    report['withheldOverlaps'] = earlier_conflicts + report['withheldOverlaps']

    for row in rows:
        # The display renders token spans, so store the exact same surface.
        # This also catches obsolete token IDs instead of silently accepting them.
        for sid, ids in list(row["targetTokenIds"].items()):
            witness = by_verse[row["verse"]]["texts"][sid]
            known = {t["id"] for t in witness["tokens"]}
            if not ids or any(i not in known for i in ids):
                raise ValueError(f"Obsolete token IDs: {row['number']} {sid}")
            assign(row, sid, witness, ids, row["mappingMethods"][sid])
        row["anchoredSources"] = sorted(row["targetTokenIds"])
    report["methods"] = dict(Counter(m for r in rows for m in r["mappingMethods"].values()))
    report["assignedWitnessSpans"] = sum(len(r["targetTokenIds"]) for r in rows)
    report["sharedGroups"] = len({g["id"] for r in rows for g in r.get("targetGroups", {}).values()})
    for source in sources:
        sid = source["id"]
        report["unassigned"][sid] = sum(len({t["id"] for t in p["texts"][sid]["tokens"]} - {i for r in rows if r["verse"] == p["number"] for i in r["targetTokenIds"].get(sid, [])}) for p in passages)
    return rows, candidates, report
