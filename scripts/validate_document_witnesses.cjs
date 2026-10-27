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
const oldTokens = vm.runInContext(`(() => {
  const corpus = JSON.parse(JSON.stringify(window.CORPUS_DATA));
  integrateResearchedTranslations(corpus, window.RESEARCHED_TRANSLATIONS, tokenizeEditedText);
  return JSON.stringify(corpus.passages.map(p => Object.fromEntries(
    window.RESEARCHED_TRANSLATIONS.sources.map(s => [s.id,p.texts[s.id]]))));
})()`, context);
vm.runInContext(`var library = mergeDocumentWitnessPlan(window.RESEARCHED_TRANSLATIONS, window.DOCUMENT_WITNESS_INTEGRATION);
var corpus = window.CORPUS_DATA;
integrateResearchedTranslations(corpus, library, tokenizeEditedText);`, context);
const after = JSON.parse(JSON.stringify(context.window.CORPUS_DATA));
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
console.log(`PASS: ${sourceIds.size} integrated document witnesses, ${tokenCount} tokens; original corpus, prior supplement tokens, source offsets, missing Thai passages and phrase references preserved.`);
