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
      state.selectedSources=new Set(['san_levi_1925','kor_lee_gilsan_2021','tha_soraj_2012']);
      state.openPassages.add('v1');
      state.openSourcePanels.add('v1:kor_lee_gilsan_2021');state.openSourcePanels.add('v1:tha_soraj_2012');
      renderReader();
      return {sources:sources.length,checked,focused};
    });
    for(const sid of ['kor_lee_gilsan_2021','tha_soraj_2012']){
      const button=page.locator(`#v1 [data-token-source="${sid}"]`).first();
      const word=await button.innerText(); await button.click();
      await page.locator('.lexical-popover').waitFor();
      assert.ok((await page.locator('.lexical-popover').innerText()).includes(word));
      await page.locator('[data-close-lexical-popover]').click();
    }
    await page.evaluate(()=>openResearchedDocument('kor_lee_gilsan_2021'));
    await page.locator('[data-open-library-source="kor_lee_gilsan_2021"]').click();
    assert.ok(await page.locator('#v1 .source-panel[data-source="kor_lee_gilsan_2021"]').count());
    await page.screenshot({path:path.resolve(root,'../inspection/qa-document-witnesses.png'),fullPage:false});
    assert.deepEqual(errors,[]);
    console.log('PASS:',JSON.stringify(stats),'Reading coverage, exact Focus spans, Comparison coverage notes, word lookup and source-document navigation.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
