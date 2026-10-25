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
  version = 0
  startSequence = 0
  language = ''
  private seen = new Set<string>()

  accept(event: RoomEvent): boolean {
    if (event.type === 'subscription.ready' || event.type === 'subscription.changed') {
      this.version = event.subscriptionVersion ?? 0
      this.startSequence = event.payload?.startSequence ?? 0
      this.language = event.targetLanguage ?? ''
      this.seen.clear()
      return true
    }
    if (event.subscriptionVersion && event.subscriptionVersion !== this.version) return false
    if (event.targetLanguage && event.targetLanguage !== this.language) return false
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

export const ROOM_LANGUAGES = [
  { value: 'zh-CN', label: '中文' }, { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' }, { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
]
