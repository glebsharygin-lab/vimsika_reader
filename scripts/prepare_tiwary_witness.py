"""Preserve new OCR and select Hindi separately from facing Sanskrit passages.

Ranges are one-based physical OCR line numbers checked against the printed
section sequence. OCR spelling remains unproofed; this is not a critical text.
"""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OCR=ROOT.parent/'inspection/tiwary-final-ocr'
RANGES={
 1:[('034-right',17,25)],
 2:[('035-left',17,28),('035-right',2,11)],
 3:[('035-right',30,32),('036-left',2,16)],
 4:[('036-right',8,33),('037-left',2,4)],
 5:[('037-left',15,23)],
 6:[('037-right',5,14)],
 7:[('037-right',27,30),('038-left',3,8)],
 8:[('038-left',10,12),('038-left',28,40)],
 9:[('038-right',15,26)],
 10:[('039-left',28,43),('039-right',2,15)],
 11:[('039-right',16,18),('040-left',4,19)],
 12:[('040-left',31,36),('040-right',2,8)],
 13:[('040-right',22,30),('041-left',2,3)],
 14:[('041-left',5,5),('041-left',39,44),('041-right',2,27)],
 15:[('042-left',13,34)],
 16:[('042-right',16,35)],
 17:[('043-left',30,48),('043-right',3,19)],
 18:[('044-left',5,30)],
 19:[('044-right',4,16)],
 20:[('044-right',31,33),('045-left',2,13)],
 21:[('045-left',26,31),('045-right',2,8)],
 22:[('045-right',20,29)],
}
blocks=[]; lookup={}; snapshots={}
for f in sorted(OCR.glob('*.txt')):
    key=f.stem.removeprefix('page-'); text=f.read_text('utf8')
    page,side=key.split('-')
    block={'id':'tiwary-reocr-'+key,'label':f'PDF {int(page)} · {side} physical page',
           'locator':f'Alternate scan PDF page {int(page)}, {side} side · new local OCR, unproofed',
           'text':text,'pdfPage':int(page),'physicalSide':side,'reviewStatus':'unproofed-ocr'}
    blocks.append(block); lookup[key]=block
    snapshots[f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
component={'id':'hin-tiwary-reocr-20261027','label':'Hindi/Sanskrit scan · new OCR · unproofed',
           'kind':'translation-ocr-draft','blocks':blocks,
           'provenance':{'engine':'Tesseract.js 7 with official tessdata_best Hindi',
                         'method':'Separate facing pages; deskew and local contrast before OCR. No spelling corrections.',
                         'reviewStatus':'unproofed-ocr','sourceTextSha256':snapshots}}
mappings=[]
for verse,ranges in RANGES.items():
    fragments=[]
    for key,a,b in ranges:
        block=lookup[key]; lines=block['text'].splitlines(keepends=True)
        start=sum(map(len,lines[:a-1])); end=sum(map(len,lines[:b]))
        assert block['text'][start:end].strip(),(verse,key)
        fragments.append({'componentId':component['id'],'blockId':block['id'],'start':start,'end':end})
    mappings.append({'sourceId':'hin_tiwary_1995_alternate','passageId':f'v{verse}',
                     'level':'passage','fragments':fragments,'coverageStatus':'unproofed-ocr',
                     'note':'Alternate scan of the existing Mahesh Tiwary 1995 edition, not an independent translation. Hindi selected from the bilingual pages; OCR spelling remains unproofed. No phrase alignment is inferred.',
                     'coverageNote':'Unproofed OCR from the alternate scan: damaged letters, punctuation and word beginnings remain uncertain. Check the source document before quoting.'})
out={'documentId':'hin_tiwary_1995_alternate','component':component,'passageMappings':mappings}
(ROOT/'source-witnesses/tiwary-reocr-selections.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Prepared',len(blocks),'source pages and',len(mappings),'Hindi passage selections.')
