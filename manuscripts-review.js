/* Explicit user actions only: opening Manuscripts never submits a private draft. */
window.ManuscriptReviewUI=(()=>{
  'use strict';
  const sessions=new Map();let el,bridge,view;
  const e=value=>escapeHtml(value),a=value=>escapeAttribute(value);
  let forms={};try{forms=JSON.parse(localStorage.getItem('vimsika-manuscript-review-forms-v1')||'{}');}catch{}
  function saveForm(key,value){forms[key]=value;try{localStorage.setItem('vimsika-manuscript-review-forms-v1',JSON.stringify(forms));}catch{view.message='Review text is retained in this session; browser storage is unavailable.';}}
  function mount(element,context) {
    el=element;bridge=context;
    const key=context.id+':'+(state.auth.user?.id||'signed-out');
    if(!sessions.has(key))sessions.set(key,{capability:null,items:[],cursor:null,detail:null,message:'',busy:false});
    view=sessions.get(key);render();if(view.detail)el.parentElement.open=true;
  }
  async function action(fn) {
    if(view.busy)return;const active=view;active.busy=true;render();
    try{await fn();}catch(error){active.message=error.message;}
    finally{active.busy=false;if(view===active&&el?.isConnected)render();}
  }
  function recordHTML(value) {
    if(!value)return '<p>No earlier record.</p>';
    if(value.layers)return Object.entries(value.layers).map(([layer,v])=>`<p><strong>${e(layer)}</strong> · ${e(v?.scope||'untranscribed')}</p><p class="ms-conflict-text">${e(v?.text||'No transcription recorded.')}</p>`).join('')+`<details><summary>Coordinates, marks and full record</summary><pre>${e(JSON.stringify(value,null,2))}</pre></details>`;
    return `<pre>${e(JSON.stringify(value,null,2))}</pre>`;
  }
  function render() {
    if(!el?.isConnected)return;
    const role=state.auth.role,signed=state.auth.configured&&state.auth.user&&['contributor','editor','admin'].includes(role),canReview=['editor','admin'].includes(role);
    const enabled=view.capability==='1.0.0',detail=view.detail,blocked=bridge.blocked(),draft=bridge.draft();
    el.innerHTML=`<p role="status">${e(view.message)}</p><p>Proposals keep a separate, signed-in author record. Reviewers can read submissions immediately. Recording any decision publishes the proposal and review note in repository history; only accepted readings enter the public text.</p>
      <button type="button" id="ms-review-check" ${view.busy?'disabled':''}>${enabled?'Refresh proposals':'Check review service'}</button>
      ${!signed?'<p>Sign in with contributor or editor access to share manuscript changes. Private editing and export remain available.</p>':''}
      ${view.capability===false?'<p>Shared review is not enabled on this service yet. Export your private draft for now.</p>':''}
      ${enabled&&signed?`<form id="ms-submit-review"><label>Submission note / evidence<textarea name="note" rows="3" maxlength="5000" required>${e(forms['submit:'+bridge.id]||'')}</textarea></label><p>${draft.records.length} saved change(s). Unsaved form text is not included. ${blocked?e(blocked):''}</p><button type="submit" ${view.busy||blocked||!draft.records.length?'disabled':''}>Submit for review</button></form>
      <div class="ms-review-list">${view.items.map(item=>`<p><button type="button" data-ms-proposal="${a(item.id)}" ${view.busy?'disabled':''}>${e(item.author.login)} · ${e(item.status)} · ${e(item.submittedAt)}</button><br>${e(item.note)}</p>`).join('')||'<p>No proposals loaded.</p>'}</div>${view.cursor?'<button type="button" id="ms-review-more">Load more proposals</button>':''}`:''}
      ${detail?`<section id="ms-proposal-detail"><h5>Proposal by ${e(detail.proposal.author.login)} · ${e(detail.status)}</h5><p>${e(detail.proposal.note)}</p><p>Submitted ${e(detail.proposal.submittedAt)} · based on ${e(detail.proposal.draft.baseVersion)}</p><button type="button" id="ms-proposal-export">Export complete proposal</button>
        ${detail.status==='submitted'&&detail.conflicts.length?'<p class="ms-review-warning">The current version conflicts with this proposal. Acceptance is blocked. Return it for a revised proposal after comparing the changes.</p>':''}
        ${detail.changes.map((change,i)=>`<fieldset><legend>${e(change.kind)} · ${e(change.targetId)}</legend><button type="button" data-ms-review-scan="${i}">View target scan</button><div class="ms-conflict-pair"><section><h5>Current shared record</h5>${recordHTML(change.before)}</section><section><h5>Submitted proposal</h5>${recordHTML(change.after)}</section></div></fieldset>`).join('')}
        ${detail.decision?`<p>Decision: ${e(detail.decision.decision)} by ${e(detail.decision.reviewer.login)} · ${e(detail.decision.decidedAt)}. ${detail.decision.reviewer.id===detail.proposal.author.id?'The author reviewed their own proposal.':''}</p><p>${e(detail.decision.note)}</p>`:''}
        ${canReview&&detail.status==='submitted'?`<form id="ms-review-decision"><label>Decision<select name="decision" required><option value="">Choose after comparison</option><option value="accepted" ${detail.conflicts.length?'disabled':''}>Accept and publish</option><option value="returned">Return for revision</option><option value="rejected">Reject; retain the proposal in history</option></select></label><label>Review note<textarea name="note" rows="3" maxlength="5000" required>${e(forms['decision:'+detail.proposal.id]?.note||'')}</textarea></label><p>This publishes the complete proposal, your signed-in identity and your review note to GitHub, including returned or rejected proposals. ${detail.proposal.author.id===state.auth.user?.id?'This will be labelled as review by the author, not independent review.':''}</p><button type="submit" ${view.busy?'disabled':''}>Record review decision</button></form>`:''}</section>`:''}`;
    el.querySelector('#ms-review-check').onclick=()=>action(async()=>{
      if(!state.auth.configured)throw new Error('A collaboration service has not been configured.');
      const result=await apiRequest('/api/capabilities');view.capability=result.manuscriptReview==='1.0.0'?'1.0.0':false;
      if(view.capability&&signed)await list(false);
    });
    const submit=el.querySelector('#ms-submit-review');if(submit){
      submit.oninput=()=>saveForm('submit:'+bridge.id,submit.elements.note.value);
      submit.onsubmit=event=>{event.preventDefault();const note=submit.elements.note.value,draft=bridge.draft();action(async()=>{
        const problem=bridge.blocked();if(problem)throw new Error(problem);
        const result=await apiRequest('/api/manuscripts/proposals',{method:'POST',body:JSON.stringify({draft,note})});
        await list(false);await detailFor(result.proposal.id);view.message=result.message;
      });};
    }
    el.querySelectorAll('[data-ms-proposal]').forEach(button=>button.onclick=()=>action(()=>detailFor(button.dataset.msProposal)));
    const more=el.querySelector('#ms-review-more');if(more)more.onclick=()=>action(()=>list(true));
    el.querySelectorAll('[data-ms-review-scan]').forEach(button=>button.onclick=()=>bridge.scan(detail.changes[Number(button.dataset.msReviewScan)],detail.base,detail.proposal.draft));
    const exp=el.querySelector('#ms-proposal-export');if(exp)exp.onclick=()=>bridge.download(JSON.stringify(detail,null,2),detail.proposal.id+'.json');
    const decision=el.querySelector('#ms-review-decision');if(decision){
      const saved=forms['decision:'+detail.proposal.id];if(saved&&![...decision.elements.decision.options].find(o=>o.value===saved.decision)?.disabled)decision.elements.decision.value=saved.decision;
      decision.oninput=()=>saveForm('decision:'+detail.proposal.id,Object.fromEntries(new FormData(decision)));
      decision.onsubmit=event=>{event.preventDefault();const fields=Object.fromEntries(new FormData(decision));action(async()=>{
        const result=await apiRequest('/api/manuscripts/proposals/'+detail.proposal.id+'/decision',{method:'POST',body:JSON.stringify({...fields,repositoryHead:detail.repositoryHead})});
        await detailFor(detail.proposal.id);await list(false);view.message=result.message;
        // Do not replace or clear a user's private draft after publication.
        await bridge.refreshPublished();
      });};
    }
  }
  async function list(more) {
    const query=new URLSearchParams({manuscript:bridge.id});if(more&&view.cursor)query.set('cursor',view.cursor);
    const result=await apiRequest('/api/manuscripts/proposals?'+query);
    view.items=more?[...view.items,...result.proposals]:result.proposals;view.cursor=result.cursor;
  }
  async function detailFor(id) {view.detail=await apiRequest('/api/manuscripts/proposals/'+encodeURIComponent(id));view.message='';}
  return {mount};
})();
