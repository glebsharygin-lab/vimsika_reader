import './shared/manuscripts-core.js';
import './shared/manuscripts-review-core.js';

const core=globalThis.ManuscriptCore, review=globalThis.ManuscriptReviewCore;
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const identity=user=>({id:user.id,login:user.login,name:user.name||user.login});
const key=id=>`manuscript-proposal:${id}`;
const editors=['editor','admin'];
const validId=id=>/^proposal-[a-f0-9-]{36}$/.test(id||'');
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function input(request) {
  if(Number(request.headers.get('Content-Length')||0)>524288)fail(413,'The manuscript proposal is too large.');
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>524288)fail(413,'The manuscript proposal is too large.');
  try{return JSON.parse(raw);}catch{fail(400,'Supply a JSON manuscript proposal.');}
}
function checked(fn,status=400) {try{return fn();}catch(error){if(error.status)throw error;fail(status,error.message);}}
function ledger(snapshot,id) {return snapshot.editorial.manuscriptReviews?.[id]||null;}
function current(snapshot) {return checked(()=>review.applyPublished(snapshot.base,ledger(snapshot,snapshot.base.id),snapshot.corpus),409).data;}
function owns(proposal,session) {if(!editors.includes(session.role)&&proposal.author.id!==session.user.id)fail(403,'This proposal belongs to another contributor.');}
function assertLineAnchors(draft,snapshot) {
  // The first shared-review release supports physical lines and passage links.
  // Do not accept unverified token IDs from the browser as manuscript evidence.
  for(const r of draft.records)if(r.kind==='anchor'&&(r.value.level!=='line'||r.value.tokenIds.length))fail(400,'Shared manuscript review currently supports line-level passage anchors only.');
  core.validatePackage(snapshot.base,snapshot.corpus);
}

/** Dependencies perform the existing Worker's KV/GitHub operations; tests supply
 * isolated in-memory substitutes. No alternate authentication/backend is used. */
export async function manuscriptRequest(request,session,env,deps) {
  if(env.MANUSCRIPT_REVIEW_ENABLED!=='true')fail(503,'Shared manuscript review has not been enabled by the site administrator.');
  if(!['contributor','editor','admin'].includes(session.role))fail(403,'Contributor access is required.');
  const url=new URL(request.url),root='/api/manuscripts/proposals';
  const suffix=url.pathname.slice(root.length),parts=suffix.split('/').filter(Boolean);
  const now=()=>new Date().toISOString();
  if(!parts.length&&request.method==='POST') {
    const body=await input(request);
    if(typeof body.note!=='string'||!body.note.trim()||body.note.length>5000)fail(400,'Describe the evidence and changes for the reviewer.');
    if(!/^[a-z][a-z0-9-]{0,79}$/.test(body.draft?.manuscriptId||''))fail(400,'Invalid manuscript ID.');
    const snapshot=await deps.snapshot(body.draft.manuscriptId);
    const base=current(snapshot);
    const proposal={schemaVersion:'1.0.0-manuscript-proposal',id:'proposal-'+crypto.randomUUID(),manuscriptId:base.id,
      author:identity(session.user),submittedAt:now(),note:body.note.trim(),draft:clone(body.draft),repositoryHead:snapshot.head};
    checked(()=>review.validateProposal(proposal,base));
    checked(()=>assertLineAnchors(proposal.draft,snapshot));
    const changes=checked(()=>review.proposalChanges(base,proposal,snapshot.corpus));
    if(changes.conflicts.length)fail(409,'The published package or record revisions changed. Refresh and resolve your saved draft before submitting.');
    await env.AUTH.put(key(proposal.id),JSON.stringify(proposal));
    return response({proposal,status:'submitted',message:'Proposal saved for shared review. Your private draft is unchanged.'},201);
  }
  if(!parts.length&&request.method==='GET') {
    const manuscriptId=url.searchParams.get('manuscript');
    if(!/^[a-z][a-z0-9-]{0,79}$/.test(manuscriptId||''))fail(400,'Choose a manuscript.');
    const snapshot=await deps.snapshot(manuscriptId);
    const events=checked(()=>review.applyPublished(snapshot.base,ledger(snapshot,manuscriptId),snapshot.corpus),409).events;
    const page=await env.AUTH.list({prefix:'manuscript-proposal:',limit:100,cursor:url.searchParams.get('cursor')||undefined});
    const items=[];
    for(const entry of page.keys) {
      const proposal=await env.AUTH.get(entry.name,'json');
      if(!proposal||proposal.manuscriptId!==manuscriptId||(!editors.includes(session.role)&&proposal.author.id!==session.user.id))continue;
      const event=events.find(e=>e.proposal.id===proposal.id);
      items.push({id:proposal.id,manuscriptId,author:proposal.author,submittedAt:proposal.submittedAt,note:proposal.note,status:event?.decision||'submitted',reviewer:event?.reviewer,decidedAt:event?.decidedAt});
    }
    return response({proposals:items,cursor:page.list_complete?null:page.cursor});
  }
  if(!validId(parts[0]))fail(404,'Unknown manuscript proposal.');
  const proposal=await env.AUTH.get(key(parts[0]),'json');
  if(!proposal)fail(404,'Proposal not found. A newly submitted proposal may take a moment to become available.');
  owns(proposal,session);
  const snapshot=await deps.snapshot(proposal.manuscriptId),base=current(snapshot);
  const history=ledger(snapshot,base.id),event=history?.events.find(e=>e.proposal.id===proposal.id);
  if(parts.length===1&&request.method==='GET') {
    const result=checked(()=>review.proposalChanges(base,proposal,snapshot.corpus));
    return response({proposal,repositoryHead:snapshot.head,base,changes:result.changes,conflicts:result.conflicts,status:event?.decision||'submitted',decision:event||null});
  }
  if(parts.length!==2||parts[1]!=='decision'||request.method!=='POST')fail(405,'Method not allowed.');
  if(!editors.includes(session.role))fail(403,'Only editors and administrators can decide manuscript proposals.');
  const body=await input(request);
  if(!['accepted','rejected','returned'].includes(body.decision)||typeof body.note!=='string'||!body.note.trim()||body.note.length>5000)fail(400,'Choose a decision and record a review note.');
  if(event)fail(409,'This proposal already has a recorded decision.');
  if(body.repositoryHead!==snapshot.head)fail(409,'The repository changed since you opened the review. Refresh and compare the latest version before deciding.');
  const decided=checked(()=>review.decide(snapshot.base,history,proposal,{id:'review-'+crypto.randomUUID(),reviewer:identity(session.user),decision:body.decision,note:body.note.trim(),decidedAt:now()},snapshot.corpus),409);
  const editorial={...snapshot.editorial,manuscriptReviews:{...snapshot.editorial.manuscriptReviews,[base.id]:decided.ledger}};
  // The immutable Git parent/head check is the transaction boundary. KV is not
  // used as a lock and the proposal is never overwritten by a decision.
  const commit=await deps.commit(snapshot,editorial,session.user,`Manuscript review: ${body.decision} (${session.user.login})`);
  return response({status:body.decision,event:decided.event,version:decided.data.version,url:commit.url,message:'Review decision recorded. Accepted readings appear after the site updates.'});
}
