const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  try {
    const page = await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    // An isolated test origin and profile: no server, external traffic or user drafts.
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='vimsika-test.invalid') return route.abort();
      const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
      const file=path.resolve(root,`.${name}`);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
      if(name==='/auth-config.js')return route.fulfill({contentType:'application/javascript',body:'window.VIMSIKA_AUTH_CONFIG={};'});
      const type={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
      await route.fulfill({contentType:type,body:fs.readFileSync(file)});
    });
    await page.goto('https://vimsika-test.invalid/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.passage-card');
    const stats=await page.evaluate(()=>{
      const sources=state.corpus.sources.filter(s=>s.libraryDocumentId);
      let checked=0,focused=0;
      for(const source of sources)for(const passage of state.corpus.passages){
        const witness=effectiveWitness(passage,source.id);
        if(witnessUnavailable(witness))continue;
        const html=readingSentenceList(passage,source,witness);
        const dom=new DOMParser().parseFromString(html,'text/html');
        const shown=[...dom.querySelectorAll('[data-token-id]')].map(n=>n.dataset.tokenId);
        const expected=witness.tokens.map(t=>t.id);
        if(shown.length!==expected.length || new Set(shown).size!==expected.length || expected.some(id=>!shown.includes(id)))throw Error(`Reading duplicated or lost tokens: ${source.id} ${passage.id}`);
        checked++;
        for(const unit of phraseAlignments(passage)){
          if(!unit.targetTokenIds?.[source.id]?.length)continue;
          state.focusedSentenceByPassage[passage.id]=unit.id;
          const doc=new DOMParser().parseFromString(readingSentenceList(passage,source,witness),'text/html');
          const ids=[...doc.querySelectorAll('[data-token-id]')].map(n=>n.dataset.tokenId);
          if(JSON.stringify(ids)!==JSON.stringify(unit.targetTokenIds[source.id]))throw Error(`Focus mismatch: ${unit.number} ${source.id}`);
          focused++;
        }
        delete state.focusedSentenceByPassage[passage.id];
      }
      state.view='comparison';
      const p=passageById('v2'), source=sourceById('eng_chatterjee_1980');
      const dom=new DOMParser().parseFromString(collationView(p,[source]),'text/html');
      if(dom.querySelector('.full-passage-row').classList.contains('collapsed'))throw Error('Whole-passage witness is hidden in comparison');
      if(!dom.body.textContent.includes('Incomplete:'))throw Error('Scan omission missing from Comparison');
      state.view='reading';
      state.selectedSources=new Set(['san_levi_1925',...sources.map(s=>s.id)]);
      state.openPassages.add('v1');
      for(const source of sources)state.openSourcePanels.add(`v1:${source.id}`);
      renderReader();
      return {sources:sources.length,checked,focused,sourceIds:sources.map(s=>s.id)};
    });
    for(const sid of ['san_levi_1925',...stats.sourceIds]){
      const button=page.locator(`#v1 [data-token-source="${sid}"]`).first();
      const word=await button.innerText(); await button.click();
      await page.locator('.lexical-popover').waitFor();
      assert.ok((await page.locator('.lexical-popover').innerText()).includes(word));
      await page.locator('[data-close-lexical-popover]').click();
    }
    // Exercise lookup on the newly linked passages, beyond the opening verse.
    for(const [sid,numbers,unitNumbers] of [
      ['eng_chatterjee_1980',[6,8,10,13,17,18,21]],
      ['eng_sharma_1993',[8,10,16,21]],
      ['eng_sharma_1993',[13,14,17,18,20,22],{13:'13.3',14:'14.12',17:'17.9',18:'18.7',20:'20.7',22:'22.6'}],
      ['eng_chatterjee_1980',[9,11,12,15,19,22],{9:'9.4',11:'11.8',12:'12.2',15:'15.7',19:'19.5',22:'22.7'}],
      ['eng_sharma_1993',[9,11,12,15,19],{9:'9.6',11:'11.7',12:'12.6',15:'15.9',19:'19.4'}],
      ['eng_chatterjee_1980',[14,16,20],{14:'14.12',16:'16.6',20:'20.9'}],
      ['eng_sharma_1993',[3,4,5,6,7],{3:'3.11',4:'4.10',5:'5.3',6:'6.3',7:'7.5'}],
      ['eng_chatterjee_1980',[3,4,5,7],{3:'3.14',4:'4.18',5:'5.4',7:'7.4'}],
      ['eng_sharma_1993',[1,2],{1:'1.7',2:'2.9'}],
      ['hin_chogdub_tripathi_1972',[3,4,5,6,7],{3:'3.12',4:'4.13',5:'5.4',6:'6.3',7:'7.4'}],
      ['hin_chogdub_tripathi_1972',[8,9,10,11,12],{8:'8.6',9:'9.4',10:'10.13',11:'11.8',12:'12.6'}],
      ['hin_chogdub_tripathi_1972',[13,14,15,16,17],{13:'13.6',14:'14.15',15:'15.8',16:'16.8',17:'17.11'}],
      ['hin_chogdub_tripathi_1972',[18,19,20,21,22],{18:'18.5',19:'19.7',20:'20.11',21:'21.6',22:'22.8'}],
      ['jpn_inazu_1929',[2],{2:'2.1'}],
      ['jpn_inazu_1929',[2],{2:'2.3'}],
      ['jpn_inazu_1929',[2,3],{2:'2.11',3:'3.11'}],
    ])for(const number of numbers){
      const pid=`v${number}`;
      const expected=await page.evaluate(({pid,sid,targetNumber})=>{
        const passage=passageById(pid),unit=phraseAlignments(passage)
          .find(u=>u.targetTokenIds?.[sid]?.length&&(!targetNumber||u.number===targetNumber));
        if(!unit)throw Error(`No phrase links: ${pid} ${sid}`);
        state.view='reading';state.selectedSources=new Set([sid]);
        state.openPassages.add(pid);state.openSourcePanels.add(`${pid}:${sid}`);
        state.focusedSentenceByPassage[pid]=unit.id;
        renderReader();return unit.targetTokenIds[sid];
      },{pid,sid,targetNumber:unitNumbers?.[number]});
      if (sid === 'jpn_inazu_1929' && number === 3) {
        const note = page.locator('#v3 .reading-source-note');
        await note.locator('summary').click();
        assert.ok(await note.locator('p').isVisible());
        assert.match(await note.innerText(),/皆同じなる/);
      }
      const tokens=page.locator(`#${pid} [data-token-source="${sid}"]`);
      assert.deepEqual(await tokens.evaluateAll(nodes=>nodes.map(n=>n.dataset.tokenId)),expected);
      const word=await tokens.first().innerText();await tokens.first().click();
      await page.locator('.lexical-popover').waitFor();
      assert.ok((await page.locator('.lexical-popover').innerText()).includes(word));
      await page.locator('[data-close-lexical-popover]').click();
      await page.evaluate(pid=>delete state.focusedSentenceByPassage[pid],pid);
    }
    await page.evaluate(() => {
      const source = sourceById('jpn_inazu_1929');
      const parse = html => new DOMParser().parseFromString(html, 'text/html');
      for (const [number, excluded, retained] of [
        ['2.10','物用あ別','夢中'],
        ['2.11','在性ある事物','乾闥城'],
        ['3.5','一第レト','限定は成立せり'],
        ['3.10','第三頃','皆同じなる'],
        ['3.11','第三頃','皆同じなる'],
      ]) {
        const passage = passageById('v'+number.split('.')[0]);
        const witness = effectiveWitness(passage, source.id);
        const unit = phraseAlignments(passage).find(row => row.number === number);
        const ids = unit.targetTokenIds[source.id];
        delete state.focusedSentenceByPassage[passage.id];
        const full = parse(readingSentenceList(passage,source,witness));
        if (!full.body.textContent.includes(excluded) || full.querySelector('.reading-source-note')) {
          throw Error('Whole witness or note visibility failed at '+number);
        }
        state.focusedSentenceByPassage[passage.id] = unit.id;
        const focus = parse(readingSentenceList(passage,source,witness));
        const comparison = parse(phraseRow(unit,passage,[source],'1fr 3fr',0));
        const visible = [focus.querySelector('.reading-sentence-body').textContent,
          alignmentTargetText(unit,passage,source.id)];
        if (number === '3.11') {
          if (!comparison.body.textContent.includes('Included in 3.10') || comparison.querySelector('[data-token-id]')) {
            throw Error('Comparison repeated or lost the shared 3.10–11 span');
          }
        } else {
          visible.push(comparison.body.textContent);
        }
        for (const shown of visible) {
          if (shown.includes(excluded) || (number.startsWith('3.') && !shown.includes(' … ')) || !shown.includes(retained)) {
            throw Error('Interleaved source text in selection '+number+': '+shown);
          }
        }
        if (number.startsWith('2.') && (!comparison.body.textContent.includes('partial source reading') ||
            !focus.querySelector('.reading-sentence-status').textContent.includes('partial source reading') ||
            !focus.querySelector('.reading-source-note')?.textContent.includes('非ざるか'))) {
          throw Error('Missing partial-coverage label or printed ending at '+number);
        }
        if (!focus.querySelector('.reading-source-note')?.textContent.includes('Inazu 1929')) {
          throw Error('Missing focused evidence at '+number);
        }
        if (focusedReadingNote(passage,source.id,{...unit,targetTexts:{[source.id]:'local draft'}},ids) ||
            focusedReadingNote(passage,source.id,unit,ids.slice(1))) {
          throw Error('Source note applied to an edited selection at '+number);
        }
        delete state.focusedSentenceByPassage[passage.id];
      }
    });
    await page.evaluate(()=>openResearchedDocument('kor_lee_gilsan_2021'));
    await page.locator('[data-open-library-source="kor_lee_gilsan_2021"]').click();
    assert.ok(await page.locator('#v1 .source-panel[data-source="kor_lee_gilsan_2021"]').count());
    await page.locator('#v1 .source-panel[data-source="kor_lee_gilsan_2021"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.resolve(root,'../inspection/qa-document-witnesses.png'),fullPage:false});
    assert.deepEqual(errors,[]);
    console.log('PASS:',JSON.stringify(stats),'Reading coverage, exact Focus spans, Comparison coverage notes, word lookup and source-document navigation.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
