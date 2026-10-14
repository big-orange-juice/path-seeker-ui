const microphoneButton = document.getElementById('microphone')
const recognizeButton = document.getElementById('recognize')
const stopButton = document.getElementById('stop')
const copyButton = document.getElementById('copy')
const statusElement = document.getElementById('status')
const logElement = document.getElementById('log')
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
const startedAt = performance.now()
const report = {
  version: 'isolated-browser-voice-20261014',
  userAgent: navigator.userAgent,
  secureContext: window.isSecureContext,
  recognitionApi: Boolean(Recognition),
  microphone: 'untested',
  language: 'zh-CN',
  events: [],
}
let recognition = null
let checkingMicrophone = false
let running = false
let ending = false
let disposed = false
let hadError = false
let receivedResult = false
let stopTimer
let endTimer

function record(event, detail = {}) {
  report.events.push({ elapsedMs: Math.round(performance.now() - startedAt), event, ...detail })
  if (report.events.length > 100) report.events.shift()
  logElement.textContent = JSON.stringify(report, null, 2)
}

function updateButtons() {
  microphoneButton.disabled = checkingMicrophone || running
  recognizeButton.disabled = checkingMicrophone || running || !Recognition
  stopButton.disabled = !running || ending
}

function stopRecognition(reason) {
  if (!running || ending) return
  ending = true
  record('stop-request', { reason })
  clearTimeout(stopTimer)
  updateButtons()
  endTimer = setTimeout(() => {
    if (!running) return
    record('abort-request', { reason: 'end-timeout' })
    statusElement.textContent = '浏览器没有结束识别，请复制记录后重新打开检测页。'
    recognition.abort()
  }, 2000)
  try {
    recognition.stop()
  } catch (error) {
    record('stop-exception', { name: error.name })
  }
}

microphoneButton.addEventListener('click', async () => {
  if (checkingMicrophone || running) return
  checkingMicrophone = true
  updateButtons()
  statusElement.textContent = '正在申请麦克风权限…'
  record('microphone-request')
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia-unavailable')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const liveTracks = stream.getAudioTracks().filter(track => track.readyState === 'live').length
    for (const track of stream.getTracks()) track.stop()
    if (disposed) return
    report.microphone = liveTracks > 0 ? 'accessible-released' : 'no-live-track'
    record('microphone-released', { liveTracks })
    statusElement.textContent = liveTracks > 0
      ? '麦克风可以访问，已释放。请点击“开始识别”继续检测。'
      : '没有可用的麦克风轨道。'
  } catch (error) {
    if (disposed) return
    report.microphone = error.name || 'failed'
    record('microphone-error', { name: error.name })
    statusElement.textContent = '麦克风访问失败，请检查浏览器的网站权限与系统麦克风权限。'
  } finally {
    checkingMicrophone = false
    updateButtons()
  }
})

recognizeButton.addEventListener('click', () => {
  if (running || checkingMicrophone || !Recognition) return
  hadError = false
  receivedResult = false
  ending = false
  try {
    if (!recognition) {
      recognition = new Recognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      for (const event of ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']) {
        recognition.addEventListener(event, () => {
          record(event)
          if (event === 'audiostart') statusElement.textContent = '浏览器已报告开始收音，请说一句话。'
        })
      }
      recognition.addEventListener('result', event => {
        receivedResult = true
        record('result', { resultCount: event.results.length })
        statusElement.textContent = '浏览器已返回识别结果，未记录说话内容。'
      })
      recognition.addEventListener('error', event => {
        hadError = true
        record('error', { code: event.error })
        statusElement.textContent = `独立识别失败：${event.error}。请复制检测结果。`
      })
      recognition.addEventListener('end', () => {
        record('end')
        running = false
        ending = false
        clearTimeout(stopTimer)
        clearTimeout(endTimer)
        if (!hadError) statusElement.textContent = receivedResult ? '独立识别已返回结果。' : '识别结束，未返回文字结果。'
        updateButtons()
      })
    }
    running = true
    updateButtons()
    statusElement.textContent = '正在启动浏览器识别…'
    record('start-request', { userActivation: navigator.userActivation?.isActive ?? null })
    recognition.start()
    if (running) stopTimer = setTimeout(() => stopRecognition('15-second-limit'), 15000)
  } catch (error) {
    running = false
    record('start-exception', { name: error.name })
    statusElement.textContent = '浏览器无法启动识别，请复制检测结果。'
    updateButtons()
  }
})

stopButton.addEventListener('click', () => stopRecognition('button'))
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
    statusElement.textContent = '检测结果已复制。'
  } catch {
    statusElement.textContent = '无法自动复制，可长按下方记录手动复制。'
  }
})
window.addEventListener('pagehide', () => {
  disposed = true
  clearTimeout(stopTimer)
  clearTimeout(endTimer)
  if (running) {
    record('abort-request', { reason: 'pagehide' })
    recognition.abort()
  }
})
window.addEventListener('pageshow', () => { disposed = false })
document.addEventListener('visibilitychange', () => {
  record('visibility', { value: document.visibilityState })
  if (document.visibilityState === 'hidden') stopRecognition('hidden')
})
record('loaded')
updateButtons()
if (!Recognition) statusElement.textContent = '当前浏览器没有提供语音识别接口。'
