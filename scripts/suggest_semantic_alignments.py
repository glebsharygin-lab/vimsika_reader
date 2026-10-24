"""Generate auditable multilingual draft spans from the corrected text anchors.

Runs the pinned, local multilingual sentence encoder; sends no corpus text to
an inference service. Similarity is evidence for a suggestion, not validation.
Never uses proportional text length to assign translation equivalents.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work/vimsika-0.24.0"
sys.path.insert(0, str(WORK / "packages"))
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


def cleaned(text):
    text = re.sub(r"\[(?:Vasubandhu|Objection|Opponent|Reply|\d+[a-d]*)[:.]?\]", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def chunks(witness, occupied):
    tokens = witness["tokens"]
    runs, run = [], []
    for i, token in enumerate(tokens):
        if token["id"] in occupied:
            if run: runs.append(run)
            run = []
        else: run.append(i)
    if run: runs.append(run)
    result = []
    for run in runs:
        current = []
        for i in run:
            current.append(i)
            end = tokens[i]["end"]
            gap_end = tokens[i+1]["start"] if i+1 < len(tokens) else len(witness["text"])
            gap = witness["text"][end:gap_end]
            sentence_end = bool(re.search(r"[.!?;。！？；।]", gap))
            # OCR preserves abbreviated names and verse labels. Neither is a
            # sentence boundary; keep it with its substantive clause.
            if len(current) < 4 or tokens[i]['text'].casefold() in {'etc', 'e', 'g', 'i', 'viz', 'd', 'h', 'usw', 'b', 'tzn'}:
                sentence_end = False
            # A model window must not silently truncate long source sentences.
            long_clause = len(current) >= 75 and bool(re.search(r"[,，:]", gap))
            if sentence_end or long_clause or len(current) >= 110 or i == run[-1]:
                lo, hi = current[0], current[-1]
                text = witness["text"][tokens[lo]["start"]:tokens[hi]["end"]]
                if len(current) >= 4 and len(cleaned(text)) >= 18:
                    result.append({"lo": lo, "hi": hi, "text": text})
                current = []
    return result


def encode(texts):
    cache_path = WORK / 'embedding-cache.npz'
    keys_path = WORK / 'embedding-keys.json'
    keys = json.loads(keys_path.read_text('utf8')) if keys_path.exists() else []
    vectors = list(np.load(cache_path)['vectors']) if cache_path.exists() else []
    lookup = {key:i for i,key in enumerate(keys)}
    pending = list(dict.fromkeys(text for text in texts if text not in lookup))
    if pending:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 4
        options.inter_op_num_threads = 1
        session=ort.InferenceSession(str(WORK/'model/model_quint8_avx2.onnx'),options,providers=['CPUExecutionProvider'])
        tokenizer=Tokenizer.from_file(str(WORK/'model/tokenizer.json'))
        tokenizer.enable_truncation(max_length=128)
        tokenizer.enable_padding(pad_id=tokenizer.token_to_id('<pad>') or 0,pad_token='<pad>')
        for start in range(0,len(pending),32):
            batch=pending[start:start+32]
            enc=tokenizer.encode_batch(batch)
            feed={'input_ids':np.array([x.ids for x in enc],dtype=np.int64),
                  'attention_mask':np.array([x.attention_mask for x in enc],dtype=np.int64),
                  'token_type_ids':np.array([x.type_ids for x in enc],dtype=np.int64)}
            outputs=session.run(None,{x.name:feed[x.name] for x in session.get_inputs()})[0]
            mask=feed['attention_mask'][...,None]
            pooled=(outputs*mask).sum(axis=1)/np.maximum(mask.sum(axis=1),1)
            pooled/=np.maximum(np.linalg.norm(pooled,axis=1,keepdims=True),1e-9)
            for text,vector in zip(batch,pooled):
                lookup[text]=len(keys);keys.append(text);vectors.append(vector.astype(np.float32))
            if start%320==0:print(f'Embedded {start+len(batch)}/{len(pending)} new spans',flush=True)
        np.savez_compressed(cache_path,vectors=np.array(vectors))
        keys_path.write_text(json.dumps(keys,ensure_ascii=False),encoding='utf8')
    return np.array([vectors[lookup[text]] for text in texts])


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',nargs='*')
    parser.add_argument('--threshold',type=float,default=.80)
    args=parser.parse_args()
    corpus=json.loads((ROOT/'data/corpus.json').read_text('utf8'))
    sources=[s for s in corpus['sources'] if s['language'] not in ['Sanskrit','Tibetan','Chinese','Slovenian'] and s['id']!='eng_silk_2016' and (not args.only or s['id'] in args.only)]
    cases=[];texts=[]
    for p in corpus['passages']:
        rows=[r for r in corpus['alignments'] if r['verse']==p['number']]
        pivots=[]
        unique_references={}
        for start in range(len(rows)):
            for size in range(1,5):
                group=rows[start:start+size]
                if len(group)!=size:continue
                # Readable translations provide the semantic reference, not a
                # vector representation of unsupported Sanskrit or Tibetan.
                fragments=[]
                for row in group:
                    fragment=row['targets'].get('eng_silk_2016')
                    if not fragment:
                        fragment=next((row['targets'].get(s) for s in ['eng_anacker_2005','eng_frauwallner_sangpo_2010','eng_kachru_2021'] if row['targets'].get(s)),None)
                    if not fragment:break
                    if fragment not in fragments:fragments.append(fragment)
                else:
                    text=cleaned(' '.join(fragments))
                    if len(text)>=18 and len(text)<1000:
                        if text in unique_references:
                            existing=unique_references[text]
                            existing['indices'].update(range(start,start+size))
                            existing['numbers']=[rows[i]['number'] for i in sorted(existing['indices'])]
                        else:
                            reference={'numbers':[r['number'] for r in group],'indices':set(range(start,start+size)),'text':text,'vector':len(texts)}
                            pivots.append(reference);unique_references[text]=reference;texts.append(text)
        for source in sources:
            sid=source['id'];witness=p['texts'][sid]
            occupied={i for r in rows for i in r['targetTokenIds'].get(sid,[])}
            targets=chunks(witness,occupied)
            for target in targets:
                target['vector']=len(texts);texts.append(cleaned(target['text']))
            if targets and pivots:cases.append((p,source,rows,pivots,targets))
    print(f'{len(cases)} passage/witness cases; {len(texts)} candidate text windows',flush=True)
    matrix=encode(texts)
    accepted=defaultdict(list);audit=[]
    for p,source,rows,pivots,targets in cases:
        sid=source['id'];witness=p['texts'][sid]
        scores=matrix[[t['vector'] for t in targets]]@matrix[[r['vector'] for r in pivots]].T
        proposals=[]
        for target,values in zip(targets,scores):
            ranked=np.argsort(values)[::-1]
            best=pivots[int(ranked[0])];score=float(values[ranked[0]])
            # An overlapping group is an alternative boundary, not a different
            # meaning. Require separation from the best disjoint interpretation.
            other=max((float(values[i]) for i,r in enumerate(pivots) if not r['indices'] & best['indices']),default=0)
            margin=score-other
            if score<args.threshold or margin<.08:continue
            if any(sid in rows[i]['targetTokenIds'] for i in best['indices']):continue
            # Prefer the smallest equally supported group (within 0.015), while
            # retaining genuinely fused two/three-clause translations.
            equivalent=[pivots[int(i)] for i in ranked if float(values[i])>=score-.04 and pivots[int(i)]['indices']<=best['indices']]
            if equivalent:best=min(equivalent,key=lambda r:len(r['indices']))
            proposals.append({**target,**best,'score':score,'margin':margin,'targetText':target['text']})
        # Highest confidence first; each target word and reference unit gets
        # at most one suggested span. Existing curated assignments are untouched.
        used_tokens=set();used_rows=set()
        for proposal in sorted(proposals,key=lambda x:x['score'],reverse=True):
            positions=set(range(proposal['lo'],proposal['hi']+1))
            if positions & used_tokens or proposal['indices'] & used_rows:continue
            # Avoid crossing trusted local anchors; no length/position score is
            # used, only the order supplied by already attested phrase anchors.
            crossing=False
            index={t['id']:i for i,t in enumerate(witness['tokens'])}
            for i,row in enumerate(rows):
                ids=row['targetTokenIds'].get(sid,[])
                if not ids:continue
                lo,hi=min(index[x] for x in ids),max(index[x] for x in ids)
                if (i<min(proposal['indices']) and lo>proposal['hi']) or (i>max(proposal['indices']) and hi<proposal['lo']):crossing=True
            if crossing:continue
            selected=witness['tokens'][proposal['lo']:proposal['hi']+1]
            anchor={'verse':p['number'],'numbers':proposal['numbers'],'sourceId':sid,
                    'text':witness['text'][selected[0]['start']:selected[-1]['end']],
                    'tokenIds':[t['id'] for t in selected],
                    'method':'multilingual-semantic-suggestion-v1','reviewStatus':'unreviewed-machine-suggestion',
                    'score':round(proposal['score'],4),'margin':round(proposal['margin'],4),
                    'referenceText':proposal['text']}
            accepted[sid].append(anchor);audit.append(anchor)
            used_tokens.update(positions);used_rows.update(proposal['indices'])
    out=WORK/'suggestions';out.mkdir(exist_ok=True)
    for sid,anchors in accepted.items():
        anchors.sort(key=lambda a:(a['verse'],int(a['numbers'][0].split('.')[1])))
        (out/f'{sid}.json').write_text(json.dumps(anchors,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (WORK/'semantic-suggestions-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({sid:len(a) for sid,a in accepted.items()},indent=2),flush=True)
    print('Suggested spans',len(audit),flush=True)

if __name__=='__main__':main()
