/* Lazy manuscript workspace. Corpus/editorial storage are never rewritten here. */
window.Manuscripts = (() => {
  'use strict';
  const assetPromises=new Map(),packages=new Map(),basePackages=new Map(),drafts=new Map(),rawDrafts=new Map();
  let publishedProblem='';
  let reviewPreview=null;
  let registry,core,viewer,generation=0,current,record,statusMessage='',storageProblem='';
  let regionTrackers=[];
  let draftConflicts=[];
  let drawing=null;
  let mobileSidebarBefore=null;
  let formBuffers={};
  try { formBuffers=JSON.parse(localStorage.getItem('vimsika-manuscript-forms-v1')||'{}'); } catch {}
  const m={id:'bnf-pt797',surfaceId:'',lineId:'',layer:'transliteration',passageId:'',pane:'scan',sync:true,overlays:true,editing:false,query:'',brightness:100,contrast:100};
  const e=value=>escapeHtml(value), a=value=>escapeAttribute(value);
  const annotationTypes={'scholarly-note':'Scholarly note','variant-reading':'Variant reading','damage-lacuna':'Damage or lacuna','uncertain-reading':'Uncertain reading','editorial-conjecture':'Editorial conjecture','abbreviation':'Abbreviation or expansion','correction':'Correction, deletion or insertion','change-of-hand':'Change of hand','marginal-note':'Marginal or interlinear note','lexical-observation':'Lexical or grammatical observation','bibliographic-reference':'Bibliographical reference','question':'Question for review'};
  function loadScript(url) {
    if(!assetPromises.has(url))assetPromises.set(url,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=url;
      script.onload=resolve;script.onerror=()=>{assetPromises.delete(url);script.remove();reject(new Error(`Could not load ${url}.`));};document.head.append(script);
    }));
    return assetPromises.get(url);
  }
  async function load(id) {
    await Promise.all([loadScript('manuscripts-core.js?v=0.34.0-draft'),loadScript('manuscripts/registry.js?v=0.34.0-draft')]);
    core=window.ManuscriptCore;registry=window.MANUSCRIPT_REGISTRY;
    await loadScript('manuscripts-review-core.js?v=0.34.0-draft');
    record=registry.manuscripts.find(r=>r.id===id)||registry.manuscripts[0];m.id=record.id;
    if(!basePackages.has(m.id)) {
      if(!/^manuscripts\/[a-z0-9-]+\.js$/.test(record.package))throw new Error('Invalid manuscript package location.');
      await loadScript(record.package+'?v=0.34.0-draft');
      const data=window.MANUSCRIPT_PACKAGES[m.id];core.validatePackage(data,state.corpus);basePackages.set(m.id,data);
    }
    publishedProblem='';
    try {packages.set(m.id,window.ManuscriptReviewCore.applyPublished(basePackages.get(m.id),state.publishedEditorData.manuscriptReviews?.[m.id],state.corpus).data);}
    catch(error) {packages.set(m.id,basePackages.get(m.id));publishedProblem=error.message;}
    const data=packages.get(m.id);
    if(!drafts.has(m.id)) {
      const draft=core.emptyDraft(data);drafts.set(m.id,draft);
      try {
        const raw=localStorage.getItem('vimsika-manuscript-draft-v1:'+m.id);
        if(raw) {rawDrafts.set(m.id,raw);const parsed=JSON.parse(raw);core.applyDraft(data,parsed,state.corpus);drafts.set(m.id,parsed);}
      } catch(error) {storageProblem='The saved manuscript draft could not be loaded. It has been kept untouched. Export the saved file before resolving it. '+error.message;}
    }
    const applied=core.applyDraft(data,drafts.get(m.id),state.corpus);current=publishedProblem?data:applied.data;draftConflicts=applied.conflicts;
    if(publishedProblem)statusMessage='Shared manuscript history needs attention. The base package is shown; private drafts are unchanged. '+publishedProblem;
    if(draftConflicts.length)statusMessage=`${draftConflicts.length} saved draft change(s) need review against package ${data.version}. Your saved file is unchanged. Open Review saved changes below.`;
    if(!current.surfaces.some(s=>s.id===m.surfaceId))m.surfaceId=current.surfaces[0]?.id||'';
    if(!current.lines.some(l=>l.id===m.lineId&&l.surfaceId===m.surfaceId))m.lineId=current.lines.find(l=>l.surfaceId===m.surfaceId)?.id||'';
    if(!core.layers.includes(m.layer))m.layer='transliteration';
    return current;
  }
  function compactMobileNavigation() {
    if(state.view==='manuscripts'&&window.innerWidth<=900&&mobileSidebarBefore===null) {
      mobileSidebarBefore=state.sidebarCollapsed;state.sidebarCollapsed=true;applySidebarState();
    }
  }
  function dispose() {
    cancelDrawing();
    generation++;regionTrackers.forEach(t=>t.destroy());regionTrackers=[];if(viewer){viewer.destroy();viewer=null;}
    if(state.view!=='manuscripts'&&mobileSidebarBefore!==null) {
      state.sidebarCollapsed=mobileSidebarBefore;mobileSidebarBefore=null;applySidebarState();
    }
  }
  function hash() {
    const params=new URLSearchParams({manuscript:m.id,surface:m.surfaceId,line:m.lineId,layer:m.layer});
    if(m.passageId)params.set('passage',m.passageId);
    history.replaceState(null,'','#'+params.toString());
  }
  function restoreHash() {
    const p=new URLSearchParams(location.hash.slice(1));
    if(!p.has('manuscript'))return false;
    for(const [field,key] of [['id','manuscript'],['surfaceId','surface'],['lineId','line'],['layer','layer'],['passageId','passage']])m[field]=p.get(key)||'';
    m.editing=false;state.view='manuscripts';updateViewPresentation();renderReader();return true;
  }
  function selectedLine() {return current.lines.find(l=>l.id===m.lineId);}
  function selectedSurface() {return current.surfaces.find(s=>s.id===m.surfaceId);}
  function linked(lineId=m.lineId) {return current.anchors.filter(x=>x.lineIds.includes(lineId));}
  function citation() {const line=selectedLine();return `${record.institution}, ${record.shelfmark}, ${selectedSurface().label}, ${line?.label||'surface'}; ${m.layer}, ${current.version}, ${current.editor}. ${location.href}`;}
  function message(text) {statusMessage=text;const el=document.querySelector('#ms-status');if(el)el.textContent=text;}
  function download(value,name,type='application/json') {
    const url=URL.createObjectURL(new Blob([value],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function persist(draft) {
    if(publishedProblem)throw new Error('Shared manuscript history needs attention before saving further drafts.');
    if(storageProblem)throw new Error('The earlier saved draft needs review; it will not be overwritten.');
    // Save first; if storage is full, keep the in-memory current draft unchanged.
    localStorage.setItem('vimsika-manuscript-draft-v1:'+m.id,JSON.stringify(draft));drafts.set(m.id,draft);
  }
  function upsert(draft,kind,value,author) {
    const data=packages.get(m.id),collection={line:'lines',region:'regions',anchor:'anchors',annotation:'annotations'}[kind];
    if(!draft.records.length)draft.baseVersion=data.version;
    const base=data[collection].find(x=>x.id===value.id),old=draft.records.find(r=>r.targetId===value.id);
    const now=new Date().toISOString();
    const change={id:old?.id||'draft-'+value.id,kind,targetId:value.id,baseRevision:base?.revision||0,
      value:{...value,revision:(base?.revision||0)+1},
      provenance:{author,createdAt:old?.provenance.createdAt||now,updatedAt:now,status:'draft'},
      history:[...(old?.history||[]),...(old?[{value:old.value,provenance:old.provenance}]:[])]};
    draft.records=draft.records.filter(r=>r.targetId!==value.id);draft.records.push(change);
  }
  function conflictReading(value) {
    if(!value)return '<p>No record with this ID in the current package.</p>';
    if(value.layers)return core.layers.map(layer=>`<p><strong>${e(layer)}</strong> · ${e(value.layers[layer]?.scope||'not transcribed')}</p><p class="ms-conflict-text">${e(value.layers[layer]?.text||'No transcription recorded.')}</p>`).join('')+`<details><summary>Full record and provenance</summary><pre>${e(JSON.stringify(value,null,2))}</pre></details>`;
    return `<pre>${e(JSON.stringify(value,null,2))}</pre>`;
  }
  function conflictHTML() {
    if(!draftConflicts.length)return '';
    return `<details class="ms-conflicts" open><summary>Review saved changes · ${draftConflicts.length}</summary><p>The current package is shown in the reader until you resolve these changes. Every choice is saved with both versions in your private draft history.</p><form id="ms-conflict-form"><label>Editor name <input name="author" required value="${a(state.auth.user?.login||'Gleb Sharygin')}"></label>${draftConflicts.map(c=>{
      const target=current.lines.find(l=>l.id===c.targetId||l.regionIds.includes(c.targetId));
      return `<fieldset><legend>${e(c.kind)} · ${e(c.targetId)}</legend>${target?`<button type="button" data-ms-review-line="${target.id}">View this line and scan</button>`:''}<div class="ms-conflict-pair"><section><h5>Current package</h5>${conflictReading(c.base)}</section><section><h5>Your saved proposal</h5>${conflictReading(c.proposed)}</section></div><label>Decision <select required name="${a(c.id)}"><option value="">Choose after comparing</option><option value="base">Use current package; archive my proposal</option><option value="draft">Keep my proposal as a private draft</option></select></label></fieldset>`;
    }).join('')}<button type="submit">Save all review decisions</button><p>This resolves local version conflicts. It does not mark a reading as scholarly reviewed or publish it.</p></form></details>`;
  }
  function renderText() {
    const rows=current.lines.filter(l=>l.surfaceId===m.surfaceId).sort((x,y)=>x.order-y.order);
    return rows.map(line=>{
      const value=line.layers[m.layer],text=value?.text||'';
      const match=!m.query||text.toLocaleLowerCase().includes(m.query.toLocaleLowerCase())||current.annotations.some(n=>n.targets.some(t=>t.lineId===line.id||line.regionIds.includes(t.regionId))&&n.text.toLocaleLowerCase().includes(m.query.toLocaleLowerCase()));
      if(!match)return '';
      const content=m.layer==='normalized'?text.split(/(\s+)/).map(word=>/^\s*$/.test(word)?e(word):`<button class="ms-word" data-ms-word="${a(word)}" data-ms-word-line="${line.id}" title="Look up this normalized form">${e(word)}</button>`).join(''):markedReading(value);
      return `<article class="ms-line ${line.id===m.lineId?'selected':''}" id="ms-line-${line.id}">
        <button class="ms-line-label" data-ms-line="${line.id}" type="button" aria-pressed="${line.id===m.lineId}">${e(line.label)} <span>${e(value?value.scope+' · '+value.status:'not transcribed')}</span></button>
        <p class="ms-line-text ${m.layer==='diplomatic'?'ms-tibetan':''}">${content||'No transcription recorded in this layer.'}</p>
        ${value?.note?`<p class="ms-note">${e(value.note)}</p>`:''}</article>`;
    }).join('')||'<p>No lines match this search in the selected surface and layer.</p>';
  }
  function markedReading(value) {
    if(!value)return '';
    const chars=Array.from(value.text);let end=0,html='';
    for(const mark of value.marks||[]) {
      html+=e(chars.slice(end,mark.start).join(''))+`<span class="ms-reading-mark ms-mark-${a(mark.type)}" title="${a(mark.type+(mark.reason?': '+mark.reason:''))}">${e(chars.slice(mark.start,mark.end).join(''))}<sup>[${e(mark.type)}]</sup></span>`;end=mark.end;
    }
    return html+e(chars.slice(end).join(''));
  }
  function sharedHistoryHTML() {
    const events=state.publishedEditorData.manuscriptReviews?.[m.id]?.events||[];
    return events.map(event=>`<p>Shared proposal ${e(event.proposal?.id)} · ${e(event.decision)}<br>Author: ${e(event.proposal?.author?.login)} · submitted ${e(event.proposal?.submittedAt)}<br>Reviewer: ${e(event.reviewer?.login)} · ${e(event.decidedAt)}${event.reviewer?.id===event.proposal?.author?.id?' · review by the author':''}<br>${e(event.note)}</p>`).join('');
  }
  function researchHTML() {
    const line=selectedLine(),anchors=linked(),notes=current.annotations.filter(n=>n.targets.some(t=>t.lineId===m.lineId||line?.regionIds.includes(t.regionId)));
    const changes=drafts.get(m.id).records.filter(r=>r.targetId===m.lineId||line?.regionIds.includes(r.targetId));
    return `<details open><summary>Passage links</summary>${anchors.length?anchors.map(anchor=>`<p class="ms-note">${e(anchor.level)} · ${e(anchor.relation)} · ${e(anchor.status)}</p><p>${e(anchor.note||'')}</p><div class="ms-actions">${anchor.passageIds.map(pid=>`<button data-ms-passage="${pid}">Read ${e(pid)}</button><button data-ms-compare="${pid}">Compare ${e(pid)}</button>`).join('')}</div>`).join(''):'<p>No passage anchor is recorded for this physical line.</p>'}
        ${m.passageId?`<p>Logical selection: ${e(m.passageId)}. Selecting a word does not change the surface.</p>`:''}</details>
      <details><summary>Notes & variants</summary>${notes.map(n=>`<p><strong>${e(n.type)} · ${e(n.status)}</strong><br>${e(n.text)}<br><small>${e(n.author||'')}</small></p>`).join('')||'<p>No scholarly annotation recorded for this line.</p>'}<p>No reviewed variant apparatus is available for this pilot.</p></details>
      <details><summary>Evidence & lexical work</summary><p>Normalized forms are editorial search readings. Each belongs to a named transcription layer and physical line, with a route back to the scan. Use the Normalized tab to look up a form.</p><p>${e(line?.layers.normalized?.note||'No normalized reading recorded.')}</p><p>Published comparison witness: ${e(record.relatedWitnessId)}. Line-level links do not assert word alignment.</p></details>
      <details><summary>History & local drafts</summary><p>Working manuscript version ${e(current.version)} · ${e(current.status)} · project editor ${e(current.editor)}. This pilot has not received independent scholarly review.</p>${changes.map(c=>`<p>${e(c.kind)} · ${e(c.provenance.status)} · ${e(c.provenance.author)}<br>${e(c.provenance.updatedAt)} · ${c.history?.length||0} earlier local revision(s)</p>`).join('')}${(drafts.get(m.id).resolutions||[]).map(r=>`<details><summary>${e(r.previous.kind)} · ${e(r.previous.targetId)} · ${r.choice==='base'?'proposal archived':'proposal retained'}</summary><p>${e(r.author)} · ${e(r.date)}<br>${e(r.fromVersion)} → ${e(r.toVersion)}</p>${conflictReading(r.previous.value)}</details>`).join('')}<p>Draft export preserves identifiers, coordinates, readings and provenance. Shared review is available only after the service is enabled.</p>${sharedHistoryHTML()}</details>
      ${conflictHTML()}
      <details id="ms-shared-details"><summary>Shared review</summary><div id="ms-shared-content"><button id="ms-shared-open" type="button">Check shared review</button><p>Private drafts are sent only when you choose Submit for review.</p></div></details>
      <details><summary>Sources & pilot scope</summary><p>${e(current.scopeNote)}</p><p>${e(current.deliveryNote)}</p>${record.bibliography.map(b=>`<p><a href="${a(b.url)}" target="_blank" rel="noopener">${e(b.label)}</a></p>`).join('')}<a href="${a(record.catalogueUrl)}" target="_blank" rel="noopener">BnF catalogue</a></details>`;
  }
  function editorHTML() {
    if(!m.editing)return '';
    if(draftConflicts.length)return '<p>Review saved changes before editing. Your earlier proposals and unsaved form text are retained.</p>';
    const line=selectedLine(),value=line?.layers[m.layer],region=current.regions.find(r=>r.id===line?.regionIds[0]);
    if(!line)return '';
    return `<form id="ms-draft-form" class="ms-draft-form"><h4>Private draft · ${e(line.label)}</h4>
      <label>Editor name <input name="author" required value="${a(state.auth.user?.login||'Gleb Sharygin')}"></label>
      <label>${e(m.layer)} <textarea name="text" rows="5">${e(value?.text||'')}</textarea></label>
      <details class="ms-reading-marks"><summary>Mark an uncertain or editorial reading</summary><input type="hidden" name="marks" value="${a(JSON.stringify(value?.marks||[]))}"><input type="hidden" name="marksBasis" value="${a(value?.text||'')}"><p>Select text in the transcription box, choose a mark and add it. These marks are private scholarly assertions.</p><label>Mark <select name="markType"><option value="unclear">Unclear reading</option><option value="damage">Damage</option><option value="supplied">Editorially supplied text</option><option value="add">Addition</option><option value="del">Deletion</option></select></label><label>Reason <input name="markReason" maxlength="500"></label><button type="button" id="ms-mark-selection">Mark selected text</button><button type="button" id="ms-clear-marks">Clear marks in this draft</button><p id="ms-mark-status">${value?.marks?.length||0} mark(s). Source readings remain recoverable.</p></details>
      <label>Extent <select name="scope"><option value="excerpt" ${value?.scope!=='complete'?'selected':''}>Excerpt of the physical line</option><option value="complete" ${value?.scope==='complete'?'selected':''}>Complete physical line</option></select></label>
      <label>Reading note / evidence <textarea name="note" rows="2">${e(value?.note||'')}</textarea></label>
      <details><summary>Geometry in original image pixels</summary><label>Region to revise <select name="regionId">${line.regionIds.map((id,i)=>`<option value="${id}">Region ${i+1} · ${e(id)}</option>`).join('')}</select></label><label><input type="checkbox" name="editGeometry"> Save a region correction</label><label><input type="checkbox" name="addRegion"> Add this rectangle as another region of this line</label><div class="ms-coordinates">${['x','y','width','height'].map((key,i)=>`<label>${key}<input name="${key}" type="number" step="1" value="${region?.xywh[i]||0}"></label>`).join('')}</div><button type="button" data-ms-draw="ms-draft-form">Draw rectangle on scan</button><p>Coordinates use the original image. Drawing stages a rectangle; Save private draft applies it.</p></details>
      <label>Note type <select name="annotationType">${Object.entries(annotationTypes).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Note target <select name="annotationTarget"><option value="line">Selected physical line</option>${line.regionIds.map((id,i)=>`<option value="${id}">Image region ${i+1}</option>`).join('')}</select></label><label>Add a private scholarly note <textarea name="annotation" rows="2"></textarea></label><button type="submit">Save private draft</button><p>Changes stay in this browser. Export a copy for review and backup.</p></form>${structureEditorHTML()}`;
  }
  function coordinateFields(box) {return `<div class="ms-coordinates">${['x','y','width','height'].map((key,i)=>`<label>${key}<input name="${key}" type="number" step="1" required value="${box[i]}"></label>`).join('')}</div>`;}
  function structureEditorHTML() {
    const line=selectedLine(),ordered=current.lines.filter(l=>l.surfaceId===m.surfaceId).sort((a,b)=>a.order-b.order),author=a(state.auth.user?.login||'Gleb Sharygin'),box=current.regions.find(r=>r.id===line.regionIds[0])?.xywh||[0,0,100,100];
    return `<div id="ms-structure-editor">
      <details><summary>Reading order</summary><form id="ms-order-form" class="ms-draft-form"><label>Editor name <input name="author" required value="${author}"></label><label>Move ${e(line.label)} to position <select name="position">${ordered.map((l,i)=>`<option value="${i}" ${l.id===line.id?'selected':''}>${i+1} · ${e(l.label)}</option>`).join('')}</select></label><button type="submit">Save order privately</button><p>Line IDs, labels and image coordinates stay fixed.</p></form></details>
      <details><summary>Add a physical line</summary><form id="ms-add-line-form" class="ms-draft-form"><label>Editor name <input name="author" required value="${author}"></label><label>Line label <input name="label" required maxlength="120" placeholder="For example: interlinear note"></label>${coordinateFields(box)}<button type="button" data-ms-draw="ms-add-line-form">Draw new line region</button><button type="submit">Add untranscribed line privately</button><p>The line is appended to this surface. All transcription layers start empty; adjust reading order separately.</p></form></details>
      <details><summary>Add a passage link</summary><form id="ms-anchor-form" class="ms-draft-form"><label>Editor name <input name="author" required value="${author}"></label><label>Passages <select name="passages" multiple required size="5">${state.corpus.passages.map(p=>`<option value="${p.id}">${e(p.id)}</option>`).join('')}</select></label><label>Relationship <select name="relation">${['partial-overlap','overlap','uncertain','variant','addition','omission'].map(v=>`<option>${v}</option>`).join('')}</select></label><label>Evidence / uncertainty <textarea name="note" required rows="2"></textarea></label><button type="submit">Save passage link privately</button><p>This associates the selected physical line with passages. It does not align words or mark the link as reviewed.</p></form></details></div>`;
  }
  function cancelDrawing() {if(drawing){drawing.remove();drawing=null;}}
  function drawRectangle(form) {
    cancelDrawing();if(!viewer?.world.getItemAt(0))return message('Wait for the source image to load.');
    // A moving camera would change the image coordinates between drag endpoints.
    viewer.viewport.setRotation(viewer.viewport.getRotation(),true);
    viewer.viewport.panTo(viewer.viewport.getCenter(),true);
    viewer.viewport.zoomTo(viewer.viewport.getZoom(),null,true);viewer.forceRedraw();
    const surface=selectedSurface(),overlay=document.createElement('div');overlay.className='ms-draw-overlay';overlay.tabIndex=0;
    overlay.setAttribute('aria-label','Drag a rectangle on the image. Escape cancels.');document.querySelector('#ms-image').append(overlay);drawing=overlay;
    const preview=document.createElement('div');preview.className='ms-draw-preview';overlay.append(preview);
    let start=null,pointer=null;
    const point=event=>{const rect=overlay.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};};
    overlay.onpointerdown=event=>{if(event.button!==0||pointer!==null)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;start=point(event);overlay.setPointerCapture(pointer);};
    overlay.onpointermove=event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();const end=point(event);Object.assign(preview.style,{left:Math.min(start.x,end.x)+'px',top:Math.min(start.y,end.y)+'px',width:Math.abs(end.x-start.x)+'px',height:Math.abs(end.y-start.y)+'px'});};
    overlay.onpointerup=event=>{
      if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();
      const end=point(event),p=viewer.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(start.x,start.y)),q=viewer.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(end.x,end.y));
      const x=Math.round(Math.min(p.x,q.x)),y=Math.round(Math.min(p.y,q.y)),w=Math.round(Math.abs(p.x-q.x)),h=Math.round(Math.abs(p.y-q.y));
      cancelDrawing();
      if(w<3||h<3||x<0||y<0||x+w>surface.width||y+h>surface.height)return message('Draw a rectangle inside the source image. No coordinates were changed.');
      ['x','y','width','height'].forEach((k,i)=>form.elements[k].value=[x,y,w,h][i]);
      if(form.elements.editGeometry)form.elements.editGeometry.checked=true;
      form.dispatchEvent(new Event('input',{bubbles:true}));message(`Rectangle staged: ${x}, ${y}, ${w}, ${h}. Save the private draft to apply it.`);
    };
    overlay.onpointercancel=cancelDrawing;overlay.onkeydown=event=>{if(event.key==='Escape'){cancelDrawing();message('Drawing cancelled. The saved geometry is unchanged.');}};
    message('Drag a rectangle on the scan. Press Escape to cancel.');overlay.focus();
  }
  async function render(container) {
    dispose();const turn=generation;
    compactMobileNavigation();
    container.innerHTML='<div class="empty-state">Loading manuscript workspace…</div>';
    try {
      await load(m.id);if(turn!==generation||state.view!=='manuscripts')return;
      const surface=selectedSurface(),index=current.surfaces.indexOf(surface);
      hash();
      container.innerHTML=`<section class="ms-workspace" data-mobile-pane="${m.pane}">
        <header class="ms-heading"><div><p class="eyebrow">Manuscripts · research pilot</p><h3>${e(record.shelfmark)}</h3><p>${e(record.institution)}</p></div><span class="ms-badge">Partial transcription · unreviewed</span></header>
        <div id="ms-status" class="ms-status" role="status">${e(storageProblem||statusMessage)}</div>
        <nav class="ms-toolbar" aria-label="Manuscript navigation"><button data-ms-prev ${index===0?'disabled':''}>← Previous</button><select id="ms-surface" aria-label="Manuscript surface">${current.surfaces.map(s=>`<option value="${s.id}" ${s.id===m.surfaceId?'selected':''}>${e(s.label)}</option>`).join('')}</select><button data-ms-next ${index===current.surfaces.length-1?'disabled':''}>Next →</button><label><input id="ms-sync" type="checkbox" ${m.sync?'checked':''}> Sync panes</label><label><input id="ms-overlays" type="checkbox" ${m.overlays?'checked':''}> Line regions</label><button id="ms-copy">Copy citation</button><button id="ms-edit" aria-pressed="${m.editing}">${m.editing?'Return to reading':'Edit private draft'}</button></nav>
        <nav class="ms-mobile-tabs" aria-label="Manuscript panels">${['scan','text','research'].map(p=>`<button data-ms-pane="${p}" aria-pressed="${m.pane===p}">${p[0].toUpperCase()+p.slice(1)}</button>`).join('')}</nav>
        <div class="ms-thumbnails" aria-label="Surface thumbnails">${current.surfaces.map((s,i)=>`<button data-ms-thumbnail="${i}" aria-pressed="${s.id===m.surfaceId}">${s.thumbnail?`<img src="${a(s.thumbnail)}" alt="" loading="lazy">`:''}<span>${e(s.label)}</span></button>`).join('')}</div><div class="ms-columns"><section class="ms-scan" aria-label="Manuscript scan"><div class="ms-image-tools"><button data-ms-zoom="1.5" aria-label="Zoom in">+</button><button data-ms-zoom="0.6666667" aria-label="Zoom out">−</button><button id="ms-home">Fit surface</button><button id="ms-rotate">Rotate 90°</button><button id="ms-fullscreen">Fullscreen</button></div><details class="ms-image-adjust"><summary>Image display aids</summary><label>Brightness <input id="ms-brightness" type="range" min="50" max="180" value="${m.brightness}"></label><label>Contrast <input id="ms-contrast" type="range" min="50" max="200" value="${m.contrast}"></label><button type="button" id="ms-reset-display">Reset display</button><p>Display only; the source image and readings stay unchanged.</p></details><div id="ms-image" class="ms-image" style="--ms-brightness:${m.brightness/100};--ms-contrast:${m.contrast/100}" tabindex="0" aria-label="Zoomable manuscript image"></div><p id="ms-image-status" role="status">Loading selected image…</p><div class="ms-attribution"><strong>${e(record.shelfmark)} · ${e(surface.label)}</strong><p>${e(record.attribution)}</p><p><a href="${a(record.rights.url)}" target="_blank" rel="noopener">${e(record.rights.label)}</a> · <a href="${a(surface.image.sourcePage||record.sourceUrl)}" target="_blank" rel="noopener">Open source image record</a></p></div></section>
        <section class="ms-text" aria-label="Manuscript text"><div class="ms-layer-tabs" role="group" aria-label="Textual layer">${core.layers.map(layer=>`<button data-ms-layer="${layer}" aria-pressed="${layer===m.layer}">${layer[0].toUpperCase()+layer.slice(1)}</button>`).join('')}</div><label class="ms-search">Search this layer and notes<input id="ms-search" type="search" value="${a(m.query)}" placeholder="Search this surface"></label><div id="ms-lines">${renderText()}</div>${editorHTML()}</section>
        <aside class="ms-research" aria-label="Manuscript research"><h4>Research</h4>${researchHTML()}<div class="ms-export"><button id="ms-export">Export private draft</button><label class="ms-import">Import draft<input id="ms-import" type="file" accept=".json,application/json"></label><button id="ms-tei">Export TEI</button>${storageProblem&&rawDrafts.has(m.id)?'<button id="ms-export-raw">Export saved draft unchanged</button>':''}</div></aside></div></section>`;
      bind(container);
      await loadScript('vendor/openseadragon-6.1.1.min.js');if(turn!==generation||state.view!=='manuscripts')return;
      let imageFallback=false;
      const tileSource=surface.image.type==='dzi'?{Image:{xmlns:'http://schemas.microsoft.com/deepzoom/2008',Url:surface.image.tilesUrl,Format:surface.image.format,Overlap:surface.image.overlap,TileSize:surface.image.tileSize,Size:{Width:surface.width,Height:surface.height}}}:surface.image.type==='iiif'?surface.image.url:{type:'image',url:surface.image.url,buildPyramid:false};
      viewer=OpenSeadragon({id:'ms-image',showNavigationControl:false,showNavigator:false,drawer:'canvas',
        tileSources:tileSource,
        gestureSettingsMouse:{clickToZoom:false},visibilityRatio:0.25,constrainDuringPan:true});
      viewer.addHandler('open',()=>{
        if(turn!==generation)return;
        document.querySelector('#ms-image-status').textContent=imageFallback?'Selected source image loaded as fallback; static tiles were unavailable.':surface.image.type==='image'?'Selected source image loaded. Tiled delivery is pending.':'Loading image tiles on demand…';
        const item=viewer.world.getItemAt(0),size=item.getContentSize();
        if(size.x!==surface.width||size.y!==surface.height){message('Image dimensions differ from the recorded canvas. Regions are disabled pending review.');return;}
        if(surface.viewport)item.setClip(new OpenSeadragon.Rect(...surface.viewport));
        fitSurface();drawRegions();
        if(reviewPreview?.surfaceId===m.surfaceId) {
          document.querySelector('.ms-scan')?.scrollIntoView({block:'start'});
          message('Shared review preview: proposed regions are dashed blue; current regions are dashed brown. Previewing does not save a change.');
        }
      });
      viewer.addHandler('tile-loaded',()=>{
        if(turn!==generation||imageFallback||surface.image.type==='image')return;
        document.querySelector('#ms-image-status').textContent='Image tiles loaded on demand.';
      });
      viewer.addHandler('tile-load-failed',()=>{
        if(turn!==generation||imageFallback||surface.image.type!=='dzi')return;
        imageFallback=true;
        document.querySelector('#ms-image-status').textContent='Static tiles unavailable; loading the original source image…';
        viewer.open({type:'image',url:surface.image.url,buildPyramid:false});
      });
      viewer.addHandler('open-failed',()=>{
        if(turn!==generation)return;
        document.querySelector('#ms-image-status').textContent='The image service could not be reached. The source link, text and local drafts remain available.';
      });
    } catch(error) {
      if(turn!==generation)return;
      container.innerHTML=`<div class="empty-state"><h3>Manuscript workspace unavailable</h3><p>${e(error.message)}</p><button id="ms-retry">Retry</button></div>`;
      container.querySelector('#ms-retry').onclick=()=>render(container);
    }
  }
  function fitSurface() {
    const item=viewer?.world.getItemAt(0);if(!item)return;
    const s=selectedSurface(),r=s.viewport||[0,0,s.width,s.height];viewer.viewport.fitBounds(item.imageToViewportRectangle(...r),true);
  }
  function drawRegions() {
    if(!viewer?.world.getItemAt(0))return;regionTrackers.forEach(t=>t.destroy());regionTrackers=[];viewer.clearOverlays();if(!m.overlays)return;
    for(const line of current.lines.filter(l=>l.surfaceId===m.surfaceId))for(const id of line.regionIds) {
      const region=current.regions.find(r=>r.id===id);if(!region)continue;
      const button=document.createElement('button');button.type='button';button.className='ms-region'+(line.id===m.lineId?' selected':'');
      button.setAttribute('aria-label',`${line.label}: select transcription`);button.dataset.msRegion=line.id;button.title=line.label;
      button.onclick=event=>{event.preventDefault();event.stopPropagation();selectLine(line.id,'scan');};
      viewer.addOverlay({element:button,location:viewer.world.getItemAt(0).imageToViewportRectangle(...region.xywh),checkResize:false});
      regionTrackers.push(new OpenSeadragon.MouseTracker({element:button,clickHandler:event=>{
        if(event.quick){event.preventDefaultAction=true;selectLine(line.id,'scan');}
      }}));
    }
    if(reviewPreview?.surfaceId===m.surfaceId)for(const box of reviewPreview.boxes) {
      const s=selectedSurface(),r=box.xywh;
      if(!Array.isArray(r)||r.length!==4||r.some(x=>!Number.isFinite(x))||r[0]<0||r[1]<0||r[2]<=0||r[3]<=0||r[0]+r[2]>s.width||r[1]+r[3]>s.height)continue;
      const element=document.createElement('div');element.className='ms-review-region '+box.kind;element.title=box.kind==='proposed'?'Submitted region preview':'Current shared region';
      viewer.addOverlay({element,location:viewer.world.getItemAt(0).imageToViewportRectangle(...r),checkResize:false});
    }
  }
  function selectLine(id,origin='text') {
    reviewPreview=null;
    cancelDrawing();
    const line=current.lines.find(l=>l.id===id);if(!line)return;m.lineId=id;
    const first=linked(id).flatMap(x=>x.passageIds)[0];if(m.sync&&first)m.passageId=first;
    hash();document.querySelector('#ms-lines').innerHTML=renderText();
    document.querySelector('.ms-research').innerHTML=`<h4>Research</h4>${researchHTML()}${document.querySelector('.ms-export')?.outerHTML||''}`;
    document.querySelector('#ms-structure-editor')?.remove();
    const oldForm=document.querySelector('#ms-draft-form');if(oldForm)oldForm.outerHTML=editorHTML();
    bindDynamic(document.querySelector('#reader'));drawRegions();
    if(m.sync) {
      if(origin==='scan')document.querySelector('#ms-line-'+id)?.scrollIntoView({block:'nearest'});
      else {const region=current.regions.find(r=>r.id===line.regionIds[0]);const item=viewer?.world.getItemAt(0);if(region&&item)viewer.viewport.fitBounds(item.imageToViewportRectangle(...region.xywh));}
    }
  }
  function goSurface(index) {const s=current.surfaces[index];if(!s)return;reviewPreview=null;m.surfaceId=s.id;m.lineId='';statusMessage='';renderReader();}
  function openReading(pid,comparison=false) {
    if(!passageById(pid))return;m.passageId=pid;
    state.view=comparison?'comparison':'reading';state.selectedSources.add(record.relatedWitnessId);state.openPassages.add(pid);state.openSourcePanels.add(pid+':'+record.relatedWitnessId);
    history.replaceState(null,'','#'+pid);updateViewPresentation();buildSidebar();renderSummary();renderReader();document.getElementById(pid)?.scrollIntoView({block:'start'});
  }
  function lookup(word,lineId) {
    m.lineId=lineId;state.view='analysis';state.analysisTab='lexicon';state.analysisSourceId=record.relatedWitnessId;
    state.analysisQuery=word;state.analysisSelectedTokenId='';state.analysisSelectedPassageId='';state.analysisPassageId=m.passageId||'v1';
    history.replaceState(null,'',location.pathname+location.search);updateViewPresentation();renderReader();
  }
  function bindDynamic(container) {
    const shared=container.querySelector('#ms-shared-content');
    if(shared) {
      const mount=()=>window.ManuscriptReviewUI.mount(shared,{id:m.id,draft:()=>core.clone(drafts.get(m.id)),download,
        blocked:()=>publishedProblem||storageProblem||(draftConflicts.length?'Resolve saved draft conflicts before submitting.':''),
        refreshPublished:async()=>{await loadPublishedEditorData();renderReader();},
        scan:(change,base,draft)=>{
          const value=change.after||change.before;
          const line=value.layers?value:base.lines.find(l=>l.regionIds.includes(value.id)||value.lineIds?.includes(l.id)||value.targets?.some(t=>t.lineId===l.id||l.regionIds.includes(t.regionId)));
          const surfaceId=value.surfaceId||line?.surfaceId;if(!surfaceId)return message('No physical surface was found for this proposal.');
          const boxes=[];
          if(change.kind==='region') {for(const [kind,r] of [['current',change.before],['proposed',change.after]])if(r)boxes.push({kind,xywh:r.xywh});}
          else if(line)for(const id of line.regionIds) {
            const before=base.regions.find(r=>r.id===id),after=draft.records.find(r=>r.kind==='region'&&r.targetId===id)?.value||before;
            if(before)boxes.push({kind:'current',xywh:before.xywh});if(after)boxes.push({kind:'proposed',xywh:after.xywh});
          }
          reviewPreview={surfaceId,boxes};m.overlays=true;m.surfaceId=surfaceId;m.lineId=current.lines.some(l=>l.id===line?.id)?line.id:'';m.pane='scan';renderReader();
        }});
      if(window.ManuscriptReviewUI)mount();
      else shared.querySelector('#ms-shared-open').onclick=async()=>{
        try{await loadScript('manuscripts-review.js?v=0.34.0-draft');if(shared.isConnected)mount();}catch(error){message(error.message);}
      };
    }
    container.querySelectorAll('[data-ms-line]').forEach(b=>b.onclick=()=>selectLine(b.dataset.msLine));
    container.querySelectorAll('[data-ms-passage]').forEach(b=>b.onclick=()=>openReading(b.dataset.msPassage));
    container.querySelectorAll('[data-ms-compare]').forEach(b=>b.onclick=()=>openReading(b.dataset.msCompare,true));
    container.querySelectorAll('[data-ms-word]').forEach(b=>b.onclick=()=>lookup(b.dataset.msWord,b.dataset.msWordLine));
    container.querySelectorAll('[data-ms-draw]').forEach(b=>b.onclick=()=>drawRectangle(document.getElementById(b.dataset.msDraw)));
    bindStructureForms(container);
    container.querySelectorAll('[data-ms-review-line]').forEach(b=>b.onclick=()=>{
      const line=current.lines.find(l=>l.id===b.dataset.msReviewLine);if(!line)return;
      if(line.surfaceId!==m.surfaceId){m.surfaceId=line.surfaceId;m.lineId=line.id;renderReader();}
      else selectLine(line.id);
    });
    const conflictForm=container.querySelector('#ms-conflict-form');
    if(conflictForm) {
      const key=`review:${m.id}:${current.version}`,pending=formBuffers[key]||{};
      for(const field of conflictForm.elements)if(field.name&&Object.hasOwn(pending,field.name))field.value=pending[field.name];
      conflictForm.oninput=()=>{
        formBuffers[key]=Object.fromEntries(new FormData(conflictForm));
        try{localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch{}
      };
      conflictForm.onsubmit=event=>{
      event.preventDefault();try {
        const fields=new FormData(conflictForm),decisions=draftConflicts.map(c=>({id:c.id,choice:fields.get(c.id)}));
        const next=core.resolveDraft(packages.get(m.id),drafts.get(m.id),decisions,fields.get('author'),state.corpus);
        persist(next);delete formBuffers[key];
        try{localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch{}
        statusMessage='Review decisions saved privately. Earlier proposals remain in History and the draft export.';renderReader();
      }catch(error){message(error.message);}
      };
    }
    const draftForm=container.querySelector('#ms-draft-form');
    if(draftForm) {
      const formKey=[m.id,m.lineId,m.layer].join(':');
      const pending=formBuffers[formKey];
      if(pending)for(const field of draftForm.elements) {
        if(!field.name||!Object.hasOwn(pending,field.name))continue;
        if(field.type==='checkbox')field.checked=Boolean(pending[field.name]);else field.value=pending[field.name];
      }
      draftForm.oninput=()=>{
        formBuffers[formKey]=Object.fromEntries(new FormData(draftForm));
        try {localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}
        catch {message('The form is retained in this session, but browser storage is unavailable. Save or copy the text before closing.');}
      };
      draftForm.elements.regionId.onchange=()=>{
        const region=current.regions.find(r=>r.id===draftForm.elements.regionId.value);
        if(region)['x','y','width','height'].forEach((key,i)=>draftForm.elements[key].value=region.xywh[i]);
        draftForm.dispatchEvent(new Event('input',{bubbles:true}));
      };
      const markStatus=()=>{const marks=JSON.parse(draftForm.elements.marks.value);draftForm.querySelector('#ms-mark-status').textContent=`${marks.length} mark(s): `+marks.map(mark=>`${mark.type} ${mark.start}–${mark.end}`).join('; ');};
      markStatus();
      draftForm.querySelector('#ms-mark-selection').onclick=()=>{
        try {
          const field=draftForm.elements.text,text=field.value,marks=JSON.parse(draftForm.elements.marks.value);
          if(marks.length&&draftForm.elements.marksBasis.value!==text)throw new Error('The text changed. Clear and reapply its marks before saving.');
          const start=Array.from(text.slice(0,field.selectionStart)).length,end=Array.from(text.slice(0,field.selectionEnd)).length;
          if(start===end)throw new Error('Select the characters to mark in the transcription box.');
          if(marks.some(mark=>start<mark.end&&end>mark.start))throw new Error('This selection overlaps an existing mark. Clear and reapply marks to change it.');
          marks.push({type:draftForm.elements.markType.value,start,end,reason:draftForm.elements.markReason.value.trim()});marks.sort((a,b)=>a.start-b.start);
          draftForm.elements.marks.value=JSON.stringify(marks);draftForm.elements.marksBasis.value=text;markStatus();draftForm.dispatchEvent(new Event('input',{bubbles:true}));
        }catch(error){message(error.message);}
      };
      draftForm.querySelector('#ms-clear-marks').onclick=()=>{
        draftForm.elements.marks.value='[]';draftForm.elements.marksBasis.value=draftForm.elements.text.value;markStatus();draftForm.dispatchEvent(new Event('input',{bubbles:true}));
      };
      draftForm.onsubmit=event=>{
      event.preventDefault();try {
        const fields=new FormData(draftForm),author=fields.get('author').trim();if(!author)throw new Error('An editor name is required.');
        const draft=core.clone(drafts.get(m.id)),line=core.clone(selectedLine()),existing=line.layers[m.layer];
        const newText=fields.get('text'),marks=JSON.parse(fields.get('marks'));
        if(marks.length&&fields.get('marksBasis')!==newText)throw new Error('The text changed. Clear and reapply its marks before saving.');
        if(newText!== (existing?.text||'')||fields.get('scope')!==existing?.scope||fields.get('note')!==(existing?.note||'')||JSON.stringify(marks)!==JSON.stringify(existing?.marks||[])) {
          line.layers[m.layer]={text:newText,scope:fields.get('scope'),note:fields.get('note'),status:'draft',provenance:['local-draft'],
            derivedFrom:existing?.derivedFrom||null,marks};line.status='draft';upsert(draft,'line',line,author);
        }
        if(fields.get('editGeometry')||fields.get('addRegion')) {
          const original=current.regions.find(r=>r.id===fields.get('regionId')&&line.regionIds.includes(r.id));
          const region=fields.get('addRegion')?{id:'ms-region-'+crypto.randomUUID(),revision:1,surfaceId:line.surfaceId,shape:'rect',provenance:['local-draft']}:original&&core.clone(original);
          if(!region)throw new Error('This line has no region to revise. Choose Add this rectangle.');
          region.xywh=['x','y','width','height'].map(k=>Number(fields.get(k)));region.status='draft';upsert(draft,'region',region,author);
          if(fields.get('addRegion')){line.regionIds.push(region.id);upsert(draft,'line',line,author);}
        }
        if(fields.get('annotation').trim()) {
          const target=fields.get('annotationTarget'),type=fields.get('annotationType');
          if(!Object.hasOwn(annotationTypes,type)||target!=='line'&&!line.regionIds.includes(target))throw new Error('Choose a valid note type and target.');
          upsert(draft,'annotation',{id:'note-'+crypto.randomUUID(),revision:1,type,targets:[target==='line'?{lineId:line.id}:{regionId:target}],text:fields.get('annotation').trim(),status:'draft',author,createdAt:new Date().toISOString(),provenance:['local-draft']},author);
        }
        if(core.applyDraft(packages.get(m.id),draft,state.corpus).conflicts.length)throw new Error('Review saved changes before saving another edit.');persist(draft);
        delete formBuffers[formKey];
        try {localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch {}
        statusMessage='Private draft saved in this browser. Export a copy for backup.';renderReader();
      }catch(error){message(error.message);}
      };
    }
    const exportButton=container.querySelector('#ms-export');if(exportButton)exportButton.onclick=()=>download(JSON.stringify(drafts.get(m.id),null,2),m.id+'-draft.json');
    const rawButton=container.querySelector('#ms-export-raw');if(rawButton)rawButton.onclick=()=>download(rawDrafts.get(m.id),m.id+'-saved-original.json');
    const teiButton=container.querySelector('#ms-tei');if(teiButton)teiButton.onclick=()=>{try{download(core.tei(current,record,state.publishedEditorData.manuscriptReviews?.[m.id]?.events||[]),m.id+'.tei.xml','application/xml');}catch(error){message(error.message);}};
    const importInput=container.querySelector('#ms-import');if(importInput)importInput.onchange=async()=>{
      const file=importInput.files[0];if(!file)return;
      try {if(file.size>5000000)throw new Error('Draft exceeds the 5 MB import limit.');const imported=JSON.parse(await file.text());
        const merged=core.mergeDrafts(drafts.get(m.id),imported,packages.get(m.id),state.corpus);persist(merged);statusMessage='Draft imported without replacing existing conflicting edits.';renderReader();
      }catch(error){message(error.message);importInput.value='';}
    };
  }
  function bindStructureForms(container) {
    for(const form of container.querySelectorAll('#ms-structure-editor form')) {
      const key=[m.id,m.lineId,form.id].join(':'),pending=formBuffers[key];
      if(pending)for(const field of form.elements) {
        if(!field.name||!Object.hasOwn(pending,field.name))continue;
        if(field.multiple)for(const option of field.options)option.selected=(pending[field.name]||[]).includes(option.value);
        else field.value=pending[field.name];
      }
      form.oninput=()=>{
        const values=Object.fromEntries(new FormData(form));
        for(const field of form.elements)if(field.multiple)values[field.name]=Array.from(field.selectedOptions,o=>o.value);
        formBuffers[key]=values;
        try{localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch{message('Form retained in this session; browser storage is unavailable.');}
      };
      form.onsubmit=event=>{
        event.preventDefault();try {
          if(draftConflicts.length)throw new Error('Resolve the saved draft conflicts first.');
          const fields=new FormData(form),author=fields.get('author').trim(),draft=core.clone(drafts.get(m.id));
          if(!author)throw new Error('An editor name is required.');
          let createdId='';
          if(form.id==='ms-order-form') {
            const ids=current.lines.filter(l=>l.surfaceId===m.surfaceId).sort((a,b)=>a.order-b.order).map(l=>l.id),position=Number(fields.get('position'));
            if(!Number.isInteger(position)||position<0||position>=ids.length)throw new Error('Choose a valid reading position.');
            ids.splice(ids.indexOf(m.lineId),1);ids.splice(position,0,m.lineId);
            for(const line of core.reorderLines(current,m.surfaceId,ids))if(line.order!==current.lines.find(l=>l.id===line.id).order)upsert(draft,'line',line,author);
          }else if(form.id==='ms-add-line-form') {
            const label=fields.get('label').trim();if(!label)throw new Error('A line label is required.');
            const id='ms-line-'+crypto.randomUUID(),rid=id+'-region',order=Math.max(0,...current.lines.filter(l=>l.surfaceId===m.surfaceId).map(l=>l.order))+1;
            upsert(draft,'region',{id:rid,revision:1,surfaceId:m.surfaceId,shape:'rect',xywh:['x','y','width','height'].map(k=>Number(fields.get(k))),status:'draft',provenance:['local-draft']},author);
            upsert(draft,'line',{id,revision:1,surfaceId:m.surfaceId,label,order,regionIds:[rid],script:selectedLine()?.script||null,hand:null,status:'untranscribed',layers:Object.fromEntries(core.layers.map(l=>[l,null])),provenance:['local-draft']},author);createdId=id;
          }else if(form.id==='ms-anchor-form') {
            const passages=[...new Set(fields.getAll('passages'))],note=fields.get('note').trim(),relation=fields.get('relation');
            if(!passages.length||!note)throw new Error('Select at least one passage and supply an evidence note.');
            if(linked().some(a=>a.relation===relation&&JSON.stringify([...a.passageIds].sort())===JSON.stringify([...passages].sort())))throw new Error('This passage relationship already exists for the line.');
            upsert(draft,'anchor',{id:'ms-anchor-'+crypto.randomUUID(),revision:1,lineIds:[m.lineId],passageIds:passages,tokenIds:[],relation,level:'line',status:'draft',note,provenance:['local-draft']},author);
          }
          if(core.applyDraft(packages.get(m.id),draft,state.corpus).conflicts.length)throw new Error('Resolve the saved draft conflicts first.');
          persist(draft);delete formBuffers[key];try{localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch{}
          if(createdId)m.lineId=createdId;
          statusMessage='Manuscript structure saved as a private draft. Existing corpus tokens are unchanged.';renderReader();
        }catch(error){message(error.message);}
      };
    }
  }
  function bind(container) {
    bindDynamic(container);
    container.querySelectorAll('[data-ms-thumbnail]').forEach(b=>b.onclick=()=>goSurface(Number(b.dataset.msThumbnail)));
    for(const field of ['brightness','contrast'])container.querySelector('#ms-'+field).oninput=event=>{m[field]=Number(event.target.value);container.querySelector('#ms-image').style.setProperty('--ms-'+field,m[field]/100);};
    container.querySelector('#ms-reset-display').onclick=()=>{for(const field of ['brightness','contrast']){m[field]=100;container.querySelector('#ms-'+field).value=100;container.querySelector('#ms-image').style.setProperty('--ms-'+field,1);}};
    container.querySelector('#ms-surface').onchange=event=>goSurface(current.surfaces.findIndex(s=>s.id===event.target.value));
    container.querySelector('[data-ms-prev]').onclick=()=>goSurface(current.surfaces.findIndex(s=>s.id===m.surfaceId)-1);
    container.querySelector('[data-ms-next]').onclick=()=>goSurface(current.surfaces.findIndex(s=>s.id===m.surfaceId)+1);
    container.querySelector('#ms-sync').onchange=event=>{m.sync=event.target.checked;};
    container.querySelector('#ms-overlays').onchange=event=>{m.overlays=event.target.checked;drawRegions();};
    container.querySelector('#ms-edit').onclick=()=>{m.editing=!m.editing;renderReader();};
    container.querySelector('#ms-search').oninput=event=>{m.query=event.target.value;container.querySelector('#ms-lines').innerHTML=renderText();bindDynamic(container);};
    container.querySelectorAll('[data-ms-layer]').forEach(b=>b.onclick=()=>{m.layer=b.dataset.msLayer;renderReader();});
    container.querySelectorAll('[data-ms-pane]').forEach(b=>b.onclick=()=>{m.pane=b.dataset.msPane;container.querySelector('.ms-workspace').dataset.mobilePane=m.pane;container.querySelectorAll('[data-ms-pane]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));viewer?.forceRedraw();});
    container.querySelectorAll('[data-ms-zoom]').forEach(b=>b.onclick=()=>{viewer?.viewport.zoomBy(Number(b.dataset.msZoom));viewer?.viewport.applyConstraints();});
    container.querySelector('#ms-home').onclick=fitSurface;
    container.querySelector('#ms-rotate').onclick=()=>viewer?.viewport.setRotation((viewer.viewport.getRotation()+90)%360,true);
    container.querySelector('#ms-fullscreen').onclick=async()=>{
      try {if(document.fullscreenElement)await document.exitFullscreen();else await container.querySelector('.ms-scan').requestFullscreen();}
      catch {message('Fullscreen is unavailable in this browser.');}
    };
    container.querySelector('#ms-copy').onclick=async()=>{hash();const text=citation();try{await navigator.clipboard.writeText(text);message('Citation copied.');}catch{message(text);}};
  }
  async function open(options={}) {
    state.view='manuscripts';updateViewPresentation();
    if(options.passageId) {
      m.passageId=options.passageId;
      try {await load(m.id);const anchor=current.anchors.find(x=>x.passageIds.includes(options.passageId));
        if(anchor){m.lineId=anchor.lineIds[0];m.surfaceId=current.lines.find(l=>l.id===m.lineId).surfaceId;}
        else statusMessage='This passage has no physical anchor in the pilot yet. The current surface is retained.';
      }catch(error){statusMessage=error.message;}
    }
    renderReader();
  }
  window.addEventListener('hashchange',()=>{if(state.corpus)restoreHash();});
  window.matchMedia('(max-width:900px)').addEventListener('change',compactMobileNavigation);
  return {render,dispose,restoreHash,open};
})();
