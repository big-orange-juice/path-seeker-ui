/**
 * 一条命令跑完：起开发服务器 → 无头 Edge 截图当前路线选择页 → 收尾。
 * 用来确认「当前源码」实际长什么样，排除看到旧产物的可能。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const NODE = process.argv[2]
const VITE = process.argv[3]
const H5_ROOT = process.argv[4]
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = process.argv[5] || 'D:\\workspace\\amh\\code\\CulturalTourism\\web\\path-seeker-ui\\tmp'
const PROFILE = 'C:\\Users\\zhmou\\AppData\\Local\\Temp\\edge-picker'
const PORT = 9404
const BASE = 'http://127.0.0.1:5174/path-seeker/client'

const problems = []
const log = (...args) => console.log('[shot-picker]', ...args)

mkdirSync(PROFILE, { recursive: true })
const vite = spawn(NODE, [VITE, '--port', '5174', '--host', '127.0.0.1'], { cwd: H5_ROOT, stdio: 'ignore' })

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/`)
      if (res.ok) return true
    } catch {}
    await sleep(500)
  }
  return false
}

class Cdp {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map() }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws error')) })
    const cdp = new Cdp(ws)
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const { resolve, reject } = cdp.pending.get(msg.id)
        cdp.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
    return cdp
  }
  send(method, params = {}) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)) } }, 40000)
    })
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(cdp, expression, label, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return true
    await sleep(250)
  }
  problems.push(`等待超时：${label}`)
  return false
}

let edge
try {
  if (!(await waitForServer())) throw new Error('开发服务器没起来')
  log('开发服务器就绪')

  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) { edge = page; break }
    } catch {}
    if (i === 0) {
      spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=412,924', 'about:blank'],
        { stdio: 'ignore' })
    }
    await sleep(500)
  }
  if (!edge) throw new Error('DevTools 没起来')

  const cdp = await Cdp.connect(edge.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Browser.grantPermissions', { origin: new URL(BASE).origin, permissions: ['geolocation'] })

  await cdp.send('Page.navigate', { url: `${BASE}/ride` })
  await waitFor(cdp, `!!document.querySelector('.tour-experience')`, '户外主线渲染')
  if (await evaluate(cdp, `!!document.querySelector('.tour-language-gate')`)) {
    await evaluate(cdp, `document.querySelectorAll('.tour-language-gate button')[0].click()`)
    await waitFor(cdp, `!document.querySelector('.tour-language-gate')`, '语言门关闭')
  }
  await waitFor(cdp, `!!document.querySelector('.start-ride')`, '路线选择页')
  await sleep(2500)

  const info = await evaluate(cdp, `(() => {
    const picker = document.querySelector('.tour-route-picker')
    const heading = document.querySelector('.route-heading-copy h1')
    const hint = document.querySelector('.route-heading-copy p')
    const input = document.querySelector('.route-search input')
    const styles = picker ? getComputedStyle(picker) : null
    const headingStyles = document.querySelector('.route-heading') ? getComputedStyle(document.querySelector('.route-heading')) : null
    return {
      heading: heading ? heading.textContent.trim() : null,
      hint: hint ? hint.textContent.trim() : null,
      searchPlaceholder: input ? input.placeholder : null,
      cards: document.querySelectorAll('.route-card').length,
      startLabel: (document.querySelector('.start-ride strong') || {}).textContent || null,
      pickerPosition: styles ? styles.position : null,
      pickerInset: styles ? styles.inset : null,
      headingBackground: headingStyles ? headingStyles.backgroundImage.slice(0, 60) : null,
      cssSheets: document.styleSheets.length,
      voiceButton: Boolean(document.querySelector('.tour-voice-button')),
    }
  })()`)
  log('页面实测:', JSON.stringify(info, null, 2))

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/shot-picker-current.png`, Buffer.from(shot.data, 'base64'))
  log('截图:', `${OUT}\\shot-picker-current.png`)
} catch (error) {
  problems.push(`执行异常：${error.message}`)
} finally {
  try { spawn('taskkill', ['/IM', 'msedge.exe', '/F'], { stdio: 'ignore' }) } catch {}
  vite.kill()
}

log('=== 结果 ===')
if (problems.length) {
  for (const item of problems) log('FAIL:', item)
  process.exit(1)
}
log('完成')
process.exit(0)
