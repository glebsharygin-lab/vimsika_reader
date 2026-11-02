/* Read-only research over a selected manuscript; personal collections stay separate. */
(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const fold=x=>String(x||'').normalize('NFC').toLocaleLowerCase();
  const layerNames=['diplomatic','transliteration','normalized','translation'];
  const notesFor=(data,line)=>data.annotations.filter(n=>n.targets.some(t=>t.lineId===line.id||line.regionIds.includes(t.regionId)));
  const label=x=>x==null?'Unidentified':typeof x==='string'?x:JSON.stringify(x);
  function search(data,options={}) {
    const {query='',field='transliteration',surface='',hand='',script='',status='',type=''}=options,q=fold(query);
    return data.lines.filter(line=>{
      if(surface&&line.surfaceId!==surface||hand&&label(line.hand)!==hand||script&&label(line.script)!==script)return false;
      const notes=notesFor(data,line).filter(n=>(!type||n.type===type)&&(!status||n.status===status));
      if(field==='notes')return notes.some(n=>fold(n.text).includes(q));
      if(type&&!notes.length)return false;
      const value=line.layers[field];return value&&(!status||value.status===status)&&fold(value.text).includes(q);
    }).map(line=>({lineId:line.id,surfaceId:line.surfaceId,label:line.label,field,
      text:field==='notes'?notesFor(data,line).filter(n=>(!type||n.type===type)&&(!status||n.status===status)&&fold(n.text).includes(q)).map(n=>n.text).join('\n'):line.layers[field].text,
      status:field==='notes'?'See individual notes':line.layers[field].status}));
  }
  function concordance(data) {
    const words=new Map();
    for(const line of data.lines) {
      const value=line.layers.normalized;if(!value)continue;
      for(const match of value.text.matchAll(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu)) {
        const term=fold(match[0]),item=words.get(term)||{term,occurrences:[]};
        item.occurrences.push({lineId:line.id,surfaceId:line.surfaceId,form:match[0],status:value.status,scope:value.scope,
          context:value.text.slice(Math.max(0,match.index-36),match.index+match[0].length+36)});words.set(term,item);
      }
    }
    return [...words.values()].sort((a,b)=>a.term.localeCompare(b.term));
  }
  function selectionBundle(data,record,lineIds,kind='selected-lines',passageId='') {
    const ids=new Set(lineIds),lines=data.lines.filter(l=>ids.has(l.id)),regions=new Set(lines.flatMap(l=>l.regionIds)),surfaces=new Set(lines.map(l=>l.surfaceId));
    if(!lines.length)throw new Error('No recorded manuscript lines match this selection.');
    return clone({schemaVersion:'1.0.0-manuscript-research-export',kind,passageId,manuscriptId:data.id,version:data.version,editor:data.editor,status:data.status,
      shelfmark:record.shelfmark,institution:record.institution,attribution:record.attribution,rights:record.rights,bibliography:record.bibliography,
      scopeNote:'Only recorded lines and line-level associations are included; a linked line can also contain other passages. Images are references, not embedded files. No word alignment or complete passage transcription is asserted.',
      surfaces:data.surfaces.filter(s=>surfaces.has(s.id)),regions:data.regions.filter(r=>regions.has(r.id)),lines,
      anchors:data.anchors.filter(a=>a.lineIds.some(id=>ids.has(id))),annotations:data.annotations.filter(a=>a.targets.some(t=>ids.has(t.lineId)||regions.has(t.regionId))),
      referenceNote:'Original many-to-many anchor and annotation targets are retained. Targets outside the selected lines refer to the full manuscript package at the recorded version.',provenance:data.provenance});
  }
  function passageBundle(data,record,passageId) {
    return selectionBundle(data,record,[...new Set(data.anchors.filter(a=>a.passageIds.includes(passageId)).flatMap(a=>a.lineIds))],'passage',passageId);
  }
  function readTray(storage,key) {
    const items=JSON.parse(storage.getItem(key)||'[]');
    if(!Array.isArray(items)||items.length>50||new Set(items.map(x=>x?.id)).size!==items.length||items.some(x=>!x||typeof x.id!=='string'||typeof x.citation!=='string'||typeof x.createdAt!=='string'||x.bundle?.schemaVersion!=='1.0.0-manuscript-research-export'||!Array.isArray(x.bundle.lines)||!x.bundle.lines.length||!Array.isArray(x.bundle.surfaces)||!Array.isArray(x.bundle.anchors)))throw new Error('The saved comparison tray cannot be read. Export it unchanged for recovery.');
    return items;
  }
  function apparatus(data) {
    const entries=[];
    for(const line of data.lines)for(const layer of layerNames) {
      const value=line.layers[layer];if(!value)continue;
      for(const [index,mark] of (value.marks||[]).entries())entries.push({id:line.id+'-'+layer+'-mark-'+index,lineId:line.id,layer,
        category:{add:'addition',del:'deletion',unclear:'uncertain',supplied:'restoration',damage:'damage'}[mark.type],reading:Array.from(value.text).slice(mark.start,mark.end).join(''),
        comparison:'',source:mark.reason||'No separate evidence note recorded.',evidence:'Recorded reading mark; no comparison with another edition is implied.',certainty:'See source note',status:value.status,stale:false});
    }
    for(const note of data.annotations)if(note.variant) {
      const v=note.variant,line=data.lines.find(l=>l.id===note.targets[0].lineId);
      entries.push({...clone(v),id:note.id,lineId:line.id,status:note.status,author:note.author,stale:line.layers[v.layer]?.text!==v.basis});
    }
    return entries;
  }
  function mount(host,api) {
    const {data,record}=api,key='vimsika-manuscript-tray-v1:'+data.id,options=api.options||{},terms=concordance(data);
    const opt=(values,current)=>'<option value="">All</option>'+values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');
    const unique=values=>[...new Set(values)].sort();
    const controls=()=>`<form id="ms-research-search"><label>Search <input name="query" type="search" value="${esc(options.query||'')}"></label><label>In <select name="field">${[...layerNames,'notes'].map(v=>`<option ${v===(options.field||'transliteration')?'selected':''}>${v}</option>`).join('')}</select></label><label>Surface <select name="surface"><option value="">All loaded surfaces</option>${data.surfaces.map(s=>`<option value="${s.id}" ${s.id===options.surface?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><label>Hand <select name="hand">${opt(unique(data.lines.map(l=>label(l.hand))),options.hand)}</select></label><label>Script <select name="script">${opt(unique(data.lines.map(l=>label(l.script))),options.script)}</select></label><label>Status <select name="status">${opt(['draft','submitted','reviewed','published','untranscribed'],options.status)}</select></label><label>Note type <select name="type">${opt(unique(data.annotations.map(n=>n.type)),options.type)}</select></label><button type="submit">Find readings</button></form><p>Search uses only recorded text in the selected layer or notes. Unidentified hands stay unidentified. Filters do not imply reviewed readings.</p><div id="ms-research-results"></div>`;
    const jump=(id,field)=>`<button type="button" data-research-line="${esc(id)}" data-research-layer="${layerNames.includes(field)?field:''}">Open line and scan</button>`;
    host.innerHTML=`<details id="ms-research-search-panel"><summary>Search manuscript</summary>${controls()}</details><details id="ms-concordance"><summary>Normalized concordance</summary><p>${terms.length} recorded forms. Counts cover transcribed normalized layers only; these are spelling forms, not dictionary lemmas or corpus token alignments.</p><label>Find form <input id="ms-concordance-query" type="search"></label><div id="ms-concordance-results"></div><button id="ms-concordance-export">Export complete concordance</button></details><details id="ms-comparison-tray"><summary>Comparison tray</summary><p>Collect snapshots of readings and their image references. Later edits do not change these saved snapshots.</p><button id="ms-tray-add">Collect selected line</button><div id="ms-tray-items"></div><button id="ms-tray-export">Export tray unchanged</button></details><details id="ms-passage-export"><summary>Export a manuscript passage</summary><label>Passage <select id="ms-export-passage">${unique(data.anchors.flatMap(a=>a.passageIds)).map(id=>`<option ${id===api.selection.passageId?'selected':''}>${esc(id)}</option>`).join('')}</select></label><button id="ms-passage-download">Export readings and image references</button><p>Includes every recorded line linked to this passage, all its layers, geometry, notes, rights and provenance. A linked line may also contain text from another passage.</p></details><p id="ms-research-message" role="status"></p>`;
    const message=text=>host.querySelector('#ms-research-message').textContent=text;
    const apparatusPanel=document.createElement('details');apparatusPanel.id='ms-apparatus';host.insertBefore(apparatusPanel,host.querySelector('#ms-research-message'));
    const assertions=apparatus(data);
    apparatusPanel.innerHTML=`<summary>Variant apparatus · ${assertions.length}</summary><p>These are recorded assertions and reading marks, not automatic differences or reviewed collation. An unclear or supplied reading is kept distinct from a substantive variant.</p><label>Category <select id="ms-apparatus-category">${opt(unique(assertions.map(v=>v.category)),'')}</select></label><div id="ms-apparatus-entries"></div>`;
    const bindJumps=area=>area.querySelectorAll('[data-research-line]').forEach(b=>b.onclick=()=>api.go(b.dataset.researchLine,b.dataset.researchLayer));
    const showApparatus=()=>{const category=host.querySelector('#ms-apparatus-category').value,out=host.querySelector('#ms-apparatus-entries');out.innerHTML=assertions.filter(v=>!category||v.category===category).map(v=>`<article><strong>${esc(v.category)} · ${esc(v.status)}</strong><p>${esc(v.layer)} · ${esc(v.author||'Source reading mark')} · ${esc(v.certainty)}${v.stale?' · TEXT BASIS CHANGED: recheck this assertion':''}</p><p>Manuscript: ${esc(v.reading||'[asserted omission]')}</p><p>Comparison: ${esc(v.comparison||'No comparison reading recorded.')}</p><p>Source: ${esc(v.source)}</p><p>${esc(v.evidence)}</p>${jump(v.lineId,v.layer)}${v.basis?`<details><summary>Original text basis</summary><p>${esc(v.basis)}</p></details>`:''}</article>`).join('')||'<p>No assertions recorded in this category.</p>';bindJumps(out);};host.querySelector('#ms-apparatus-category').onchange=showApparatus;showApparatus();
    const results=()=>{const rows=search(data,options),out=host.querySelector('#ms-research-results');out.innerHTML=`<p>${rows.length} matching physical line(s).</p>`+rows.map(r=>`<article><strong>${esc(data.surfaces.find(s=>s.id===r.surfaceId)?.label)} · ${esc(r.label)}</strong><p>${esc(r.text)}</p><p>${esc(r.status)}</p>${jump(r.lineId,r.field)}</article>`).join('');bindJumps(out);};
    const searchForm=host.querySelector('#ms-research-search');searchForm.oninput=()=>Object.assign(options,Object.fromEntries(new FormData(searchForm)));searchForm.onsubmit=event=>{event.preventDefault();Object.assign(options,Object.fromEntries(new FormData(searchForm)));results();};results();
    const renderTerms=()=>{const q=fold(host.querySelector('#ms-concordance-query').value),matched=terms.filter(t=>t.term.includes(q)),out=host.querySelector('#ms-concordance-results');out.innerHTML=`<p>${matched.length} forms${matched.length>100?'; first 100 displayed. Narrow the search or export all.':'.'}</p>`+matched.slice(0,100).map(t=>`<details><summary>${esc(t.term)} · ${t.occurrences.length}</summary>${t.occurrences.map(o=>`<p>${esc(o.context)} · ${esc(o.status)} · ${esc(o.scope)}</p>${jump(o.lineId,'normalized')}`).join('')}<button data-research-lookup="${esc(t.term)}" data-line="${t.occurrences[0].lineId}">Look up form</button></details>`).join('');bindJumps(out);out.querySelectorAll('[data-research-lookup]').forEach(b=>b.onclick=()=>api.lookup(b.dataset.researchLookup,b.dataset.line));};
    host.querySelector('#ms-concordance-query').oninput=renderTerms;renderTerms();
    host.querySelector('#ms-concordance-export').onclick=()=>api.download(JSON.stringify({manuscriptId:data.id,version:data.version,layer:'normalized',scope:'Recorded transcriptions only; orthographic forms, not lemmas.',terms},null,2),data.id+'-concordance.json');
    const tray=()=>{const out=host.querySelector('#ms-tray-items');try {const items=readTray(localStorage,key);out.innerHTML=items.map(item=>`<article><p><strong>${esc(item.bundle.shelfmark)} · ${esc(item.bundle.version)}</strong><br>${esc(item.citation)}</p>${item.bundle.lines.map(line=>`<details><summary>${esc(line.label)}</summary>${layerNames.map(layer=>`<p><strong>${esc(layer)}</strong> · ${esc(line.layers?.[layer]?.status||'not transcribed')}</p><p>${esc(line.layers?.[layer]?.text||'No transcription recorded.')}</p>`).join('')}</details>`).join('')}<button data-tray-remove="${esc(item.id)}">Remove snapshot</button>${unique(item.bundle.anchors.flatMap(a=>a.passageIds)).map(pid=>`<button data-tray-compare="${esc(pid)}">Compare ${esc(pid)} in Reader</button>`).join('')}</article>`).join('')||'<p>No collected readings.</p>';out.querySelectorAll('[data-tray-remove]').forEach(b=>b.onclick=()=>{try{const next=readTray(localStorage,key).filter(x=>x.id!==b.dataset.trayRemove);localStorage.setItem(key,JSON.stringify(next));tray();}catch(error){message(error.message);}});out.querySelectorAll('[data-tray-compare]').forEach(b=>b.onclick=()=>api.compare(b.dataset.trayCompare));}catch(error){out.textContent=error.message;}};tray();
    host.querySelector('#ms-tray-add').onclick=()=>{try{const items=readTray(localStorage,key),bundle=selectionBundle(data,record,[api.selection.lineId]);if(items.some(i=>JSON.stringify(i.bundle)===JSON.stringify(bundle)))return message('This reading is already in the tray.');if(items.length>=50)throw new Error('Export or remove a snapshot before collecting more than 50.');items.push({id:crypto.randomUUID(),createdAt:new Date().toISOString(),citation:api.citation(),bundle});localStorage.setItem(key,JSON.stringify(items));tray();message('Reading collected privately. Its layers and image references are preserved.');}catch(error){message(error.message);}};
    host.querySelector('#ms-tray-export').onclick=()=>{try{api.download(localStorage.getItem(key)||'[]',data.id+'-comparison-tray.json');}catch(error){message(error.message);}};
    host.querySelector('#ms-passage-download').onclick=()=>{try{const pid=host.querySelector('#ms-export-passage').value;api.download(JSON.stringify(passageBundle(data,record,pid),null,2),data.id+'-'+pid+'-research.json');}catch(error){message(error.message);}};
  }
  root.ManuscriptResearch={search,concordance,selectionBundle,passageBundle,readTray,apparatus,mount};
})(typeof window==='undefined'?globalThis:window);
