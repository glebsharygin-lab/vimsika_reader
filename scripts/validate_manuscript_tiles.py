"""Check all pyramid geometry and sampled full-resolution source fidelity."""
from pathlib import Path
import json, math, hashlib
from PIL import Image, ImageChops, ImageStat

ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'manuscript-images/bnf-pt797'
metadata=json.loads((assets/'PROVENANCE.json').read_text('utf8'))
for view in metadata['views']:
    number=view['view'];source=ROOT.parent/'inspection'/f'pt797-view-{number}.jpg'
    assert hashlib.sha256(source.read_bytes()).hexdigest()==view['sourceSHA256']
    original=Image.open(source).convert('RGB');count=0
    for level in range(view['maxLevel']+1):
        scale=2**(view['maxLevel']-level)
        width,height=math.ceil(view['width']/scale),math.ceil(view['height']/scale)
        for x in range(math.ceil(width/512)):
            for y in range(math.ceil(height/512)):
                box=(max(0,x*512-1),max(0,y*512-1),min(width,(x+1)*512+1),min(height,(y+1)*512+1))
                path=assets/f'view-{number}_files'/str(level)/f'{x}_{y}.jpg'
                with Image.open(path) as tile:
                    assert tile.size==(box[2]-box[0],box[3]-box[1]),path
                    if level==view['maxLevel'] and (x,y) in [(0,0),(5,1),(12,5)]:
                        error=ImageStat.Stat(ImageChops.difference(tile.convert('RGB'),original.crop(box))).mean
                        assert max(error)<5,(path,error)
                count+=1
    assert count==view['tiles']==125
assert len(list(assets.rglob('*.jpg')))==253
for thumb in assets.glob('*-thumb.jpg'):
    with Image.open(thumb) as im: assert im.width==384 and 50<im.height<100
print('PASS: 250 tile dimensions, original coordinate coverage, source hashes and sampled JPEG fidelity.')
