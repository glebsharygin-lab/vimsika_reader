"""Regression checks for Silk regrouping, source preservation and draft status."""
import argparse
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('baseline', type=Path, help='The previous release corpus.js, saved before replacing it')
args = parser.parse_args()
corpus_path = root / 'data/corpus.json'
corpus = json.loads(corpus_path.read_text('utf8')) if corpus_path.exists() else json.loads(
    (root / 'corpus.js').read_text('utf8').removeprefix('window.CORPUS_DATA = ').rstrip('\n;')
)
old_js = args.baseline.read_text('utf8')
previous = json.loads(old_js.removeprefix('window.CORPUS_DATA = ').rstrip('\n;'))

def inventory(c):
    result = {}
    for p in c['passages']:
        for sid,w in p['texts'].items():
            for t in w['tokens']:
                key = sid,t['id']
                assert key not in result, f'Duplicate token: {key}'
                result[key] = w['text'][t['start']:t['end']]
    return result

assert inventory(corpus) == inventory(previous), 'A source word or token identity changed'
assert corpus['sources'] == previous['sources'], 'A new source was ingested or metadata changed'
silk = [r for r in corpus['alignments'] if 'eng_silk_2016' in r['targetTokenIds']]
assert len(silk) == 263
assert {r['number'] for r in corpus['alignments'] if 'eng_silk_2016' not in r['targets']} == {'1.6','1.7'}
assert len({i for r in silk for i in r['targetTokenIds']['eng_silk_2016']}) == 4933
assert 'Daṇḍaka' in next(r for r in silk if r['number']=='20.1')['targets']['eng_silk_2016']
assert any(t.get('originVerse')==19 for t in corpus['passages'][19]['texts']['eng_silk_2016']['tokens'])
for row in corpus['alignments']:
    for sid,method in row['mappingMethods'].items():
        if method == 'multilingual-semantic-suggestion-v1':
            assert row['targetProvenance'][sid]['reviewStatus'] == 'unreviewed-machine-suggestion'
        if method == 'parallel-witness:character-sequence':
            assert row['targetProvenance'][sid]['reviewStatus'] == 'unreviewed-textual-match'
print(f'PASS: {len(inventory(corpus)):,} original tokens preserved; all 45 source records unchanged; Silk 263/265, 4933/4986 tokens; suggestions retain draft provenance.')
