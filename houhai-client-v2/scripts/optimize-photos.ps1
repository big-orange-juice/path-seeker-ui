$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$photoDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/ride-photos'))
$jpegEncoder = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
foreach ($photo in Get-ChildItem -LiteralPath $photoDirectory -Filter '*.jpg') {
    if ($photo.DirectoryName -ne $photoDirectory) { throw 'Unexpected photo directory' }
    $sourceImage = [Drawing.Image]::FromFile($photo.FullName)
    $scale = [Math]::Min([double]1, [double](1440 / [Math]::Max($sourceImage.Width, $sourceImage.Height)))
    $resizedImage = [Drawing.Bitmap]::new([int]($sourceImage.Width * $scale), [int]($sourceImage.Height * $scale))
    $graphics = [Drawing.Graphics]::FromImage($resizedImage)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($sourceImage, 0, 0, $resizedImage.Width, $resizedImage.Height)
    $encoderOptions = [Drawing.Imaging.EncoderParameters]::new(1)
    $encoderOptions.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]82)
    $buffer = [IO.MemoryStream]::new()
    try {
        $resizedImage.Save($buffer, $jpegEncoder, $encoderOptions)
        $sourceImage.Dispose()
        [IO.File]::WriteAllBytes($photo.FullName, $buffer.ToArray())
    } finally {
        $sourceImage.Dispose()
        $graphics.Dispose()
        $resizedImage.Dispose()
        $encoderOptions.Dispose()
        $buffer.Dispose()
    }
}
Get-ChildItem -LiteralPath $photoDirectory | Select-Object Name, Length
