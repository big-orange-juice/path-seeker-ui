/**
 * 播放期「说话即打断」（barge-in）：只在本机算能量，判断用户是否开口。
 *
 * 边界（重要）：
 * - 音频帧不录制、不编码、不上传、不落盘；只把每帧 RMS 拿来做阈值判断，帧数据本身立刻丢弃。
 * - 麦克风只在「有语音在播」的窗口里消费数据；不在播放期时 worklet 的 gate 关闭，帧被直接丢弃。
 * - 不做语音识别，所以打断之后仍需用户打字提问。
 *
 * 判定沿用 duplex demo 的参数：自适应噪声底 + 播放期抬高的阈值与持续帧数，
 * 避免外放时 TTS 自己被当成用户说话（echoCancellation 是前提）。
 */

import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue"

/** 与 demos/duplex-voice config.json 的 voice 段保持一致 */
const DETECTOR = {
  frameSize: 512,
  /** 高于噪声底多少倍才算人声 */
  noiseFloorMultiplier: 3,
  /** 绝对下限，防止安静环境下噪声底过低 */
  minRms: 0.012,
  /** 播放期阈值：必须比环境噪声明显高，避免回声误触发 */
  bargeInRms: 0.03,
  /** 播放期需要连续超过阈值的时长 */
  bargeInHoldMs: 220,
  /** 刚开始播放的一小段不计入，避开起播瞬态 */
  graceMs: 180,
  /** 触发一次后到播放真正停止前的静默期 */
  cooldownMs: 900,
} as const

export interface PlaybackBargeInOptions {
  onBargeIn: () => void
}

export interface PlaybackBargeIn {
  /** 浏览器是否具备 AudioWorklet + getUserMedia */
  supported: ComputedRef<boolean>
  /** 用户开关；关闭后不再提示权限也不再监听 */
  enabled: Ref<boolean>
  /** 麦克风是否已获取 */
  armed: Ref<boolean>
  /** 当前是否正在消费音频帧（播放期） */
  listening: Ref<boolean>
  /** 权限被拒绝；UI 据此提示并自动关闭开关 */
  permissionDenied: Ref<boolean>
  error: ShallowRef<string>
  /** 获取麦克风；必须在用户手势里调用 */
  arm: () => Promise<boolean>
  /**
   * 之前是否已经授权过麦克风。
   * 用于「不要在一次回答中间突然弹权限框」：只有授权过才自动启用，
   * 首次使用交给用户主动点开关。
   */
  hasPermission: () => Promise<boolean>
  /** 进入播放期，开始消费音频帧 */
  listen: () => void
  /** 离开播放期，停止消费音频帧 */
  hold: () => void
  setEnabled: (value: boolean) => void
  dispose: () => void
}

const supported = computed(() => typeof window !== "undefined"
  && "AudioContext" in window
  && "audioWorklet" in (window.AudioContext?.prototype ?? {})
  && Boolean(navigator.mediaDevices?.getUserMedia))

const enabled = ref(true)
const armed = ref(false)
const listening = ref(false)
const permissionDenied = ref(false)
const error = shallowRef("")
const options: PlaybackBargeInOptions = { onBargeIn: () => undefined }

let context: AudioContext | null = null
let stream: MediaStream | null = null
let node: AudioWorkletNode | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let muteNode: GainNode | null = null
let arming: Promise<boolean> | null = null
let noiseFloor = 0.006
let hotFrames = 0
let bargeFrames = 21
let graceUntil = 0
let cooldownUntil = 0

function resetDetector() {
  noiseFloor = 0.006
  hotFrames = 0
  graceUntil = performance.now() + DETECTOR.graceMs
}

function gate(value: boolean) {
  node?.port.postMessage({ type: "gate", value })
  listening.value = value
  if (value) resetDetector()
}

function onFrame(rms: number) {
  if (!listening.value || !enabled.value) return
  const now = performance.now()
  if (now < graceUntil || now < cooldownUntil) return

  const threshold = Math.max(DETECTOR.minRms, noiseFloor * DETECTOR.noiseFloorMultiplier, DETECTOR.bargeInRms)
  if (rms < threshold * 0.7) {
    // 只在明显低于阈值时更新噪声底，避免把语音算进环境噪声
    noiseFloor = noiseFloor * 0.98 + rms * 0.02
    hotFrames = 0
    return
  }

  hotFrames = rms > threshold ? hotFrames + 1 : 0
  if (hotFrames < bargeFrames) return

  hotFrames = 0
  cooldownUntil = now + DETECTOR.cooldownMs
  gate(false)
  options.onBargeIn()
}

async function arm() {
  if (armed.value) return true
  if (!enabled.value || !supported.value) return false
  if (arming) return arming

  arming = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // 回声消除是打断能成立的前提，否则 TTS 会被再次采集、自己打断自己
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      })

      const Ctor = window.AudioContext
      if (!Ctor) throw new Error("no-audio-context")
      if (!context) context = new Ctor({ latencyHint: "interactive" })
      if (context.state !== "running") await context.resume()

      const workletUrl = `${import.meta.env.BASE_URL}worklets/pcm-capture.worklet.js`
      await context.audioWorklet.addModule(workletUrl)

      node = new AudioWorkletNode(context, "pcm-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: { frameSize: DETECTOR.frameSize },
      })
      const frameMs = (DETECTOR.frameSize / context.sampleRate) * 1000
      bargeFrames = Math.max(1, Math.round(DETECTOR.bargeInHoldMs / frameMs))

      // worklet 需要连到输出端才会被持续调度；用 0 增益节点保证听不到
      muteNode = context.createGain()
      muteNode.gain.value = 0
      sourceNode = context.createMediaStreamSource(stream)
      sourceNode.connect(node)
      node.connect(muteNode).connect(context.destination)
      node.port.onmessage = (event) => {
        const rms = Number(event.data?.rms)
        if (Number.isFinite(rms)) onFrame(rms)
      }
      node.port.postMessage({ type: "gate", value: false })

      armed.value = true
      permissionDenied.value = false
      error.value = ""
      return true
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : ""
      permissionDenied.value = name === "NotAllowedError" || name === "SecurityError"
      error.value = permissionDenied.value
        ? "未获得麦克风权限，说话打断不可用；仍可正常听语音回复。"
        : "无法开启麦克风，说话打断不可用；仍可正常听语音回复。"
      enabled.value = false
      release()
      return false
    } finally {
      arming = null
    }
  })()

  return arming
}

function release() {
  gate(false)
  try {
    if (node) node.port.onmessage = null
    sourceNode?.disconnect()
    node?.disconnect()
    muteNode?.disconnect()
  } catch {
    // 断开时的异常忽略
  }
  for (const track of stream?.getTracks() ?? []) track.stop()
  stream = null
  node = null
  sourceNode = null
  muteNode = null
  armed.value = false
  listening.value = false
}

export function usePlaybackBargeIn(hooks?: PlaybackBargeInOptions): PlaybackBargeIn {
  if (hooks) options.onBargeIn = hooks.onBargeIn

  return {
    supported,
    enabled,
    armed,
    listening,
    permissionDenied,
    error,
    arm,
    hasPermission: async () => {
      if (armed.value) return true
      const permissions = navigator.permissions
      if (!permissions?.query) return false
      try {
        const status = await permissions.query({ name: "microphone" as PermissionName })
        return status.state === "granted"
      } catch {
        // 部分浏览器不支持查询麦克风权限，交给用户主动开启
        return false
      }
    },
    listen: () => {
      if (!armed.value || !enabled.value || listening.value) return
      gate(true)
    },
    hold: () => {
      if (!listening.value) return
      gate(false)
    },
    setEnabled: (value: boolean) => {
      enabled.value = value
      if (!value) {
        release()
        permissionDenied.value = false
        error.value = ""
        return
      }
      // 仅在已有权限时静默恢复；否则等下一次用户手势里的 arm()
      if (armed.value) gate(listening.value)
    },
    dispose: () => {
      release()
      void context?.close().catch(() => undefined)
      context = null
      armed.value = false
      listening.value = false
    },
  }
}
