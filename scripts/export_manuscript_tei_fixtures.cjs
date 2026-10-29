// Synthetic export cases are QA fixtures only; never manuscript source data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'../inspection/tei-profile');
const ctx=vm.createContext({window:{},URL});
for(const file of ['manuscripts-core.js','manuscripts-review-core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const core=ctx.window.ManuscriptCore,review=ctx.window.ManuscriptReviewCore;
const base=JSON.parse(fs.readFileSync(path.join(root,'manuscripts/bnf-pt797.json'))),record=JSON.parse(fs.readFileSync(path.join(root,'manuscripts/registry.json'))).manuscripts[0];
const corpus={passages:JSON.parse(fs.readFileSync(path.join(root,'manuscripts/corpus-anchors.json'))).passageIds.map(id=>({id,texts:{}}))};
fs.mkdirSync(out,{recursive:true});const expected={};
function save(name,data,events=[]){fs.writeFileSync(path.join(out,name+'.xml'),core.tei(data,record,events));expected[name]={data,record,events};}
save('base',base);
const all=core.clone(base),layer=all.lines[0].layers.transliteration;
layer.text='a𐀀bcd';layer.marks=['unclear','damage','supplied','add','del'].map((type,i)=>({type,start:i,end:i+1,reason:`QA ${type}: uncertain <angle> & punctuation "quoted".`}));
save('all-reading-marks',all);
const empty=core.clone(base);empty.anchors=[];empty.annotations=[];empty.lines.forEach(line=>{line.status='untranscribed';Object.keys(line.layers).forEach(key=>line.layers[key]=null);});
save('untranscribed',empty);
const draft=core.emptyDraft(base),line=core.clone(all.lines[0]);line.revision++;
draft.records.push({id:'qa-draft',kind:'line',targetId:line.id,baseRevision:line.revision-1,value:line,provenance:{author:'QA only',updatedAt:'2026-10-29T07:00:00Z',status:'draft'}});
const proposal={schemaVersion:'1.0.0-manuscript-proposal',id:'qa-proposal',manuscriptId:base.id,author:{login:'qa-author',id:101},submittedAt:'2026-10-29T07:00:00Z',note:'Synthetic fixture',draft};
const decided=review.decide(base,null,proposal,{id:'qa-review',reviewer:{login:'qa-editor',id:102},decision:'accepted',note:'QA decision <literal> & retained uncertainty',decidedAt:'2026-10-29T07:10:00Z'},corpus);
save('reviewed',decided.data,decided.ledger.events);
fs.writeFileSync(path.join(out,'expected.json'),JSON.stringify(expected,null,2));
for(const bad of ['\u0000','\ud800','\udfff']) {
 const copy=core.clone(base);copy.lines[0].layers.transliteration.text=bad;
 require('node:assert/strict').throws(()=>core.tei(copy,record),/XML-invalid/);
}
console.log('Exported four isolated TEI fixtures: base, all marks, untranscribed and review history.');
