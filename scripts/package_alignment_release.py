"""Package the nine-file 0.36.8 delta over the verified GitHub 0.36.5 upload."""
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
    'source-witnesses/ALIGNMENT-20261102-HINDI.md',
    'source-witnesses/ALIGNMENT-20261102-HINDI-EVENING.md',
    'source-witnesses/ALIGNMENT-20261102-HINDI-LATE.md',
    'scripts/smoke_document_witnesses.cjs',
    'scripts/package_alignment_release.py',
]
files = [(name, site / name) for name in names]
target = work / 'UPLOAD_0.36.8_ALIGNMENT'
allowed = {name for name, _ in files}
assert len(allowed) == len(files) == 9
archive = work / (target.name + '.zip')
manifest_path = work / 'inspection/upload-0.36.8-manifest.json'
assert not target.exists() and not archive.exists() and not manifest_path.exists(), \
    'Release already exists; inspect it instead of overwriting a prepared bundle.'
# Upstream 6977c76c3fe2ef61c67f2839fd39eed659637819 contains the verified
# 0.36.5 delta over 0.36.4. Check the union, with the later manifest taking precedence.
baseline = {}
for version in ['0.36.4', '0.36.5']:
    for entry in json.loads((work / f'inspection/upload-{version}-manifest.json').read_text('utf8')):
        baseline[entry['path']] = entry
for entry in baseline.values():
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
