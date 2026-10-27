export interface RoomEvent {
  type: string
  roomId?: string
  epochId?: string
  eventId?: string
  sequence?: number
  subscriptionVersion?: number
  targetLanguage?: string | null
  payload?: Record<string, any>
}

export class RoomEventCursor {
  private allLanguages: boolean
  version = 0
  startSequence = 0
  language = ''
  private seen = new Set<string>()

  constructor(allLanguages = false) { this.allLanguages = allLanguages }

  accept(event: RoomEvent): boolean {
    if (event.type === 'subscription.ready' || event.type === 'subscription.changed') {
      this.version = event.subscriptionVersion ?? 0
      this.startSequence = event.payload?.startSequence ?? 0
      this.language = event.targetLanguage ?? ''
      this.seen.clear()
      return true
    }
    if (event.subscriptionVersion && event.subscriptionVersion !== this.version) return false
    if (!this.allLanguages && event.targetLanguage && event.targetLanguage !== this.language) return false
    if (event.sequence != null && event.sequence < this.startSequence
      && /^(audio\.|text\.|transcript\.|translation\.)/.test(event.type)) return false
    if (event.eventId) {
      if (this.seen.has(event.eventId)) return false
      this.seen.add(event.eventId)
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!)
    }
    return true
  }
}

export interface RoomTextItem {
  id: string
  language: string
  languageLabel: string
  source: string
  text: string
  status: 'translating' | 'complete' | 'error'
  sequence: number
}

export class RoomTextFeed {
  items: RoomTextItem[] = []
  private sources = new Map<string, string>()

  accept(event: RoomEvent) {
    const sourceId = `${event.epochId || ''}:${event.sequence ?? 0}`
    if (event.type === 'transcript.final') {
      const source = String(event.payload?.text || '')
      if (source.trim()) {
        this.sources.set(sourceId, source)
        if (this.sources.size > 120) this.sources.delete(this.sources.keys().next().value!)
        this.items = this.items.map(item => item.id.slice(0, item.id.lastIndexOf(':')) === sourceId ? { ...item, source } : item)
      }
      return this.items
    }
    if (!event.targetLanguage || !['translation.committed', 'text.delta', 'translation.final', 'language.error'].includes(event.type)) return this.items
    const payload = event.payload || {}
    const id = `${event.epochId || ''}:${event.sequence ?? 0}:${event.targetLanguage}`
    const previous = this.items.find(item => item.id === id)
    const item: RoomTextItem = previous ? { ...previous } : {
      id, language: event.targetLanguage,
      languageLabel: ROOM_LANGUAGES.find(language => language.value === event.targetLanguage)?.label || event.targetLanguage,
      source: this.sources.get(sourceId) || '', text: '', status: 'translating', sequence: event.sequence ?? 0,
    }
    if (event.type === 'translation.committed' && !this.sources.has(sourceId) && String(payload.text || '').trim()) item.source = String(payload.text)
    if (event.type === 'text.delta') item.text += String(payload.content || '')
    if (event.type === 'translation.final') {
      const finalText = String(payload.text || '')
      if (finalText.trim()) { item.text = finalText; item.status = 'complete' }
      else if (item.text.trim() && item.status !== 'error') item.status = 'complete'
      else {
        item.text = item.status === 'error' ? item.text : '本段未生成译文，请等待下一段讲解'
        item.status = 'error'
      }
    }
    if (event.type === 'language.error') { item.text = String(payload.message || '本段翻译暂不可用'); item.status = 'error' }
    this.items = (previous ? this.items.map(entry => entry.id === id ? item : entry) : [...this.items, item]).slice(-60)
    return this.items
  }

  clear() { this.items = []; this.sources.clear() }
}

export function groupRoomMessages(items: RoomTextItem[]) {
  const groups = new Map<string, { id: string; sequence: number; source: string; translations: RoomTextItem[] }>()
  for (const item of items) {
    const separator = item.id.lastIndexOf(':')
    const id = separator < 0 ? item.id : item.id.slice(0, separator)
    let group = groups.get(id)
    if (!group) {
      group = { id, sequence: item.sequence, source: '', translations: [] }
      groups.set(id, group)
    }
    if (!group.source && item.source) group.source = item.source
    group.translations.push(item)
  }
  return [...groups.values()]
}

export const ROOM_LANGUAGES = [
  { value: 'zh-CN', label: '中文' }, { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' }, { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
]
