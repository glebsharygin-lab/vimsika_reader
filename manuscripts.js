/* Lazy manuscript workspace. Corpus/editorial storage are never rewritten here. */
window.Manuscripts = (() => {
  'use strict';
  const assetPromises=new Map(),packages=new Map(),drafts=new Map(),rawDrafts=new Map();
  let registry,core,viewer,generation=0,current,record,statusMessage='',storageProblem='';
  let regionTrackers=[];
  let draftConflicts=[];
  let mobileSidebarBefore=null;
  let formBuffers={};
  try { formBuffers=JSON.parse(localStorage.getItem('vimsika-manuscript-forms-v1')||'{}'); } catch {}
  const m={id:'bnf-pt797',surfaceId:'',lineId:'',layer:'transliteration',passageId:'',pane:'scan',sync:true,overlays:true,editing:false,query:''};
  const e=value=>escapeHtml(value), a=value=>escapeAttribute(value);
  function loadScript(url) {
    if(!assetPromises.has(url))assetPromises.set(url,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=url;
      script.onload=resolve;script.onerror=()=>{assetPromises.delete(url);script.remove();reject(new Error(`Could not load ${url}.`));};document.head.append(script);
    }));
    return assetPromises.get(url);
  }
  async function load(id) {
    await Promise.all([loadScript('manuscripts-core.js?v=0.31.1-draft'),loadScript('manuscripts/registry.js?v=0.31.1-draft')]);
    core=window.ManuscriptCore;registry=window.MANUSCRIPT_REGISTRY;
    record=registry.manuscripts.find(r=>r.id===id)||registry.manuscripts[0];m.id=record.id;
    if(!packages.has(m.id)) {
      if(!/^manuscripts\/[a-z0-9-]+\.js$/.test(record.package))throw new Error('Invalid manuscript package location.');
      await loadScript(record.package+'?v=0.31.1-draft');
      const data=window.MANUSCRIPT_PACKAGES[m.id];core.validatePackage(data,state.corpus);packages.set(m.id,data);
    }
    const data=packages.get(m.id);
    if(!drafts.has(m.id)) {
      const draft=core.emptyDraft(data);drafts.set(m.id,draft);
      try {
        const raw=localStorage.getItem('vimsika-manuscript-draft-v1:'+m.id);
        if(raw) {rawDrafts.set(m.id,raw);const parsed=JSON.parse(raw);core.applyDraft(data,parsed,state.corpus);drafts.set(m.id,parsed);}
      } catch(error) {storageProblem='The saved manuscript draft could not be loaded. It has been kept untouched. Export the saved file before resolving it. '+error.message;}
    }
    const applied=core.applyDraft(data,drafts.get(m.id),state.corpus);current=applied.data;draftConflicts=applied.conflicts;
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
    if(storageProblem)throw new Error('The earlier saved draft needs review; it will not be overwritten.');
    // Save first; if storage is full, keep the in-memory current draft unchanged.
    localStorage.setItem('vimsika-manuscript-draft-v1:'+m.id,JSON.stringify(draft));drafts.set(m.id,draft);
  }
  function upsert(draft,kind,value,author) {
    const data=packages.get(m.id),collection={line:'lines',region:'regions',annotation:'annotations'}[kind];
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
      const content=m.layer==='normalized'?text.split(/(\s+)/).map(word=>/^\s*$/.test(word)?e(word):`<button class="ms-word" data-ms-word="${a(word)}" data-ms-word-line="${line.id}" title="Look up this normalized form">${e(word)}</button>`).join(''):e(text);
      return `<article class="ms-line ${line.id===m.lineId?'selected':''}" id="ms-line-${line.id}">
        <button class="ms-line-label" data-ms-line="${line.id}" type="button" aria-pressed="${line.id===m.lineId}">${e(line.label)} <span>${e(value?value.scope+' · '+value.status:'not transcribed')}</span></button>
        <p class="ms-line-text ${m.layer==='diplomatic'?'ms-tibetan':''}">${content||'No transcription recorded in this layer.'}</p>
        ${value?.note?`<p class="ms-note">${e(value.note)}</p>`:''}</article>`;
    }).join('')||'<p>No lines match this search in the selected surface and layer.</p>';
  }
  function researchHTML() {
    const line=selectedLine(),anchors=linked(),notes=current.annotations.filter(n=>n.targets.some(t=>t.lineId===m.lineId||line?.regionIds.includes(t.regionId)));
    const changes=drafts.get(m.id).records.filter(r=>r.targetId===m.lineId||line?.regionIds.includes(r.targetId));
    return `<details open><summary>Passage links</summary>${anchors.length?anchors.map(anchor=>`<p class="ms-note">${e(anchor.level)} · ${e(anchor.relation)} · ${e(anchor.status)}</p><p>${e(anchor.note||'')}</p><div class="ms-actions">${anchor.passageIds.map(pid=>`<button data-ms-passage="${pid}">Read ${e(pid)}</button><button data-ms-compare="${pid}">Compare ${e(pid)}</button>`).join('')}</div>`).join(''):'<p>No passage anchor is recorded for this physical line.</p>'}
        ${m.passageId?`<p>Logical selection: ${e(m.passageId)}. Selecting a word does not change the surface.</p>`:''}</details>
      <details><summary>Notes & variants</summary>${notes.map(n=>`<p><strong>${e(n.type)} · ${e(n.status)}</strong><br>${e(n.text)}<br><small>${e(n.author||'')}</small></p>`).join('')||'<p>No scholarly annotation recorded for this line.</p>'}<p>No reviewed variant apparatus is available for this pilot.</p></details>
      <details><summary>Evidence & lexical work</summary><p>Normalized forms are editorial search readings. Each belongs to a named transcription layer and physical line, with a route back to the scan. Use the Normalized tab to look up a form.</p><p>${e(line?.layers.normalized?.note||'No normalized reading recorded.')}</p><p>Published comparison witness: ${e(record.relatedWitnessId)}. Line-level links do not assert word alignment.</p></details>
      <details><summary>History & local drafts</summary><p>Base package ${e(current.version)} · ${e(current.status)} · project editor ${e(current.editor)}. This pilot has not received independent scholarly review.</p>${changes.map(c=>`<p>${e(c.kind)} · ${e(c.provenance.status)} · ${e(c.provenance.author)}<br>${e(c.provenance.updatedAt)} · ${c.history?.length||0} earlier local revision(s)</p>`).join('')}${(drafts.get(m.id).resolutions||[]).map(r=>`<details><summary>${e(r.previous.kind)} · ${e(r.previous.targetId)} · ${r.choice==='base'?'proposal archived':'proposal retained'}</summary><p>${e(r.author)} · ${e(r.date)}<br>${e(r.fromVersion)} → ${e(r.toVersion)}</p>${conflictReading(r.previous.value)}</details>`).join('')}<p>Draft export preserves identifiers, coordinates, readings and provenance. Submission and publication are not enabled in this pilot.</p></details>
      ${conflictHTML()}
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
      <label>Extent <select name="scope"><option value="excerpt" ${value?.scope!=='complete'?'selected':''}>Excerpt of the physical line</option><option value="complete" ${value?.scope==='complete'?'selected':''}>Complete physical line</option></select></label>
      <label>Reading note / evidence <textarea name="note" rows="2">${e(value?.note||'')}</textarea></label>
      <details><summary>Geometry in original image pixels</summary><label><input type="checkbox" name="editGeometry"> Save a region correction</label><div class="ms-coordinates">${['x','y','width','height'].map((key,i)=>`<label>${key}<input name="${key}" type="number" step="1" value="${region?.xywh[i]||0}"></label>`).join('')}</div><p>These values are independent of zoom and browser size.</p></details>
      <label>Add a private scholarly note <textarea name="annotation" rows="2"></textarea></label><button type="submit">Save private draft</button><p>Changes stay in this browser. Export a copy for review and backup.</p></form>`;
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
        <div class="ms-columns"><section class="ms-scan" aria-label="Manuscript scan"><div class="ms-image-tools"><button data-ms-zoom="1.5" aria-label="Zoom in">+</button><button data-ms-zoom="0.6666667" aria-label="Zoom out">−</button><button id="ms-home">Fit surface</button><button id="ms-rotate">Rotate 90°</button><button id="ms-fullscreen">Fullscreen</button></div><div id="ms-image" class="ms-image" tabindex="0" aria-label="Zoomable manuscript image"></div><p id="ms-image-status" role="status">Loading selected image…</p><div class="ms-attribution"><strong>${e(record.shelfmark)} · ${e(surface.label)}</strong><p>${e(record.attribution)}</p><p><a href="${a(record.rights.url)}" target="_blank" rel="noopener">${e(record.rights.label)}</a> · <a href="${a(surface.image.sourcePage||record.sourceUrl)}" target="_blank" rel="noopener">Open source image record</a></p></div></section>
        <section class="ms-text" aria-label="Manuscript text"><div class="ms-layer-tabs" role="group" aria-label="Textual layer">${core.layers.map(layer=>`<button data-ms-layer="${layer}" aria-pressed="${layer===m.layer}">${layer[0].toUpperCase()+layer.slice(1)}</button>`).join('')}</div><label class="ms-search">Search this layer and notes<input id="ms-search" type="search" value="${a(m.query)}" placeholder="Search this surface"></label><div id="ms-lines">${renderText()}</div>${editorHTML()}</section>
        <aside class="ms-research" aria-label="Manuscript research"><h4>Research</h4>${researchHTML()}<div class="ms-export"><button id="ms-export">Export private draft</button><label class="ms-import">Import draft<input id="ms-import" type="file" accept=".json,application/json"></label><button id="ms-tei">Export TEI</button>${storageProblem&&rawDrafts.has(m.id)?'<button id="ms-export-raw">Export saved draft unchanged</button>':''}</div></aside></div></section>`;
      bind(container);
      await loadScript('vendor/openseadragon-6.1.1.min.js');if(turn!==generation||state.view!=='manuscripts')return;
      viewer=OpenSeadragon({id:'ms-image',showNavigationControl:false,showNavigator:false,drawer:'canvas',
        tileSources:surface.image.type==='iiif'?surface.image.url:{type:'image',url:surface.image.url,buildPyramid:false},
        gestureSettingsMouse:{clickToZoom:false},visibilityRatio:0.25,constrainDuringPan:true});
      viewer.addHandler('open',()=>{
        if(turn!==generation)return;
        document.querySelector('#ms-image-status').textContent=surface.image.type==='iiif'?'Image tiles loaded on demand.':'Selected source image loaded. Tiled delivery is pending.';
        const item=viewer.world.getItemAt(0),size=item.getContentSize();
        if(size.x!==surface.width||size.y!==surface.height){message('Image dimensions differ from the recorded canvas. Regions are disabled pending review.');return;}
        if(surface.viewport)item.setClip(new OpenSeadragon.Rect(...surface.viewport));
        fitSurface();drawRegions();
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
  }
  function selectLine(id,origin='text') {
    const line=current.lines.find(l=>l.id===id);if(!line)return;m.lineId=id;
    const first=linked(id).flatMap(x=>x.passageIds)[0];if(m.sync&&first)m.passageId=first;
    hash();document.querySelector('#ms-lines').innerHTML=renderText();
    document.querySelector('.ms-research').innerHTML=`<h4>Research</h4>${researchHTML()}${document.querySelector('.ms-export')?.outerHTML||''}`;
    const oldForm=document.querySelector('#ms-draft-form');if(oldForm)oldForm.outerHTML=editorHTML();
    bindDynamic(document.querySelector('#reader'));drawRegions();
    if(m.sync) {
      if(origin==='scan')document.querySelector('#ms-line-'+id)?.scrollIntoView({block:'nearest'});
      else {const region=current.regions.find(r=>r.id===line.regionIds[0]);const item=viewer?.world.getItemAt(0);if(region&&item)viewer.viewport.fitBounds(item.imageToViewportRectangle(...region.xywh));}
    }
  }
  function goSurface(index) {const s=current.surfaces[index];if(!s)return;m.surfaceId=s.id;m.lineId='';statusMessage='';renderReader();}
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
    container.querySelectorAll('[data-ms-line]').forEach(b=>b.onclick=()=>selectLine(b.dataset.msLine));
    container.querySelectorAll('[data-ms-passage]').forEach(b=>b.onclick=()=>openReading(b.dataset.msPassage));
    container.querySelectorAll('[data-ms-compare]').forEach(b=>b.onclick=()=>openReading(b.dataset.msCompare,true));
    container.querySelectorAll('[data-ms-word]').forEach(b=>b.onclick=()=>lookup(b.dataset.msWord,b.dataset.msWordLine));
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
      draftForm.onsubmit=event=>{
      event.preventDefault();try {
        const fields=new FormData(draftForm),author=fields.get('author').trim();if(!author)throw new Error('An editor name is required.');
        const draft=core.clone(drafts.get(m.id)),line=core.clone(selectedLine()),existing=line.layers[m.layer];
        const newText=fields.get('text');
        if(newText!== (existing?.text||'')||fields.get('scope')!==existing?.scope||fields.get('note')!==(existing?.note||'')) {
          line.layers[m.layer]={text:newText,scope:fields.get('scope'),note:fields.get('note'),status:'draft',provenance:['local-draft'],
            derivedFrom:existing?.derivedFrom||null};line.status='draft';upsert(draft,'line',line,author);
        }
        if(fields.get('editGeometry')) {
          const region=core.clone(current.regions.find(r=>r.id===line.regionIds[0]));region.xywh=['x','y','width','height'].map(k=>Number(fields.get(k)));region.status='draft';upsert(draft,'region',region,author);
        }
        if(fields.get('annotation').trim())upsert(draft,'annotation',{id:'note-'+crypto.randomUUID(),revision:1,type:'scholarly-note',targets:[{lineId:line.id}],text:fields.get('annotation').trim(),status:'draft',author,createdAt:new Date().toISOString(),provenance:['local-draft']},author);
        if(core.applyDraft(packages.get(m.id),draft,state.corpus).conflicts.length)throw new Error('Review saved changes before saving another edit.');persist(draft);
        delete formBuffers[formKey];
        try {localStorage.setItem('vimsika-manuscript-forms-v1',JSON.stringify(formBuffers));}catch {}
        statusMessage='Private draft saved in this browser. Export a copy for backup.';renderReader();
      }catch(error){message(error.message);}
      };
    }
    const exportButton=container.querySelector('#ms-export');if(exportButton)exportButton.onclick=()=>download(JSON.stringify(drafts.get(m.id),null,2),m.id+'-draft.json');
    const rawButton=container.querySelector('#ms-export-raw');if(rawButton)rawButton.onclick=()=>download(rawDrafts.get(m.id),m.id+'-saved-original.json');
    const teiButton=container.querySelector('#ms-tei');if(teiButton)teiButton.onclick=()=>{try{download(core.tei(current,record),m.id+'.tei.xml','application/xml');}catch(error){message(error.message);}};
    const importInput=container.querySelector('#ms-import');if(importInput)importInput.onchange=async()=>{
      const file=importInput.files[0];if(!file)return;
      try {if(file.size>5000000)throw new Error('Draft exceeds the 5 MB import limit.');const imported=JSON.parse(await file.text());
        const merged=core.mergeDrafts(drafts.get(m.id),imported,packages.get(m.id),state.corpus);persist(merged);statusMessage='Draft imported without replacing existing conflicting edits.';renderReader();
      }catch(error){message(error.message);importInput.value='';}
    };
  }
  function bind(container) {
    bindDynamic(container);
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
    container.querySelector('#ms-rotate').onclick=()=>viewer?.viewport.setRotation((viewer.viewport.getRotation()+90)%360);
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
