/**
 * 验证问一问面板对齐 demo 后的结构与交互：
 *  - 状态行是面板顶部一行薄条（相位 + 提示），不再塞在输入区里
 *  - 输入区是整行：附件上下文 + 输入框 + 按住说话麦克风 + 发送
 *  - 麦克风按下进入识别（波形条），松开停止并自动发送（demo 行为）
 *  - 说话打断收进顶栏图标
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
const PROFILE = 'C:\\Users\\zhmou\\AppData\\Local\\Temp\\edge-ask-demo'
const PORT = 9406
const BASE = 'http://127.0.0.1:5174/path-seeker/client'

const problems = []
const log = (...args) => console.log('[verify-ask-demo]', ...args)

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
})()
`

mkdirSync(PROFILE, { recursive: true })
const vite = spawn(NODE, [VITE, '--port', '5174', '--host', '127.0.0.1'], { cwd: H5_ROOT, stdio: 'ignore' })

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

const STRUCTURE = `(() => {
  const panel = document.querySelector('.ask-panel')
  const status = document.querySelector('.ask-voice-bar')
  const msgs = document.querySelector('.ask-msgs')
  const composer = document.querySelector('.ask-composer')
  const inner = document.querySelector('.ask-composer-inner')
  const composerStyle = composer ? getComputedStyle(composer) : null
  const rect = el => el ? el.getBoundingClientRect() : null
  return {
    statusDirectChildOfPanel: Boolean(panel && status && Array.from(panel.children).includes(status)),
    statusAboveMessages: Boolean(status && msgs && rect(status).bottom <= rect(msgs).top + 1),
    statusInsideComposer: Boolean(composer && status && composer.contains(status)),
    statusIsThinRow: Boolean(status) && Math.round(rect(status).height) <= 60,
    statusText: status ? status.textContent.replace(/\\s+/g, ' ').trim() : null,
    composerFullWidth: composerStyle ? composerStyle.marginLeft === '0px' && composerStyle.borderRadius === '0px' : null,
    micInComposer: Boolean(inner && inner.querySelector('.ask-mic-button')),
    sendInComposer: Boolean(inner && inner.querySelector('.ask-send')),
    inputInComposer: Boolean(inner && inner.querySelector('.ask-input')),
    micSiblingsInInner: inner ? Array.from(inner.children).map(n => n.className.split(' ')[0]) : [],
    contextChipInComposer: Boolean(composer && composer.querySelector('.ask-context-chip')),
    bargeInInHeader: Boolean(document.querySelector('.ask-head .ask-icon-btn[aria-label="说话打断"]')),
    suggestionsOutsideBubbles: document.querySelectorAll('.ask-bubble .ask-suggestions').length,
    micWaves: document.querySelectorAll('.ask-mic-button .ask-voice-wave i').length,
    micListening: (() => { const b = document.querySelector('.ask-mic-button'); return b ? b.classList.contains('is-listening') : null })(),
    micAria: (() => { const b = document.querySelector('.ask-mic-button'); return b ? b.getAttribute('aria-pressed') : null })(),
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
      spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

  // 从行程页的语音键进入，保证带着当前上下文
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
  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(700)

  const structure = await evaluate(cdp, STRUCTURE)
  log('结构:', JSON.stringify(structure, null, 2))
  if (!structure.statusDirectChildOfPanel) problems.push('状态行不是面板的顶层子元素')
  if (!structure.statusAboveMessages) problems.push('状态行没有位于消息列表上方')
  if (structure.statusInsideComposer) problems.push('状态行仍塞在输入区里（应已独立成行）')
  if (!structure.statusIsThinRow) problems.push('状态行不够薄，仍占多行')
  if (structure.composerFullWidth !== true) problems.push('输入区不是整行（对齐 demo 应贴满宽度）')
  if (!structure.micInComposer) problems.push('麦克风按钮不在输入区里')
  if (!structure.sendInComposer || !structure.inputInComposer) problems.push('输入区缺少输入框或发送键')
  if (!structure.contextChipInComposer) problems.push('当前上下文（附件）没有出现在输入区')
  if (!structure.bargeInInHeader) problems.push('说话打断没有收进顶栏')
  if (structure.suggestionsOutsideBubbles > 0) problems.push('气泡里仍在渲染建议，应与 demo 一样只在输入框上方一行')

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-ask-demo-idle.png`, Buffer.from(shot.data, 'base64'))
  log('待命态截图:', `${OUT}\\verify-ask-demo-idle.png`)

  // 按住说话：pointerdown 进入识别 → 波形条
  await evaluate(cdp, `(() => {
    const btn = document.querySelector('.ask-mic-button')
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    return true
  })()`)
  await sleep(500)
  const pressing = await evaluate(cdp, STRUCTURE)
  log('按住时:', JSON.stringify({ listening: pressing.micListening, waves: pressing.micWaves, aria: pressing.micAria }))
  if (pressing.micListening !== true) problems.push('按住麦克风没有进入识别态')
  if (pressing.micAria !== 'true') problems.push('按住时 aria-pressed 不是 true')
  if (pressing.micWaves !== 4) problems.push(`识别中波形条数量应为 4，实际 ${pressing.micWaves}`)

  await evaluate(cdp, `window.__voiceEmit('烟袋斜街有什么故事', false)`)
  await sleep(300)
  const interim = await evaluate(cdp, `document.querySelector('.ask-input').value`)
  log('识别中草稿:', JSON.stringify(interim))
  if (!interim.includes('烟袋斜街')) problems.push('识别结果没有实时回填输入框')

  const pressShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-ask-demo-holding.png`, Buffer.from(pressShot.data, 'base64'))
  log('按住态截图:', `${OUT}\\verify-ask-demo-holding.png`)

  // 松开：停止识别并自动发送（demo 行为）
  await evaluate(cdp, `(() => {
    const btn = document.querySelector('.ask-mic-button')
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
    return true
  })()`)
  await sleep(2000)

  const afterRelease = await evaluate(cdp, `(() => {
    const btn = document.querySelector('.ask-mic-button')
    const userBubble = [...document.querySelectorAll('.ask-bubble.is-user')].pop()
    return {
      listening: btn ? btn.classList.contains('is-listening') : null,
      waves: document.querySelectorAll('.ask-mic-button .ask-voice-wave i').length,
      draft: document.querySelector('.ask-input').value,
      userText: userBubble ? userBubble.innerText.trim() : '',
    }
  })()`)
  log('松开后:', JSON.stringify(afterRelease))
  if (afterRelease.listening !== false) problems.push('松开后没有退出识别态')
  if (afterRelease.waves !== 0) problems.push('松开后波形仍在显示')
  if (!afterRelease.userText.includes('烟袋斜街')) problems.push(`松开后没有自动发送识别结果：${JSON.stringify(afterRelease.userText)}`)
  if ((afterRelease.draft || '') !== '') problems.push('自动发送后草稿没有清空')

  const sentShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/verify-ask-demo-sent.png`, Buffer.from(sentShot.data, 'base64'))
  log('发送后截图:', `${OUT}\\verify-ask-demo-sent.png`)
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
