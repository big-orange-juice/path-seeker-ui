$ErrorActionPreference = 'Stop'
$signingRoot = Join-Path $PSScriptRoot '.signing'
$keytool = Join-Path $PSScriptRoot '.tools/jdk/bin/keytool.exe'
if (!(Test-Path -LiteralPath $keytool)) { throw '请先运行 bootstrap.ps1 准备 JDK' }
New-Item -ItemType Directory -Path $signingRoot -Force | Out-Null
$debugKey = Join-Path $signingRoot 'driver-debug.jks'
if (!(Test-Path -LiteralPath $debugKey)) {
    & $keytool -genkeypair -keystore $debugKey -storetype JKS -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'
    if ($LASTEXITCODE -ne 0) { throw '调试证书生成失败' }
}
$releaseKey = Join-Path $signingRoot 'driver-release.jks'
$configuration = Join-Path $signingRoot 'keystore.properties'
if (!(Test-Path -LiteralPath $releaseKey)) {
    if (Test-Path -LiteralPath $configuration) { throw '已存在密码文件但缺少发布证书，请恢复备份后再构建' }
    $env:DRIVER_SIGNING_PASSWORD = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    & $keytool -genkeypair -keystore $releaseKey -storetype JKS -alias driver-release -storepass:env DRIVER_SIGNING_PASSWORD -keypass:env DRIVER_SIGNING_PASSWORD -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=PathSeeker Driver'
    if ($LASTEXITCODE -ne 0) { throw '发布证书生成失败' }
    [System.IO.File]::WriteAllText($configuration, "storePassword=$env:DRIVER_SIGNING_PASSWORD`n")
}
if (!(Test-Path -LiteralPath $configuration)) { throw '发布证书密码文件缺失，请恢复 .signing 备份' }
$properties = Get-Content -LiteralPath $configuration -Raw | ConvertFrom-StringData
$env:DRIVER_SIGNING_PASSWORD = $properties.storePassword
Write-Output 'PackageName: com.pathseeker.driver'
Write-Output '调试版 SHA1:'
& $keytool -list -v -keystore $debugKey -storepass android -alias androiddebugkey | Select-String 'SHA1:'
Write-Output '发布版 SHA1:'
& $keytool -list -v -keystore $releaseKey -storepass:env DRIVER_SIGNING_PASSWORD -alias driver-release | Select-String 'SHA1:'
Remove-Item Env:DRIVER_SIGNING_PASSWORD
