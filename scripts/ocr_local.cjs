// Local OCR only. Models and raw results stay outside the publishable site.
const fs=require('node:fs'), path=require('node:path');
const {createWorker}=require('tesseract.js');
(async()=>{
  const [lang,input,output,psm='6']=process.argv.slice(2);
  if(!lang||!input||!output)throw Error('Usage: ocr_local.cjs LANGUAGE INPUT_FILE_OR_DIR OUTPUT_DIR [PSM]');
  const inspection=path.resolve(__dirname,'../../inspection');
  const worker=await createWorker(lang,1,{langPath:path.join(inspection,'tessdata'),gzip:false,cacheMethod:'none'});
  try {
    await worker.setParameters({tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'});
    fs.mkdirSync(output,{recursive:true});
    const files=fs.statSync(input).isDirectory()?fs.readdirSync(input).filter(x=>x.endsWith('.png')).sort().map(x=>path.join(input,x)):[input];
    for(const file of files){
      const target=path.join(output,path.basename(file,'.png')+'.json');
      if(fs.existsSync(target)){console.log('Existing',path.basename(file));continue;}
      const {data}=await worker.recognize(file,{}, {text:true,blocks:true,tsv:true});
      fs.writeFileSync(target,JSON.stringify({image:path.basename(file),language:lang,engine:'Tesseract.js 7 / tessdata_best',psm,reviewStatus:'unproofed-ocr',...data},null,2));
      fs.writeFileSync(target.replace(/\.json$/,'.txt'),data.text);
      console.log(path.basename(file),data.confidence,data.text.length);
    }
  } finally {await worker.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
