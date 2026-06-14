Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot "..\assets\logo-m.png"
$dst = Join-Path $PSScriptRoot "..\assets\logo-m-transparent.png"
if (-not (Test-Path $src)) { Write-Error "logo-m.png not found"; exit 1 }

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$out = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, $fmt)

for ($y = 0; $y -lt $bmp.Height; $y++) {
  for ($x = 0; $x -lt $bmp.Width; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $lum = ($c.R + $c.G + $c.B) / 3
    $grayish = [Math]::Abs($c.R - $c.G) -lt 14 -and [Math]::Abs($c.G - $c.B) -lt 14
    $checker = $grayish -and $lum -gt 175
    $white = $lum -gt 242 -and $c.A -gt 180
    if ($checker -or $white) {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } else {
      $out.SetPixel($x, $y, $c)
    }
  }
}

$out.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$out.Dispose()
Write-Host "Saved $dst"
