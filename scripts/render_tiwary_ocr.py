"""Render each physical page separately and deskew using source OCR geometry."""
import math, statistics, sys, re, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]/'.codex_deps'))
import fitz
from PIL import Image, ImageFilter, ImageOps
import numpy as np

source=Path(sys.argv[1]); output=Path(sys.argv[2]); output.mkdir(parents=True,exist_ok=True)
doc=fitz.open(source)
manifest=[]
for n in range(34,46):
    page=doc[n-1]; width,height=page.rect.width,page.rect.height
    for side,a,b in [('left',0,.515),('right',.515,1)]:
        spans=[s for block in page.get_text('dict')['blocks'] for line in block.get('lines',[]) for s in line['spans']
               if len(re.findall(r'[\u0900-\u097f]',s['text']))>2 and width*a <= (s['bbox'][0]+s['bbox'][2])/2 < width*b]
        if not spans: continue
        clip=fitz.Rect(max(width*a,min(s['bbox'][0] for s in spans)-12),max(0,min(s['bbox'][1] for s in spans)-12),
                       min(width*b,max(s['bbox'][2] for s in spans)+12),min(height,max(s['bbox'][3] for s in spans)+12))
        # Damaged OCR can omit the beginnings of right-page lines. Do not let
        # those omissions determine the new image's left edge.
        if side == 'right': clip.x0 = width*a+3
        pix=page.get_pixmap(matrix=fitz.Matrix(3,3),clip=clip)
        img=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        angles=[math.degrees(math.atan2(*reversed(l['dir'])))
                for block in page.get_text('dict')['blocks'] for l in block.get('lines',[])
                if width*a < l['bbox'][0] < width*b and l['bbox'][2]-l['bbox'][0]>120]
        angle=statistics.median(angles) if angles else 0
        img=img.rotate(angle,expand=True,fillcolor='white').convert('L')
        pixels=np.asarray(img,dtype=float); background=np.asarray(img.filter(ImageFilter.GaussianBlur(16)),dtype=float)
        img=Image.fromarray(np.uint8(np.where(pixels/np.maximum(background,1)<.8,0,255)))
        ImageOps.expand(img,border=30,fill=255).save(output/f'page-{n:03d}-{side}.png')
        manifest.append({'page':n,'side':side,'clipPdfPoints':list(clip),'scale':3,'rotationDegrees':angle,
                         'preprocessing':'local contrast threshold 0.8, Gaussian radius16, border30px'})
        print(n,side,round(angle,2))
(output/'render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
