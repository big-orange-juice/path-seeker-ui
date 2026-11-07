param([ValidateSet('Debug', 'Release', 'All', 'Check')][string]$Variant = 'All')
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$env:JAVA_HOME = Join-Path $projectRoot '.tools/jdk'
$env:ANDROID_HOME = Join-Path $projectRoot '.tools/android-sdk'
$env:ANDROID_USER_HOME = Join-Path $projectRoot '.tools/android-user'
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.tools/gradle-cache'
$gradle = Join-Path $projectRoot '.tools/gradle-8.11.1/bin/gradle.bat'
if (!(Test-Path -LiteralPath $gradle) -or !(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
    throw '请先运行 ./bootstrap.ps1 下载命令行构建工具'
}
& (Join-Path $projectRoot 'signing.ps1')
$tasks = @(switch ($Variant) {
    'Debug' { @(':app:assembleDebug') }
    'Release' { @(':app:assembleRelease') }
    'Check' { @(':app:lintDebug') }
    'All' { @(':app:assembleDebug', ':app:assembleRelease', ':app:lintDebug') }
})
& $gradle -p $projectRoot --no-daemon @tasks
if ($LASTEXITCODE -ne 0) { throw 'Android 构建或检查失败' }
