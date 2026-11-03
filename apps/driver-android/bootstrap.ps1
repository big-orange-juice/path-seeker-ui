param([switch]$Build)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

function Download-Checked($Url, $Destination, $Algorithm, $Expected) {
    if (!(Test-Path -LiteralPath $Destination) -or (Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -ne $Expected) {
        Invoke-WebRequest -Uri $Url -OutFile $Destination -TimeoutSec 900
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash -ne $Expected) { throw "下载校验失败：$Destination" }
}

function Response-Text($Response) {
    if ($Response.Content -is [byte[]]) { return [System.Text.Encoding]::UTF8.GetString($Response.Content) }
    return [string]$Response.Content
}

$jdkRoot = Join-Path $toolsRoot 'jdk'
if (!(Test-Path -LiteralPath $jdkRoot)) {
    $asset = @(Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows')[0]
    $archive = Join-Path $toolsRoot 'jdk.zip'
    Download-Checked $asset.binary.package.link $archive 'SHA256' $asset.binary.package.checksum
    $expanded = Join-Path $toolsRoot 'jdk-expanded'
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
    $folder = @(Get-ChildItem -LiteralPath $expanded -Directory)[0]
    Move-Item -LiteralPath $folder.FullName -Destination $jdkRoot
}
$env:JAVA_HOME = $jdkRoot
$env:Path = "$jdkRoot/bin;$env:Path"
$env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-cache'
$env:ANDROID_USER_HOME = Join-Path $toolsRoot 'android-user'

$gradleRoot = Join-Path $toolsRoot 'gradle-8.11.1'
if (!(Test-Path -LiteralPath $gradleRoot)) {
    $checksum = (Response-Text (Invoke-WebRequest 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip.sha256')).Trim()
    $archive = Join-Path $toolsRoot 'gradle.zip'
    Download-Checked 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip' $archive 'SHA256' $checksum
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
}

$env:ANDROID_HOME = Join-Path $toolsRoot 'android-sdk'
$manager = Join-Path $env:ANDROID_HOME 'cmdline-tools/latest/bin/sdkmanager.bat'
if (!(Test-Path -LiteralPath $manager)) {
    [xml]$repository = Response-Text (Invoke-WebRequest 'https://dl.google.com/android/repository/repository2-1.xml')
    $package = $repository.SelectSingleNode("//*[local-name()='remotePackage' and @path='cmdline-tools;latest']")
    $archiveInfo = $package.SelectSingleNode("*[local-name()='archives']/*[local-name()='archive'][*[local-name()='host-os']='windows']/*[local-name()='complete']")
    if (!$archiveInfo) { throw '未找到 Android 官方 Windows 命令行 SDK' }
    $archive = Join-Path $toolsRoot 'android-tools.zip'
    Download-Checked ('https://dl.google.com/android/repository/' + $archiveInfo.url) $archive 'SHA1' $archiveInfo.SelectSingleNode('checksum').InnerText
    $expanded = Join-Path $toolsRoot 'android-expanded'
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
    New-Item -ItemType Directory -Path (Join-Path $env:ANDROID_HOME 'cmdline-tools') -Force | Out-Null
    Move-Item -LiteralPath (Join-Path $expanded 'cmdline-tools') -Destination (Join-Path $env:ANDROID_HOME 'cmdline-tools/latest')
}
$androidCli = Join-Path $env:ANDROID_HOME 'cmdline-tools/latest/bin/android.exe'
if (Test-Path -LiteralPath $androidCli) {
    foreach ($package in @('platform-tools', 'platforms/android-35', 'build-tools/35.0.0')) {
        & $androidCli --no-metrics "--sdk=$env:ANDROID_HOME" sdk install $package
        if ($LASTEXITCODE -ne 0) { throw "Android SDK 安装失败：$package" }
    }
} else {
    1..100 | ForEach-Object { 'y' } | & $manager "--sdk_root=$env:ANDROID_HOME" --licenses
    if ($LASTEXITCODE -ne 0) { throw 'Android SDK 许可确认失败' }
    & $manager "--sdk_root=$env:ANDROID_HOME" 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
    if ($LASTEXITCODE -ne 0) { throw 'Android SDK 安装失败' }
}
Write-Output "构建工具已就绪：$toolsRoot"
if (!(Test-Path -LiteralPath (Join-Path $env:ANDROID_HOME 'platforms/android-35/android.jar')) -or !(Test-Path -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/aapt.exe'))) {
    throw 'Android Platform 35 或 Build Tools 35.0.0 尚未完整安装'
}
if ($Build) {
    & (Join-Path $projectRoot 'signing.ps1')
    & (Join-Path $gradleRoot 'bin/gradle.bat') -p $projectRoot --no-daemon :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'APK 编译失败' }
    Write-Output (Join-Path $projectRoot 'app/build/outputs/apk/debug/app-debug.apk')
}
