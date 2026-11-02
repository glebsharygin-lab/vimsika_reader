"""Package the cumulative 0.36.4 update without modifying older release bundles."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

site = Path(__file__).resolve().parents[1]
work = site.parent
worker = Path(r'C:\basic project\collaboration-worker')
names = [
    'index.html', 'styles.css', 'manuscripts.js', 'manuscripts-core.js',
    'manuscripts-research.js', 'manuscripts-review.js', 'witness-integration.js',
    'manuscripts/BOOKMARKS.md', 'manuscripts/DRAFT-IMPORT.md',
    'manuscripts/RESEARCH-TOOLS.md', 'manuscripts/SHARED-REVIEW.md',
    'source-witnesses/document-witness-plan.json',
    'source-witnesses/phrase-selections.json',
    'source-witnesses/ALIGNMENT-20261101.md',
    'source-witnesses/ALIGNMENT-20261101-EVENING.md',
    'source-witnesses/ALIGNMENT-20261102.md',
    'source-witnesses/ALIGNMENT-20261102-MORNING.md',
    'scripts/validate_manuscripts.cjs', 'scripts/smoke_manuscripts.cjs',
    'scripts/validate_manuscript_research.cjs',
    'scripts/smoke_manuscript_research.cjs', 'scripts/smoke_manuscript_review.cjs',
    'scripts/export_manuscript_tei_fixtures.cjs', 'scripts/validate_manuscript_tei.py',
    'scripts/package_research_release.py', 'scripts/build_document_witnesses.py',
    'scripts/validate_document_witnesses.cjs', 'scripts/smoke_document_witnesses.cjs',
    'scripts/package_alignment_release.py',
]
files = [(name, site / name) for name in names] + [
    ('collaboration-worker/' + name, worker / name) for name in [
        'src/index.js', 'src/shared/manuscripts-core.js',
        'test/manuscript-review.test.mjs',
    ]
]
target = work / 'UPLOAD_0.36.4_ALIGNMENT'
allowed = {name for name, _ in files}
assert len(allowed) == len(files) == 32
if target.exists():
    actual = {p.relative_to(target).as_posix() for p in target.rglob('*') if p.is_file()}
    assert not actual - allowed, 'Unexpected files in upload folder; inspect before packaging.'
manifest = []
for name, source in files:
    dest = target / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)
    assert dest.read_bytes() == source.read_bytes()
    manifest.append({
        'path': name, 'bytes': dest.stat().st_size,
        'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
    })
archive = work / (target.name + '.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for name, _ in files:
        bundle.write(target / name, name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert set(bundle.namelist()) == allowed
    for name, source in files:
        assert bundle.read(name) == source.read_bytes()
(work / 'inspection/upload-0.36.4-manifest.json').write_text(
    json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Verified {len(files)} files; ZIP {archive.stat().st_size:,} bytes')
