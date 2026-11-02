"""Package the seven-file 0.36.5 delta over the verified GitHub 0.36.4 upload."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

site = Path(__file__).resolve().parents[1]
work = site.parent
names = [
    'index.html', 'witness-integration.js',
    'source-witnesses/document-witness-plan.json',
    'source-witnesses/phrase-selections.json',
    'source-witnesses/ALIGNMENT-20261102-AFTERNOON.md',
    'scripts/smoke_document_witnesses.cjs',
    'scripts/package_alignment_release.py',
]
files = [(name, site / name) for name in names]
target = work / 'UPLOAD_0.36.5_ALIGNMENT'
allowed = {name for name, _ in files}
assert len(allowed) == len(files) == 7
archive = work / (target.name + '.zip')
manifest_path = work / 'inspection/upload-0.36.5-manifest.json'
assert not target.exists() and not archive.exists() and not manifest_path.exists(), \
    'Release already exists; inspect it instead of overwriting a prepared bundle.'
# The baseline was checked byte-for-byte against upstream commit
# 4acfaebc826d7143db7ad7bbcf16ada7cbb1bafa. Every omitted file must stay unchanged.
baseline = json.loads((work / 'inspection/upload-0.36.4-manifest.json').read_text('utf8'))
for entry in baseline:
    if entry['path'] in allowed:
        continue
    source = (Path(r'C:\basic project') / entry['path']) if entry['path'].startswith('collaboration-worker/') else site / entry['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256'], entry['path']
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
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for name, _ in files:
        bundle.write(target / name, name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert set(bundle.namelist()) == allowed
    for name, source in files:
        assert bundle.read(name) == source.read_bytes()
manifest_path.write_text(
    json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Verified {len(files)} files; ZIP {archive.stat().st_size:,} bytes')
