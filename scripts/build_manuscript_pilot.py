"""Build a small, explicitly provisional PT 797 package from verified image metadata."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
raw=json.loads((ROOT.parent/'inspection/commons-pt797.json').read_text('utf8'))
images=sorted(raw['query']['pages'].values(),key=lambda x:x['title'])
registry={'schemaVersion':'1.0.0','manuscripts':[{
 'id':'bnf-pt797','shelfmark':'Pelliot tibétain 797',
 'institution':'Bibliothèque nationale de France, Département des Manuscrits',
 'label':'Dunhuang · Pelliot tibétain 797','language':'Tibetan','script':'Tibetan',
 'package':'manuscripts/bnf-pt797.js','status':'Pilot · partial transcription',
 'catalogueUrl':'https://archivesetmanuscrits.bnf.fr/ark:/12148/cc1221932',
 'sourceUrl':'https://gallica.bnf.fr/ark:/12148/btv1b10097230v',
 'manifestUrl':'https://gallica.bnf.fr/iiif/ark:/12148/btv1b10097230v/manifest.json',
 'manifestStatus':'unavailable-during-verification',
 'attribution':'Source gallica.bnf.fr / Bibliothèque nationale de France; images via Wikimedia Commons',
 'rights':{'label':'Public domain (Commons record); BnF source attribution retained',
           'url':'https://gallica.bnf.fr/accueil/fr/html/conditions-dutilisation-de-gallica'},
 'relatedWitnessId':'tib_silk_dunhuang_2017',
 'bibliography':[{'id':'silk2017','label':'Jonathan A. Silk, Materials Toward the Study of Vasubandhu’s Viṁśikā (II), RET 39 (2017), 342–360',
  'url':'https://openphilology.eu/publications-jonathan-silk/articles_2017a_materials.pdf'}]
}]}
pkg={'schemaVersion':'1.0.0','id':'bnf-pt797','version':'0.4.0-draft','editor':'Gleb Sharygin',
 'status':'draft','createdAt':'2026-10-28','surfaces':[],'regions':[],'lines':[],
 'anchors':[],'annotations':[],
 'scopeNote':'Three surfaces from the first two digital images; sequence follows image order. The first six physical lines have draft transliterations following Silk 2017; a continuation excerpt on the next surface completes section II K. Their joined wording matches the supplied edition, with physical extents checked against scan crops. The diplomatic layer remains a short excerpt. Remaining lines are untranscribed. Foliation, further transcription, difficult readings and reviewed correspondences remain to be established.',
 'deliveryNote':'The viewer loads static Deep Zoom tiles from a separate manuscript-images folder, derived from the verified Commons scans. BnF manifest and tile checks returned HTTP 403. The Commons original remains a fallback if local tiles are unavailable. Full scans are not bundled in the corpus or site.',
 'provenance':[{'id':'commons-metadata','type':'catalogue-metadata','accessed':'2026-10-28',
                'note':'Image identifiers, dimensions and public-domain statement from Commons imageinfo API. Digital images are from the BnF substitute R 33337.'},
               {'id':'pilot-inspection','type':'image-inspection','date':'2026-10-28',
                'note':'Line boxes drawn against the first two source images; approximate original-pixel coordinates. Short opening excerpts positioned using the scan and the existing user-supplied Silk 2017 transcription. No independent scholarly review.'},
               {'id':'opening-line-check','type':'image-inspection','date':'2026-10-28','source':'silk2017',
                'note':'Opening transcription follows Silk 2017 p.344. The former 0.2/0.3 line-2 endpoint was found to be too late and is superseded by line-boundaries-20261029. Decorative opening strokes are not transliterated; this is not an independently reviewed edition.'},
               {'id':'bnf-pagination','type':'catalogue-metadata','accessed':'2026-10-28',
                'url':'https://gallica.bnf.fr/services/Pagination?ark=btv1b10097230v',
                'note':'Seven digital views; all pagination labels are NP. The service supplies no foliation labels and does not establish the physical order.'},
               {'id':'static-tile-derivatives','type':'image-processing','date':'2026-10-29',
                'note':'Separate Deep Zoom JPEG tiles made from the verified Commons originals, retaining 6664×2592 coordinates. 512-pixel tiles, one-pixel overlap, JPEG quality95; reduced levels use Lanczos. No contrast enhancement or restoration. See manuscript-images/bnf-pt797/PROVENANCE.json.'}]}
layouts=[(0,'s01','Image 1 · single surface',[50,510,6440,1010], [535,690,850,1000,1150,1310]),
         (1,'s02','Image 2 · upper surface',[35,170,6450,1010],[195,350,510,665,825,985]),
         (1,'s03','Image 2 · lower surface',[35,1350,6450,1040],[1370,1525,1680,1835,1995,2155])]
for order,(i,suffix,label,crop,ys) in enumerate(layouts,1):
 p=images[i];im=p['imageinfo'][0];sid='pt797-'+suffix
 pkg['surfaces'].append({'id':sid,'revision':2,'label':label,'order':order,
  'folioLabel':None,'folioStatus':'not-yet-verified','canvasId':None,
  'coordinateSpace':'original-image-pixels',
  'thumbnail':f'manuscript-images/bnf-pt797/{sid}-thumb.jpg',
  'width':im['width'],'height':im['height'],'viewport':crop,
  'image':{'type':'dzi','url':im['url'].split('?')[0],'width':im['width'],'height':im['height'],
           'tilesUrl':f'manuscript-images/bnf-pt797/view-{i+1}_files/','tileSize':512,'overlap':1,'format':'jpg',
           'sourcePage':im['descriptionurl'],'sourceId':p['pageid'],'delivery':'static-tiles-with-original-fallback'},
  'provenance':['commons-metadata','pilot-inspection','static-tile-derivatives']})
 for n,y in enumerate(ys,1):
  lid=f'{sid}-l{n:02}';rid=f'{lid}-region'
  pkg['regions'].append({'id':rid,'revision':1,'surfaceId':sid,'shape':'rect',
   'xywh':[230,y,6100,145],'status':'draft','provenance':['pilot-inspection']})
  pkg['lines'].append({'id':lid,'revision':1,'surfaceId':sid,'order':n,'label':f'Line {n}',
   'regionIds':[rid],'script':'Tibetan','hand':None,'status':'untranscribed',
   'layers':{'diplomatic':None,'transliteration':None,'normalized':None,'translation':None},
   'provenance':['pilot-inspection']})
def layer(text,note,derived=None):
 return {'text':text,'scope':'excerpt','status':'draft','note':note,
         'derivedFrom':derived,'provenance':['pilot-inspection']}
line=pkg['lines'][0];line['status']='draft'
line['layers']['diplomatic']=layer('ཐེག་པ་ཆེན་པོ་ལ་ ཁམས་གསུམ་པ་རྣམ་པར་རྀག་པ་ཙམ་དུ་རྣམ་པར་གཞག་སྟེ།།',
 'Opening Mahāyāna assertion only. Draft Unicode transcription; reversed i encoded with U+0F80. Spacing and punctuation require palaeographic review; titles and the rest of the physical line are not included.')
line['layers']['transliteration']=layer('theg pa chen po la khams gsum pa rnam par rïg pa tsam du rnam par gzhag ste ||',
 'Opening assertion only; Silk 2017 §I A. The ï convention preserves the reported reversed gi gu; positional check against the scan, not a new critical edition.')
line['layers']['normalized']=layer('theg pa chen po la khams gsum pa rnam par rig pa tsam du rnam par gzhag ste',
 'Editorial search form: reversed i regularized and punctuation omitted. This is not a diplomatic reading.',{'lineId':line['id'],'layer':'transliteration'})
line=pkg['lines'][1];line['status']='draft'
line['layers']['transliteration']=layer('sems dang yïd dang rnam par shes pa dang | rnam par rïg pa zhes bya ba nï rnam grangs su gtogs pa’o ||',
 'Synonym clause only; Silk 2017 §I C. The rest of the physical line is not yet transcribed here.')
line['layers']['normalized']=layer('sems dang yid dang rnam par shes pa dang rnam par rig pa zhes bya ba ni rnam grangs su gtogs pa’o',
 'Editorial search form with regularized i and omitted punctuation.',{'lineId':line['id'],'layer':'transliteration'})
pkg['provenance'].append({'id':'line-boundaries-20261029','type':'image-inspection','date':'2026-10-29','source':'silk2017',
 'note':'Image-1 lines1–6 and the opening of image-2 upper line1 checked with original-pixel crops. Line2 ends skra lastsogs pa; line3 starts mthong ba bzhïn te and ends gzugs. Line4 ends myed; line5 begins bar. Line6 ends yul dang dus nges; the next surface begins pa dang. Joined text through II K exactly matches the supplied Silk 2017 pp344–345 transcription after removing editorial section/page labels. Palaeographic review remains pending.'})
line_map=json.loads((ROOT/'manuscripts/pt797-opening-line-map.json').read_text('utf-8'))
for entry in line_map['lines']:
 line=next(l for l in pkg['lines'] if l['id']==entry['id']);text=entry['text'];scope=entry['scope']
 line['revision']=entry['revision'];line['status']='draft'
 provenance='opening-line-check' if entry['id']=='pt797-s01-l01' else 'line-boundaries-20261029'
 line['provenance'].append(provenance)
 note=('Textual content of the physical line; readings follow Silk 2017 p.344, with extent checked against the scan. Reversed-i convention retained. Decorative strokes excluded; palaeographic review remains pending.' if entry['id']=='pt797-s01-l01' else
       'Readings follow Silk 2017 pp.344–345. Physical extent checked against original-pixel scan crops on 29 October. Reversed-i convention retained; palaeographic review remains pending.'+(' Only the continuation of section II K is transcribed here; the rest of this physical line remains untranscribed.' if scope=='excerpt' else ''))
 line['layers']['transliteration']={'text':text,'scope':scope,'status':'draft','derivedFrom':None,'note':note,'provenance':[provenance,'silk2017']}
 line['layers']['normalized']={'text':' '.join(text.replace('ï','i').replace('|',' ').split()),'scope':scope,'status':'draft',
  'note':('Editorial search form derived from the full draft transliteration, regularizing reversed i and omitting punctuation. No additional reading is supplied.' if scope=='complete' else 'Editorial search form of the recorded excerpt; reversed i regularized and punctuation omitted. No additional reading is supplied.'),
  'derivedFrom':{'lineId':line['id'],'layer':'transliteration'},'provenance':[provenance]}
for n,passages in [(1,['v1']),(2,['v1']),(3,['v1','v2']),(4,['v2']),(5,['v2']),(6,['v2'])]:
 pkg['anchors'].append({'id':f'pt797-anchor-l{n}','revision':3 if n<=3 else 1,'lineIds':[f'pt797-s01-l{n:02}'],
  'passageIds':passages,'tokenIds':[],'relation':'partial-overlap','level':'line','status':'draft',
  'note':'Physical-line association based on the checked draft extent. Line3 crosses from the opening explanation into the objection and verse2. No word-level equivalence is asserted.',
  'provenance':['line-boundaries-20261029']})
pkg['anchors'].append({'id':'pt797-anchor-s02-l01','revision':1,'lineIds':['pt797-s02-l01'],'passageIds':['v2'],'tokenIds':[],
 'relation':'partial-overlap','level':'line','status':'draft','note':'The recorded excerpt completes section II K from the previous surface. The remaining physical line is not transcribed here; no word-level equivalence is asserted.','provenance':['line-boundaries-20261029']})
pkg['annotations'].append({'id':'pt797-pale-opening','revision':2,'type':'uncertain-reading',
 'targets':[{'regionId':'pt797-s01-l03-region'}],'text':'Verse2 is pale in this monochrome substitute. Silk 2017 p.343 reports that manuscript verses are rubricated in red. The reproduced contrast is not evidence of manuscript damage; the transliteration follows the supplied edition and remains a draft.',
 'status':'draft','author':'Pilot preparation (unreviewed)','createdAt':'2026-10-28','updatedAt':'2026-10-29','provenance':['line-boundaries-20261029','silk2017']})
pkg['annotations'].append({'id':'pt797-surface-continuation','revision':1,'type':'scholarly-note','targets':[{'lineId':'pt797-s01-l06'},{'lineId':'pt797-s02-l01'}],
 'text':'Section II K continues across these digital-image surfaces: yul dang dus nges / pa dang. This supports the local reading sequence; it does not establish an original folio label. Only the opening continuation on the second surface is transcribed here.',
 'status':'draft','author':'Gleb Sharygin (project editor; draft preparation)','createdAt':'2026-10-29','provenance':['line-boundaries-20261029']})
for addition in line_map.get('reportedAdditions',[]):
 line=next(l for l in pkg['lines'] if l['id']==addition['lineId']);value=line['layers']['transliteration']
 assert value['text'].count(addition['context'])==1
 start=value['text'].index(addition['context'])+addition['startInContext'];end=start+len(addition['text'])
 assert value['text'][start:end]==addition['text']
 value['marks']=[{'type':'add','start':start,'end':end,'reason':addition['source']+'. '+addition['note']}]
 pkg['annotations'].append({'id':line['id']+'-reported-addition','revision':1,'type':'correction','targets':[{'lineId':line['id']}],
  'text':addition['source']+'. '+addition['note']+' Recorded as a draft, following the supplied edition; independent palaeographic review remains pending.',
  'status':'draft','author':'Gleb Sharygin (project editor; draft preparation)','createdAt':'2026-10-29','provenance':['silk2017','line-boundaries-20261029']})
out=ROOT/'manuscripts';out.mkdir(exist_ok=True)
for name,obj,var in [('registry',registry,'window.MANUSCRIPT_REGISTRY'),('bnf-pt797',pkg,'window.MANUSCRIPT_PACKAGES["bnf-pt797"]')]:
 (out/(name+'.json')).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 prefix='window.MANUSCRIPT_PACKAGES = window.MANUSCRIPT_PACKAGES || {};\n' if name!='registry' else ''
 (out/(name+'.js')).write_text(prefix+var+' = '+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print('Built PT 797 pilot: 3 surfaces, 18 physical lines, 6 full-line draft transliterations plus a continuation excerpt; source text preserved.')
