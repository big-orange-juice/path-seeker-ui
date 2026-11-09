import { roomLocale } from './translation-room-messages'
import type { RoomEvent } from './translation-room'

/** 游客提问独立于车夫讲解段号；音频只保留在会话内，不进入页面快照或历史持久化。 */
export interface RoomQuestion {
  id: string
  speakerId: string
  displayName: string
  sourceLanguage: string
  targetLanguage: string
  source: string
  text: string
  status: string
  error: string
  expiresAt: number
  audioAvailable: boolean
}

export interface QuestionAudio { hex: string; format: string }

export class RoomQuestionFeed {
  items: RoomQuestion[] = []
  private audio = new Map<string, QuestionAudio[]>()

  accept(event: RoomEvent): boolean {
    if (event.type !== 'question.updated') return false
    const value = event.payload || {}
    if (typeof value.id !== 'string' || typeof value.speakerId !== 'string') return true
    const previous = this.items.find(item => item.id === value.id)
    if (previous && ['played', 'playing'].includes(previous.status)) return true
    const parts = Array.isArray(value.audio) ? value.audio as QuestionAudio[] : []
    if (parts.length && parts.length <= 100 && parts.reduce((size, part) => size + String(part.hex || '').length, 0) <= 4 * 1024 * 1024
      && parts.every(part => ['mp3', 'wav'].includes(part.format) && /^(?:[0-9a-f]{2})+$/i.test(part.hex))) this.audio.set(value.id, parts)
    const item: RoomQuestion = {
      id: value.id, speakerId: value.speakerId, displayName: String(value.displayName || ''),
      sourceLanguage: String(value.sourceLanguage || ''), targetLanguage: String(value.targetLanguage || ''),
      source: String(value.source || ''), text: String(value.text || ''), status: String(value.status || 'accepted'),
      error: String(value.error || ''), expiresAt: Number(value.expiresAt) || 0, audioAvailable: this.audio.has(value.id),
    }
    this.items = (previous ? this.items.map(entry => entry.id === item.id ? item : entry) : [...this.items, item]).slice(-20)
    const retained = new Set(this.items.map(entry => entry.id))
    for (const id of this.audio.keys()) if (!retained.has(id)) this.audio.delete(id)
    return true
  }

  playable(id: string, now = Date.now()): QuestionAudio[] | null {
    const item = this.items.find(entry => entry.id === id)
    if (!item || !item.audioAvailable || item.expiresAt <= now || !['ready', 'playing'].includes(item.status)) return null
    return this.audio.get(id) || null
  }

  expire(now = Date.now()) {
    this.items = this.items.map(item => {
      if (item.expiresAt > now || !['accepted', 'recognizing', 'translating', 'ready'].includes(item.status)) return item
      this.audio.delete(item.id)
      return { ...item, status: 'expired', audioAvailable: false }
    })
  }

  mark(id: string, status: string) {
    if (status === 'played') this.audio.delete(id)
    this.items = this.items.map(item => item.id === id ? { ...item, status, audioAvailable: this.audio.has(id) } : item)
  }

  discardAudio() {
    this.audio.clear()
    this.items = this.items.map(item => ({ ...item, audioAvailable: false, status: ['accepted', 'recognizing', 'translating', 'ready', 'playing'].includes(item.status) ? 'expired' : item.status }))
  }

  clear() { this.audio.clear(); this.items = [] }
}

/** WAV 头固定为 16 kHz／单声道／16 bit，与后端短录音校验一致。 */
export function questionWav(parts: ArrayBuffer[]): ArrayBuffer {
  const length = parts.reduce((size, part) => size + part.byteLength, 0)
  if (length < 9600 || length > 960000 || length % 2) throw Error('invalid_recording')
  const buffer = new ArrayBuffer(44 + length)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + length, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, length, true)
  let offset = 44
  for (const part of parts) { new Uint8Array(buffer, offset, part.byteLength).set(new Uint8Array(part)); offset += part.byteLength }
  return buffer
}

const labels = {
  'zh-CN': ['对车夫说话', '按住说话，松开发送 · 最长 30 秒', '正在录音，松开发送', '取消', '正在发送提问…', '游客提问', '暂停讲解并收听', '收听提问', '继续讲解', '识别与翻译中…', '等待车夫收听', '正在播放', '已播放', '译音不可用，请阅读译文', '提问失败，请重试', '已过期，请重新提问', '录音太短或格式无效，请重试', '麦克风无法开启，请检查权限', '暂停讲解中，请稍候', '停止播放'],
  yue: ['同車夫講嘢', '撳住講嘢，放手傳送 · 最長 30 秒', '錄音中，放手傳送', '取消', '傳送提問中…', '遊客提問', '暫停講解再收聽', '聽提問', '繼續講解', '辨識同翻譯中…', '等車夫收聽', '播放中', '已播放', '譯音用唔到，請睇譯文', '提問失敗，請再試', '已過期，請再問一次', '錄音太短或格式無效，請再試', '開唔到咪高峰，請檢查權限', '暫停講解中，請稍等', '停止播放'],
  en: ['Talk to the guide', 'Hold to talk, release to send · Max 30 s', 'Recording · Release to send', 'Cancel', 'Sending question…', 'Visitor questions', 'Pause commentary and listen', 'Listen to question', 'Resume commentary', 'Recognizing and translating…', 'Waiting for the guide', 'Playing', 'Played', 'Audio unavailable. Read the translation.', 'Question failed. Please try again.', 'Expired. Please ask again.', 'Recording too short or invalid. Try again.', 'Cannot open microphone. Check permission.', 'Pausing commentary…', 'Stop playback'],
  ja: ['ガイドに話す', '長押しで録音、離して送信 · 最大30秒', '録音中 · 離して送信', 'キャンセル', '質問を送信中…', '参加者の質問', '解説を一時停止して聞く', '質問を聞く', '解説を再開', '音声認識・翻訳中…', 'ガイドの確認待ち', '再生中', '再生済み', '音声を利用できません。訳文をご覧ください。', '質問の送信に失敗しました。再試行してください。', '期限切れです。もう一度質問してください。', '録音が短すぎるか無効です。再試行してください。', 'マイクを開けません。権限をご確認ください。', '解説を一時停止中…', '再生を停止'],
  ko: ['가이드에게 말하기', '길게 눌러 녹음, 놓으면 전송 · 최대 30초', '녹음 중 · 놓으면 전송', '취소', '질문 전송 중…', '방문객 질문', '해설을 일시 중지하고 듣기', '질문 듣기', '해설 재개', '음성 인식 및 번역 중…', '가이드 확인 대기 중', '재생 중', '재생 완료', '음성을 사용할 수 없습니다. 번역문을 읽어 주세요.', '질문 전송 실패. 다시 시도해 주세요.', '만료되었습니다. 다시 질문해 주세요.', '녹음이 너무 짧거나 잘못되었습니다.', '마이크 권한을 확인해 주세요.', '해설 일시 중지 중…', '재생 중지'],
  fr: ['Parler au guide', 'Maintenez pour parler, relâchez pour envoyer · 30 s max', 'Enregistrement · Relâchez pour envoyer', 'Annuler', 'Envoi de la question…', 'Questions des visiteurs', 'Suspendre le commentaire et écouter', 'Écouter la question', 'Reprendre le commentaire', 'Reconnaissance et traduction…', 'En attente du guide', 'Lecture en cours', 'Écouté', 'Audio indisponible. Lisez la traduction.', 'Échec. Veuillez réessayer.', 'Expiré. Posez à nouveau votre question.', 'Enregistrement trop court ou invalide.', 'Vérifiez les autorisations du microphone.', 'Suspension du commentaire…', 'Arrêter la lecture'],
  ru: ['Сказать водителю', 'Удерживайте для записи, отпустите для отправки · До 30 с', 'Запись · Отпустите для отправки', 'Отмена', 'Отправка вопроса…', 'Вопросы гостей', 'Приостановить комментарий и слушать', 'Слушать вопрос', 'Продолжить комментарий', 'Распознавание и перевод…', 'Ожидаем водителя', 'Воспроизводится', 'Прослушано', 'Аудио недоступно. Читайте перевод.', 'Не удалось отправить вопрос. Повторите попытку.', 'Срок истёк. Задайте вопрос снова.', 'Запись слишком короткая или неверного формата.', 'Не удалось включить микрофон. Проверьте разрешение.', 'Приостанавливаем комментарий…', 'Остановить воспроизведение'],
  es: ['Hablar con el guía', 'Mantén para hablar, suelta para enviar · Máx. 30 s', 'Grabando · Suelta para enviar', 'Cancelar', 'Enviando pregunta…', 'Preguntas de visitantes', 'Pausar comentarios y escuchar', 'Escuchar pregunta', 'Reanudar comentarios', 'Reconociendo y traduciendo…', 'Esperando al guía', 'Reproduciendo', 'Reproducido', 'Audio no disponible. Lee la traducción.', 'Error al preguntar. Inténtalo de nuevo.', 'Caducado. Vuelve a preguntar.', 'Grabación demasiado corta o no válida.', 'Comprueba el permiso del micrófono.', 'Pausando comentarios…', 'Detener reproducción'],
}

export function questionMessages(language: string) {
  const value = labels[roomLocale(language)]
  return { talk: value[0]!, hint: value[1]!, recording: value[2]!, cancel: value[3]!, sending: value[4]!, title: value[5]!, pauseListen: value[6]!, listen: value[7]!, resume: value[8]!, processing: value[9]!, ready: value[10]!, playing: value[11]!, played: value[12]!, textOnly: value[13]!, failed: value[14]!, expired: value[15]!, invalidRecording: value[16]!, microphone: value[17]!, pausing: value[18]!, stop: value[19]! }
}

export function questionStatus(status: string, language: string) {
  const value = questionMessages(language)
  return status === 'ready' ? value.ready : status === 'playing' ? value.playing : status === 'played' ? value.played
    : status === 'failed' ? value.failed : status === 'expired' ? value.expired : status === 'text_only' ? value.textOnly : value.processing
}
