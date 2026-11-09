$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $PSScriptRoot '.tools/test-classes'
$compiler = Join-Path $PSScriptRoot '.tools/jdk/bin/javac.exe'
$runtime = Join-Path $PSScriptRoot '.tools/jdk/bin/java.exe'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
& $compiler -encoding UTF-8 -d $testRoot (Join-Path $PSScriptRoot 'app/src/main/java/com/pathseeker/driver/DriverLanguages.java') (Join-Path $PSScriptRoot 'tests/DriverLanguagesTest.java')
if ($LASTEXITCODE -ne 0) { throw '语言配置测试编译失败' }
& $runtime -ea -cp $testRoot com.pathseeker.driver.DriverLanguagesTest
if ($LASTEXITCODE -ne 0) { throw '语言配置测试失败' }
& $compiler -encoding UTF-8 -d $testRoot (Join-Path $PSScriptRoot 'app/src/main/java/com/pathseeker/driver/QuestionAudioPreparation.java') (Join-Path $PSScriptRoot 'tests/QuestionAudioPreparationTest.java')
if ($LASTEXITCODE -ne 0) { throw '音频准备测试编译失败' }
& $runtime -ea -cp $testRoot com.pathseeker.driver.QuestionAudioPreparationTest
if ($LASTEXITCODE -ne 0) { throw '音频准备测试失败' }

$zxingRoot = Join-Path $PSScriptRoot '.tools/gradle-cache/caches/modules-2/files-2.1/com.google.zxing/core/3.5.3'
$zxing = Get-ChildItem -LiteralPath $zxingRoot -Filter 'core-3.5.3.jar' -Recurse | Select-Object -First 1
if (!$zxing) { throw '请先构建 Android APP，下载二维码编码依赖' }
$testClasspath = $testRoot + [IO.Path]::PathSeparator + $zxing.FullName
& $compiler -encoding UTF-8 -cp $zxing.FullName -d $testRoot (Join-Path $PSScriptRoot 'app/src/main/java/com/pathseeker/driver/RoomInvitation.java') (Join-Path $PSScriptRoot 'tests/RoomInvitationTest.java')
if ($LASTEXITCODE -ne 0) { throw '二维码测试编译失败' }
& $runtime -ea -cp $testClasspath com.pathseeker.driver.RoomInvitationTest
if ($LASTEXITCODE -ne 0) { throw '二维码测试失败' }
