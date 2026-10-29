const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('\n','')),c=>c.charCodeAt(0)));

export function manuscriptRepository(env,github,token) {
  const repo=`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const branch=env.GITHUB_DEFAULT_BRANCH||'main';
  async function file(path,head,optional=false) {
    try {
      const result=await github(`${repo}/contents/${path}?ref=${encodeURIComponent(head)}`,{token});
      if(result.type!=='file')fail(409,'A manuscript source file could not be read.');
      if(result.size>8000000)fail(409,'The manuscript review history exceeds the current service limit. Archive and migrate it before adding decisions.');
      if(result.encoding==='none')return github(`${repo}/contents/${path}?ref=${encodeURIComponent(head)}`,{token,raw:true});
      if(result.encoding!=='base64')fail(409,'A manuscript source file could not be read.');
      return JSON.parse(decode(result.content));
    }catch(error){if(optional&&error.status===404)return {};throw error;}
  }
  return {
    async snapshot(id) {
      if(!/^[a-z][a-z0-9-]{0,79}$/.test(id||''))fail(400,'Invalid manuscript ID.');
      const ref=await github(`${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{token});
      const head=ref.object.sha;
      const registry=await file('manuscripts/registry.json',head);
      const item=registry.manuscripts?.find(m=>m.id===id);
      if(!item||item.package!==`manuscripts/${id}.js`)fail(404,'The manuscript is not in the published registry.');
      const [base,editorial,index]=await Promise.all([
        file(`manuscripts/${id}.json`,head),file(env.GITHUB_EDITORIAL_PATH,head,true),file('manuscripts/corpus-anchors.json',head)
      ]);
      if(index.schemaVersion!=='1.0.0'||!Array.isArray(index.passageIds)||!index.passageIds.length||new Set(index.passageIds).size!==index.passageIds.length)fail(409,'The manuscript passage index needs an update.');
      return {head,base,editorial,corpus:{passages:index.passageIds.map(id=>({id,texts:{}}))}};
    },
    async commit(snapshot,editorial,user,message) {
      const content=JSON.stringify(editorial,null,2)+'\n';
      if(new TextEncoder().encode(content).length>8000000)fail(413,'The review history needs an explicit archive/migration before another decision can be recorded.');
      // Contents-SHA alone cannot detect a simultaneous manuscript-package
      // update. Parent the commit to the complete reviewed repository snapshot.
      const parent=await github(`${repo}/git/commits/${snapshot.head}`,{token});
      const tree=await github(`${repo}/git/trees`,{method:'POST',token,body:{base_tree:parent.tree.sha,tree:[{path:env.GITHUB_EDITORIAL_PATH,mode:'100644',type:'blob',content}]}});
      const author={name:user.name||user.login,email:`${user.id}+${user.login}@users.noreply.github.com`};
      const commit=await github(`${repo}/git/commits`,{method:'POST',token,body:{message,tree:tree.sha,parents:[snapshot.head],author,committer:author}});
      try {
        await github(`${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{method:'PATCH',token,body:{sha:commit.sha,force:false}});
      }catch(error) {
        if([409,422].includes(error.status))fail(409,'The repository changed during review. No decision was published. Refresh and compare the current version.');
        throw error;
      }
      return {url:commit.html_url||`https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`};
    }
  };
}
