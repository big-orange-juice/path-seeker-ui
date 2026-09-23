// 由 mock-narrations-flat.douzong.tts.json 生成 src/ride/narrations.ts
// 用法：node scripts/build-narrations.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'mock-narrations-flat.douzong.tts.json')
const target = join(root, 'src/ride/narrations.ts')
const entries = JSON.parse(readFileSync(source, 'utf8'))

/** @type {Record<string, Record<string, { text: string, audio: string, durationMs: number }[]>>} */
const grouped = {}
let clips = 0
for (const entry of entries) {
  const tts = entry.tts ?? {}
  if (tts.status !== 'success' || !tts.ossUrl) continue
  const byPlace = grouped[entry.routeName] ??= {}
  const list = byPlace[entry.placeName] ??= []
  list.push({ text: entry.text, audio: tts.ossUrl, durationMs: tts.durationMs ?? 0 })
  clips += 1
}

const header = [
  '// 由 mock-narrations-flat.douzong.tts.json 生成，请勿手改；重新生成：node scripts/build-narrations.mjs',
  '// 按「路线名 + 站点名」索引远程 TTS 文稿与音频（当前仅有中文音色）。',
  "import type { RideNarrationClip } from './types.ts'",
  '',
  'export const rideNarrationClips: Record<string, Record<string, RideNarrationClip[]>> = ',
].join('\n')

writeFileSync(target, `${header}${JSON.stringify(grouped, null, 2)}\n`)
console.log(`生成 ${target}：路线 ${Object.keys(grouped).length} 条，站点 ${Object.values(grouped).reduce((total, group) => total + Object.keys(group).length, 0)} 个，音频片段 ${clips} 段`)
