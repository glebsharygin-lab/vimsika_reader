from __future__ import annotations

import argparse
import json
import math
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


SOURCE_TEXT_ID = "SA_T06_vasvvmsu"
SOURCE_URL = "https://dharmamitra.org/nexus/db/sa/SA_T06_vasvvmsu/text"
AUTHORIZATION_REFERENCE = (
    "Email from the DharmaNexus team (Sebastian / Dharmamitra AI) to "
    "Gleb Sharygin, 2026-06-20; see "
    "reference-source/dharmanexus-permission-2026-06-20.txt."
)
TARGET_SOURCE_IDS = {
    "BO_T06_D4057": "tib_derge",
    "ZH_T31_1589": "zho_paramartha",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def token_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return "".join(
        character
        for character in normalized
        if unicodedata.category(character)[0] in {"L", "M", "N"}
    )


def is_han_character(character: str) -> bool:
    codepoint = ord(character)
    return (
        0x3400 <= codepoint <= 0x4DBF
        or 0x4E00 <= codepoint <= 0x9FFF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x323AF
    )


def text_keys(value: str) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    for character in unicodedata.normalize("NFKC", value):
        if is_han_character(character):
            if current:
                key = token_key("".join(current))
                if key and not key.isdigit():
                    chunks.append(key)
                current = []
            chunks.append(token_key(character))
            continue
        category = unicodedata.category(character)[0]
        if category in {"L", "M", "N"} or character in {"'", "’", "ʼ", "-", "_"}:
            current.append(character)
            continue
        if current:
            key = token_key("".join(current))
            if key and not key.isdigit():
                chunks.append(key)
            current = []
    if current:
        key = token_key("".join(current))
        if key and not key.isdigit():
            chunks.append(key)
    return chunks


def target_text_candidates(row: dict[str, Any]) -> list[str]:
    candidates = [
        str(value)
        for value in row.get("par_segtext", [])
        if str(value).strip()
    ]
    candidates.extend(
        str(part.get("text", ""))
        for part in row.get("par_fulltext", [])
        if str(part.get("text", "")).strip()
    )
    unique = list(dict.fromkeys(candidates))
    return sorted(unique, key=lambda value: len(text_keys(value)), reverse=True)


def is_alignable_token(token: dict[str, Any]) -> bool:
    key = token_key(str(token.get("text", "")))
    if not key or key == "vvs" or key.isdigit():
        return False
    text = str(token.get("text", ""))
    if text.isascii() and text.isupper() and (
        len(text) == 1 or all(character in "IVXLCDM" for character in text)
    ):
        return False
    return True


def alignable_tokens(witness: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        token
        for token in witness.get("tokens", [])
        if is_alignable_token(token)
    ]


def exact_occurrences(haystack: list[str], needle: list[str]) -> list[int]:
    if not needle or len(needle) > len(haystack):
        return []
    length = len(needle)
    return [
        index
        for index in range(0, len(haystack) - length + 1)
        if haystack[index : index + length] == needle
    ]


def fuzzy_span(
    haystack: list[str],
    needle: list[str],
    expected_start: int,
    radius: int | None = None,
) -> tuple[int, int, float] | None:
    if not haystack or not needle:
        return None
    search_radius = radius or max(60, len(needle) * 8)
    minimum_start = max(0, expected_start - search_radius)
    maximum_start = min(len(haystack) - 1, expected_start + search_radius)
    length_variation = max(2, math.ceil(len(needle) * 0.2))
    minimum_length = max(1, len(needle) - length_variation)
    maximum_length = min(len(haystack), len(needle) + length_variation)
    best: tuple[int, int, float] | None = None
    for start in range(minimum_start, maximum_start + 1):
        for length in range(minimum_length, maximum_length + 1):
            end = start + length
            if end > len(haystack):
                continue
            ratio = SequenceMatcher(
                None,
                needle,
                haystack[start:end],
                autojunk=False,
            ).ratio()
            distance_penalty = abs(start - expected_start) / max(1, len(haystack))
            adjusted_ratio = ratio - distance_penalty * 0.05
            if best is None or adjusted_ratio > best[2]:
                best = (start, end, adjusted_ratio)
    return best


def locate_in_witness(
    target_text: str,
    witness_tokens: list[dict[str, Any]],
    expected_fraction: float,
    minimum_fuzzy_ratio: float = 0.72,
) -> dict[str, Any] | None:
    needle = text_keys(target_text)
    haystack = [token_key(str(token["text"])) for token in witness_tokens]
    if not needle or not haystack:
        return None
    expected_start = round(expected_fraction * max(0, len(haystack) - 1))
    occurrences = exact_occurrences(haystack, needle)
    if occurrences:
        start = min(occurrences, key=lambda index: abs(index - expected_start))
        end = start + len(needle)
        return {
            "start": start,
            "end": end,
            "ratio": 1.0,
            "method": "exact-token-sequence",
        }
    candidate = fuzzy_span(haystack, needle, expected_start)
    if candidate is None or candidate[2] < minimum_fuzzy_ratio:
        return None
    return {
        "start": candidate[0],
        "end": candidate[1],
        "ratio": round(candidate[2], 4),
        "method": "fuzzy-token-sequence",
    }


def project_span(
    source_start: int,
    source_end: int,
    source_count: int,
    target_count: int,
) -> tuple[int, int] | None:
    if source_count <= 0 or target_count <= 0:
        return None
    target_start = round(source_start * target_count / source_count)
    target_end = round(source_end * target_count / source_count)
    target_start = min(target_start, target_count - 1)
    target_end = max(target_start + 1, min(target_end, target_count))
    return target_start, target_end


def span_payload(
    witness: dict[str, Any],
    witness_tokens: list[dict[str, Any]],
    start: int,
    end: int,
) -> tuple[str, list[str]]:
    selected = witness_tokens[start:end]
    if not selected:
        return "", []
    text = str(witness.get("text", ""))
    character_start = int(selected[0]["start"])
    character_end = int(selected[-1]["end"])
    return (
        text[character_start:character_end],
        [str(token["id"]) for token in selected],
    )


def source_segments(export_directory: Path) -> list[dict[str, Any]]:
    pages = sorted(export_directory.glob("source-page-*.json"))
    if not pages:
        raise FileNotFoundError("No DharmaNexus source-page-*.json files found.")
    items: list[dict[str, Any]] = []
    for page in pages:
        items.extend(load_json(page).get("items", []))
    return sorted(
        items,
        key=lambda item: int(str(item["segnr"]).split(":")[-1]),
    )


def parallel_rows(export_directory: Path) -> dict[str, dict[str, Any]]:
    batches = sorted(export_directory.glob("parallel-batch-*.json"))
    if not batches:
        raise FileNotFoundError("No DharmaNexus parallel-batch-*.json files found.")
    rows: dict[str, dict[str, Any]] = {}
    for batch in batches:
        for row in load_json(batch):
            rows[str(row["id"])] = row
    return rows


def build_global_sanskrit_index(
    passages: list[dict[str, Any]],
) -> tuple[list[str], list[dict[str, Any] | None], dict[int, list[dict[str, Any]]]]:
    keys: list[str] = []
    entries: list[dict[str, Any] | None] = []
    passage_tokens: dict[int, list[dict[str, Any]]] = {}
    for passage in sorted(passages, key=lambda item: int(item["number"])):
        verse = int(passage["number"])
        tokens = alignable_tokens(passage["texts"]["san_levi_1925"])
        passage_tokens[verse] = tokens
        for local_index, token in enumerate(tokens):
            keys.append(token_key(str(token["text"])))
            entries.append(
                {
                    "verse": verse,
                    "localIndex": local_index,
                    "token": token,
                }
            )
        keys.append(f"__passage_boundary_{verse}__")
        entries.append(None)
    return keys, entries, passage_tokens


def locate_sanskrit_segments(
    segments: list[dict[str, Any]],
    passages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    global_keys, global_entries, passage_tokens = build_global_sanskrit_index(passages)
    cursor = 0
    mapped: list[dict[str, Any]] = []
    for segment in segments:
        segment_text = "".join(
            str(part.get("text", ""))
            for part in segment.get("segtext", [])
        )
        needle = text_keys(segment_text)
        occurrences = exact_occurrences(global_keys[cursor:], needle)
        method = "exact-token-sequence"
        ratio = 1.0
        if occurrences:
            start = cursor + occurrences[0]
            end = start + len(needle)
        else:
            candidate = fuzzy_span(global_keys, needle, cursor, radius=180)
            if candidate is None or candidate[2] < 0.72:
                raise ValueError(
                    f"Unable to map DharmaNexus source segment {segment['segnr']}: "
                    f"{segment_text}"
                )
            start, end, ratio = candidate
            method = "fuzzy-token-sequence"
        selected_entries = global_entries[start:end]
        selected_entries = [entry for entry in selected_entries if entry is not None]
        if not selected_entries:
            raise ValueError(
                f"DharmaNexus segment {segment['segnr']} has no local Sanskrit tokens."
            )
        groups: list[list[dict[str, Any]]] = []
        for entry in selected_entries:
            if not groups or groups[-1][-1]["verse"] != entry["verse"]:
                groups.append([entry])
            else:
                groups[-1].append(entry)
        for part_index, group in enumerate(groups, start=1):
            verse = int(group[0]["verse"])
            local_start = int(group[0]["localIndex"])
            local_end = int(group[-1]["localIndex"]) + 1
            mapped.append(
                {
                    "segment": segment,
                    "segmentText": " ".join(
                        str(entry["token"]["text"])
                        for entry in group
                    ),
                    "verse": verse,
                    "localStart": local_start,
                    "localEnd": local_end,
                    "sourceTokenCount": len(passage_tokens[verse]),
                    "mappingMethod": (
                        method
                        if len(groups) == 1
                        else f"{method}:split-at-local-passage-boundary"
                    ),
                    "mappingRatio": round(float(ratio), 4),
                    "segmentPart": part_index,
                    "segmentParts": len(groups),
                }
            )
        cursor = end
    return mapped


def make_alignments(
    corpus: dict[str, Any],
    mapped_segments: list[dict[str, Any]],
    rows_by_id: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    passages_by_number = {
        int(passage["number"]): passage
        for passage in corpus["passages"]
    }
    source_records = {
        str(source["id"]): source
        for source in corpus["sources"]
    }
    verse_orders: Counter[int] = Counter()
    mapping_counts: Counter[str] = Counter()
    target_mapping_counts: Counter[str] = Counter()
    anchored_target_coverage: Counter[str] = Counter()
    source_coverage: Counter[str] = Counter()
    unresolved_records: list[dict[str, Any]] = []
    alignments: list[dict[str, Any]] = []

    for mapped in mapped_segments:
        verse = int(mapped["verse"])
        passage = passages_by_number[verse]
        verse_orders[verse] += 1
        order = verse_orders[verse]
        number = f"{verse}.{order}"
        source_start = int(mapped["localStart"])
        source_end = int(mapped["localEnd"])
        source_count = int(mapped["sourceTokenCount"])
        expected_fraction = source_start / max(1, source_count)
        targets: dict[str, str] = {}
        target_token_ids: dict[str, list[str]] = {}
        mapping_methods: dict[str, str] = {}
        mapping_ratios: dict[str, float] = {}
        anchored_sources = ["san_levi_1925"]
        projected_sources: list[str] = []

        source_witness = passage["texts"]["san_levi_1925"]
        source_tokens = alignable_tokens(source_witness)
        source_text, source_ids = span_payload(
            source_witness,
            source_tokens,
            source_start,
            source_end,
        )
        targets["san_levi_1925"] = source_text
        target_token_ids["san_levi_1925"] = source_ids
        mapping_methods["san_levi_1925"] = str(mapped["mappingMethod"])
        mapping_ratios["san_levi_1925"] = float(mapped["mappingRatio"])
        mapping_counts[str(mapped["mappingMethod"])] += 1

        match_ids = sorted(
            {
                str(match_id)
                for part in mapped["segment"].get("segtext", [])
                for match_id in part.get("matches", [])
            }
        )
        target_records: list[dict[str, Any]] = []
        anchored_target_rows: dict[str, dict[str, Any]] = {}
        for match_id in match_ids:
            row = rows_by_id.get(match_id)
            if row is None:
                unresolved_records.append(
                    {"sourceSegment": mapped["segment"]["segnr"], "matchId": match_id}
                )
                continue
            local_source_id = TARGET_SOURCE_IDS.get(str(row.get("filename", "")))
            record = {
                "id": match_id,
                "filename": row.get("filename"),
                "targetSourceId": local_source_id,
                "targetSegment": row.get("par_segnr"),
                "targetSegmentRange": row.get("par_segnr_range"),
                "score": row.get("score"),
                "length": row.get("length"),
            }
            target_records.append(record)
            if local_source_id:
                anchored_target_rows[local_source_id] = row

        for source_id, source_record in source_records.items():
            if source_id == "san_levi_1925":
                source_coverage[source_id] += 1
                continue
            witness = passage["texts"].get(source_id, {})
            witness_tokens = alignable_tokens(witness)
            if not witness_tokens:
                continue

            local_mapping: dict[str, Any] | None = None
            local_mapping_kind = ""
            if source_id in anchored_target_rows:
                target_row = anchored_target_rows[source_id]
                mapping_candidates: list[tuple[dict[str, Any], int]] = []
                for target_text in target_text_candidates(target_row):
                    candidate_mapping = locate_in_witness(
                        target_text,
                        witness_tokens,
                        expected_fraction,
                        minimum_fuzzy_ratio=0.68,
                    )
                    if candidate_mapping is not None:
                        mapping_candidates.append(
                            (candidate_mapping, len(text_keys(target_text)))
                        )
                if mapping_candidates:
                    local_mapping = max(
                        mapping_candidates,
                        key=lambda item: (
                            float(item[0]["ratio"]),
                            item[1],
                        ),
                    )[0]
                local_mapping_kind = "dharmanexus-target"
                if local_mapping is None:
                    unresolved_records.append(
                        {
                            "sourceSegment": mapped["segment"]["segnr"],
                            "matchId": target_row.get("id"),
                            "targetSourceId": source_id,
                            "reason": "target text not located in local witness",
                        }
                    )
            elif str(source_record.get("languageCode", "")) == "san":
                local_mapping = locate_in_witness(
                    str(mapped["segmentText"]),
                    witness_tokens,
                    expected_fraction,
                    minimum_fuzzy_ratio=0.72,
                )
                local_mapping_kind = "parallel-sanskrit"

            if local_mapping is not None:
                target_start = int(local_mapping["start"])
                target_end = int(local_mapping["end"])
                text, token_ids = span_payload(
                    witness,
                    witness_tokens,
                    target_start,
                    target_end,
                )
                targets[source_id] = text
                target_token_ids[source_id] = token_ids
                method = f"{local_mapping_kind}:{local_mapping['method']}"
                mapping_methods[source_id] = method
                mapping_ratios[source_id] = float(local_mapping["ratio"])
                anchored_sources.append(source_id)
                target_mapping_counts[method] += 1
                if local_mapping_kind == "dharmanexus-target":
                    anchored_target_coverage[source_id] += 1
                source_coverage[source_id] += 1
                continue

            projected = project_span(
                source_start,
                source_end,
                source_count,
                len(witness_tokens),
            )
            if projected is None:
                continue
            text, token_ids = span_payload(
                witness,
                witness_tokens,
                projected[0],
                projected[1],
            )
            targets[source_id] = text
            target_token_ids[source_id] = token_ids
            mapping_methods[source_id] = "within-passage-monotonic-projection"
            projected_sources.append(source_id)
            source_coverage[source_id] += 1

        confidence = "medium" if len(anchored_target_rows) else "low"
        alignments.append(
            {
                "id": f"dharmanexus-v{verse}-{order:03d}",
                "verse": verse,
                "order": order,
                "number": number,
                "level": "sentence",
                "status": "dharmanexus-authorized",
                "confidence": confidence,
                "relation": "parallel",
                "label": f"DharmaNexus segment {number}",
                "method": (
                    "dharmanexus-source-segment+target-anchors+"
                    "within-segment-monotonic-projection-v1"
                ),
                "targets": targets,
                "targetTokenIds": target_token_ids,
                "anchoredSources": sorted(set(anchored_sources)),
                "projectedSources": sorted(set(projected_sources)),
                "sourceCharacterSpan": {
                    "start": int(source_tokens[source_start]["start"]),
                    "end": int(source_tokens[source_end - 1]["end"]),
                },
                "mappingMethods": mapping_methods,
                "mappingRatios": mapping_ratios,
                "provenance": {
                    "provider": "DharmaNexus",
                    "sourceTextId": SOURCE_TEXT_ID,
                    "sourceUrl": SOURCE_URL,
                    "sourceSegment": mapped["segment"]["segnr"],
                    "sourceSegmentPart": mapped.get("segmentPart", 1),
                    "sourceSegmentParts": mapped.get("segmentParts", 1),
                    "matchIds": match_ids,
                    "targetRecords": target_records,
                    "authorizationReference": AUTHORIZATION_REFERENCE,
                    "retrievedAt": "2026-06-22",
                },
                "note": (
                    "Sanskrit segmentation and available Tibetan/Paramārtha "
                    "correlations derive from DharmaNexus under written authorization. "
                    "Other witness spans are preliminary local projections and require "
                    "scholarly review."
                ),
            }
        )

    report = {
        "schemaVersion": "0.1.0-dharmanexus-import-report",
        "sourceTextId": SOURCE_TEXT_ID,
        "sourceUrl": SOURCE_URL,
        "authorizationReference": AUTHORIZATION_REFERENCE,
        "sourceSegments": len(
            {
                str(mapped["segment"]["segnr"])
                for mapped in mapped_segments
            }
        ),
        "mappedLocalParts": len(mapped_segments),
        "alignmentsCreated": len(alignments),
        "sourceMappingMethods": dict(mapping_counts),
        "targetMappingMethods": dict(target_mapping_counts),
        "anchoredTargetCoverage": dict(anchored_target_coverage),
        "sourceCoverage": dict(source_coverage),
        "unresolvedRecords": unresolved_records,
    }
    return alignments, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--corpus",
        type=Path,
        default=Path("data/corpus.json"),
    )
    parser.add_argument(
        "--export-dir",
        type=Path,
        default=Path("reference-source/dharmanexus-export"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            "reference-source/dharmanexus-SA_T06_vasvvmsu-authorized.json"
        ),
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("qa-metadata/dharmanexus-import-report.json"),
    )
    args = parser.parse_args()

    corpus = load_json(args.corpus)
    segments = source_segments(args.export_dir)
    rows_by_id = parallel_rows(args.export_dir)
    mapped_segments = locate_sanskrit_segments(segments, corpus["passages"])
    alignments, report = make_alignments(corpus, mapped_segments, rows_by_id)
    payload = {
        "schemaVersion": "0.2.0-authorized-alignment-import",
        "source": {
            "id": "dharmanexus-SA_T06_vasvvmsu",
            "label": "DharmaNexus · SA_T06_vasvvmsu",
            "url": SOURCE_URL,
            "authorizationReference": AUTHORIZATION_REFERENCE,
            "authorizationStatus": "written-permission-received",
            "permissionDate": "2026-06-20",
            "retrievedAt": "2026-06-22",
            "note": (
                "DharmaNexus authorized reuse and invited corrected alignments "
                "to be shared back with the project."
            ),
        },
        "alignments": alignments,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
