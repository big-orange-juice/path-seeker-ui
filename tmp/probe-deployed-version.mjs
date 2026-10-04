/**
 * 诊断：用 ASCII 类名给线上产物「定位版本」。
 * 中文在压缩产物里会被转义成 \uXXXX，所以只查类名这类不会变的 ASCII 标记。
 */
const TARGETS = (process.argv[2] || 'https://www.omahaaigc.com/path-seeker/client/ride').split(',')
const MARKERS = [
  ['route-heading', '路线选择页新版布局'],
  ['start-ride', '路线选择页新版开始键'],
  ['tour-route-card', '路线选择页旧版卡片'],
  ['tour-start', '路线选择页旧版开始键'],
  ['tour-tools', '行程页左侧图标工具栏'],
  ['tour-voice', '行程页语音键（本轮新增）'],
  ['tour-voice-wave', '语音键波形'],
  ['ask-bargein-toggle', '问一问说话打断开关'],
  ['ask-voice-caption', '问一问字幕跟读'],
  ['ask-interrupted-tag', '问一问打断标记'],
]

for (const page of TARGETS) {
  console.log(`\n===== ${page} =====`)
  let html
  try {
    const response = await fetch(page)
    html = await response.text()
    if (!response.ok) { console.log(`HTTP ${response.status}`); continue }
  } catch (error) { console.log(`请求失败：${error.message}`); continue }

  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1])
  const bodies = {}
  for (const asset of assets) {
    const url = new URL(asset, page).toString()
    const response = await fetch(url)
    const body = await response.text()
    bodies[asset.split('/').pop()] = body
    console.log(`  ${response.status}  ${String(Math.round(body.length / 1024)).padStart(5)}KB  ${asset.split('/').pop()}`)
  }

  const combined = Object.values(bodies).join('\n')
  console.log('  标记命中：')
  for (const [marker, label] of MARKERS) {
    const hit = combined.includes(marker)
    console.log(`    ${hit ? '有' : '无'}  ${marker.padEnd(20)} ${label}`)
  }
}
