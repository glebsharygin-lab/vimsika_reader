"""Create separate static Deep Zoom tiles; no full source scan enters the site.

Inputs are the verified Commons downloads in inspection/. Pixel coordinates
remain those of the original photograph. No contrast/sharpening is applied.
"""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'manuscript-images' / 'bnf-pt797'
SIZE, OVERLAP = 512, 1
OUTPUT.mkdir(parents=True, exist_ok=True)
records = []
for number in (1, 2):
    source = ROOT.parent / 'inspection' / f'pt797-view-{number}.jpg'
    with Image.open(source) as original:
        image = original.convert('RGB')
    width, height = image.size
    assert (width, height) == (6664, 2592), 'Source dimensions changed; review coordinates first.'
    maximum = math.ceil(math.log2(max(width, height)))
    count = total = 0
    for level in range(maximum + 1):
        scale = 2 ** (maximum - level)
        level_size = (math.ceil(width / scale), math.ceil(height / scale))
        resized = image if scale == 1 else image.resize(level_size, Image.Resampling.LANCZOS)
        target = OUTPUT / f'view-{number}_files' / str(level)
        target.mkdir(parents=True, exist_ok=True)
        for x in range(math.ceil(level_size[0] / SIZE)):
            for y in range(math.ceil(level_size[1] / SIZE)):
                box = (max(0, x*SIZE-OVERLAP), max(0, y*SIZE-OVERLAP),
                       min(level_size[0], (x+1)*SIZE+OVERLAP), min(level_size[1], (y+1)*SIZE+OVERLAP))
                tile = target / f'{x}_{y}.jpg'
                resized.crop(box).save(tile, 'JPEG', quality=95, subsampling=0, optimize=True)
                count += 1
                total += tile.stat().st_size
    (OUTPUT / f'view-{number}.dzi').write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<Image xmlns="http://schemas.microsoft.com/deepzoom/2008" Format="jpg" Overlap="{OVERLAP}" TileSize="{SIZE}"><Size Width="{width}" Height="{height}"/></Image>\n', 'utf8')
    records.append(dict(view=number, width=width, height=height, maxLevel=maximum,
                        tiles=count, tileBytes=total, sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest()))
    crops=[('pt797-s01',[50,510,6440,1010])] if number==1 else [('pt797-s02',[35,170,6450,1010]),('pt797-s03',[35,1350,6450,1040])]
    for sid,(x,y,w,h) in crops:
        image.crop((x,y,x+w,y+h)).resize((384,round(384*h/w)),Image.Resampling.LANCZOS).save(OUTPUT/f'{sid}-thumb.jpg','JPEG',quality=90)
(OUTPUT / 'PROVENANCE.json').write_text(json.dumps({
    'manuscriptId': 'bnf-pt797', 'createdAt': '2026-10-29', 'format': 'Deep Zoom Image',
    'tileSize': SIZE, 'overlap': OVERLAP, 'jpegQuality': 95,
    'source': 'BnF, Pelliot tibétain 797, monochrome substitute R33337; images 1 and 2 via Wikimedia Commons',
    'credit': 'Source gallica.bnf.fr / Bibliothèque nationale de France',
    'sourceRecord': 'https://commons.wikimedia.org/wiki/Category:Pelliot_tib%C3%A9tain_797_-_btv1b10097230v',
    'rights': 'Public domain according to the Commons image records; institutional source attribution retained.',
    'processing': 'Lower levels resized with Lanczos; all levels JPEG-encoded. No enhancement, restoration or transcription changes. Original scan coordinate system retained.',
    'views': records
}, ensure_ascii=False, indent=2)+'\n', 'utf8')
print(json.dumps(records))
