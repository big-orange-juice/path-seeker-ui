import { shallowRef } from 'vue'

const ready = shallowRef(false)
const preparing = shallowRef(false)
const notice = shallowRef('')
let pending: Promise<boolean> | null = null

export function useMicrophoneAccess() {
  function prepare() {
    if (pending) return pending
    ready.value = false
    preparing.value = true
    notice.value = '请允许使用麦克风，授权后重新按住说话'
    pending = (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('insecure-context')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        const usable = stream.getAudioTracks().some(track => track.readyState === 'live')
        for (const track of stream.getTracks()) track.stop()
        if (!usable) throw new Error('no-microphone')
        ready.value = true
        notice.value = '麦克风已就绪，请重新按住说话'
        return true
      } catch (caught) {
        const name = caught instanceof Error ? caught.name : ''
        notice.value = name === 'NotAllowedError' || name === 'SecurityError'
          ? '未获得麦克风权限，请在浏览器的网站权限中允许麦克风'
          : name === 'NotReadableError'
            ? '麦克风暂时无法使用，请结束正在使用麦克风的通话或录音'
            : caught instanceof Error && caught.message === 'insecure-context'
              ? '当前页面无法申请麦克风，请使用 HTTPS 地址打开'
              : '没有找到可用的麦克风，请检查设备连接'
        return false
      }
    })()
    void pending.finally(() => {
      preparing.value = false
      pending = null
    })
    return pending
  }

  return { ready, preparing, notice, prepare }
}

export type MicrophoneAccess = ReturnType<typeof useMicrophoneAccess>
