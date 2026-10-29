"""Validate the exported subset against TEI P5 and the documented Reader profile.

Run export_manuscript_tei_fixtures.cjs first. No network is used during validation.
These tests do not claim universal TEI Schematron coverage or palaeographic review.
"""
from pathlib import Path
from copy import deepcopy
import hashlib,json
from lxml import etree

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT.parent/'inspection/tei-profile'
SCHEMA=ROOT/'manuscripts/tei/tei_all-4.12.0.rng'
NS={'t':'http://www.tei-c.org/ns/1.0','xml':'http://www.w3.org/XML/1998/namespace'}
XID='{'+NS['xml']+'}id'
parser=etree.XMLParser(resolve_entities=False,no_network=True)
provenance=json.loads((SCHEMA.parent/'schema-provenance.json').read_text('utf-8'))
assert hashlib.sha256(SCHEMA.read_bytes()).hexdigest()==provenance['sha256'],'Pinned schema hash changed.'
schema=etree.RelaxNG(etree.parse(str(SCHEMA),parser))

def get(tree,expression):return tree.xpath(expression,namespaces=NS)
def text(element):return ''.join(element.itertext())
def validate(tree,expected):
    assert not tree.docinfo.doctype,'External document declarations are outside the export profile.'
    assert schema.validate(tree),str(schema.error_log)
    data=expected['data'];events=expected['events']
    ids=get(tree,'//@xml:id');assert len(ids)==len(set(ids)),'Duplicate XML IDs.'
    idset=set(ids)
    for attribute in get(tree,'//@facs'):
        assert all(x.startswith('#') and x[1:] in idset for x in attribute.split()),'Unresolved facsimile target.'
    for attribute in get(tree,'//@target'):
        for target in attribute.split():
            if target.startswith('#'):assert target[1:] in idset,'Unresolved internal target.'
            else:assert target in {'../index.html#'+pid for a in data['anchors'] for pid in a['passageIds']},'Unknown logical passage target.'
    for surface in data['surfaces']:
        s=get(tree,f'//t:surface[@xml:id="{surface["id"]}"]');assert len(s)==1
        assert tuple(float(s[0].get(k)) for k in ['ulx','uly','lrx','lry'])==(0,0,surface['width'],surface['height'])
        assert s[0].find('t:graphic',NS).get('url')==surface['image']['url']
    for region in data['regions']:
        zone=get(tree,f'//t:zone[@xml:id="{region["id"]}"]');assert len(zone)==1
        assert zone[0].getparent().get(XID)==region['surfaceId']
        x,y,w,h=region['xywh'];assert tuple(float(zone[0].get(k)) for k in ['ulx','uly','lrx','lry'])==(x,y,x+w,y+h),'Changed original-pixel geometry.'
    order={s['id']:s['order'] for s in data['surfaces']}
    lines=sorted(data['lines'],key=lambda line:(order[line['surfaceId']],line['order']))
    assert get(tree,'//t:div[@type="physical-lines"]/t:ab/@xml:id')==[line['id'] for line in lines],'Physical reading order changed.'
    layers=['diplomatic','transliteration','normalized','translation']
    assert get(tree,'//t:div[@type="transcription"]/@subtype')==layers,'Layers conflated or missing.'
    for layer in layers:
        exported=get(tree,f'//t:div[@type="transcription"][@subtype="{layer}"]/t:ab')
        written=[line for line in lines if line['layers'][layer] is not None]
        assert len(exported)==len(written),'Untranscribed text was invented or a reading lost.'
        for ab,line in zip(exported,written):
            value=line['layers'][layer];prefix=line['id']+'-'+layer
            assert ab.get(XID)==prefix
            lb=ab.find('t:lb',NS);assert lb.get('n')==str(line['order'])
            assert lb.get('facs','').split()==['#'+r for r in line['regionIds']]
            seg=ab.find('t:seg',NS);assert seg.get('type')==value['scope']
            assert text(seg)==value['text'],'Source wording or Unicode characters changed.'
            assert text(ab.find('t:note',NS))==(value.get('note') or ''),'Layer note changed.'
            marks=value.get('marks',[]);assert len(seg)==len(marks)
            position=len(seg.text or '')
            for n,(element,mark) in enumerate(zip(seg,marks),1):
                assert etree.QName(element).localname==mark['type']
                assert position==mark['start'] and position+len(text(element))==mark['end'],'Mark offsets changed.'
                assert text(element)==value['text'][mark['start']:mark['end']]
                position+=len(text(element))+len(element.tail or '')
                if mark.get('reason'):
                    target=prefix+'-mark-'+str(n);assert element.get(XID)==target
                    notes=get(ab,f't:note[@type="reading-mark"][@target="#{target}"]')
                    assert len(notes)==1 and text(notes[0])==mark['reason'],'Mark explanation lost or changed.'
            assert len(get(ab,'t:note[@type="reading-mark"]'))==sum(bool(m.get('reason')) for m in marks)
    links=get(tree,'//t:linkGrp[@type="manuscript-corpus"]/t:link');assert len(links)==len(data['anchors'])
    for link,anchor in zip(links,data['anchors']):
        assert link.get(XID)==anchor['id'] and link.get('type')==anchor['relation'] and link.get('ana')==anchor['level']
        assert link.get('target').split()==['#'+x for x in anchor['lineIds']]+['../index.html#'+p for p in anchor['passageIds']]
    notes=get(tree,'//t:div[@type="annotations"]/t:note');assert len(notes)==len(data['annotations'])
    for note,annotation in zip(notes,data['annotations']):
        assert note.get(XID)==annotation['id'] and text(note)==annotation['text']
        assert note.get('target').split()==['#'+(t.get('regionId') or t['lineId']) for t in annotation['targets']]
    changes=get(tree,'//t:revisionDesc/t:change');assert len(changes)==len(events)
    for change,event in zip(changes,events):
        assert change.get('who')=='https://github.com/'+event['reviewer']['login']
        assert change.get('when')==event['decidedAt'] and change.get('type')==event['decision']
        assert event['proposal']['author']['login'] in text(change) and event['note'] in text(change)
    return True

expected=json.loads((FOLDER/'expected.json').read_text('utf-8'))
trees={}
for name,data in expected.items():
    tree=etree.parse(str(FOLDER/(name+'.xml')),parser);validate(tree,data);trees[name]=tree
    print('PASS:',name,'TEI P5 4.12.0 + Reader export profile')

# Negative cases prove the tests detect loss/corruption rather than mirror output.
def reject(name,case,mutate):
    tree=deepcopy(trees[case]);mutate(tree)
    try:validate(tree,expected[case])
    except AssertionError:print('PASS: rejected',name);return
    raise AssertionError('Invalid export passed: '+name)
reject('unsupported mark attribute','all-reading-marks',lambda t:get(t,'//t:damage')[0].set('reason','not valid here'))
reject('missing image reference','base',lambda t:get(t,'//t:lb')[0].set('facs','#missing-zone'))
reject('changed source text','base',lambda t:setattr(get(t,'//t:seg')[0],'text','invented reading'))
reject('shifted rectangle','base',lambda t:get(t,'//t:zone')[0].set('ulx','-1'))
reject('lost mark explanation','all-reading-marks',lambda t:setattr(get(t,'//t:note[@type="reading-mark"]')[0],'text',''))
reject('false reviewer','reviewed',lambda t:get(t,'//t:change')[0].set('who','https://github.com/not-the-reviewer'))
print('All TEI schema/profile and negative-control checks passed; no source data modified.')
