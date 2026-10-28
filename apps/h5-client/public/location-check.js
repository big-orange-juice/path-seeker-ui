/**
 * 定位精度检测探针（静态页面，不依赖应用运行时）
 *
 * 目的：导览页面出现“定位精度不足”时，用它区分四类成因——
 * 1. 非安全上下文（非 HTTPS/localhost）导致浏览器只给最粗结果；
 * 2. 权限被拒或系统定位总开关关闭；
 * 3. 浏览器拿不到卫星定位，只能给出网络定位（精度通常在数百米以上）；
 * 4. 定位链路正常，只是应用侧精度阈值偏严。
 *
 * 采样参数与应用一致（enableHighAccuracy/timeout/maximumAge 参考
 * apps/h5-client/src/composables/useTourJourney.ts 的 watchPosition 配置），
 * 便于直接对比“页面能拿到的精度”和“接近判定可用的精度”。
 */

/** 应用侧接近判定阈值（米），与 packages/ts-shared/src/geo-range.ts 的 maxAccuracyMeters 保持一致 */
const APP_MAX_ACCURACY_METERS = 65

/** 单组采样时长（毫秒） */
const SAMPLE_DURATION_MS = 12000

const els = {
  env: document.getElementById('env'),
  verdict: document.getElementById('verdict'),
  status: document.getElementById('status'),
  log: document.getElementById('log'),
  run: document.getElementById('run'),
  stop: document.getElementById('stop'),
  copy: document.getElementById('copy'),
}

/** 本次检测的完整记录，最终用于复制粘贴给排查方 */
const report = {
  page: 'location-check',
  startedAt: new Date().toISOString(),
  href: location.href,
  origin: location.origin,
  secureContext: window.isSecureContext,
  protocol: location.protocol,
  userAgent: navigator.userAgent,
  permissionState: 'unknown',
  groups: [],
  verdict: '',
}

let running = false
let activeWatchId = null

function pad(value) {
  return String(value).padStart(2, '0')
}

function timestamp() {
  const now = new Date()
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function appendLog(line) {
  els.log.textContent += `[${timestamp()}] ${line}\n`
}

function setStatus(text) {
  els.status.textContent = text
}

function renderEnv() {
  const rows = [
    ['地址', report.href],
    ['安全上下文', report.secureContext ? '是（可申请定位）' : '否（现代浏览器会拒绝或降级定位）'],
    ['Geolocation API', 'geolocation' in navigator ? '支持' : '不支持'],
    ['定位权限', report.permissionState],
    ['应用侧精度阈值', `≤ ${APP_MAX_ACCURACY_METERS} 米`],
  ]
  els.env.innerHTML = ''
  for (const [label, value] of rows) {
    const li = document.createElement('li')
    li.textContent = `${label}：${value}`
    els.env.appendChild(li)
  }
}

function setVerdict(kind, text) {
  els.verdict.className = kind
  els.verdict.textContent = text
}

/** 读取浏览器的定位权限状态；老浏览器没有 Permissions API 时返回 unknown */
async function readPermissionState() {
  if (!navigator.permissions?.query) return 'unknown（浏览器不支持 Permissions API）'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unknown（查询被拒绝）'
  }
}

/**
 * 采样一组定位读数
 * @param {{ label: string, enableHighAccuracy: boolean, timeout: number, maximumAge: number }} options
 */
function sampleGroup(options) {
  return new Promise(resolve => {
    const samples = []
    const errors = []
    const startedAt = Date.now()
    let watchId = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (activeWatchId === watchId) activeWatchId = null
      clearTimeout(timer)
      resolve({ ...options, samples, errors })
    }

    const timer = setTimeout(finish, SAMPLE_DURATION_MS)

    watchId = navigator.geolocation.watchPosition(
      position => {
        const accuracy = Math.round(position.coords.accuracy)
        samples.push({
          accuracy,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          altitude: position.coords.altitude === null ? null : Math.round(position.coords.altitude),
          heading: Number.isFinite(position.coords.heading) ? Math.round(position.coords.heading) : null,
          speed: Number.isFinite(position.coords.speed) ? Number(position.coords.speed.toFixed(2)) : null,
          elapsedMs: Date.now() - startedAt,
          at: timestamp(),
        })
        appendLog(`${options.label}：第 ${samples.length} 次读数，精度 ±${accuracy} 米，用时 ${Date.now() - startedAt} 毫秒`)
        const usable = samples.filter(item => item.accuracy <= APP_MAX_ACCURACY_METERS).length
        setStatus(`${options.label}：已收到 ${samples.length} 次读数，其中 ${usable} 次达到应用阈值`)
      },
      error => {
        // 同一组内错误通常重复出现，只记录首次
        if (errors.length) return
        errors.push({ code: error.code, message: error.message || '' })
        appendLog(`${options.label}：定位失败，code=${error.code} ${error.message || ''}`)
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      },
    )
    activeWatchId = watchId

    if (running) setStatus(`${options.label}：正在采样，最多 ${SAMPLE_DURATION_MS / 1000} 秒`)
  })
}

function summarize(group) {
  const accuracies = group.samples.map(item => item.accuracy)
  const best = accuracies.length ? Math.min(...accuracies) : null
  const worst = accuracies.length ? Math.max(...accuracies) : null
  const usable = accuracies.filter(value => value <= APP_MAX_ACCURACY_METERS).length
  return {
    label: group.label,
    enableHighAccuracy: group.enableHighAccuracy,
    timeout: group.timeout,
    maximumAge: group.maximumAge,
    readings: accuracies.length,
    usableReadings: usable,
    bestAccuracyMeters: best,
    worstAccuracyMeters: worst,
    firstFixDelayMs: group.samples.length ? group.samples[0].elapsedMs : null,
    errorCount: group.errors.length,
    firstErrorCode: group.errors.length ? group.errors[0].code : null,
    firstErrorMessage: group.errors.length ? group.errors[0].message : '',
    samples: group.samples,
  }
}

function describeError(code) {
  if (code === 1) return '权限被拒绝（PERMISSION_DENIED）：站点或系统未授权定位'
  if (code === 2) return '位置不可用（POSITION_UNAVAILABLE）：系统定位关闭或定位提供方不可用'
  if (code === 3) return '请求超时（TIMEOUT）：在超时时间内没有拿到任何定位'
  return `未知错误 code=${code}`
}

/**
 * 依据四组采样给出结论：
 * A 修复后首帧、B 修复后改善通道、C 旧版导览参数、D 放宽缓存的高精度。
 * 结论只覆盖本次检测能证实的部分。
 */
function buildVerdict(quick, upgrade, legacy, wide) {
  const legacyStuck = legacy && legacy.readings === 0
  const legacyNote = legacyStuck
    ? `旧版参数（高精度 + 1 秒缓存）在本次检测中 ${SAMPLE_DURATION_MS / 1000} 秒内一次回调都没有，与线上表现一致。`
    : ''

  if (report.permissionState === 'denied' || quick?.firstErrorCode === 1) {
    return {
      kind: 'fail',
      text: '结论：定位权限被拒绝。请先在浏览器站点设置里允许定位，并在系统设置里给该浏览器开启定位权限，然后重新检测。',
    }
  }
  if (!quick || quick.readings === 0) {
    const reason = quick?.firstErrorCode === 2
      ? '位置不可用，多为系统定位总开关关闭，或该浏览器缺少可用的定位提供方（部分国产 ROM 缺少 Google Play Services 时会出现）'
      : quick?.firstErrorCode === 3
        ? '请求超时，通常是定位提供方被系统冻结或室内无信号'
        : '没有拿到任何回调'
    return {
      kind: 'fail',
      text: `结论：修复后的首帧通道同样拿不到定位（${reason}）。请到室外重试；若室外仍如此，属于设备或浏览器层面的定位能力缺失，需要换设备或换宿主。`,
    }
  }

  const quickOk = quick.usableReadings > 0
  const parts = [
    `A 组 ${quick.readings} 次读数、最佳 ±${quick.bestAccuracyMeters} 米、首帧用时 ${quick.firstFixDelayMs} 毫秒`,
    `B 组 ${upgrade?.readings ?? 0} 次读数${upgrade?.bestAccuracyMeters ? `、最佳 ±${upgrade.bestAccuracyMeters} 米` : ''}`,
    `C 组 ${legacy?.readings ?? 0} 次读数`,
    `D 组 ${wide?.readings ?? 0} 次读数`,
  ].join('；')

  if (quickOk && legacyStuck) {
    return {
      kind: 'pass',
      text: `结论：修复生效。${parts}。A 首帧在 ${quick.firstFixDelayMs} 毫秒内给出 ±${quick.bestAccuracyMeters} 米的可用定位，而 C 旧版参数 ${SAMPLE_DURATION_MS / 1000} 秒内没有任何回调——这就是导览页"定位精度不足"的成因，现已绕开。`,
    }
  }
  if (quickOk) {
    return {
      kind: 'pass',
      text: `结论：定位可用。${parts}。${legacyNote}导览页应能正常使用地图定位、跟随与近站讲解；若仍提示精度不足，请把完整结果发回继续排查。`,
    }
  }
  return {
    kind: 'warn',
    text: `结论：能定位但精度不足，A 组最佳 ±${quick.bestAccuracyMeters} 米，未达到应用阈值（≤ ${APP_MAX_ACCURACY_METERS} 米）。${parts}。${legacyNote}可到室外重试确认；若室外仍如此，需要放宽判定阈值或依赖手动选站。`,
  }
}

async function run() {
  if (running) return
  if (!('geolocation' in navigator)) {
    setVerdict('fail', '结论：当前浏览器不支持 Geolocation API。')
    appendLog('navigator.geolocation 不存在')
    return
  }

  running = true
  els.run.disabled = true
  els.stop.disabled = false
  els.log.textContent = ''
  report.groups = []
  report.permissionState = await readPermissionState()
  renderEnv()
  appendLog(`开始检测：安全上下文=${report.secureContext}，权限=${report.permissionState}`)
  if (!report.secureContext) appendLog('提示：非安全上下文下定位会被浏览器拒绝或降级')

  const groups = [
    { label: 'A 快速首帧（修复后首帧：不强制高精度）', enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
    { label: 'B 改善通道（修复后第二步：强制高精度）', enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    { label: 'C 旧版参数（导览原实现：高精度+短缓存）', enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    { label: 'D 高精度对照组（放宽缓存的高精度）', enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
  ]

  const summaries = []
  for (const group of groups) {
    if (!running) break
    appendLog(`--- ${group.label}：采样 ${SAMPLE_DURATION_MS / 1000} 秒 ---`)
    const result = await sampleGroup(group)
    const summary = summarize(result)
    summaries.push(summary)
    report.groups.push(summary)
    appendLog(
      `${group.label}：读数 ${summary.readings} 次，达标 ${summary.usableReadings} 次，`
      + `最佳 ${summary.bestAccuracyMeters ?? '—'} 米，最差 ${summary.worstAccuracyMeters ?? '—'} 米`,
    )
    if (summary.firstErrorCode !== null) appendLog(`${group.label}：${describeError(summary.firstErrorCode)}`)
  }

  if (!summaries.length) {
    running = false
    els.run.disabled = false
    els.stop.disabled = true
    return
  }

  const verdict = buildVerdict(summaries[0], summaries[1], summaries[2], summaries[3])
  report.verdict = verdict.text
  setVerdict(verdict.kind, verdict.text)
  report.finishedAt = new Date().toISOString()
  appendLog('检测结束')

  running = false
  els.run.disabled = false
  els.stop.disabled = true
  setStatus('检测完成，可复制结果')
}

function stop() {
  if (!running) return
  running = false
  if (activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId)
    activeWatchId = null
  }
  appendLog('已手动停止')
  setStatus('已手动停止')
  els.run.disabled = false
  els.stop.disabled = true
}

async function copyReport() {
  const text = JSON.stringify(report, null, 2)
  try {
    await navigator.clipboard.writeText(text)
    setStatus('检测结果已复制到剪贴板')
  } catch {
    // 剪贴板在非安全上下文或缺少授权时不可用，退回手动选择
    const range = document.createRange()
    range.selectNodeContents(els.log)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    setStatus('自动复制不可用，已选中下方记录，请长按手动复制')
  }
}

els.run.addEventListener('click', () => { void run() })
els.stop.addEventListener('click', stop)
els.copy.addEventListener('click', () => { void copyReport() })

// 首屏先展示环境信息，便于确认打开的是不是 HTTPS 地址
void (async () => {
  report.permissionState = await readPermissionState()
  renderEnv()
  appendLog(`页面已加载：${report.href}`)
  appendLog(`安全上下文=${report.secureContext}，定位权限=${report.permissionState}`)
})()
