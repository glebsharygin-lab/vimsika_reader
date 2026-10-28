"""Recover reading order from the alternate scan's skewed PDF text layer.

No OCR characters are corrected. Physical page sides and baseline geometry are
used to reunite lines which the supplied plain-text extraction interleaves.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    import fitz
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[4]/'.codex_deps'))
    import fitz


def extract_page(page, number):
    sides = {'left': [], 'right': []}
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            if not line['spans']:
                continue
            dx, dy = line['dir']
            slope = dy / dx if dx else 0
            # The supplied OCR sometimes joins a left-page line to a right-page
            # line. Classify individual spans before reconstructing baselines.
            for span in line['spans']:
                midpoint = (span['bbox'][0] + span['bbox'][2]) / 2
                side = 'left' if midpoint < page.rect.width * .515 else 'right'
                anchor = page.rect.width * (.13 if side == 'left' else .53)
                x, y = span['origin']
                baseline = y - slope * (x - anchor)
                sides[side].append((baseline, [span]))
    blocks = []
    for side, lines in sides.items():
        groups = []
        for baseline, spans in sorted(lines, key=lambda line:line[0]):
            if groups and abs(baseline-groups[-1]['baseline']) < 5:
                groups[-1]['spans'].extend(spans)
            else:
                groups.append({'baseline':baseline,'spans':list(spans)})
        for i, group in enumerate(groups,1):
            spans = sorted(group['spans'],key=lambda span:span['origin'][0])
            text = ' '.join(''.join(span['text'] for span in spans).split())
            if text:
                blocks.append({'id':f'tiwary-layout-p{number:03d}-{side}-l{i:02d}',
                    'label':f'PDF page {number}, {side} side, line {i}',
                    'locator':f'Alternate scan PDF page {number} · {side} side · reconstructed OCR line {i}',
                    'text':text,'pdfPage':number,'side':side,'baseline':round(group['baseline'],2),
                    'reviewStatus':'unproofed-ocr-layout-draft'})
    return blocks


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf',type=Path)
    parser.add_argument('output',type=Path)
    args = parser.parse_args()
    doc = fitz.open(args.pdf)
    blocks = [block for number in range(34,46) for block in extract_page(doc[number-1],number)]
    result = {'documentId':'hin_tiwary_1995_alternate',
        'sourceSnapshot':{'name':args.pdf.name,'sha256':hashlib.sha256(args.pdf.read_bytes()).hexdigest()},
        'method':'PDF text-layer spans grouped by physical page side and deskewed baseline; no character corrections',
        'component':{'id':'hin-tiwary-layout-draft','label':'Alternate scan · reconstructed reading order · unproofed',
                     'kind':'translation-ocr-draft','blocks':blocks}}
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f'Extracted {len(blocks)} physical text lines from 12 scan images.')
