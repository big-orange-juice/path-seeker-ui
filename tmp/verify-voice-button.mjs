/**
 * 验证行程页的「一键语音提问」：
 *  - 按钮只出现在行程态，位置在讲解悬浮条正上方居中；
 *  - 点一下会掐掉正在播的讲解、打开问一问并挂上当前站点附件；
 *  - 语音识别结果实时写进输入框，结束后按钮回到待命态。
 *
 * 识别用注入的假 SpeechRecognition 驱动，避免依赖浏览器厂商的识别服务。
 * 只在本地页面操作，不写业务数据。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://127.0.0.1:5174/path-seeker/client'
const PROFILE = process.argv[3] || 'C:\\Users\\zhmou\\AppData\\Local\\Temp\\edge-voice'
const SHOT_DIR = process.argv[4] || 'D:\\workspace\\amh\\code\\CulturalTourism\\web\\path-seeker-ui\\tmp'
const PORT = 9403

const problems = []
const log = (...args) => console.log('[verify-voice]', ...args)

/** 假识别器：start() 后可由 window.__voiceEmit 手动吐结果 */
const MOCK = `
(() => {
  class FakeRecognition {
    constructor() {
      this.lang = ''
      this.continuous = false
      this.interimResults = true
      this.maxAlternatives = 1
      this.onstart = null
      this.onresult = null
      this.onerror = null
      this.onend = null
      this.started = false
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
  window.__voiceEmit = (text, isFinal) => window.__fakeRecognition && window.__fakeRecognition.emit(text, isFinal)
  window.__voiceFinish = () => window.__fakeRecognition && window.__fakeRecognition.finish()
})()
`

class Cdp {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); this.handlers = [] }

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
        return
      }
      for (const handler of cdp.handlers) handler(msg)
    }
    return cdp
  }

  send(method, params = {}) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }
      }, 40000)
    })
  }

  on(handler) { this.handlers.push(handler) }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    throw new Error(`eval failed: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`)
  }
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

async function waitForDevTools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('DevTools endpoint never came up')
}

mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=412,924',
  'about:blank',
], { stdio: 'ignore' })

try {
  const page = await waitForDevTools()
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

  // 选路线（新的选择页用 .start-ride，且需要已选中一条路线）
  await waitFor(cdp, `!!document.querySelector('.start-ride')`, '路线选择面板')
  await waitFor(cdp, `!document.querySelector('.start-ride').disabled`, '路线预选完成')

  const voiceInPicker = await evaluate(cdp, `!!document.querySelector('.tour-voice-button')`)
  if (voiceInPicker) problems.push('路线选择页不该出现语音键')

  await evaluate(cdp, `document.querySelector('.start-ride').click()`)
  await waitFor(cdp, `!!document.querySelector('.tour-voice-button')`, '行程页语音键出现')
  await sleep(1600)

  const layout = await evaluate(cdp, `(() => {
    const button = document.querySelector('.tour-voice-button')
    const dock = document.querySelector('.tour-story-dock')
    if (!button) return null
    const b = button.getBoundingClientRect()
    const d = dock ? dock.getBoundingClientRect() : null
    return {
      width: Math.round(b.width),
      height: Math.round(b.height),
      centerX: Math.round(b.left + b.width / 2),
      bottom: Math.round(b.bottom),
      viewportWidth: window.innerWidth,
      dockTop: d ? Math.round(d.top) : null,
      hint: (document.querySelector('.tour-voice-hint') || {}).textContent.trim(),
      pressed: button.getAttribute('aria-pressed'),
    }
  })()`)
  log('语音键布局:', JSON.stringify(layout))
  if (!layout) problems.push('语音键未渲染')
  else {
    if (layout.width < 48 || layout.height < 48) problems.push(`语音键触控区过小：${layout.width}x${layout.height}`)
    if (Math.abs(layout.centerX - layout.viewportWidth / 2) > 2) problems.push(`语音键未水平居中：center=${layout.centerX} viewport=${layout.viewportWidth}`)
    if (layout.dockTop != null && layout.bottom > layout.dockTop) problems.push('语音键与讲解悬浮条重叠')
    if (layout.pressed !== 'false') problems.push(`初始 aria-pressed 应为 false，实际 ${layout.pressed}`)
  }

  const dockBefore = await evaluate(cdp, `(document.querySelector('.tour-story-dock button') || {}).textContent.trim()`)
  log('点击前讲解按钮文案:', dockBefore)

  const idleShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${SHOT_DIR}/verify-voice-button-idle.png`, Buffer.from(idleShot.data, 'base64'))
  log('待命态截图:', `${SHOT_DIR}\\verify-voice-button-idle.png`)

  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(700)

  const afterTap = await evaluate(cdp, `(() => {
    const layer = document.querySelector('.ask-layer')
    const chip = document.querySelector('.ask-context-chip-text')
    const button = document.querySelector('.tour-voice-button')
    return {
      askOpen: layer ? layer.className.includes('is-open') : false,
      chip: chip ? chip.textContent.trim() : '',
      pressed: button ? button.getAttribute('aria-pressed') : null,
      dock: (document.querySelector('.tour-story-dock button') || {}).textContent.trim(),
      fakeStarted: Boolean(window.__fakeRecognition),
      fakeLang: window.__fakeRecognition ? window.__fakeRecognition.lang : '',
    }
  })()`)
  log('点击后:', JSON.stringify(afterTap))
  if (!afterTap.askOpen) problems.push('点击语音键后问一问面板没有打开')
  if (!afterTap.chip) problems.push('点击语音键后没有挂上站点附件上下文')
  if (afterTap.pressed !== 'true') problems.push('点击语音键后未进入识别态')
  if (!afterTap.fakeStarted) problems.push('点击语音键后没有启动语音识别')
  if (afterTap.fakeLang && !/^zh/.test(afterTap.fakeLang)) problems.push(`识别语言未跟随讲解语言：${afterTap.fakeLang}`)
  if (dockBefore === '暂停' && afterTap.dock !== '播放讲解') problems.push(`点击语音键没有打断讲解：${dockBefore} → ${afterTap.dock}`)
  else if (dockBefore === '暂停') log('讲解已被打断（暂停 → 播放讲解）')

  await evaluate(cdp, `window.__voiceEmit('这个站点有什么', false)`)
  await sleep(400)
  const interim = await evaluate(cdp, `document.querySelector('.ask-input').value`)
  log('临时识别结果回显:', JSON.stringify(interim))
  if (!interim.includes('这个站点有什么')) problems.push('临时识别结果没有回填输入框')

  await evaluate(cdp, `window.__voiceEmit('这个站点有什么故事？', true)`)
  await evaluate(cdp, `window.__voiceFinish()`)
  await sleep(600)

  const settled = await evaluate(cdp, `(() => {
    const input = document.querySelector('.ask-input')
    const button = document.querySelector('.tour-voice-button')
    return {
      input: input ? input.value : null,
      pressed: button ? button.getAttribute('aria-pressed') : null,
    }
  })()`)
  log('识别结束后:', JSON.stringify(settled))
  if ((settled.input || '').trim() !== '这个站点有什么故事？') problems.push(`最终识别文本未写入输入框：${JSON.stringify(settled.input)}`)
  if (settled.pressed !== 'false') problems.push('识别结束后按钮未回到待命态')

  // 再点一次进入识别，第三次点击应停止识别（按钮回到待命）
  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(500)
  const secondStart = await evaluate(cdp, `document.querySelector('.tour-voice-button').getAttribute('aria-pressed')`)
  if (secondStart !== 'true') problems.push('再次点击未重新进入识别态')
  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(500)
  const stopped = await evaluate(cdp, `document.querySelector('.tour-voice-button').getAttribute('aria-pressed')`)
  if (stopped !== 'false') problems.push('识别中再次点击没有结束识别')
  else log('识别中再次点击可结束识别')

  // 回归：草稿改成 store 驱动后，提交仍然要能发出（识别结果 → 用户气泡）
  // 注意：上一步已经停掉识别，这里要重新开一次再喂结果
  await evaluate(cdp, `document.querySelector('.tour-voice-button').click()`)
  await sleep(500)
  await evaluate(cdp, `window.__voiceEmit('烟袋斜街有什么故事？', true)`)
  await evaluate(cdp, `window.__voiceFinish()`)
  await sleep(500)

  const beforeSubmit = await evaluate(cdp, `document.querySelector('.ask-input').value`)
  log('提交前草稿:', JSON.stringify(beforeSubmit))
  if (!beforeSubmit.includes('烟袋斜街')) problems.push(`识别结果没有写进草稿：${JSON.stringify(beforeSubmit)}`)

  await evaluate(cdp, `document.querySelector('.ask-composer').requestSubmit()`)
  await sleep(1500)
  const submitted = await evaluate(cdp, `(() => {
    const userBubble = [...document.querySelectorAll('.ask-bubble.is-user')].pop()
    const bot = [...document.querySelectorAll('.ask-bubble.is-bot')].pop()
    return {
      userText: userBubble ? userBubble.innerText.trim() : '',
      draft: document.querySelector('.ask-input') ? document.querySelector('.ask-input').value : null,
      botText: bot ? bot.innerText.replace(/\\s+/g, ' ').slice(0, 80) : '',
    }
  })()`)
  log('提交后:', JSON.stringify(submitted))
  if (!submitted.userText.includes('烟袋斜街')) problems.push(`识别结果没有作为用户消息发出：${JSON.stringify(submitted.userText)}`)
  if ((submitted.draft || '') !== '') problems.push('提交后输入框草稿没有清空')
  // 户外上下文当前会被后端 400 拒绝，这里只说明现状，不算失败
  if (/未登录|上下文|失败|重试/.test(submitted.botText)) log(`（预期）后端仍未支持户外上下文：${submitted.botText}`)

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${SHOT_DIR}/verify-voice-button.png`, Buffer.from(shot.data, 'base64'))
  log('截图:', `${SHOT_DIR}\\verify-voice-button.png`)
} catch (error) {
  problems.push(`执行异常：${error.message}`)
} finally {
  edge.kill()
}

log('=== 结果 ===')
if (problems.length) {
  for (const item of problems) log('FAIL:', item)
  process.exit(1)
}
log('全部检查通过')
process.exit(0)
