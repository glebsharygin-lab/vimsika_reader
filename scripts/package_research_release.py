"""Explicit cumulative 0.36 allow-list over the verified 0.34 public upload."""
from pathlib import Path
import hashlib,json,shutil,zipfile
site=Path(__file__).resolve().parents[1];work=site.parent
worker=Path(r'C:\basic project\collaboration-worker')
names=['index.html','styles.css','manuscripts.js','manuscripts-core.js',
       'manuscripts-research.js','manuscripts-review.js',
       'scripts/validate_manuscripts.cjs','scripts/smoke_manuscripts.cjs',
       'scripts/validate_manuscript_research.cjs','scripts/smoke_manuscript_research.cjs',
       'scripts/smoke_manuscript_review.cjs','scripts/export_manuscript_tei_fixtures.cjs',
       'scripts/validate_manuscript_tei.py','scripts/package_research_release.py',
       'manuscripts/BOOKMARKS.md','manuscripts/DRAFT-IMPORT.md',
       'manuscripts/RESEARCH-TOOLS.md','manuscripts/SHARED-REVIEW.md']
files=[(n,site/n) for n in names]+[('collaboration-worker/'+n,worker/n) for n in
       ['src/index.js','src/shared/manuscripts-core.js','test/manuscript-review.test.mjs']]
target=work/'UPLOAD_0.36.0_RESEARCH';allowed={n for n,_ in files};manifest=[]
if target.exists():
 assert not {p.relative_to(target).as_posix() for p in target.rglob('*') if p.is_file()}-allowed
for name,source in files:
 dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
 assert dest.read_bytes()==source.read_bytes()
 manifest.append(dict(path=name,bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
archive=work/(target.name+'.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for name,_ in files:z.write(target/name,name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and set(z.namelist())==allowed
 for name,source in files:assert z.read(name)==source.read_bytes()
(work/'inspection/upload-0.36.0-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Verified {len(files)} files; ZIP {archive.stat().st_size:,} bytes')
