const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),worker=process.env.VIMSIKA_WORKER_ROOT||path.join(root,'collaboration-worker');
(async()=>{
 const {manuscriptRequest}=await import(pathToFileURL(path.join(worker,'src/manuscript-review.js')));
 const base=JSON.parse(fs.readFileSync(path.join(root,'manuscripts/bnf-pt797.json'))),index=JSON.parse(fs.readFileSync(path.join(root,'manuscripts/corpus-anchors.json')));
 let editorial=JSON.parse(fs.readFileSync(path.join(root,'editorial-overrides.json'))),head='head-1',enabled=false,role='contributor',commits=0;
 const store=new Map(),requests=[],errors=[];
 const env={MANUSCRIPT_REVIEW_ENABLED:'true',AUTH:{get:async(k,type)=>{const value=store.get(k);return type==='json'&&value?JSON.parse(value):value||null;},put:async(k,value)=>{store.set(k,value);},list:async()=>({keys:[...store.keys()].map(name=>({name})),list_complete:true})}};
 const sessions={contributor:{user:{id:11,login:'contributor',name:'Contributor'},role:'contributor'},editor:{user:{id:22,login:'editor',name:'Editor'},role:'editor'}};
 const deps={snapshot:async()=>({head,base,editorial,corpus:{passages:index.passageIds.map(id=>({id,texts:{}}))}}),commit:async(snapshot,next,user)=>{assert.equal(snapshot.head,head);assert.equal(user.id,22);editorial=next;commits++;head='head-'+(commits+1);return {url:'https://mock.invalid/commit'};}};
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());requests.push(request.method()+' '+url.pathname);
   if(url.hostname==='review-test.invalid'){
    if(url.pathname==='/api/capabilities')return route.fulfill({json:enabled?{manuscriptReview:'1.0.0'}:{service:'old service'}});
    try{
     const result=await manuscriptRequest(new Request(request.url(),{method:request.method(),headers:request.headers(),...(request.postData()?{body:request.postData()}: {})}),sessions[role],env,deps);
     return route.fulfill({status:result.status,contentType:'application/json',body:await result.text()});
    }catch(error){return route.fulfill({status:error.status||500,json:{error:error.message}});}
   }
   if(url.hostname!=='vimsika-test.invalid')return route.abort();
   const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Missing'});
   if(url.pathname==='/auth-config.js')return route.fulfill({contentType:'application/javascript',body:'window.VIMSIKA_AUTH_CONFIG={};'});
   if(url.pathname==='/editorial-overrides.json')return route.fulfill({json:editorial});
   return route.fulfill({contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://vimsika-test.invalid/');await page.waitForSelector('.passage-card');
  const corpus=await page.evaluate(()=>JSON.stringify(state.corpus));
  await page.evaluate(()=>{localStorage.setItem('vimsika-editor-annotations-v1','{"sentinel":"Reader draft"}');state.auth={configured:true,role:'contributor',user:{id:11,login:'contributor'},token:'mock'};window.VIMSIKA_AUTH_CONFIG={apiBaseUrl:'https://review-test.invalid'};});
  await page.locator('[data-view="manuscripts"]').click();await page.waitForSelector('#ms-edit');
  assert.ok(!requests.some(r=>r.includes('/api/')));
  await page.locator('#ms-edit').click();await page.locator('#ms-draft-form [name="text"]').fill('MOCK manuscript review — not source evidence.');
  await page.locator('#ms-draft-form button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#ms-status')?.textContent.includes('Private draft saved'));
  const saved=await page.evaluate(()=>localStorage.getItem('vimsika-manuscript-draft-v1:bnf-pt797'));
  await page.locator('#ms-shared-details > summary').click();await page.locator('#ms-shared-open').click();await page.locator('#ms-review-check').click();
  await page.waitForFunction(()=>document.querySelector('#ms-shared-content')?.textContent.includes('not enabled'));assert.equal(await page.locator('#ms-submit-review').count(),0);assert.equal(store.size,0);
  enabled=true;await page.locator('#ms-review-check').click();await page.waitForSelector('#ms-submit-review');
  await page.locator('#ms-submit-review [name="note"]').fill('QA proposal <literal> with separate authenticated author.');
  await page.locator('#ms-submit-review button').click();await page.waitForSelector('#ms-proposal-detail');
  assert.equal(store.size,1);assert.equal(commits,0);assert.equal(await page.evaluate(()=>localStorage.getItem('vimsika-manuscript-draft-v1:bnf-pt797')),saved);assert.equal(await page.locator('#ms-review-decision').count(),0);
  const id=JSON.parse([...store.values()][0]).id;
  const pair=await page.locator('#ms-proposal-detail .ms-conflict-pair').innerText();assert.ok(pair.includes('MOCK manuscript review'));assert.ok(pair.includes(base.lines[0].layers.transliteration.text));
  await page.locator('[data-ms-review-scan="0"]').click();await page.waitForSelector('.ms-review-region.proposed');
  assert.equal(await page.locator('.ms-review-region.current').count(),1);assert.equal(await page.evaluate(()=>localStorage.getItem('vimsika-manuscript-draft-v1:bnf-pt797')),saved);
  role='editor';await page.evaluate(()=>{state.auth.user={id:22,login:'editor'};state.auth.role='editor';renderReader();});await page.waitForSelector('#ms-shared-details');
  await page.locator('#ms-shared-details > summary').click();await page.locator('#ms-review-check').click();await page.locator(`[data-ms-proposal="${id}"]`).click();await page.waitForSelector('#ms-review-decision');
  await page.locator('#ms-review-decision [name="decision"]').selectOption('accepted');await page.locator('#ms-review-decision [name="note"]').fill('QA reviewer compared the complete proposal.');
  // A change anywhere in the repository invalidates the review snapshot.
  head='head-intervening';await page.locator('#ms-review-decision button').click();
  await page.waitForFunction(()=>document.querySelector('#ms-shared-content')?.textContent.includes('repository changed'));assert.equal(commits,0);assert.equal(await page.locator('#ms-review-decision [name="note"]').inputValue(),'QA reviewer compared the complete proposal.');
  await page.locator(`[data-ms-proposal="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#ms-review-decision button')?.disabled);
  await page.screenshot({path:path.join(root,'../inspection/qa-manuscript-review-desktop.png'),fullPage:true});
  await page.locator('#ms-review-decision button').click();await page.waitForFunction(()=>document.querySelector('#ms-conflict-form'));
  assert.equal(commits,1);assert.equal(await page.evaluate(()=>localStorage.getItem('vimsika-manuscript-draft-v1:bnf-pt797')),saved);
  assert.ok((await page.locator('#ms-lines').innerText()).includes('MOCK manuscript review'));assert.ok((await page.locator('#ms-lines').innerText()).includes('published'));
  assert.equal(await page.evaluate(()=>JSON.stringify(state.corpus)),corpus);assert.equal(await page.evaluate(()=>localStorage.getItem('vimsika-editor-annotations-v1')),'{"sentinel":"Reader draft"}');
  await page.reload();await page.waitForSelector('#ms-conflict-form');assert.equal(await page.evaluate(()=>localStorage.getItem('vimsika-manuscript-draft-v1:bnf-pt797')),saved);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-ms-pane="research"]').click();await page.locator('#ms-shared-details > summary').click();await page.locator('#ms-shared-open').click();
  await page.screenshot({path:path.join(root,'../inspection/qa-manuscript-review-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  console.log('PASS: old-service gating, explicit submission, authenticated review, stale-head rejection, published overrides, unchanged private/Reader drafts, reload and mobile. All network calls mocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
