import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {manuscriptRequest} from '../src/manuscript-review.js';
import {manuscriptRepository} from '../src/manuscript-repository.js';
import worker,{mergeEditorial} from '../src/index.js';

// In a checkout the site is the repository root; local staged releases can
// supply a separate root. No authentication settings are read by these tests.
const site=process.env.VIMSIKA_SITE_ROOT?pathToFileURL(path.resolve(process.env.VIMSIKA_SITE_ROOT)+path.sep):new URL('../../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,site),'utf8'));
const original=read('manuscripts/bnf-pt797.json'),index=read('manuscripts/corpus-anchors.json');
const core=globalThis.ManuscriptCore,review=globalThis.ManuscriptReviewCore,clone=core.clone;
const corpus={passages:index.passageIds.map(id=>({id,texts:{}}))};
const contributor={user:{id:11,login:'contributor',name:'Contributor'},role:'contributor'};
const editor={user:{id:22,login:'editor',name:'Editor'},role:'editor'};
const other={user:{id:33,login:'other'},role:'contributor'};
globalThis.fetch=()=>{throw new Error('Unexpected external network request in a mock-only test.');};
function fixture(){
 const store=new Map(),writes=[];let head='head-1';
 let editorial={units:[{id:'preserve-me'}],textEdits:{sentinel:{text:'unchanged'}},otherExtension:{a:1}};
 const base=clone(original);
 const env={MANUSCRIPT_REVIEW_ENABLED:'true',SITE_URL:'https://reader.invalid',ADMIN_GITHUB_LOGIN:'admin',AUTH:{
  get:async(key,type)=>{const value=store.get(key);return type==='json'&&value?JSON.parse(value):value||null;},
  put:async(key,value)=>{store.set(key,value);},
  list:async()=>({keys:[...store.keys()].map(name=>({name})),list_complete:true})
 }};
 const deps={snapshot:async()=>({head,base:clone(base),editorial:clone(editorial),corpus}),commit:async(snapshot,value,user)=>{
  assert.equal(snapshot.head,head);writes.push({value:clone(value),user});editorial=clone(value);head='head-'+(writes.length+1);return {url:'https://github.invalid/commit/test'};
 }};
 const call=async(path='',method='GET',body,session=contributor)=>manuscriptRequest(new Request('https://worker.invalid/api/manuscripts/proposals'+path,{method,body:body===undefined?undefined:JSON.stringify(body)}),session,env,deps);
 const draft=(version=base)=>{const d=core.emptyDraft(version),line=clone(version.lines[0]);line.revision++;line.layers.transliteration.text+=' [TEST proposal]';line.status='draft';d.records.push({id:'draft-'+line.id,kind:'line',targetId:line.id,baseRevision:line.revision-1,value:line,provenance:{author:'unverified name',updatedAt:'2026-10-29T06:00:00Z',status:'draft'}});return d;};
 const submit=async(d=draft())=>(await call('','POST',{draft:d,note:'Mock evidence; never real manuscript data.',author:{login:'forged',id:999}})).json();
 return {env,deps,store,writes,base,call,draft,submit,getEditorial:()=>editorial,setHead:h=>head=h};
}
async function status(promise,value){await assert.rejects(promise,error=>error.status===value);}

test('submit stamps authenticated identity, preserves originals and never publishes',async()=>{
 const f=fixture(),before=JSON.stringify(f.base),draft=f.draft(),saved=JSON.stringify(draft);
 const result=await f.submit(draft);assert.equal(result.status,'submitted');assert.deepEqual(result.proposal.author,contributor.user);assert.equal(result.proposal.draft.records[0].provenance.author,'unverified name');
 assert.equal(JSON.stringify(draft),saved);assert.equal(JSON.stringify(f.base),before);assert.equal(f.writes.length,0);
 const list=await(await f.call('?manuscript=bnf-pt797')).json();assert.equal(list.proposals.length,1);
 await status(f.call('/'+result.proposal.id,'GET',undefined,other),403);
 const otherList=await(await f.call('?manuscript=bnf-pt797','GET',undefined,other)).json();assert.equal(otherList.proposals.length,0);
 await status(f.call('/'+result.proposal.id+'/decision','POST',{decision:'accepted',note:'forged review',repositoryHead:'head-1'}),403);
});
test('reject disabled, invalid, stale, unsafe geometry and unknown passage proposals',async()=>{
 const f=fixture();f.env.MANUSCRIPT_REVIEW_ENABLED='false';await status(f.submit(),503);f.env.MANUSCRIPT_REVIEW_ENABLED='true';
 await status(f.call('','POST',{draft:f.draft(),note:''}),400);
 let draft=f.draft();draft.baseVersion='old';await status(f.submit(draft),409);
 draft=f.draft();draft.records[0].value.revision=99;await status(f.submit(draft),400);
 draft=f.draft();draft.records.push({id:'bad-region',kind:'region',targetId:f.base.regions[0].id,baseRevision:f.base.regions[0].revision,value:{...clone(f.base.regions[0]),revision:f.base.regions[0].revision+1,xywh:[0,0,99999,20]},provenance:clone(draft.records[0].provenance)});await status(f.submit(draft),400);
 draft=f.draft();const anchor=clone(f.base.anchors[0]);anchor.revision++;anchor.passageIds=['not-a-passage'];draft.records.push({id:'bad-anchor',kind:'anchor',targetId:anchor.id,baseRevision:anchor.revision-1,value:anchor,provenance:clone(draft.records[0].provenance)});await status(f.submit(draft),400);
 anchor.passageIds=[index.passageIds[0]];anchor.level='token';anchor.tokenIds=['fake-token'];await status(f.submit(draft),400);
 assert.equal(f.store.size,0);assert.equal(f.writes.length,0);
});
test('accept records author/reviewer, changes only versioned overrides and survives Reader edits',async()=>{
 const f=fixture(),p=(await f.submit()).proposal;
 const detail=await(await f.call('/'+p.id,'GET',undefined,editor)).json();assert.equal(detail.conflicts.length,0);assert.equal(detail.changes.length,1);
 const result=await(await f.call('/'+p.id+'/decision','POST',{decision:'accepted',note:'Compared with test scan fixture.',repositoryHead:detail.repositoryHead},editor)).json();
 assert.equal(result.status,'accepted');assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].user,editor.user);
 const editorial=f.getEditorial(),ledger=editorial.manuscriptReviews['bnf-pt797'];
 assert.deepEqual(editorial.units,[{id:'preserve-me'}]);assert.deepEqual(editorial.otherExtension,{a:1});
 const applied=review.applyPublished(f.base,ledger,corpus);assert.ok(applied.data.version.includes('+review.'));assert.equal(applied.data.lines[0].publication.author.id,11);assert.equal(applied.data.lines[0].publication.reviewer.id,22);assert.equal(applied.data.lines[0].publication.selfReview,false);
 const tei=core.tei(applied.data,read('manuscripts/registry.json').manuscripts[0],ledger.events);assert.ok(tei.includes('<revisionDesc>'));assert.ok(tei.includes('who="https://github.com/editor"'));assert.ok(tei.includes('by contributor'));
 assert.equal(f.base.lines[0].revision,original.lines[0].revision);assert.equal(applied.data.lines[0].revision,f.base.lines[0].revision+1);
 assert.equal(core.applyDraft(applied.data,p.draft,corpus).conflicts.length,1);
 const merged=mergeEditorial(editorial,{units:[{id:'new-unit'}]},'editor');assert.deepEqual(merged.manuscriptReviews,editorial.manuscriptReviews);assert.deepEqual(merged.otherExtension,{a:1});
 await status(f.call('/'+p.id+'/decision','POST',{decision:'accepted',note:'duplicate',repositoryHead:'head-2'},editor),409);
 assert.equal(f.writes.length,1);
});
test('return/reject retain proposal, leave text unchanged; self-review is explicit',async()=>{
 for(const decision of ['returned','rejected']){
  const f=fixture(),p=(await f.submit()).proposal;
  await f.call('/'+p.id+'/decision','POST',{decision,note:'Needs more evidence.',repositoryHead:'head-1'},editor);
  const result=review.applyPublished(f.base,f.getEditorial().manuscriptReviews['bnf-pt797'],corpus);assert.deepEqual(result.data,f.base);assert.deepEqual(result.events[0].proposal,p);
 }
 const f=fixture(),p=(await f.submit()).proposal;
 await f.call('/'+p.id+'/decision','POST',{decision:'accepted',note:'Author review explicitly recorded.',repositoryHead:'head-1'},{...contributor,role:'editor'});
 const result=review.applyPublished(f.base,f.getEditorial().manuscriptReviews['bnf-pt797'],corpus);assert.equal(result.data.lines[0].publication.selfReview,true);
});
test('two concurrent proposals require re-comparison and never overwrite silently',async()=>{
 const f=fixture(),p=(await f.submit()).proposal,q=(await f.submit()).proposal;
 await f.call('/'+p.id+'/decision','POST',{decision:'accepted',note:'first',repositoryHead:'head-1'},editor);
 await status(f.call('/'+q.id+'/decision','POST',{decision:'accepted',note:'stale',repositoryHead:'head-1'},editor),409);
 const detail=await(await f.call('/'+q.id,'GET',undefined,editor)).json();assert.equal(detail.conflicts.length,1);
 await status(f.call('/'+q.id+'/decision','POST',{decision:'accepted',note:'conflicting',repositoryHead:'head-2'},editor),409);
 await f.call('/'+q.id+'/decision','POST',{decision:'returned',note:'Compare new shared revision.',repositoryHead:'head-2'},editor);assert.equal(f.writes.length,2);
});
test('invalid history is atomic, source-version changes require migration',async()=>{
 const f=fixture(),p=(await f.submit()).proposal;
 const decision={id:'review-test',reviewer:editor.user,decision:'accepted',note:'test',decidedAt:'2026-10-29T06:00:00Z'};
 const ledger=review.decide(f.base,null,p,decision,corpus).ledger;
 const broken=clone(ledger);broken.events.push({...clone(ledger.events[0]),id:'review-next'});assert.throws(()=>review.applyPublished(f.base,broken,corpus),/already/);
 assert.throws(()=>review.applyPublished({...f.base,version:'new-package'},ledger,corpus),/migration/);
 assert.deepEqual(f.base,original);
});
test('Git writes are based on the full reviewed commit; a branch race cannot publish',async()=>{
 const calls=[],env={GITHUB_OWNER:'owner',GITHUB_REPO:'repo',GITHUB_EDITORIAL_PATH:'editorial-overrides.json'};
 const github=async(path,options)=>{calls.push({path,...options});if(path.endsWith('/git/commits/head-1'))return {tree:{sha:'tree-old'}};if(path.endsWith('/git/trees'))return {sha:'tree-new'};if(path.endsWith('/git/commits'))return {sha:'commit-new'};if(path.includes('/git/refs/'))throw Object.assign(new Error('not fast-forward'),{status:422});throw new Error(path);};
 await status(manuscriptRepository(env,github,'MOCK').commit({head:'head-1'},{sentinel:true},editor.user,'test'),409);
 assert.deepEqual(calls[2].body.parents,['head-1']);assert.equal(calls[3].body.force,false);assert.equal(calls[2].body.author.email,'22+editor@users.noreply.github.com');
 assert.equal(calls[1].body.tree.length,1);assert.equal(calls[1].body.base_tree,'tree-old');
});
test('repository snapshot pins registry/package/editorial/index to one commit',async()=>{
 const paths=[],env={GITHUB_OWNER:'owner',GITHUB_REPO:'repo',GITHUB_EDITORIAL_PATH:'editorial-overrides.json'};
 const github=async(path)=>{paths.push(path);if(path.includes('/git/ref/'))return {object:{sha:'fixed-head'}};
  const name=path.split('/contents/')[1].split('?')[0],data=name==='editorial-overrides.json'?{}:read(name);
  return {type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(data)).toString('base64')};};
 const snapshot=await manuscriptRepository(env,github,'MOCK').snapshot('bnf-pt797');assert.equal(snapshot.head,'fixed-head');assert.ok(paths.filter(p=>p.includes('/contents/')).every(p=>p.endsWith('?ref=fixed-head')));assert.equal(snapshot.corpus.passages.length,22);
});
test('router exposes capability only when enabled and enforces session/role before network',async()=>{
 const f=fixture();let response=await worker.fetch(new Request('https://worker.invalid/api/capabilities'),f.env);assert.equal((await response.json()).manuscriptReview,'1.0.0');
 f.env.MANUSCRIPT_REVIEW_ENABLED='false';response=await worker.fetch(new Request('https://worker.invalid/api/capabilities'),f.env);assert.equal((await response.json()).manuscriptReview,null);
 response=await worker.fetch(new Request('https://worker.invalid/api/manuscripts/proposals'),f.env);assert.equal(response.status,401);
 f.store.set('session:test',JSON.stringify({user:contributor.user}));f.store.set('role:contributor','reader');
 response=await worker.fetch(new Request('https://worker.invalid/api/manuscripts/proposals',{headers:{Authorization:'Bearer test'}}),f.env);assert.equal(response.status,403);
 f.store.set('role:contributor','contributor');
 response=await worker.fetch(new Request('https://worker.invalid/api/publish',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({editorial:{manuscriptReviews:{}},mode:'review'})}),f.env);assert.equal(response.status,400);
});
test('browser and server validators remain identical',()=>{
 for(const name of ['manuscripts-core.js','manuscripts-review-core.js'])assert.equal(fs.readFileSync(new URL(name,site),'utf8'),fs.readFileSync(new URL('../src/shared/'+name,import.meta.url),'utf8'));
});
test('large editorial history uses pinned raw contents rather than empty base64',async()=>{
 const env={GITHUB_OWNER:'owner',GITHUB_REPO:'repo',GITHUB_EDITORIAL_PATH:'editorial-overrides.json'};let rawRead=false;
 const github=async(path,options)=>{
  if(path.includes('/git/ref/'))return {object:{sha:'pinned-head'}};
  const name=path.split('/contents/')[1].split('?')[0];assert.ok(path.endsWith('?ref=pinned-head'));
  if(name==='editorial-overrides.json'){
   if(options.raw){rawRead=true;return {sentinel:'retained large history'};}
   return {type:'file',encoding:'none',size:2000000};
  }
  return {type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(read(name))).toString('base64')};
 };
 const snapshot=await manuscriptRepository(env,github,'MOCK').snapshot('bnf-pt797');assert.equal(rawRead,true);assert.equal(snapshot.editorial.sentinel,'retained large history');
});
