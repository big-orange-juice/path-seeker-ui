import { computed, onUnmounted, shallowRef } from 'vue'
import type { LiveLocation } from '../types'

type LocationState = 'idle' | 'requesting' | 'tracking' | 'error' | 'unsupported'

const refreshInterval = 1000

function errorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return '定位权限未开启，请在浏览器设置中允许访问位置。'
  if (error.code === error.POSITION_UNAVAILABLE) return '暂时无法获取当前位置，请到开阔处后重试。'
  return '定位请求超时，请检查网络和系统定位服务。'
}

export function useLiveLocation() {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const state = shallowRef<LocationState>(supported ? 'idle' : 'unsupported')
  const location = shallowRef<LiveLocation>()
  const error = shallowRef(supported ? '' : '当前浏览器不支持定位。')
  const updatedLabel = shallowRef('')
  let timer: number | undefined
  let requesting = false
  let generation = 0

  function request() {
    if (!supported || requesting || state.value === 'idle') return
    requesting = true
    const requestGeneration = generation
    navigator.geolocation.getCurrentPosition(position => {
      if (requestGeneration !== generation) return
      requesting = false
      location.value = {
        coordinate: [position.coords.longitude, position.coords.latitude],
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }
      updatedLabel.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(position.timestamp)
      error.value = ''
      state.value = 'tracking'
    }, reason => {
      if (requestGeneration !== generation) return
      requesting = false
      error.value = errorMessage(reason)
      state.value = 'error'
      stopTimer()
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 9000 })
  }

  function stopTimer() {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }

  function start() {
    if (!supported) return
    generation += 1
    requesting = false
    stopTimer()
    state.value = 'requesting'
    error.value = ''
    request()
    timer = window.setInterval(request, refreshInterval)
  }

  function stop() {
    generation += 1
    stopTimer()
    requesting = false
    location.value = undefined
    updatedLabel.value = ''
    state.value = 'idle'
    error.value = ''
  }

  onUnmounted(stop)

  return {
    state,
    location,
    error,
    updatedLabel,
    tracking: computed(() => state.value === 'tracking' || state.value === 'requesting'),
    start,
    stop,
  }
}
