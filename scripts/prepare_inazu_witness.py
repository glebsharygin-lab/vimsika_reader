"""Keep raw Japanese OCR addressable and map provisional passage boundaries.

The opening has a separate image-checked transcription. The remaining text is
explicitly marked severely uncertain OCR, not a reliable quotation source.
"""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
input_file=ROOT.parent/'inspection/inazu-reocr-blocks-draft.json'
rows=json.loads(input_file.read_text('utf8'))
starts=['p011-l12','p013-l09','p014-l27','p016-l19','p017-l09','p018-l04',
        'p018-l19','p019-l16','p020-l20','p022-l23','p023-l28','p024-l13',
        'p025-l14','p027-l12','p029-l03','p029-l33','p031-l19','p032-l14',
        'p033-l21','p034-l27','p035-l23']
blocks=[{**r,'label':f'PDF page {r["page"]} · OCR segment {r["order"]}',
         'locator':f'Inazu 1929 PDF page {r["page"]}, vertical OCR segment {r["order"]}, unproofed',
         'reviewStatus':'severely-uncertain-ocr'} for r in rows]
component={'id':'jpn-inazu-reocr-20261027','label':'Vertical Japanese OCR · severely uncertain',
           'kind':'translation-ocr-draft','blocks':blocks,
           'provenance':{'engine':'Windows Japanese OCR; page 19 recognized by cropped columns',
                         'orderedInputSha256':hashlib.sha256(input_file.read_bytes()).hexdigest(),
                         'method':'Right-to-left physical column ordering; small glosses and OCR spellings remain uncertain.',
                         'reviewStatus':'severely-uncertain-ocr'}}
indices=[next(i for i,r in enumerate(rows) if r['id']=='inazu-reocr-'+start) for start in starts]
assert indices==sorted(indices)
mappings=[]
for verse,(a,b) in enumerate(zip(indices,indices[1:]+[len(rows)]),2):
    selected=[r for r in rows[a:b] if not r['text'].startswith(('哲學研究第','梵文唯識二十論')) and r['id']!='inazu-reocr-p014-l26']
    mappings.append({'sourceId':'jpn_inazu_1929','passageId':f'v{verse}','level':'passage',
                     'componentId':component['id'],'blockIds':[r['id'] for r in selected],
                     'coverageStatus':'severely-uncertain-ocr',
                     'coverageNote':'Severely uncertain vertical OCR: damaged readings and the order of small glosses need checking against the scan. Do not quote this draft as a verified transcription.',
                     'note':'Provisional passage assignment using printed verse numbers and preceding questions. No phrase-level correspondence is inferred. The continuous original document and raw OCR are preserved.'})
out={'documentId':'jpn_inazu_1929','component':component,'passageMappings':mappings}
(ROOT/'source-witnesses/inazu-reocr-selections.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Prepared',len(blocks),'Japanese OCR blocks and',len(mappings),'draft passage assignments; opening supplied separately.')
