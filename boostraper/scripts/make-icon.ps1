$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot ".."
$pngPath = Join-Path $outDir "icon.png"
$icoPath = Join-Path $outDir "icon.ico"

function New-LetterBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

  $pad = [Math]::Max(4, [int]($size * 0.12))
  $rect = New-Object System.Drawing.RectangleF($pad, $pad, ($size - $pad * 2), ($size - $pad * 2))
  $fontSize = [Math]::Max(8, [int]($size * 0.62))
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 139, 92, 246))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString("B", $font, $brush, $rect, $sf)

  $font.Dispose(); $brush.Dispose(); $sf.Dispose(); $g.Dispose()
  return $bmp
}

$png = New-LetterBitmap 256
$png.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$iconSizes = @(16, 32, 48, 64, 128, 256)
$streams = New-Object System.Collections.Generic.List[System.IO.MemoryStream]
$bitmaps = @()
foreach ($s in $iconSizes) {
  $b = New-LetterBitmap $s
  $bitmaps += $b
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $ms.Position = 0
  $streams.Add($ms)
}

# Build ICO manually (PNG entries)
function Write-UInt16([System.IO.BinaryWriter]$w, [uint16]$v) { $w.Write([byte]($v -band 0xFF)); $w.Write([byte](($v -shr 8) -band 0xFF)) }
function Write-UInt32([System.IO.BinaryWriter]$w, [uint32]$v) {
  $w.Write([byte]($v -band 0xFF)); $w.Write([byte](($v -shr 8) -band 0xFF))
  $w.Write([byte](($v -shr 16) -band 0xFF)); $w.Write([byte](($v -shr 24) -band 0xFF))
}

$icoMs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($icoMs)
Write-UInt16 $bw 0
Write-UInt16 $bw 1
Write-UInt16 $bw $iconSizes.Count
$offset = 6 + (16 * $iconSizes.Count)
$idx = 0
foreach ($s in $iconSizes) {
  $data = $streams[$idx].ToArray()
  $dim = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([byte]$dim)
  $bw.Write([byte]$dim)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  Write-UInt16 $bw 1
  Write-UInt16 $bw 32
  Write-UInt32 $bw $data.Length
  Write-UInt32 $bw $offset
  $offset += $data.Length
  $idx++
}
foreach ($st in $streams) { $bw.Write($st.ToArray()) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $icoMs.ToArray())

foreach ($b in $bitmaps) { $b.Dispose() }
$png.Dispose()
foreach ($st in $streams) { $st.Dispose() }
$bw.Dispose(); $icoMs.Dispose()

Write-Host "Created $pngPath"
Write-Host "Created $icoPath"
