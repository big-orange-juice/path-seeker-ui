$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $PSScriptRoot '.tools/test-classes'
$compiler = Join-Path $PSScriptRoot '.tools/jdk/bin/javac.exe'
$runtime = Join-Path $PSScriptRoot '.tools/jdk/bin/java.exe'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
& $compiler -encoding UTF-8 -d $testRoot (Join-Path $PSScriptRoot 'app/src/main/java/com/pathseeker/driver/QuestionAudioPreparation.java') (Join-Path $PSScriptRoot 'tests/QuestionAudioPreparationTest.java')
if ($LASTEXITCODE -ne 0) { throw '音频准备测试编译失败' }
& $runtime -ea -cp $testRoot com.pathseeker.driver.QuestionAudioPreparationTest
if ($LASTEXITCODE -ne 0) { throw '音频准备测试失败' }
