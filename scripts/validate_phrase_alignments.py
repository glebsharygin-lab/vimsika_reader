"""Validate exact token references, shared spans and absence of projections."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
corpus_path = root / "data/corpus.json"
corpus = json.loads(corpus_path.read_text("utf8")) if corpus_path.exists() else json.loads(
    (root / "corpus.js").read_text("utf8").removeprefix("window.CORPUS_DATA = ").rstrip("\n;")
)
passages = {p["number"]: p for p in corpus["passages"]}
errors = []
for row in corpus["alignments"]:
    p = passages[row["verse"]]
    for sid, ids in row["targetTokenIds"].items():
        witness = p["texts"][sid]
        index = {t["id"]: t for t in witness["tokens"]}
        if not ids or any(i not in index for i in ids):
            errors.append(f"Invalid token ids: {row['number']} {sid}")
            continue
        if ids != list(dict.fromkeys(ids)):
            errors.append(f"Duplicate token ids: {row['number']} {sid}")
        start, end = index[ids[0]]["start"], index[ids[-1]]["end"]
        if ids != [t["id"] for t in witness["tokens"] if t["start"] >= start and t["end"] <= end]:
            errors.append(f"Noncontiguous token span: {row['number']} {sid}")
        if witness["text"][start:end] != row["targets"][sid]:
            errors.append(f"Text/token mismatch: {row['number']} {sid}")
        if "projection" in row.get("mappingMethods", {}).get(sid, ""):
            errors.append(f"Positional projection retained: {row['number']} {sid}")
    for sid, group in row.get("targetGroups", {}).items():
        group_rows = [r for r in corpus["alignments"] if r["verse"] == row["verse"] and r["number"] in group["numbers"]]
        if any(r.get("targetGroups", {}).get(sid) != group or r["targetTokenIds"].get(sid) != row["targetTokenIds"][sid] for r in group_rows):
            errors.append(f"Inconsistent shared group: {group['id']}")
for p in corpus["passages"]:
    rows = [r for r in corpus["alignments"] if r["verse"] == p["number"]]
    for n, left in enumerate(rows):
        for right in rows[n + 1:]:
            for sid, ids in left["targetTokenIds"].items():
                if set(ids) & set(right["targetTokenIds"].get(sid, [])):
                    group = left.get("targetGroups", {}).get(sid)
                    if not group or group != right.get("targetGroups", {}).get(sid):
                        errors.append(f"Unmarked overlapping spans: {left['number']} {right['number']} {sid}")
    if p["sentenceUnits"] != [r for r in corpus["alignments"] if r["verse"] == p["number"] and r["level"] == "sentence"]:
        errors.append(f"Divergent sentence backbones: {p['number']}")
for c in corpus["candidateAlignments"]:
    if len(c["targetTokenIds"]) < 2 or any(not s.startswith("san_") for s in c["targetTokenIds"]):
        errors.append(f"Invalid Sanskrit text-match candidate: {c['id']}")
if errors:
    raise SystemExit("\n".join(errors[:40]) + f"\n{len(errors)} validation failures")
print(f"PASS: {len(corpus['sources'])} witnesses; {len(corpus['alignments'])} phrase units; all exact spans, token references and shared groups valid.")
