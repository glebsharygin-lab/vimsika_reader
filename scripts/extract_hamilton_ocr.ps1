param(
  [string]$PdfPath = "C:\Users\glebs\Downloads\oxford res ac\misc133034.pdf",
  [string]$OutputDir = "source-witnesses\eng_hamilton_1938",
  [string]$ChineseOutputDir = "source-witnesses\zho_hamilton_xuanzang_1938",
  [string]$Python = "C:\Users\glebs\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$imageDir = Join-Path $root "tmp\pdfs\hamilton_translation_images"
$englishDir = Join-Path $root $OutputDir
$chineseDir = Join-Path $root $ChineseOutputDir
New-Item -ItemType Directory -Force -Path $imageDir, $englishDir, $chineseDir | Out-Null

@"
from pathlib import Path
from pypdf import PdfReader

pdf = Path(r"$PdfPath")
out = Path(r"$imageDir")
out.mkdir(parents=True, exist_ok=True)
reader = PdfReader(str(pdf))
for index, page in enumerate(reader.pages, start=1):
    images = list(page.images)
    if not images:
        continue
    image = images[0]
    suffix = Path(image.name).suffix or ".jpg"
    target = out / f"page_{index:02d}_{Path(image.name).stem}{suffix}"
    target.write_bytes(image.data)
"@ | & $Python -

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$script:asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1"
})[0]

function Await-WinRt($operation, [Type]$resultType) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($operation))
  $task.Wait() | Out-Null
  $task.Result
}

function Invoke-ImageOcr($path, $languageTag) {
  $storageFile = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
  $fileAccessMode = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
  $randomAccessStream = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
  $bitmapDecoder = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
  $softwareBitmap = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
  $ocrEngine = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
  $ocrResult = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
  $language = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]

  $engine = $ocrEngine::TryCreateFromLanguage([Activator]::CreateInstance($language, $languageTag))
  if ($null -eq $engine) {
    throw "No Windows OCR engine is available for $languageTag."
  }

  $file = Await-WinRt ($storageFile::GetFileFromPathAsync((Resolve-Path $path).Path)) $storageFile
  $stream = Await-WinRt ($file.OpenAsync($fileAccessMode::Read)) $randomAccessStream
  $decoder = Await-WinRt ($bitmapDecoder::CreateAsync($stream)) $bitmapDecoder
  $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) $softwareBitmap
  $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) $ocrResult
  $result.Text
}

$englishChunks = [System.Collections.Generic.List[string]]::new()
$chineseChunks = [System.Collections.Generic.List[string]]::new()
$manifest = [System.Collections.Generic.List[object]]::new()

Get-ChildItem $imageDir -Filter "page_*.jpg" | Sort-Object Name | ForEach-Object {
  if ($_.Name -notmatch "^page_(\d+)") {
    return
  }
  $page = [int]$Matches[1]
  if ($page -ge 64) {
    $text = Invoke-ImageOcr $_.FullName "en-US"
    $kind = "bibliography"
    $language = "en-US"
  } elseif ($page % 2 -eq 1) {
    $text = Invoke-ImageOcr $_.FullName "en-US"
    $englishChunks.Add("===== PAGE $page =====`n$text")
    $kind = "english-translation-notes"
    $language = "en-US"
  } else {
    $text = Invoke-ImageOcr $_.FullName "zh-Hant-TW"
    $chineseChunks.Add("===== PAGE $page =====`n$text")
    $kind = "chinese-text"
    $language = "zh-Hant-TW"
  }
  $manifest.Add([pscustomobject]@{
    page = $page
    image = $_.Name
    kind = $kind
    ocrLanguage = $language
    chars = $text.Length
  })
}

[IO.File]::WriteAllText((Join-Path $englishDir "translation_ocr.txt"), ($englishChunks -join "`n`n") + "`n", [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $chineseDir "chinese_ocr.txt"), ($chineseChunks -join "`n`n") + "`n", [Text.UTF8Encoding]::new($false))
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $englishDir "scan-manifest.json")
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $chineseDir "scan-manifest.json")

Write-Output "English OCR pages: $($englishChunks.Count)"
Write-Output "Chinese OCR pages: $($chineseChunks.Count)"
Write-Output "Run scripts\segment_witnesses_batch3.py next to refresh passages.json."
