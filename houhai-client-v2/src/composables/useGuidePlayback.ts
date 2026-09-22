import { computed, inject, provide, shallowRef, watch, type InjectionKey } from 'vue'
import type { CulturalPlace } from '../types'
import { useNarration } from './useNarration'

const playbackKey: InjectionKey<ReturnType<typeof provideGuidePlayback>> = Symbol('guide-playback')

export function provideGuidePlayback(place: () => CulturalPlace | undefined) {
  const narration = useNarration()
  const selectedId = shallowRef('')
  const versions = computed(() => place()?.guideNarrations ?? [])
  const selected = computed(() => versions.value.find(version => version.id === selectedId.value) ?? versions.value[0])
  const chapters = computed(() => selected.value?.chapters ?? place()?.narration ?? [])
  const text = computed(() => chapters.value.map(chapter => `${chapter.title}。${chapter.text}`).join('\n'))
  const title = computed(() => selected.value?.title ?? place()?.name ?? '')

  watch(() => place()?.id, () => {
    narration.stop()
    selectedId.value = ''
  }, { flush: 'sync' })

  function selectGuide(id: string) {
    if (selected.value?.id === id) return
    narration.stop()
    selectedId.value = id
  }

  function toggle() {
    if (text.value) narration.toggle(text.value)
  }

  const playback = { narration, versions, selected, chapters, title, available: computed(() => !!text.value), selectGuide, toggle }
  provide(playbackKey, playback)
  return playback
}

export function useGuidePlayback() {
  const playback = inject(playbackKey)
  if (!playback) throw new Error('Guide playback requires ExplorerShell')
  return playback
}
