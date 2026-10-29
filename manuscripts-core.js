/* Physical manuscript records never replace corpus witnesses or token identities. */
(function (root) {
  'use strict';
  const layers = ['diplomatic','transliteration','normalized','translation'];
  const kinds = {line:'lines',region:'regions',anchor:'anchors',annotation:'annotations'};
  const statuses = ['draft','submitted','reviewed','published','untranscribed'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const check = (yes,message) => { if (!yes) throw new Error(message); };
  const idOK = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,159}$/.test(value);
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  function rectangle(box,surface) {
    return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
      box[0]>=0 && box[1]>=0 && box[2]>0 && box[3]>0 &&
      box[0]+box[2]<=surface.width && box[1]+box[3]<=surface.height;
  }
  function validatePackage(data,corpus) {
    check(data?.schemaVersion==='1.0.0' && idOK(data.id) && typeof data.version==='string','Unsupported manuscript package.');
    const ids=new Set();
    for (const key of ['surfaces','regions','lines','anchors','annotations']) {
      check(Array.isArray(data[key]),`Missing ${key}.`);
      for(const item of data[key]) {
        check(idOK(item.id) && !ids.has(item.id),`Invalid or duplicate ID: ${item.id}`); ids.add(item.id);
        check(Number.isInteger(item.revision) && item.revision>0,`Missing revision: ${item.id}`);
      }
    }
    const surfaces=new Map(data.surfaces.map(s=>[s.id,s]));
    const regions=new Map(data.regions.map(r=>[r.id,r]));
    const lines=new Map(data.lines.map(l=>[l.id,l]));
    for(const s of data.surfaces) {
      check(Number.isFinite(s.width)&&s.width>0&&Number.isFinite(s.height)&&s.height>0,`Invalid dimensions: ${s.id}`);
      check((s.canvasId==null||https(s.canvasId))&&https(s.image?.url),`Unsafe image reference: ${s.id}`);
      check(['image','iiif','dzi'].includes(s.image.type),`Unsupported image delivery: ${s.id}`);
      if(s.image.type==='dzi')check(/^manuscript-images\/[a-z0-9-]+\/view-[1-9][0-9]*_files\/$/.test(s.image.tilesUrl)&&s.image.tileSize===512&&s.image.overlap===1&&s.image.format==='jpg',`Invalid tile configuration: ${s.id}`);
      check(!s.viewport||rectangle(s.viewport,s),`Invalid surface viewport: ${s.id}`);
      check(!s.thumbnail||/^manuscript-images\/[a-z0-9-]+\/[a-z0-9-]+-thumb\.jpg$/.test(s.thumbnail),`Invalid thumbnail: ${s.id}`);
    }
    for(const r of data.regions) {
      check(surfaces.has(r.surfaceId)&&r.shape==='rect'&&rectangle(r.xywh,surfaces.get(r.surfaceId)),`Invalid region: ${r.id}`);
    }
    for(const l of data.lines) {
      check(surfaces.has(l.surfaceId)&&Array.isArray(l.regionIds),`Invalid line surface: ${l.id}`);
      check(Number.isInteger(l.order)&&l.order>0,`Invalid reading order: ${l.id}`);
      check(l.regionIds.every(id=>regions.get(id)?.surfaceId===l.surfaceId),`Region belongs to a different surface: ${l.id}`);
      check(l.layers&&statuses.includes(l.status),`Invalid line layers/status: ${l.id}`);
      for(const key of layers) {
        const value=l.layers[key];
        if(value==null)continue;
        check(typeof value.text==='string'&&value.text.length<=1000000,`Invalid ${key}: ${l.id}`);
        check(['excerpt','complete'].includes(value.scope),`Missing transcription scope: ${l.id}`);
        check(statuses.includes(value.status),`Invalid layer status: ${l.id}`);
        if(value.derivedFrom) check(lines.has(value.derivedFrom.lineId)&&layers.includes(value.derivedFrom.layer),`Invalid derivation: ${l.id}`);
        let end=0;
        for(const mark of value.marks||[]) {
          check(['unclear','damage','supplied','add','del'].includes(mark.type),`Invalid TEI mark: ${l.id}`);
          check(Number.isInteger(mark.start)&&Number.isInteger(mark.end)&&mark.start>=end&&mark.end>mark.start&&mark.end<=Array.from(value.text).length,`Overlapping or invalid mark: ${l.id}`);
          end=mark.end;
        }
      }
    }
    for(const s of data.surfaces) {
      const order=data.lines.filter(l=>l.surfaceId===s.id).map(l=>l.order);
      check(new Set(order).size===order.length,`Duplicate reading order on ${s.id}`);
    }
    const passageIds=corpus&&new Set(corpus.passages.map(p=>p.id));
    const tokenIds=corpus&&new Set(corpus.passages.flatMap(p=>Object.values(p.texts).flatMap(w=>(w.tokens||[]).map(t=>t.id))));
    for(const a of data.anchors) {
      check(Array.isArray(a.lineIds)&&a.lineIds.length&&a.lineIds.every(id=>lines.has(id)),`Invalid anchor lines: ${a.id}`);
      check(Array.isArray(a.passageIds)&&a.passageIds.every(id=>idOK(id)&&(!passageIds||passageIds.has(id))),`Invalid passage anchor: ${a.id}`);
      check(Array.isArray(a.tokenIds)&&a.tokenIds.every(id=>typeof id==='string'&&(!tokenIds||tokenIds.has(id))),`Unknown corpus token: ${a.id}`);
      check(['line','token'].includes(a.level)&&statuses.includes(a.status),`Invalid anchor level/status: ${a.id}`);
      check(a.level==='token'||a.tokenIds.length===0,`Line anchor cannot assert token alignment: ${a.id}`);
      check(['overlap','partial-overlap','variant','addition','omission','uncertain'].includes(a.relation),`Invalid anchor relation: ${a.id}`);
    }
    for(const a of data.annotations) {
      check(typeof a.text==='string'&&Array.isArray(a.targets)&&a.targets.length&&statuses.includes(a.status),`Invalid annotation: ${a.id}`);
      for(const target of a.targets) check((target.regionId&&regions.has(target.regionId))||(target.lineId&&lines.has(target.lineId)),`Unknown annotation target: ${a.id}`);
    }
    return data;
  }
  function emptyDraft(data) {
    return {schemaVersion:'1.0.0-manuscript-draft',manuscriptId:data.id,baseVersion:data.version,records:[]};
  }
  function reorderLines(data,surfaceId,ids) {
    const lines=data.lines.filter(l=>l.surfaceId===surfaceId);
    check(Array.isArray(ids)&&ids.length===lines.length&&new Set(ids).size===lines.length&&lines.every(l=>ids.includes(l.id)),'Reading order must contain every line of the surface exactly once.');
    return lines.map(line=>({...clone(line),order:ids.indexOf(line.id)+1}));
  }
  function validateDraft(draft,data) {
    check(draft?.schemaVersion==='1.0.0-manuscript-draft'&&draft.manuscriptId===data.id,'Draft belongs to a different manuscript or schema.');
    check(typeof draft.baseVersion==='string'&&Array.isArray(draft.records)&&draft.records.length<=1000,'Invalid draft structure.');
    check(draft.resolutions===undefined||Array.isArray(draft.resolutions)&&draft.resolutions.every(r=>r&&['base','draft'].includes(r.choice)&&typeof r.author==='string'&&typeof r.date==='string'&&r.previous&&idOK(r.previous.targetId)&&r.previous.value),'Invalid resolution history.');
    const ids=new Set(), targets=new Set();
    for(const r of draft.records) {
      check(idOK(r.id)&&!ids.has(r.id),'Duplicate or invalid draft ID.');ids.add(r.id);
      check(Object.hasOwn(kinds,r.kind)&&idOK(r.targetId)&&r.value?.id===r.targetId,'Invalid draft target.');
      check(!targets.has(r.targetId),'Multiple draft changes to the same record.');targets.add(r.targetId);
      check(Number.isInteger(r.baseRevision)&&r.baseRevision>=0,'Invalid base revision.');
      check(r.provenance&&typeof r.provenance.author==='string'&&r.provenance.author.trim()&&typeof r.provenance.updatedAt==='string'&&statuses.includes(r.provenance.status),'Missing draft provenance.');
    }
    return draft;
  }
  function applyDraft(data,draft,corpus) {
    validateDraft(draft,data);
    const copy=clone(data),conflicts=[];
    for(const r of draft.records) {
      const list=copy[kinds[r.kind]],index=list.findIndex(x=>x.id===r.targetId);
      if(draft.baseVersion!==data.version||(index<0?r.baseRevision!==0:r.baseRevision!==list[index].revision)) {
        conflicts.push({id:r.id,targetId:r.targetId,kind:r.kind,base:index<0?null:clone(list[index]),proposed:clone(r.value),reason:'The package version or record revision changed. Compare both versions before saving.'}); continue;
      }
      if(index<0)list.push(clone(r.value));else list[index]=clone(r.value);
    }
    // A line and its region/order changes can depend on one another. Do not
    // expose a partially applied draft when one member needs conflict review.
    if(conflicts.length)return {data:clone(data),conflicts};
    validatePackage(copy,corpus);
    return {data:copy,conflicts};
  }
  // Rebase only through an explicit decision for EVERY conflict. The old record
  // and current base are kept in the exported audit trail even when set aside.
  function resolveDraft(data,draft,decisions,author,corpus,now=new Date().toISOString()) {
    check(typeof author==='string'&&author.trim(),'An editor name is required.');
    const {conflicts}=applyDraft(data,draft,corpus);
    check(conflicts.length&&Array.isArray(decisions)&&decisions.length===conflicts.length,'Choose a resolution for every conflict.');
    const choices=new Map(decisions.map(d=>[d.id,d.choice]));
    check(choices.size===conflicts.length&&conflicts.every(c=>['base','draft'].includes(choices.get(c.id))),'Choose a resolution for every conflict.');
    const copy=clone(draft);copy.resolutions=copy.resolutions||[];
    for(const conflict of conflicts) {
      const index=copy.records.findIndex(r=>r.id===conflict.id),old=clone(copy.records[index]),choice=choices.get(conflict.id);
      check(choice==='base'||conflict.base||old.baseRevision===0,'A removed base record cannot be restored implicitly. Keep the current package and retain the proposal in history.');
      copy.resolutions.push({id:conflict.id,choice,author:author.trim(),date:now,fromVersion:draft.baseVersion,toVersion:data.version,previous:old,base:conflict.base});
      if(choice==='base')copy.records.splice(index,1);
      else {
        const revision=conflict.base?.revision||0;
        copy.records[index]={...old,baseRevision:revision,value:{...old.value,revision:revision+1,status:'draft'},
          provenance:{...old.provenance,author:author.trim(),updatedAt:now,status:'draft'},
          history:[...(old.history||[]),{value:old.value,provenance:old.provenance}]};
        if(old.kind==='line')for(const value of Object.values(copy.records[index].value.layers))if(value)value.status='draft';
      }
    }
    copy.baseVersion=data.version;
    check(!applyDraft(data,copy,corpus).conflicts.length,'Some conflicts remain unresolved.');
    return copy;
  }
  function mergeDrafts(current,incoming,data,corpus) {
    validateDraft(current,data);validateDraft(incoming,data);
    check(current.baseVersion===incoming.baseVersion&&incoming.baseVersion===data.version,'Draft base version differs; nothing was imported. Export both versions for review.');
    const copy=clone(current),conflicts=[];
    const history=[...(current.resolutions||[]),...(incoming.resolutions||[])];
    if(history.length)copy.resolutions=[...new Map(history.map(r=>[JSON.stringify(r),clone(r)])).values()];
    for(const r of incoming.records) {
      const old=copy.records.find(x=>x.id===r.id||x.targetId===r.targetId);
      if(!old)copy.records.push(clone(r));
      else if(JSON.stringify(old)!==JSON.stringify(r))conflicts.push(r.targetId);
    }
    check(!conflicts.length,`Conflicting edits to ${conflicts.join(', ')}. Nothing was imported; both files remain available for review.`);
    const applied=applyDraft(data,copy,corpus);
    check(!applied.conflicts.length,'Imported revisions conflict with the base; nothing was imported.');
    return copy;
  }
  function markedText(value) {
    const chars=Array.from(value.text);let cursor=0,xml='';
    for(const mark of value.marks||[]) {
      xml+=esc(chars.slice(cursor,mark.start).join(''))+`<${mark.type}${mark.reason?` reason="${esc(mark.reason)}"`:''}>`+esc(chars.slice(mark.start,mark.end).join(''))+`</${mark.type}>`;cursor=mark.end;
    }
    return xml+esc(chars.slice(cursor).join(''));
  }
  function tei(data,record,reviewHistory=[]) {
    validatePackage(data);
    const surfaceOrder=new Map(data.surfaces.map(s=>[s.id,s.order]));
    const orderedLines=[...data.lines].sort((a,b)=>surfaceOrder.get(a.surfaceId)-surfaceOrder.get(b.surfaceId)||a.order-b.order);
    const surfaces=data.surfaces.map(s=>`<surface xml:id="${esc(s.id)}" n="${esc(s.label)}" ulx="0" uly="0" lrx="${s.width}" lry="${s.height}"><graphic url="${esc(s.image.url)}"/>${data.regions.filter(r=>r.surfaceId===s.id).map(r=>`<zone xml:id="${esc(r.id)}" ulx="${r.xywh[0]}" uly="${r.xywh[1]}" lrx="${r.xywh[0]+r.xywh[2]}" lry="${r.xywh[1]+r.xywh[3]}"/>`).join('')}</surface>`).join('\n');
    const sections=layers.map(layer=>`<div type="transcription" subtype="${layer}">${orderedLines.filter(l=>l.layers[layer]).map(l=>`<ab xml:id="${esc(l.id)}-${layer}"><lb n="${l.order}" facs="${l.regionIds.map(id=>'#'+esc(id)).join(' ')}"/><seg type="${esc(l.layers[layer].scope)}">${markedText(l.layers[layer])}</seg><note>${esc(l.layers[layer].note)}</note></ab>`).join('\n')}</div>`).join('\n');
    const physical=orderedLines.map(l=>`<ab xml:id="${esc(l.id)}" facs="${l.regionIds.map(id=>'#'+esc(id)).join(' ')}"><note>${esc(l.label)}; ${esc(l.status)}</note></ab>`).join('');
    const links=data.anchors.map(a=>`<link xml:id="${a.id}" type="${esc(a.relation)}" ana="${esc(a.level)}" target="${[...a.lineIds.map(id=>'#'+id),...a.passageIds.map(id=>'../index.html#'+id)].map(esc).join(' ')}"/>`).join('');
    const revisions=reviewHistory.length?`<revisionDesc>${reviewHistory.map(event=>`<change when="${esc(event.decidedAt)}" who="https://github.com/${esc(event.reviewer.login)}" type="${esc(event.decision)}">Proposal ${esc(event.proposal.id)} by ${esc(event.proposal.author.login)}, submitted ${esc(event.proposal.submittedAt)}; ${event.reviewer.id===event.proposal.author.id?'review by the author; ':''}${esc(event.note)}</change>`).join('')}</revisionDesc>`:'';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>${esc(record.shelfmark)} — ${esc(data.version)}</title><editor>${esc(data.editor)}</editor></titleStmt><publicationStmt><publisher>Viṃśikā Reader</publisher><availability status="restricted"><p>Local draft export; no publication or review is implied. ${esc(record.attribution)}. ${esc(record.rights.label)} ${esc(record.rights.url)}</p></availability></publicationStmt><sourceDesc><p>${esc(record.institution)}; ${esc(record.shelfmark)}. ${esc(record.sourceUrl)}</p></sourceDesc></fileDesc>${revisions}</teiHeader><facsimile>${surfaces}</facsimile><text><body><div type="physical-lines">${physical}</div>${sections}</body><back><div type="annotations">${data.annotations.map(a=>`<note xml:id="${a.id}" type="${esc(a.type)}" target="${a.targets.map(t=>'#'+esc(t.regionId||t.lineId)).join(' ')}">${esc(a.text)}</note>`).join('')}</div><div type="correspondence"><linkGrp type="manuscript-corpus">${links}</linkGrp></div></back></text></TEI>`;
  }
  // Adapter accepts simple, single-image IIIF Presentation 2/3 canvases only.
  // Complex canvases are explicitly rejected rather than silently mispositioned.
  function iiifCanvases(manifest) {
    const list=manifest.items||manifest.sequences?.[0]?.canvases;
    check(Array.isArray(list),'Unsupported IIIF manifest.');
    return list.map(c=>{
      const paints=c.images||c.items?.flatMap(p=>p.items||[]);
      check(paints?.length===1,'Multiple painting resources require an explicit image transform.');
      const body=paints[0].resource||paints[0].body;
      check(body&&!Array.isArray(body),'Unsupported painting body.');
      const services=Array.isArray(body.service)?body.service:[body.service];
      const service=services.find(s=>s&&(/ImageService[23]/.test(s.type||'')||/image/.test(s['@context']||'')));
      const url=service?.id||service?.['@id'];check(https(url),'No supported HTTPS IIIF image service.');
      check(body.width===c.width&&body.height===c.height,'Canvas/image coordinate transform is not yet supported.');
      const target=paints[0].target||paints[0].on;
      check(typeof target==='string'&&!target.includes('#'),'Partial-canvas painting is not supported.');
      return {canvasId:c.id||c['@id'],label:typeof c.label==='string'?c.label:Object.values(c.label||{}).flat().join(' '),width:c.width,height:c.height,image:{type:'iiif',url:url.replace(/\/$/,'')+'/info.json'}};
    });
  }
  root.ManuscriptCore={layers,clone,validatePackage,validateDraft,emptyDraft,reorderLines,applyDraft,resolveDraft,mergeDrafts,tei,iiifCanvases};
})(typeof window==='undefined'?globalThis:window);
