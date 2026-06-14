# Removes gray JPEG background from logo.png -> logo-transparent.png
$ErrorActionPreference = "Stop"
$assets = Join-Path (Split-Path $PSScriptRoot -Parent) "assets"
$src = Join-Path $assets "logo.png"
$pngOut = Join-Path $assets "logo-transparent.png"

if (-not (Test-Path $src)) {
    Write-Error "Missing $src"
}

Add-Type -AssemblyName System.Drawing

function Test-MagentaPixel([System.Drawing.Color]$c) {
    $r = [int]$c.R
    $g = [int]$c.G
    $b = [int]$c.B
    $max = [Math]::Max($r, [Math]::Max($g, $b))
    $min = [Math]::Min($r, [Math]::Min($g, $b))
    if ($max -eq 0) { return $false }
    $sat = ($max - $min) / $max
    return ($sat -gt 0.22) -and ($r -gt 70) -and ($r -ge $g) -and ($b -ge ($g - 40))
}

function Test-BackgroundPixel([System.Drawing.Color]$c) {
    if (Test-MagentaPixel $c) { return $false }
    $r = [int]$c.R
    $g = [int]$c.G
    $b = [int]$c.B
    $max = [Math]::Max($r, [Math]::Max($g, $b))
    $min = [Math]::Min($r, [Math]::Min($g, $b))
    $sat = if ($max -eq 0) { 0 } else { ($max - $min) / $max }
    return ($sat -lt 0.18) -or ($max -lt 95) -or (($max - $min) -lt 28 -and $r -lt 170)
}

$img = [System.Drawing.Bitmap]::FromFile($src)
$out = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$out.SetResolution($img.HorizontalResolution, $img.VerticalResolution)

for ($y = 0; $y -lt $img.Height; $y++) {
    for ($x = 0; $x -lt $img.Width; $x++) {
        $c = $img.GetPixel($x, $y)
        if (Test-BackgroundPixel $c) {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$out.Save($pngOut, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$out.Dispose()
Write-Host "Created $pngOut"
