/**
 * 将 @ffmpeg/core 的 js/wasm 同步到 public/ffmpeg，
 * 供浏览器端抽音自托管加载（不走外网 CDN）。
 *
 * @ffmpeg/core 的 exports 未暴露子路径，故用目录探测而非 require.resolve。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'ffmpeg')
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']

const coreCandidates = [
  join(root, 'node_modules', '@ffmpeg', 'core'),
  join(root, '..', '..', 'node_modules', '@ffmpeg', 'core'),
]

function resolveCoreDir() {
  for (const dir of coreCandidates) {
    const sample = join(dir, 'dist', 'esm', 'ffmpeg-core.js')
    if (existsSync(sample)) {
      return join(dir, 'dist', 'esm')
    }
  }
  return null
}

const srcDir = resolveCoreDir()
if (!srcDir) {
  console.error('[sync-ffmpeg-core] 未找到 @ffmpeg/core（dist/esm）')
  console.error('请在 apps/web-admin 执行：pnpm add @ffmpeg/core')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

for (const name of files) {
  const src = join(srcDir, name)
  if (!existsSync(src)) {
    console.error(`[sync-ffmpeg-core] 缺少文件：${src}`)
    process.exit(1)
  }
  copyFileSync(src, join(outDir, name))
  console.log(`[sync-ffmpeg-core] ${name} → public/ffmpeg/`)
}
