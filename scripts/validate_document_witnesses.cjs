const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, Intl });
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
for (const name of ['corpus.js', 'researched-translations.js', 'witness-integration.js', 'translation-library.js']) {
  vm.runInContext(read(name), context, {filename:name});
}
const app = read('app.js');
vm.runInContext(app.slice(app.indexOf('function isCjk('), app.indexOf('function effectiveWitness(')), context);
const before = JSON.parse(JSON.stringify(context.window.CORPUS_DATA));
const originalLibrary = JSON.parse(JSON.stringify(context.window.RESEARCHED_TRANSLATIONS));
const oldTokens = vm.runInContext(`(() => {
  const corpus = JSON.parse(JSON.stringify(window.CORPUS_DATA));
  integrateResearchedTranslations(corpus, window.RESEARCHED_TRANSLATIONS, tokenizeEditedText);
  return JSON.stringify(corpus.passages.map(p => Object.fromEntries(
    window.RESEARCHED_TRANSLATIONS.sources.map(s => [s.id,p.texts[s.id]]))));
})()`, context);
// All ten imports were already uploaded by the user. Phrase-only changes must
// preserve those published token identities, including the later OCR imports.
const publishedPlan = fs.readFileSync(path.join(root,'../inspection/witness-integration-before-alignment-20261028.js'),'utf8');
vm.runInContext(publishedPlan.replace('window.DOCUMENT_WITNESS_INTEGRATION','window.PUBLISHED_WITNESS_PLAN'),context);
const publishedTokens = JSON.parse(vm.runInContext(`(() => {
  const snapshot = JSON.parse(JSON.stringify(window.CORPUS_DATA));
  const lib = mergeDocumentWitnessPlan(window.RESEARCHED_TRANSLATIONS,window.PUBLISHED_WITNESS_PLAN);
  integrateResearchedTranslations(snapshot,lib,tokenizeEditedText);
  return JSON.stringify(snapshot.passages.map(p=>Object.fromEntries(lib.sources.map(s=>[s.id,{text:p.texts[s.id].text,tokens:p.texts[s.id].tokens}]))));
})()`,context));
vm.runInContext(`var library = mergeDocumentWitnessPlan(window.RESEARCHED_TRANSLATIONS, window.DOCUMENT_WITNESS_INTEGRATION);
var corpus = window.CORPUS_DATA;
integrateResearchedTranslations(corpus, library, tokenizeEditedText);`, context);
const after = JSON.parse(JSON.stringify(context.window.CORPUS_DATA));
for (const [i,passage] of publishedTokens.entries()) {
  for (const [sid,witness] of Object.entries(passage)) {
    assert.equal(after.passages[i].texts[sid].text,witness.text,`${sid}: published text changed`);
    assert.deepEqual(after.passages[i].texts[sid].tokens,witness.tokens,`${sid}: published tokens changed`);
  }
}
assert.deepEqual(JSON.parse(JSON.stringify(context.window.RESEARCHED_TRANSLATIONS)), originalLibrary,'Source library mutated');
const merged = JSON.parse(vm.runInContext('JSON.stringify(library)',context));
for (const doc of originalLibrary.documents) {
  const current=merged.documents.find(d=>d.id===doc.id);
  assert.deepEqual(current.components.slice(0,doc.components.length),doc.components,'Original document components replaced');
}
assert.equal(after.sources.find(s=>s.id==='hin_tiwary_1995_alternate').duplicateOf,'hin_tiwari_1995');
assert.equal(after.passages[0].texts.jpn_inazu_1929.coverageStatus,'scan-checked-draft');
assert.equal(after.passages[1].texts.jpn_inazu_1929.coverageStatus,'severely-uncertain-ocr');
assert.throws(()=>vm.runInContext(`mergeDocumentWitnessPlan(window.RESEARCHED_TRANSLATIONS, {
  schemaVersion:'test', documentAdditions:[{documentId:window.RESEARCHED_TRANSLATIONS.documents[0].id,
  components:[{...window.RESEARCHED_TRANSLATIONS.documents[0].components[0], label:'Replacement'}]}]
})`,context),/would replace a source component/);
assert.deepEqual(after.sources.slice(0, before.sources.length), before.sources);
for (const original of before.passages) {
  const current = after.passages.find(p=>p.id===original.id);
  for (const [sid,witness] of Object.entries(original.texts)) assert.deepEqual(current.texts[sid],witness);
  for (const row of original.sentenceUnits) {
    const updated = current.sentenceUnits.find(r=>r.id===row.id);
    for (const [sid, ids] of Object.entries(row.targetTokenIds)) assert.deepEqual(updated.targetTokenIds[sid], ids);
  }
}
for (const [i, old] of JSON.parse(oldTokens).entries()) {
  for (const [sid,witness] of Object.entries(old)) {
    assert.deepEqual(after.passages[i].texts[sid].tokens,witness.tokens,`Existing ${sid} token IDs changed`);
    assert.equal(after.passages[i].texts[sid].text,witness.text);
  }
}
const sourceIds = new Set(); let tokenCount=0;
const phraseKeys=new Set();
for(const cell of merged.phraseMappings || []) {
  const key=`${cell.sourceId}:${cell.passageId}:${cell.unitId}`;
  assert.ok(!phraseKeys.has(key),`Duplicate phrase assignment: ${key}`); phraseKeys.add(key);
  assert.ok(cell.start<cell.end,`Empty phrase: ${key}`);
  assert.ok(after.passages.find(p=>p.id===cell.passageId).sentenceUnits.some(u=>u.id===cell.unitId),`Unknown unit: ${key}`);
}
for (const passage of after.passages) {
  for (const source of after.sources.filter(s=>s.libraryDocumentId)) {
    sourceIds.add(source.id);
    const w=passage.texts[source.id]; assert.ok(w);
    if(w.status==='not-present-in-supplied-source') { assert.equal(w.tokens.length,0); continue; }
    const ids = new Set();
    for(const t of w.tokens) {
      assert.equal(w.text.slice(t.start,t.end),t.text); assert.ok(!ids.has(t.id)); ids.add(t.id); tokenCount++;
    }
    for(const row of passage.sentenceUnits) {
      const selected=row.targetTokenIds?.[source.id] || [];
      assert.ok(selected.every(id=>ids.has(id)),`${row.number} ${source.id}`);
      const common=after.alignments.find(r=>r.id===row.id);
      assert.deepEqual(common.targetTokenIds[source.id],row.targetTokenIds[source.id]);
    }
  }
}
assert.deepEqual(after.passages.filter(p=>p.texts.tha_soraj_2012.status==='not-present-in-supplied-source').map(p=>p.number),[5,6,7,16,20]);
assert.equal(after.passages.filter(p=>p.texts.kor_lee_gilsan_2021.tokens.length).length,22);
assert.ok(after.passages[0].texts.tha_soraj_2012.tokens.length>80);
const once = JSON.stringify(after);
vm.runInContext('integrateResearchedTranslations(corpus, library, tokenizeEditedText)',context);
assert.equal(JSON.stringify(context.window.CORPUS_DATA),once,'Integration must be idempotent');
console.log(`PASS: ${sourceIds.size} integrated document witnesses, ${tokenCount} tokens, ${phraseKeys.size} phrase cells; original corpus, all published import tokens, source offsets, missing Thai passages and phrase references preserved.`);
