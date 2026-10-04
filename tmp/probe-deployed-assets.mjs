/**
 * 诊断：线上 C 端页面引用的产物是否都存在，以及产物里的文案是哪一版。
 * 只做只读请求。
 */
const PAGES = process.argv.slice(2)
if (!PAGES.length) PAGES.push('https://www.omahaaigc.com/path-seeker/client/ride')

for (const page of PAGES) {
  console.log(`\n===== ${page} =====`)
  let html
  try {
    const response = await fetch(page, { redirect: 'follow' })
    console.log(`页面 HTTP ${response.status}  content-type=${response.headers.get('content-type')}`)
    html = await response.text()
  } catch (error) {
    console.log(`页面请求失败：${error.message}`)
    continue
  }

  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1])
  if (!assets.length) console.log('（HTML 里没有找到 js/css 引用）')

  for (const asset of assets) {
    const url = new URL(asset, page).toString()
    try {
      const response = await fetch(url, { method: 'GET' })
      const body = await response.text()
      const kind = url.endsWith('.css') ? 'css' : 'js'
      const marks = kind === 'css'
        ? [
            ['route-heading', body.includes('route-heading')],
            ['start-ride', body.includes('start-ride')],
            ['tour-voice', body.includes('tour-voice')],
          ]
        : [
            ['选择这一程', body.includes('选择这一程')],
            ['游览路线', body.includes('游览路线')],
            ['搜索路线或导游', body.includes('搜索路线或导游')],
            ['搜索路线、导游或途经点', body.includes('搜索路线、导游或途经点')],
            ['说话提问', body.includes('说话提问')],
          ]
      console.log(`  HTTP ${response.status}  ${kind}  ${String(Math.round(body.length / 1024)).padStart(5)}KB  ${url}`)
      console.log(`      ${marks.map(([name, hit]) => `${name}=${hit ? '有' : '无'}`).join('  ')}`)
    } catch (error) {
      console.log(`  请求失败  ${url}  ${error.message}`)
    }
  }
}
