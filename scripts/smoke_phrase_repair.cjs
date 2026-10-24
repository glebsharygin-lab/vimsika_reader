const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/auth-config.js*', route => route.fulfill({contentType:'application/javascript',body:'window.VIMSIKA_AUTH_CONFIG = {};'}));
    await page.goto('http://127.0.0.1:8765', {waitUntil:'networkidle'});
    const result = await page.evaluate(() => {
      let checked=0;
      for (const passage of state.corpus.passages) {
        for (const source of state.corpus.sources) {
          const witness = effectiveWitness(passage, source.id);
          if (witnessUnavailable(witness)) continue;
          const doc = new DOMParser().parseFromString(readingSentenceList(passage,source,witness),'text/html');
          const ids = [...doc.querySelectorAll('[data-token-id]')].map(node=>node.dataset.tokenId);
          if (ids.length !== new Set(ids).size) throw new Error(`Repeated token in Reading: ${passage.id} ${source.id}`);
          if (ids.length !== witness.tokens.length) throw new Error(`Lost token in Reading: ${passage.id} ${source.id} ${ids.length}/${witness.tokens.length}`);
          checked++;
        }
      }
      const p = state.corpus.passages[1];
      const sid='zho_xuanzang';
      const source=state.corpus.sources.find(s=>s.id===sid);
      const witness=effectiveWitness(p,sid);
      state.focusedSentenceByPassage[p.id]='dharmanexus-v2-002';
      const focused=readingSentenceList(p,source,witness);
      if (!focused.includes('若') || focused.includes('Included in')) throw new Error('Focus omitted the shared Chinese root verse');
      delete state.focusedSentenceByPassage[p.id];
      const p1=state.corpus.passages[0];
      const original=structuredClone(state.editorData);
      state.editorData.sectionEdits=[{passageId:'v1',unitId:'sentence-v1-001',number:'1.1',targetTexts:{san_levi_1925:'LEGACY EDIT'},updatedAt:'test'}];
      const edited=phraseAlignments(p1).filter(r=>r.number==='1.1');
      if (edited.length!==1 || alignmentTargetText(edited[0],p1,'san_levi_1925')!=='LEGACY EDIT') throw new Error('Legacy section edit was lost or duplicated');
      state.editorData=original;
      const from=p1.sentenceUnits[0];
      const moved=from.targetTokenIds.san_levi_1925;
      state.editorData.sentenceEdits=[{passageId:'v1',toUnitId:'sentence-v1-002',sourceId:'san_levi_1925',tokenIds:moved,updatedAt:'test-boundary'}];
      const units=effectiveSentenceUnits(p1);
      const emptied=units.find(r=>r.number==='1.1');
      if (alignmentTargetText(emptied,p1,'san_levi_1925')) throw new Error('Moved tokens reappeared through stale text fallback');
      state.editorData=original;
      return {checked,slavic:state.corpus.sources.filter(s=>['Polish','Russian','Slovenian'].includes(s.language)).length};
    });
    assert.equal(result.slavic,5);
    for (const sid of ['pol_balcerowicz_nowakowska_1999','rus_lyssenko_2022','slv_petek_2022']) {
      await page.locator(`#sourceFilters input[value='${sid}']`).check();
      const panel=page.locator(`#v1 .source-panel[data-source='${sid}']`);
      if (!(await panel.getAttribute('class')).includes('open')) await panel.locator('.source-panel-header').click();
    }
    await page.locator("#v1 [data-focus-sentence='dharmanexus-v1-006']").first().click();
    await page.screenshot({path:'qa-slavic-phrase-repair.png',fullPage:false});
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${result.checked} witness passages preserve every token once; shared Chinese focus, legacy edits, moved boundaries and five Slavic witnesses verified.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
