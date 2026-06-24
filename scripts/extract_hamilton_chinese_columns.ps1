param(
  [string]$ImageDir = "tmp\pdfs\hamilton_translation_images",
  [string]$OutputDir = "source-witnesses\zho_hamilton_xuanzang_1938"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$imageRoot = Join-Path $root $ImageDir
$targetRoot = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$script:asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRt($operation, [Type]$resultType) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($operation))
  $task.Wait() | Out-Null
  $task.Result
}

function Invoke-ImageOcrLines($path, $languageTag) {
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

  $rows = [System.Collections.Generic.List[object]]::new()
  foreach ($line in $result.Lines) {
    $words = @()
    foreach ($word in $line.Words) {
      $rect = $word.BoundingRect
      $words += [pscustomobject]@{
        text = $word.Text
        x = $rect.X
        y = $rect.Y
        width = $rect.Width
        height = $rect.Height
      }
    }
    if ($words.Count -eq 0) {
      continue
    }
    $xs = @($words | ForEach-Object { $_.x })
    $ys = @($words | ForEach-Object { $_.y })
    $x2s = @($words | ForEach-Object { $_.x + $_.width })
    $y2s = @($words | ForEach-Object { $_.y + $_.height })
    $x = ($xs | Measure-Object -Minimum).Minimum
    $y = ($ys | Measure-Object -Minimum).Minimum
    $x2 = ($x2s | Measure-Object -Maximum).Maximum
    $y2 = ($y2s | Measure-Object -Maximum).Maximum
    $rows.Add([pscustomobject]@{
      text = $line.Text
      x = $x
      y = $y
      x2 = $x2
      y2 = $y2
      width = $x2 - $x
      height = $y2 - $y
      words = $words
    })
  }
  $rows
}

$pageRows = [System.Collections.Generic.List[object]]::new()
Get-ChildItem $imageRoot -Filter "page_*.jpg" | Sort-Object Name | ForEach-Object {
  if ($_.Name -notmatch "^page_(\d+)") {
    return
  }
  $page = [int]$Matches[1]
  if ($page -ge 64 -or ($page % 2 -eq 1)) {
    return
  }
  $lines = Invoke-ImageOcrLines $_.FullName "zh-Hant-TW"
  $pageRows.Add([pscustomobject]@{
    page = $page
    image = $_.Name
    lines = $lines
  })
  Write-Output "OCR Chinese page ${page}: $($lines.Count) lines"
}

$pageRows | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $targetRoot "chinese_ocr_lines.json")
Write-Output "Wrote $(Join-Path $targetRoot 'chinese_ocr_lines.json')"
