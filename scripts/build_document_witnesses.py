"""Build source-located normal witnesses from the preserved 0.29 documents.

All selections are exact substrings of the imported document blocks. Notes and
uncertain text remain in the continuous source reader; no missing text is made up.
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / 'researched-translations.js').read_text('utf8')
library = json.loads(raw[raw.index('{'):].rstrip('\n;'))
documents = {d['id']: d for d in library['documents']}
plan = {'schemaVersion': '1.1.0-draft', 'sources': [], 'passageMappings': [], 'phraseMappings': [], 'documentAdditions': [],
        'description': 'Source-located document integration; uncertain and absent spans are not inferred.'}


def source(document_id, label, language, script, color, coverage, fidelity, **extra):
    doc = documents[document_id]
    plan['sources'].append({
        'id': document_id, 'label': label, 'shortLabel': label.split(' · ',1)[-1],
        'language': language, 'languageCode': doc['languageCode'], 'script': script,
        'role': 'translation', 'color': color, 'citation': doc['citation'],
        'libraryDocumentId': document_id, 'coverageLabel': coverage,
        'fidelityLabel': fidelity, **extra,
    })


def add_document_components(document_id, components):
    original = documents[document_id]
    ids = {c['id'] for c in original['components']}
    assert all(c['id'] not in ids for c in components), document_id
    documents[document_id] = {**original, 'components': original['components'] + components}
    addition=next((d for d in plan['documentAdditions'] if d['documentId']==document_id),None)
    if addition:
        addition['components'].extend(components)
    else:
        plan['documentAdditions'].append({'documentId':document_id, 'components':components})


def checked_opening(sid,verse=1):
    file=json.loads((ROOT/'source-witnesses/scan-checked-openings.json').read_text('utf8'))
    reading=next(r for r in file['readings'] if r['documentId']==sid and r.get('passageNumber',1)==verse)
    block={**reading,'reviewStatus':file['reviewStatus'],'method':file['method']}
    component={'id':sid+'-scan-checked'+(f'-v{verse}' if verse!=1 else ''),'kind':'translation-draft',
               'label':f'Passage {verse} checked against scan · draft','blocks':[block]}
    add_document_components(sid,[component])
    plan['passageMappings']=[m for m in plan['passageMappings'] if (m['sourceId'],m['passageId'])!=(sid,f'v{verse}')]
    plan['passageMappings'].append({'sourceId':sid,'passageId':f'v{verse}','level':'passage',
        'componentId':component['id'],'blockIds':[block['id']],
        'coverageStatus':'scan-checked-draft','coverageNote':'Transcribed against the supplied page image; scholarly review pending.',
        'note':file['method']})


def flattened(parts):
    text, spans = '', []
    for part in parts:
        if text:
            text += '\n\n'
        start = len(text)
        text += part['text']
        spans.append({**part, 'flatStart': start, 'flatEnd': len(text)})
    return text, spans


def split_passages(sid, parts, starts, note):
    text, spans = flattened(parts)
    boundaries = []
    for verse, marker in starts:
        if marker is None:
            start = 0
        else:
            assert text.count(marker) == 1, (sid, verse, marker, text.count(marker))
            start = text.index(marker)
        boundaries.append((verse, start))
    assert [b for _, b in boundaries] == sorted(b for _, b in boundaries)
    for i, (verse, start) in enumerate(boundaries):
        end = boundaries[i + 1][1] if i + 1 < len(boundaries) else len(text)
        fragments = []
        for span in spans:
            a, b = max(start, span['flatStart']), min(end, span['flatEnd'])
            if a >= b:
                continue
            fragments.append({
                'componentId': span['componentId'], 'blockId': span['blockId'],
                'start': span['start'] + a - span['flatStart'],
                'end': span['start'] + b - span['flatStart'],
            })
        assert fragments, (sid, verse)
        plan['passageMappings'].append({'sourceId': sid, 'passageId': f'v{verse}',
            'level': 'passage', 'fragments': fragments, 'note': note})


def korean():
    sid = 'kor_lee_gilsan_2021'
    source(sid, 'Korean · Lee Gil-san 2021', 'Korean', 'Hangul', '#446f89',
           'Translation of all 22 passages; detailed annotations in the source document',
           'Direct PDF text; translation separated from annotations; draft boundaries')
    parts = []
    for n, component in enumerate(documents[sid]['components'][:16], 1):
        started = False
        for block in component['blocks']:
            body = re.split(r'\n#\d+', block['text'])[0]
            if not started:
                match = re.search(r'(?m)^【'+str(n)+r'】\s*(?!〖)(?=\S)', body)
                if not match:
                    continue
                start, started = match.start(), True
            else:
                start = 0
            notes = re.search(r'(?m)^【'+str(n)+r'】\s*〖', body[start:])
            end = start + notes.start() if notes else len(body)
            if body[start:end].strip():
                parts.append({'componentId': component['id'], 'blockId': block['id'],
                              'start': start, 'text': body[start:end]})
            if notes:
                break
        assert started, f'Missing Korean translation section {n}'
    # The author's sixteen argument sections are not verse numbers. These
    # explicit transitions follow the translated roots and their commentary.
    starts = [(1,None), (2,'【2】 이에 대해'), (3,'【3】 [바수반두:]'),
              (4,'기대 효과의 발휘는 몽정처럼.'), (5,'【4】 [대론자:]'),
              (6,'[대론자:] 그 경우 저 지옥중생들의 업들에 의해'),
              (7,'업의 훈습〖e〗이 A에 있고'), (8,'【5】 [대론자:]'),
              (9,'A라는 자신의 종자로부터 표상이 B인양'),
              (10,'[대론자:] 그런데 저와 같이 의도를 가지고 교설하고'),
              (11,'【7】 [바수반두:]'), (12,'여섯 개의 것과 동시에 결합하기 때문에'),
              (13,'【8】 [바수반두:]'), (14,'어떤 A에 방향에 따른 부분의 구별'),
              (15,'【9】 [대론자:]'), (16,'【10】 [대론자:]'),
              (17,'[바수반두:] 경험된 대상을 기억한다는'), (18,'【12】 [대론자:]'),
              (19,'【14】 [대론자:]'), (20,'아니라면 어떻게 단다까숲의'),
              (21,'【15】 [대론자:]'), (22,'【16】 유식성')]
    split_passages(sid, parts, starts,
        'Korean translation, separated from the author’s extensive annotations. '
        'The source’s sixteen argument sections are mapped by explicit translated verse transitions; '
        'source pages and annotation marks are retained. Passage boundaries remain drafts.')


def thai():
    sid = 'tha_soraj_2012'
    source(sid, 'Thai · Soraj 2012 · abridged', 'Thai', 'Thai', '#9a613d',
           'Abridged relay: passages 1–4, 8–15, 17–19, 21–22',
           'Article text; source order and omissions retained', translationStatus='abridged')
    component = documents[sid]['components'][0]
    starts = [(1,16),(2,18),(3,20),(4,22),(8,27),(9,31),(10,32),(11,35),
              (12,40),(13,43),(14,44),(15,50),(17,55),(18,58),(19,63),(21,65),(22,69)]
    for i, (verse, first) in enumerate(starts):
        last = starts[i+1][1]-1 if i+1 < len(starts) else 70
        blocks = component['blocks'][first-1:last]
        assert blocks[0]['id'] == f'tha-soraj-{first:03d}'
        text = '\n\n'.join(b['text'] for b in blocks)
        # Freeze imported word boundaries in the manifest so browser/ICU upgrades
        # cannot silently change the IDs of an unedited Thai witness.
        code = "const fs=require('fs'); const text=fs.readFileSync(0,'utf8'); console.log(JSON.stringify([...new Intl.Segmenter('th',{granularity:'word'}).segment(text)].filter(p=>p.isWordLike).map(p=>[p.index,p.index+p.segment.length])));"
        token_spans = json.loads(subprocess.run(['node', '-e', code], input=text,
            text=True, encoding='utf8', capture_output=True, check=True).stdout)
        plan['passageMappings'].append({'sourceId': sid, 'passageId': f'v{verse}',
            'level': 'passage', 'componentId': component['id'],
            'blockIds': [b['id'] for b in blocks],
            'tokenSpans': token_spans,
            'note': 'Abridged Thai relay of Cronk. Numbered quotations and adjoining explanation '
                    'are grouped by passage; the source’s order is preserved (including 4b before 4a '
                    'and 18b before 18a). Omitted passages are not reconstructed.'})


def chatterjee():
    sid = 'eng_chatterjee_1980'
    source(sid, 'English · K. N. Chatterjee 1980', 'English', 'Latin', '#557c46',
           'All 22 passage locations; passages 2–3 incomplete in the supplied scan',
           'Unproofed OCR; Sanskrit excluded; scan gap in passages 2–3',
           translationStatus='scan-incomplete')
    component = documents[sid]['components'][0]
    # The upper part of each page contains Sanskrit. Keep only the English
    # lower section, with exact offsets back to the preserved OCR blocks.
    english_starts = [
        'In the Mahayäna', "The word, 'puyanadx'", 'The fact that persons', 'of iron ablaze',
        'do not undergo', 'The väsanä', 'to assert that', 'these two are both',
        'one get initiated', '-non-essential', 'vaiscsikas', 'atom only',
        '*That which', '(If you say so;', 'cIf it is one', 'an elephant',
        'CfAnd when', '"Recollection', 'knowledge which', 'As knowledges',
        'other animals', 'If you do not presume', 'sages is not', 'Vijflaptimätratä being',
    ]
    assert len(component['blocks']) == len(english_starts)
    parts = []
    for block, marker in zip(component['blocks'], english_starts):
        assert block['text'].count(marker) == 1, (block['id'],marker)
        start = block['text'].index(marker)
        parts.append({'componentId':component['id'], 'blockId':block['id'],
                      'start':start, 'text':block['text'][start:]})
    starts = [(1,None), (2,"'If consciousness"), (3,"The word, 'puyanadx'"),
              (4,"'The usefulness"), (5,'As the animals are born'),
              (6,'Then it must be admitted'), (7,"Moreover,\n'The väsanä"),
              (8,'Ägama ( sästras )'), (9,'What is that which is in view ?'),
              (10,'What is the use of having instructed'), (11,'How are we to understand'),
              (12,"'When six atoms"), (13,'No, there cannot be any blemish'),
              (14,'*That which has spatial'), (15,'cIf it is one'),
              (16,'Existence cr non-existence'), (17,'Whatever is not known'),
              (18,'If it be so that all knowledges'),
              (19,'If everything is but consciousness only'),
              (20,'"How again was the dandäkäranya'),
              (21,'If everything is but consciousness alone'),
              (22,'Vijflaptimätratä being')]
    split_passages(sid, parts, starts,
        'English translation separated from the Sanskrit page sections. Unproofed OCR is retained '
        'with page locators; boundaries are drafts. The supplied scan jumps from the opening '
        'of verse 2 on PDF page 52 to commentary on verse 3 on PDF page 53. Missing text is not supplied.')
    for mapping in plan['passageMappings']:
        if mapping['sourceId']==sid and mapping['passageId'] in ['v2','v3']:
            mapping['coverageStatus']='scan-incomplete'
            mapping['coverageNote']='Incomplete: the supplied scan skips intervening text between PDF pages 52 and 53.'


def validate():
    seen = set()
    for mapping in plan['passageMappings']:
        key = mapping['sourceId'], mapping['passageId']
        assert key not in seen, key
        seen.add(key)
        doc = documents[mapping['sourceId']]
        blocks = {b['id']: (c['id'], b) for c in doc['components'] for b in c['blocks']}
        for fragment in mapping.get('fragments', []):
            component, block = blocks[fragment['blockId']]
            assert fragment['componentId'] == component
            assert 0 <= fragment['start'] < fragment['end'] <= len(block['text'])


def sharma():
    sid = 'eng_sharma_1993'
    source(sid, 'English · T. R. Sharma 1993', 'English', 'Latin', '#74604c',
           '22 passage locations, with the author’s explanatory commentary',
           'Unproofed English OCR; translation and author commentary; draft boundaries',
           includesSecondaryCommentary=True)
    selections = json.loads((ROOT/'source-witnesses/sharma-text-selections.json').read_text('utf8'))
    assert selections['sourceSnapshot'] == documents[sid]['sourceSnapshot']
    blocks = {b['id']:b for c in documents[sid]['components'] for b in c['blocks']}
    parts = [{**f, 'text':blocks[f['blockId']]['text'][f['start']:f['end']]}
             for f in selections['fragments']]
    starts = [(1,None),(2,'“If the consciousness is without'),
        (3,'“No, the objection does not hold good'),
        (4,'“(All the previously mentioned four factors)'),
        (5,'“Animals are ‘born in the heaven'), (6,'“Then due to the deeds'),
        (7,'“The impression of a deed'), (8,'“The scripture is the reason'),
        (9,'“What is the hidden meaning?'), (10,'“What again is the purpose'),
        (11,'“How again one is to think'), (12,'“Why (a single atom) is not proved'),
        (13,'“The atoms do not join'), (14,'“If the joining of the atoms is desired'),
        (15,'“What is the purpose of this question'),
        (16,'“Existence and non-existence are to be determined'),
        (17,'“(Something) inexperienced is not remembered'),
        (18,'“If the representations of corsciousness appearing'),
        (19,'“Death is transformation caused'),
        (20,'“How was it that the Dandaka forest'),
        (21,'“If everything is consciousness, do the knowers'),
        (22,'“The theory of consciousness being of innumerabie')]
    split_passages(sid, parts, starts,
        'English translation together with Sharma’s explanatory commentary. Sanskrit OCR sections '
        'and separate bibliographical footnotes are left in the full source document. The text is '
        'unproofed OCR, including damaged readings; source-line locators are retained. '
        'Passage boundaries are drafts, not reviewed phrase correspondences.')
    for mapping in plan['passageMappings']:
        if mapping['sourceId']==sid and mapping['passageId']=='v4':
            mapping['coverageStatus']='source-omission'
            mapping['coverageNote']='The supplied printed source passes from verse 3 to the hell example (4b); the wet-dream clause (4a) is absent at this point. Checked against PDF pages 79–80 (printed 67–68). No missing clause has been supplied.'


def mapped_text(sid, verse):
    mapping = next(m for m in library['passageMappings'] + plan['passageMappings']
                   if m['sourceId'] == sid and m['passageId'] == f'v{verse}')
    doc = documents[sid]
    blocks = {b['id']: b for c in doc['components'] for b in c['blocks']}
    if 'fragments' in mapping:
        return '\n\n'.join(blocks[f['blockId']]['text'][f['start']:f['end']]
                           for f in mapping['fragments'])
    return '\n\n'.join(blocks[b]['text'] for b in mapping['blockIds'])


def chogdub():
    sid = 'hin_chogdub_tripathi_1972'
    source(sid, 'Hindi · Chogdub–Tripāṭhī 1972', 'Hindi', 'Devanagari', '#8c603e',
           'Hindi translation and translated autocommentary in all 22 passages',
           'Unproofed Unicode reader text; Sanskrit and later explanation separated')
    selections = json.loads((ROOT/'source-witnesses/chogdub-text-selections.json').read_text('utf8'))
    assert selections['sourceSnapshot'] == documents[sid]['sourceSnapshot']
    plan['passageMappings'].extend(selections['passageMappings'])


def tiwary_alternate():
    sid='hin_tiwary_1995_alternate'
    data=json.loads((ROOT/'source-witnesses/tiwary-reocr-selections.json').read_text('utf8'))
    add_document_components(sid,[data['component']])
    source(sid,'Hindi · Mahesh Tiwary 1995 · alternate scan','Hindi','Devanagari','#8a6954',
           '22 passage locations · duplicate edition · unproofed scan',
           'New local OCR; Hindi separated from Sanskrit; spelling and word beginnings remain uncertain',
           duplicateOf='hin_tiwari_1995',translationStatus='alternate-copy',reviewStatus='unproofed-ocr')
    plan['passageMappings'].extend(data['passageMappings'])
    checked_opening(sid)
    checked_opening(sid,2)


def inazu():
    sid='jpn_inazu_1929'
    data=json.loads((ROOT/'source-witnesses/inazu-reocr-selections.json').read_text('utf8'))
    add_document_components(sid,[data['component']])
    source(sid,'Japanese · Kizō Inazu 1929','Japanese','Japanese','#77628c',
           'Opening checked against scan; 21 further passage locations with severely uncertain OCR',
           'Vertical OCR draft; damaged readings and small-gloss order require scan checking',
           translationStatus='ocr-draft',reviewStatus='severely-uncertain-ocr')
    plan['passageMappings'].extend(data['passageMappings'])
    checked_opening(sid)


def opening_phrases():
    # Exact, semantically checked clause boundaries. These remain draft
    # correspondences; punctuation and source wording are not rewritten.
    starts = {
        'vie_nguyen_hong': [(1,'An lập'), (2,'vì khế kinh'), (3,'Tâm ý thức'),
            (4,'trong đây'), (5,'Chỉ ngăn'), (6,'Khi nội thức'),
            (7,'như hoa mắt'), (8,'Nghĩa này')],
        'zho_lu_cheng_2009': [(1,'现在就大乘'), (2,'因为经里面'), (3,'心和意'),
            (4,'这里说心'), (5,'因为说唯字'), (6,'内面的识'), (7,'很像人眼睛')],
        'kor_lee_gilsan_2021': [(1,'【1】'), (2,'경전에'), (3,'마음[=심]'),
            (4,'나아가 여기서'), (5,'‘오직 -일 뿐'), (6,'이 식은 대상'), (7,'예를 들어')],
        'tha_soraj_2012': [(1,'ข้อเสนอของโยคาจาร:'), (3,'“จิต” “มนัส”'),
            (4,'คำว่า “จิต”'), (5,'การใช้คำว่า'), (6,'แน่นอนว่า'), (7,'แต่นี่ก็ไม่ต่าง')],
        'ron_nedu_2011': [(6,'1.Acestea'), (7,'asemenea')],
    }
    for sid, markers in starts.items():
        text = mapped_text(sid, 1)
        boundaries = []
        for unit, marker in markers:
            assert text.count(marker) == 1, (sid, marker)
            boundaries.append((unit, text.index(marker)))
        assert [n for _,n in boundaries] == sorted(n for _,n in boundaries)
        for i,(unit,start) in enumerate(boundaries):
            end = boundaries[i+1][1] if i+1 < len(boundaries) else len(text)
            plan['phraseMappings'].append({'sourceId': sid, 'passageId':'v1',
                'unitId': f'dharmanexus-v1-{unit:03d}', 'start':start, 'end':end,
                'note':'Opening clause selected against the Sanskrit section; scholarly review pending.'})


def romanian_roots():
    raw = (ROOT/'corpus.js').read_text('utf8')
    corpus = json.loads(raw[raw.index('{'):].rstrip('\n;'))
    normalize = lambda text: re.sub(r'\s+', ' ', re.sub(r'[|।॥0-9]', ' ', text)).strip()
    for passage in corpus['passages'][1:]:
        root = normalize(passage['root'])
        units = [u for u in passage['sentenceUnits']
                 if normalize(u['targets'].get('san_levi_1925',''))
                 and normalize(u['targets']['san_levi_1925']) in root]
        # The source has katha without anusvara in 14.3; retain that wording.
        if passage['id'] == 'v14':
            units.insert(1, next(u for u in passage['sentenceUnits'] if u['number']=='14.3'))
        assert units, passage['id']
        text = mapped_text('ron_nedu_2011', passage['number'])
        group = {'id': f"nedu-{passage['id']}-root", 'numbers':[u['number'] for u in units],
                 'note':'One translated root verse corresponds to these Sanskrit verse units.'}
        for unit in units:
            plan['phraseMappings'].append({'sourceId':'ron_nedu_2011',
                'passageId':passage['id'], 'unitId':unit['id'], 'start':0, 'end':len(text),
                **({'group':group} if len(units)>1 else {}),
                'note':'Numbered Romanian root verse; a shared span, not an inferred subdivision.'})


def checked_opening_phrases():
    for sid,markers in {
        'jpn_inazu_1929':[(1,'第一節'),(2,'『諸の佛子よ'),(3,'心と意と識と表識'),
                         (4,'茲に心と云ふ'),(5,'唯だと云ふ'),(6,'（一）'),(7,'譬ふれば')],
        'hin_tiwary_1995_alternate':[(1,'महायानदर्शन'),(2,'‘हे जिनपुत्रों'),(3,'चित्त, मन,'),
                                    (4,'यहां चित्त'),(5,'मात्र ( शब्द )'),(6,'जिस प्रकार')],
    }.items():
        text=mapped_text(sid,1)
        assert all(text.count(marker)==1 for _,marker in markers),sid
        boundaries=[(unit,text.index(marker)) for unit,marker in markers]
        final=text.index('( चित्त के अतिरिक्त )') if sid.startswith('hin_') else len(text)
        for i,(unit,start) in enumerate(boundaries):
            end=boundaries[i+1][1] if i+1<len(boundaries) else final
            mapping={'sourceId':sid,'passageId':'v1','unitId':f'dharmanexus-v1-{unit:03d}',
                     'start':start,'end':end,'note':'Clause selected from the image-checked opening; scholarly review pending.'}
            if sid.startswith('hin_') and unit==6:
                mapping['group']={'id':'tiwary-alternate-v1-root','numbers':['1.6','1.7'],
                    'note':'Hindi gives the simile before the thesis in one comparative sentence; the whole sentence is shared.'}
                plan['phraseMappings'].append({**mapping,'unitId':'dharmanexus-v1-007'})
            plan['phraseMappings'].append(mapping)


if __name__ == '__main__':
    korean()
    thai()
    chatterjee()
    sharma()
    chogdub()
    tiwary_alternate()
    inazu()
    opening_phrases()
    romanian_roots()
    checked_opening_phrases()
    validate()
    target = ROOT / 'source-witnesses/document-witness-plan.json'
    target.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (ROOT/'witness-integration.js').write_text('window.DOCUMENT_WITNESS_INTEGRATION = '+
        json.dumps(plan,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    print(f"Built {len(plan['sources'])} witness plans and {len(plan['passageMappings'])} passage selections.")
