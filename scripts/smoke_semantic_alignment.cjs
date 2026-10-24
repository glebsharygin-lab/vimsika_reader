const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  try {
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/auth-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'window.VIMSIKA_AUTH_CONFIG = {};'}));
    await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.passage-card');
    const result=await page.evaluate(()=>{
      const sid='eng_silk_2016',source=state.corpus.sources.find(s=>s.id===sid);
      let units=0;
      for(const p of state.corpus.passages){
        const witness=effectiveWitness(p,sid);
        for(const row of phraseAlignments(p)){
          if(!row.targetTokenIds?.[sid]?.length)continue;
          state.focusedSentenceByPassage[p.id]=row.id;
          const doc=new DOMParser().parseFromString(readingSentenceList(p,source,witness),'text/html');
          const shown=[...doc.querySelectorAll('[data-token-id]')].map(n=>n.dataset.tokenId);
          if(JSON.stringify(shown)!==JSON.stringify(row.targetTokenIds[sid]))throw Error(`Silk focus mismatch ${row.number}`);
          units++;
        }
        delete state.focusedSentenceByPassage[p.id];
      }
      const p=state.corpus.passages[2],row=phraseAlignments(p).find(r=>r.number==='3.14');
      const target=state.corpus.sources.find(s=>s.id==='eng_das');
      const rendered=readingSentenceList(p,target,effectiveWitness(p,target.id));
      if(!rendered.includes('suggested · check span'))throw Error('Reading lost suggestion label');
      if(!phraseRow(row,p,[target],'1fr 3fr',0).includes('alignment-suggestion-label'))throw Error('Comparison lost suggestion label');
      const moved=state.corpus.passages[19].texts[sid].tokens.find(t=>t.originVerse===19);
      if(!moved || !state.corpus.passages[19].texts[sid].tokens.some(t=>t.id===moved.id))throw Error('Moved Silk token inaccessible');
      return {units,moved:moved.id};
    });
    assert.equal(result.units,263);assert.deepEqual(errors,[]);
    await page.locator('#sourceFilters input').evaluateAll(nodes=>{for(const n of nodes)if(n.checked&&!['san_levi_1925','eng_silk_2016'].includes(n.value))n.click();});
    await page.locator('#sourceFilters input[value="eng_silk_2016"]').check();
    await page.locator('#v3 .passage-header').click();
    const panel=page.locator('#v3 .source-panel[data-source="eng_silk_2016"]');
    if(!(await panel.getAttribute('class')).includes('open'))await panel.locator('.source-panel-header').click();
    await page.locator('#v3').scrollIntoViewIfNeeded();
    await page.screenshot({path:'work/vimsika-0.24.0/qa-silk.png'});
    console.log('PASS: 263 focused Silk spans render their exact tokens, including moved verse boundaries; Reading and Comparison label draft suggestions.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
