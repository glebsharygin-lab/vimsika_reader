/* Shared browser/Worker review contract. Image and corpus records stay separate. */
(function(root) {
  'use strict';
  const core=root.ManuscriptCore;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const collections={line:'lines',region:'regions',anchor:'anchors',annotation:'annotations'};
  const idOK=id=>typeof id==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,159}$/.test(id);
  const identity=user=>user&&Number.isSafeInteger(user.id)&&user.id>0&&typeof user.login==='string'&&/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(user.login);
  const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
  function emptyLedger(base) {return {schemaVersion:'1.0.0-manuscript-reviews',manuscriptId:base.id,baseVersion:base.version,events:[]};}
  function validateProposal(proposal,base) {
    check(proposal?.schemaVersion==='1.0.0-manuscript-proposal'&&idOK(proposal.id)&&proposal.manuscriptId===base.id,'Invalid manuscript proposal.');
    check(identity(proposal.author)&&date(proposal.submittedAt)&&typeof proposal.note==='string'&&proposal.note.trim(),'Missing authenticated submission provenance.');
    core.validateDraft(proposal.draft,base);
    check(proposal.draft.records.length>0,'The proposal has no saved changes.');
    return proposal;
  }
  function proposalChanges(base,proposal,corpus) {
    validateProposal(proposal,base);
    const result=core.applyDraft(base,proposal.draft,corpus);
    // A published revision is assigned by the review contract, never the client.
    for(const r of proposal.draft.records)check(r.value.revision===r.baseRevision+1,'Proposed record revision must follow its base revision.');
    return {...result,changes:proposal.draft.records.map(r=>({kind:r.kind,targetId:r.targetId,before:clone(base[collections[r.kind]].find(x=>x.id===r.targetId)||null),after:clone(r.value)}))};
  }
  function acceptedDraft(base,event) {
    const draft=clone(event.proposal.draft);
    for(const r of draft.records) {
      const stamp={eventId:event.id,author:clone(event.proposal.author),reviewer:clone(event.reviewer),submittedAt:event.proposal.submittedAt,decidedAt:event.decidedAt,selfReview:event.reviewer.id===event.proposal.author.id};
      // Free-text authors, histories and marks remain evidence supplied by the
      // contributor. Only this separate publication stamp is authenticated.
      r.value.publication=stamp;
      r.value.revision=r.baseRevision+1;
      if(r.kind!=='region')r.value.status=r.kind==='line'&&Object.values(r.value.layers).every(v=>v==null)?'untranscribed':'published';
      if(r.kind==='line')for(const value of Object.values(r.value.layers))if(value)value.status='published';
      r.provenance={...r.provenance,author:event.proposal.author.login,status:'published',updatedAt:event.decidedAt};
    }
    return draft;
  }
  function applyPublished(base,ledger,corpus) {
    core.validatePackage(base,corpus);
    if(ledger==null)return {data:clone(base),events:[]};
    check(ledger.schemaVersion==='1.0.0-manuscript-reviews'&&ledger.manuscriptId===base.id&&Array.isArray(ledger.events),'Invalid manuscript review ledger.');
    check(ledger.baseVersion===base.version,'Published manuscript changes need migration to the new base package. No overrides have been applied.');
    let data=clone(base);const ids=new Set(),proposals=new Set();
    for(const event of ledger.events) {
      check(idOK(event.id)&&!ids.has(event.id),'Duplicate or invalid review event.');ids.add(event.id);
      validateProposal(event.proposal,base);
      check(!proposals.has(event.proposal.id),'A proposal already has a final decision.');proposals.add(event.proposal.id);
      check(['accepted','rejected','returned'].includes(event.decision)&&identity(event.reviewer)&&date(event.decidedAt)&&typeof event.note==='string'&&event.note.trim(),'Invalid review decision provenance.');
      check(event.previousVersion===data.version,'Review history is out of sequence.');
      if(event.decision!=='accepted')continue;
      check(!proposalChanges(data,event.proposal,corpus).conflicts.length,'Published manuscript revisions conflict. No partial review history may be applied.');
      const applied=core.applyDraft(data,acceptedDraft(data,event),corpus);
      check(!applied.conflicts.length,'Published manuscript revisions conflict.');
      data=applied.data;data.version=base.version+'+review.'+event.id;
    }
    return {data,events:clone(ledger.events)};
  }
  function decide(base,ledger,proposal,{id,reviewer,decision,note,decidedAt},corpus) {
    const history=ledger==null?emptyLedger(base):clone(ledger);
    const current=applyPublished(base,history,corpus).data;
    validateProposal(proposal,base);
    check(!history.events.some(e=>e.proposal.id===proposal.id),'This proposal already has a decision.');
    const event={id,proposal:clone(proposal),reviewer:clone(reviewer),decision,note,decidedAt,previousVersion:current.version};
    history.events.push(event);
    const applied=applyPublished(base,history,corpus);
    return {ledger:history,data:applied.data,event};
  }
  root.ManuscriptReviewCore={emptyLedger,validateProposal,proposalChanges,applyPublished,decide};
})(typeof window==='undefined'?globalThis:window);
