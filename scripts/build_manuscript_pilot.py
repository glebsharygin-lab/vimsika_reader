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
pkg={'schemaVersion':'1.0.0','id':'bnf-pt797','version':'0.2.0-draft','editor':'Gleb Sharygin',
 'status':'draft','createdAt':'2026-10-28','surfaces':[],'regions':[],'lines':[],
 'anchors':[],'annotations':[],
 'scopeNote':'Three surfaces from the first two digital images; sequence follows image order. The first two physical lines have draft transliterations based on Silk 2017, with line boundaries checked against the scan; the diplomatic layer remains a short excerpt. Other lines are untranscribed. Foliation, further transcription, difficult readings and reviewed correspondences remain to be established.',
 'deliveryNote':'BnF image-1 metadata and pagination were retrieved, but subsequent manifest and tile checks still returned HTTP 403. This pilot retains the selected Commons image on demand (about 1–1.6 MB), not IIIF tiles. No scans are bundled in the Reader.',
 'provenance':[{'id':'commons-metadata','type':'catalogue-metadata','accessed':'2026-10-28',
                'note':'Image identifiers, dimensions and public-domain statement from Commons imageinfo API. Digital images are from the BnF substitute R 33337.'},
               {'id':'pilot-inspection','type':'image-inspection','date':'2026-10-28',
                'note':'Line boxes drawn against the first two source images; approximate original-pixel coordinates. Short opening excerpts positioned using the scan and the existing user-supplied Silk 2017 transcription. No independent scholarly review.'},
               {'id':'opening-line-check','type':'image-inspection','date':'2026-10-28','source':'silk2017',
                'note':'Silk 2017 p.344 sections 0, I A–H and the opening of II, checked against three consecutive crops covering the first two physical lines of image 1. Line 2 ends after ces; brgal te begins line 3. Readings follow Silk, not an independently reviewed edition. Decorative opening strokes are not transliterated.'},
               {'id':'bnf-pagination','type':'catalogue-metadata','accessed':'2026-10-28',
                'url':'https://gallica.bnf.fr/services/Pagination?ark=btv1b10097230v',
                'note':'Seven digital views; all pagination labels are NP. This confirms no foliation labels and does not establish the physical order.'}]}
layouts=[(0,'s01','Image 1 · single surface',[50,510,6440,1010], [535,690,850,1000,1150,1310]),
         (1,'s02','Image 2 · upper surface',[35,170,6450,1010],[195,350,510,665,825,985]),
         (1,'s03','Image 2 · lower surface',[35,1350,6450,1040],[1370,1525,1680,1835,1995,2155])]
for order,(i,suffix,label,crop,ys) in enumerate(layouts,1):
 p=images[i];im=p['imageinfo'][0];sid='pt797-'+suffix
 pkg['surfaces'].append({'id':sid,'revision':1,'label':label,'order':order,
  'folioLabel':None,'folioStatus':'not-yet-verified','canvasId':None,
  'coordinateSpace':'original-image-pixels',
  'width':im['width'],'height':im['height'],'viewport':crop,
  'image':{'type':'image','url':im['url'].split('?')[0],'width':im['width'],'height':im['height'],
           'sourcePage':im['descriptionurl'],'sourceId':p['pageid'],'delivery':'single-image-fallback'},
  'provenance':['commons-metadata','pilot-inspection']})
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
opening_lines=[
 'rgya gar skad du | bïng shï ka ’brïd tï || || bod skad du nyï shu pa ’grel ba || ’jam dpal gzhonur gyur pa la phyag ’tsal lo || theg pa chen po la khams gsum pa rnam par rïg pa tsam du rnam par gzhag ste || mdo las kye rgyal ba’ï sras dag | ’dï lta ste | khams gsum pa ’dï ni sems tsam mo zhes ’byung ba’ï phyir ro ||',
 'sems dang yïd dang rnam par shes pa dang | rnam par rïg pa zhes bya ba nï rnam grangs su gtogs pa’o || sems de yang ’dïr mtshungs par ldan ba dang | bcas par dgongs pa’o || tsam zhes bya ba smos pa nï don dgag pa’ï phyir ro || rnam par shes pa ’dï nyïd don du snang bar ’byung ste | dper na rab rïb can rnams kyïs || skra lastsogs pa mthong ba bzhïn te | don gang yang myed do || ’dïr ’dï skad ces'
]
for n,text in enumerate(opening_lines):
 line=pkg['lines'][n];line['revision']=2;line['provenance'].append('opening-line-check')
 line['layers']['transliteration']={'text':text,'scope':'complete','status':'draft','derivedFrom':None,
  'note':'Textual content of the physical line; readings follow Silk 2017 p.344, with extent checked against the scan. Reversed-i convention retained. Decorative strokes excluded; palaeographic review remains pending.'+(' The objection continues with brgal te on the next line.' if n==1 else ''),
  'provenance':['opening-line-check','silk2017']}
 line['layers']['normalized']={'text':' '.join(text.replace('ï','i').replace('|',' ').split()),'scope':'complete','status':'draft',
  'note':'Editorial search form derived from the full draft transliteration, regularizing reversed i and omitting punctuation. No additional reading is supplied.',
  'derivedFrom':{'lineId':line['id'],'layer':'transliteration'},'provenance':['opening-line-check']}
for n,passages in [(1,['v1']),(2,['v1','v2']),(3,['v2'])]:
 pkg['anchors'].append({'id':f'pt797-anchor-l{n}','revision':2,'lineIds':[f'pt797-s01-l{n:02}'],
  'passageIds':passages,'tokenIds':[],'relation':'partial-overlap','level':'line','status':'draft',
  'note':'Physical-line association only. The second line reaches the opening of the objection preceding verse 2 and ends at ces; the objection continues with brgal te on line 3. No word-level equivalence is asserted.',
  'provenance':['pilot-inspection']})
pkg['annotations'].append({'id':'pt797-pale-opening','revision':1,'type':'uncertain-reading',
 'targets':[{'regionId':'pt797-s01-l03-region'}],'text':'Much of this line is pale in the monochrome substitute. The cause has not been established; do not automatically classify it as manuscript damage.',
 'status':'draft','author':'Pilot preparation (unreviewed)','createdAt':'2026-10-28','provenance':['pilot-inspection']})
out=ROOT/'manuscripts';out.mkdir(exist_ok=True)
for name,obj,var in [('registry',registry,'window.MANUSCRIPT_REGISTRY'),('bnf-pt797',pkg,'window.MANUSCRIPT_PACKAGES["bnf-pt797"]')]:
 (out/(name+'.json')).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 prefix='window.MANUSCRIPT_PACKAGES = window.MANUSCRIPT_PACKAGES || {};\n' if name!='registry' else ''
 (out/(name+'.js')).write_text(prefix+var+' = '+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print('Built PT 797 pilot: 3 surfaces, 18 physical lines, 2 full-line draft transliterations; images external.')
