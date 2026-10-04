/**
 * 验证问一问语音条里的「语音识别状态」：
 *  - 待命时是麦克风图标 + 「语音输入」
 *  - 识别中变成波形条 + 「正在听」，字幕区显示实时听写
 *  - 点状态芯片可结束识别；识别结果写进输入框
 *
 * 一条命令内起开发服务器 + 无头 Edge，识别用注入的假实现驱动。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const NODE = process.argv[2]
const VITE = process.argv[3]
const H5_ROOT = process.argv[4]
const OUT = process.argv[5] || 'D:\\workspace\\amh\\code\\CulturalTourism\\web\\path-seeker-ui\\tmp'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = 'C:\\Users\\zhmou\\AppData\\Local\\Temp\\edge-voice-status'
const PORT = 9405
const BASE = 'http://127.0.0.1:5174/path-seeker/client'

const problems = []
const log = (...args) => console.log('[verify-voice-status]', ...args)

const MOCK = `
(() => {
  class FakeRecognition {
    constructor() {
      this.lang = ''; this.continuous = false; this.interimResults = true; this.maxAlternatives = 1
      this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null; this.started = false
    }
    start() {
      if (this.started) throw new Error('already started')
      this.started = true
      window.__fakeRecognition = this
      setTimeout(() => this.onstart && this.onstart(), 0)
    }
    stop() { this.finish() }
    abort() { this.started = false; setTimeout(() => this.onend && this.onend(), 0) }
    emit(text, isFinal) {
      if (!this.onresult) return
      const result = [{ transcript: text }]
      result.isFinal = isFinal
      this.onresult({ resultIndex: 0, results: Object.assign([result], { length: 1 }) })
    }
    finish() { this.started = false; setTimeout(() => this.onend && this.onend(), 0) }
  }
  window.SpeechRecognition = FakeRecognition
  window.webkitSpeechRecognition = FakeRecognition
  window.__voiceEmit = (t, f) => window.__fakeRecognition && window.__fakeRecognition.emit(t, f)
  window.__voiceFinish = () => window.__fakeRecognition && window.__fakeRecognition.finish()
})()
`

mkdirSync(PROFILE, { recursive: true })
const vite = spawn(NODE, [VITE, '--port', '5174', '--host', '127.0.0.1'], { cwd: H5_ROOT, stdio: 'ignore' })
let edgeProc

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

const VOICE_BAR = `(() => {
  const chip = document.querySelector('.ask-voice-mic')
  const caption = document.querySelector('.ask-voice-caption')
  return {
    chip: chip ? chip.textContent.trim() : null,
    chipListening: chip ? chip.classList.contains('is-listening') : null,
    chipPressed: chip ? chip.getAttribute('aria-pressed') : null,
    waveBars: document.querySelectorAll('.ask-voice-mic .ask-voice-wave i').length,
    hasWave: Boolean(document.querySelector('.ask-voice-mic .ask-voice-wave')),
    caption: caption ? caption.textContent.trim() : null,
    captionRecognizing: caption ? caption.classList.contains('is-recognizing') : null,
    input: (document.querySelector('.ask-input') || {}).value ?? null,
  }
})()`

try {
  let ready = false
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(`${BASE}/`)).ok) { ready = true; break } } catch {}
    await sleep(500)
  }
  if (!ready) throw new Error('开发服务器没起来')
  log('开发服务器就绪')

  let page
  for (let i = 0; i < 60; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) break
    } catch {}
    if (i === 0) {
      edgeProc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=412,924', 'about:blank'],
        { stdio: 'ignore' })
    }
    await sleep(500)
  }
  if (!page) throw new Error('DevTools 没起来')

  const cdp = await Cdp.connect(page.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK })
  await cdp.send('Browser.grantPermissions', { origin: new URL(BASE).origin, permissions: ['geolocation'] })

  await cdp.send('Page.navigate', { url: `${BASE}/ride` })
  await waitFor(cdp, `!!document.querySelector('.tour-experience')`, '户外主线渲染')
  if (await evaluate(cdp, `!!document.querySelector('.tour-language-gate')`)) {
    await evaluate(cdp, `document.querySelectorAll('.tour-language-gate button')[0].click()`)
    await waitFor(cdp, `!document.querySelector('.tour-language-gate')`, '语言门关闭')
  }
  await waitFor(cdp, `!!document.querySelector('.start-ride')`, '路线选择页')
  await waitFor(cdp, `!document.querySelector('.start-ride').disabled`, '路线预选完成')
  await evaluate(cdp, `document.querySelector('.start-ride').click()`)
  await waitFor(cdp, `!!document.querySelector('.tour-voice-button')`, '行程页语音键')
  await sleep(1200)

  // 待命态：应是麦克风图标 + 「语音输入」，没有波形
  const idleBefore = await evaluate(cdp, `(() => {
    const chip = document.querySelector('.ask-voice-mic')
    return { chip: chip ? chip.textContent.trim() : null, hasWave: Boolean(document.querySelector('.ask-voice-mic .ask-voice-wave')) }
  })()`)
  log('开麦前（面板未打开时读不到，属预期）:', JSON.stringify(idleBefore))

  // 点语音键：面板打开 + 开始识别
  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(800)

  const listening = await evaluate(cdp, VOICE_BAR)
  log('识别中:', JSON.stringify(listening))
  if (listening.chipListening !== true) problems.push('识别中状态芯片没有进入 listening 态')
  if (listening.chipPressed !== 'true') problems.push('识别中 aria-pressed 不是 true')
  if (listening.waveBars !== 4) problems.push(`波形条数量应为 4，实际 ${listening.waveBars}`)
  if (!(listening.chip || '').includes('正在听')) problems.push(`识别中芯片文案应为「正在听」，实际 ${listening.chip}`)
  if (!listening.caption) problems.push('识别中没有显示字幕区提示')
  if (listening.captionRecognizing !== true) problems.push('识别中字幕没有加 is-recognizing 标记')

  // 合并成一块：状态行必须在底部卡片内部，且相位与提示同一行
  const merged = await evaluate(cdp, `(() => {
    const panel = document.querySelector('.ask-panel')
    const composer = document.querySelector('.ask-composer')
    const status = document.querySelector('.ask-voice-bar')
    const phase = document.querySelector('.ask-voice-phase')
    const hint = document.querySelector('.ask-voice-hint')
    const composerStyle = composer ? getComputedStyle(composer) : null
    const composerRect = composer ? composer.getBoundingClientRect() : null
    const statusRect = status ? status.getBoundingClientRect() : null
    return {
      statusExists: Boolean(status),
      insideComposer: Boolean(document.querySelector('.ask-composer .ask-voice-bar')),
      directChildOfPanel: panel && status ? Array.from(panel.children).includes(status) : null,
      sameLine: phase && hint
        ? Math.abs(phase.getBoundingClientRect().top - hint.getBoundingClientRect().top) < 6
        : null,
      composerRadius: composerStyle ? composerStyle.borderRadius : null,
      composerMarginLeft: composerStyle ? composerStyle.marginLeft : null,
      composerTop: composerRect ? Math.round(composerRect.top) : null,
      statusTop: statusRect ? Math.round(statusRect.top) : null,
      statusInsideComposerBand: composerRect && statusRect
        ? statusRect.top >= composerRect.top - 1 && statusRect.bottom <= composerRect.bottom + 1
        : null,
    }
  })()`)
  log('合并检查:', JSON.stringify(merged))
  if (!merged.insideComposer) problems.push('语音状态区没有并入底部输入卡片')
  if (merged.directChildOfPanel) problems.push('语音状态区仍挂在面板顶层（应已下移）')
  if (merged.sameLine !== true) problems.push('相位与提示不在同一行，没有压成一行')
  if (merged.composerRadius === '0px') problems.push('底部输入块没有圆角')
  if (merged.statusInsideComposerBand !== true) problems.push('状态区不在输入卡片的范围内')

  const waveShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-voice-listening.png`, Buffer.from(waveShot.data, 'base64'))
  log('识别中截图:', `${OUT}\\verify-voice-listening.png`)

  // 实时听写进字幕与输入框
  await evaluate(cdp, `window.__voiceEmit('这个站点有什么', false)`)
  await sleep(400)
  const interim = await evaluate(cdp, VOICE_BAR)
  log('临时结果:', JSON.stringify(interim))
  if (!(interim.caption || '').includes('这个站点有什么')) problems.push('识别中字幕没有显示实时听写')
  if (!(interim.input || '').includes('这个站点有什么')) problems.push('临时结果没有回填输入框')

  // 点状态芯片 → 结束识别
  await evaluate(cdp, `document.querySelector('.ask-voice-mic').click()`)
  await sleep(600)
  const stopped = await evaluate(cdp, VOICE_BAR)
  log('点芯片后:', JSON.stringify(stopped))
  if (stopped.chipListening !== false) problems.push('点击状态芯片没有结束识别')
  if (stopped.hasWave) problems.push('结束识别后波形仍在显示')
  if (!(stopped.chip || '').includes('语音输入')) problems.push(`待命态芯片文案应为「语音输入」，实际 ${stopped.chip}`)
  // 手动停麦时刚说出口的内容不能丢
  if (!(stopped.input || '').includes('这个站点有什么')) problems.push(`手动结束识别后草稿被清空：${JSON.stringify(stopped.input)}`)

  const idleShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-voice-idle.png`, Buffer.from(idleShot.data, 'base64'))
  log('待命态截图:', `${OUT}\\verify-voice-idle.png`)

  // 全页问一问共用同一套卡片样式，一并确认没有回归
  await cdp.send('Page.navigate', { url: `${BASE}/shell/ask` })
  await waitFor(cdp, `!!document.querySelector('.ask-layer.is-full .ask-composer')`, '全页问一问渲染')
  await sleep(800)
  const fullPage = await evaluate(cdp, `(() => {
    const composer = document.querySelector('.ask-composer')
    const status = document.querySelector('.ask-voice-bar')
    const composerStyle = composer ? getComputedStyle(composer) : null
    const composerRect = composer ? composer.getBoundingClientRect() : null
    const statusRect = status ? status.getBoundingClientRect() : null
    return {
      statusInsideComposer: Boolean(document.querySelector('.ask-composer .ask-voice-bar')),
      radius: composerStyle ? composerStyle.borderRadius : null,
      marginLeft: composerStyle ? composerStyle.marginLeft : null,
      statusInsideBand: composerRect && statusRect
        ? statusRect.top >= composerRect.top - 1 && statusRect.bottom <= composerRect.bottom + 1
        : null,
      composerBottomGap: composerRect ? Math.round(window.innerHeight - composerRect.bottom) : null,
    }
  })()`)
  log('全页问一问:', JSON.stringify(fullPage))
  if (!fullPage.statusInsideComposer) problems.push('全页问一问：状态区没有并入输入卡片')
  if (fullPage.radius === '0px') problems.push('全页问一问：输入卡片没有圆角')
  if (fullPage.statusInsideBand !== true) problems.push('全页问一问：状态区不在输入卡片范围内')

  const fullShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-voice-fullpage.png`, Buffer.from(fullShot.data, 'base64'))
  log('全页截图:', `${OUT}\\verify-voice-fullpage.png`)
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
log('全部检查通过')
process.exit(0)
