#Requires -Version 5.1
<#
.SYNOPSIS
  在本地（Windows）打包 B 端后台的「源码发布包」，用于上传到 Linux 服务器解压后安装 + 构建。

.DESCRIPTION
  打包内容 = git 跟踪的文件（剔除 .skills 等与运行无关的目录）+ pnpm-lock.yaml，
  只保留 monorepo 根配置、apps/web-admin、以及 web-admin 依赖的两个工作区包。
  node_modules / .output / .nuxt / .env.local 一律不进包：
  - .output 是 Windows 产物（含 sharp-win32-x64 原生二进制），拿到 Linux 上会崩；
  - .env.local 是本机私密配置，服务器上应使用 .env.production 与 PM2 的 env。

.PARAMETER OutDir
  产物输出目录，默认 <仓库根>/artifacts/deploy。

.PARAMETER TargetDir
  服务器上解压后的仓库根目录；仅用于生成安装说明和上传命令提示，默认 /root/path-seeker/source_code。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/pack-admin-deploy.ps1
#>
[CmdletBinding()]
param(
  [string]$OutDir = 'artifacts/deploy',
  [string]$TargetDir = '/root/path-seeker/source_code'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$archiveName = 'path-seeker-ui'          # 压缩包内的顶层目录名，服务器解压后即为该目录
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
  throw "未找到 git 仓库：$repoRoot"
}

# ---------- 1. 取 git 跟踪的文件清单 ----------
$tracked = & git -C $repoRoot ls-files
if ($LASTEXITCODE -ne 0) { throw 'git ls-files 执行失败。' }

# 只保留发布所需：根配置 + 后台应用 + 它依赖的工作区包 + nginx 片段
$keepPrefixes = @(
  'package.json'
  'pnpm-workspace.yaml'
  'apps/web-admin/'
  'packages/ts-shared/'
  'packages/game-renderer/'
  'docs/nginx/'
)

# 明确排除：AI 技能说明、任何本地私密 env 覆盖文件
$dropPatterns = @(
  '(^|/)\.skills/'
  '(^|/)\.env\.local$'
  '(^|/)\.env\.[^/]*\.local$'
)

$selected = foreach ($file in $tracked) {
  $path = $file -replace '\\', '/'
  if ($keepPrefixes -notcontains $path -and -not ($keepPrefixes | Where-Object { $path.StartsWith($_) })) {
    continue
  }
  if ($dropPatterns | Where-Object { $path -match $_ }) {
    continue
  }
  $path
}

if (-not $selected) { throw '没有匹配到任何文件，请检查 keepPrefixes 配置。' }

# ---------- 2. 暂存到临时目录 ----------
$stageParent = Join-Path ([System.IO.Path]::GetTempPath()) "ps-admin-pack-$stamp"
$stageRoot = Join-Path $stageParent $archiveName
Remove-Item $stageParent -Recurse -Force -ErrorAction SilentlyContinue
New-Item $stageRoot -ItemType Directory -Force | Out-Null

$copied = 0
foreach ($rel in $selected) {
  $src = Join-Path $repoRoot ($rel -replace '/', [System.IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
    Write-Warning "文件缺失，已跳过：$rel"
    continue
  }

  $dst = Join-Path $stageRoot ($rel -replace '/', [System.IO.Path]::DirectorySeparatorChar)
  $dstDir = Split-Path -Parent $dst
  if (-not (Test-Path -LiteralPath $dstDir)) {
    New-Item $dstDir -ItemType Directory -Force | Out-Null
  }
  Copy-Item -LiteralPath $src -Destination $dst -Force
  $copied++
}

# pnpm-lock.yaml 未被 git 跟踪（在 .gitignore 里），但必须随包发出，
# 否则服务器每次装出的依赖树都可能不同。
$lockSrc = Join-Path $repoRoot 'pnpm-lock.yaml'
if (Test-Path -LiteralPath $lockSrc) {
  Copy-Item -LiteralPath $lockSrc -Destination (Join-Path $stageRoot 'pnpm-lock.yaml') -Force
  $copied++
  $lockState = '已包含，服务器请用 pnpm install --frozen-lockfile'
}
else {
  $lockState = '缺失！服务器只能裸 pnpm install，装出的版本可能与本地不一致'
  Write-Warning $lockState
}

# ---------- 3. 生成包内安装说明 ----------
# 服务器是 Linux 路径，不能用 Split-Path（Windows 会把 / 规范化成 \）
$targetParent = ($TargetDir.TrimEnd('/') -replace '/[^/]+$', '')
$readme = @"
# Path Seeker Admin 发布包

打包时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
文件数量：$copied

## 服务器上执行（需 Node >= 22.12、pnpm 11.x）

    mkdir -p $targetParent
    tar -xzf <本包>.tar.gz -C $targetParent
    cd $TargetDir
    pnpm install --frozen-lockfile
    pnpm build:web-admin              # 必须在 Linux 上构建，Windows 产物里的 sharp 不能用于 Linux
    cd apps/web-admin
    pm2 start ecosystem.config.cjs    # 更新时：pm2 reload path-seeker-admin --update-env
    pm2 save

解压后仓库根目录为 $TargetDir（包内顶层目录 $archiveName 需已就位或改名）。

## 注意

- 环境变量：PM2 的 env 优先级最高，会覆盖 apps/web-admin/.env.production。
  高德 Key 需通过 NUXT_PUBLIC_AMAP_KEY / NUXT_PUBLIC_AMAP_SECURITY_CODE 提供。
- nginx：docs/nginx/path-seeker.conf 已随包提供，需 client_max_body_size >= 420m。
- 本包为源码包，不含 node_modules / .output，需在服务器上构建。
"@
Set-Content -LiteralPath (Join-Path $stageRoot 'DEPLOY-README.md') -Value $readme -Encoding UTF8

# ---------- 4. 打 tar.gz ----------
$outPath = Join-Path $repoRoot $OutDir
if (-not (Test-Path -LiteralPath $outPath)) {
  New-Item $outPath -ItemType Directory -Force | Out-Null
}
$archivePath = Join-Path $outPath "path-seeker-admin-src-$stamp.tar.gz"
if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }

& tar -czf $archivePath -C $stageParent $archiveName
if ($LASTEXITCODE -ne 0) { throw 'tar 打包失败。' }

Remove-Item $stageParent -Recurse -Force -ErrorAction SilentlyContinue

$info = Get-Item -LiteralPath $archivePath
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash

Write-Host ''
Write-Host '打包完成' -ForegroundColor Green
Write-Host "  文件    : $($info.FullName)"
Write-Host "  大小    : $([math]::Round($info.Length / 1KB, 1)) KB"
Write-Host "  文件数  : $copied"
Write-Host "  锁文件  : $lockState"
Write-Host "  SHA256  : $hash"
Write-Host ''
Write-Host '上传并部署：' -ForegroundColor Cyan
Write-Host "  scp `"$($info.FullName)`" root@<服务器>:/tmp/"
Write-Host "  ssh root@<服务器> 'mkdir -p $targetParent && tar -xzf /tmp/$($info.Name) -C $targetParent'"
