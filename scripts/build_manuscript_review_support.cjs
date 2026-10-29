// Prepare the small authoritative passage index and identical Worker validators.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'corpus.js'),'utf8'),context);
const ids=context.window.CORPUS_DATA.passages.map(p=>p.id);
if(!ids.length||new Set(ids).size!==ids.length)throw new Error('Invalid corpus passage index.');
fs.writeFileSync(path.join(root,'manuscripts/corpus-anchors.json'),JSON.stringify({schemaVersion:'1.0.0',passageIds:ids},null,2)+'\n');
const option=process.argv.indexOf('--worker');
if(option!==-1){
 const target=path.resolve(process.argv[option+1],'src/shared');fs.mkdirSync(target,{recursive:true});
 for(const file of ['manuscripts-core.js','manuscripts-review-core.js'])fs.copyFileSync(path.join(root,file),path.join(target,file));
}
console.log(`Prepared ${ids.length} passage IDs; no corpus text or token IDs changed.`);
