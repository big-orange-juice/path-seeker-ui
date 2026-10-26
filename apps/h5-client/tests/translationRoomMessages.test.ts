import test from 'node:test'
import assert from 'node:assert/strict'
import { ROOM_LANGUAGES, RoomTextFeed } from '../../../packages/ts-shared/src/translation-room.ts'
import { formatRoomMessage, localizeRoomNotice, roomLocale, roomMessages } from '../../../packages/ts-shared/src/translation-room-messages.ts'

test('every supported room language has complete messages and matching interpolation parameters', () => {
  const baseline = roomMessages('zh-CN')
  for (const language of ROOM_LANGUAGES) {
    const dictionary = roomMessages(language.value)
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(baseline).sort(), language.value)
    for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) {
      assert.ok(dictionary[key].trim(), `${language.value}.${key}`)
      assert.deepEqual(dictionary[key].match(/\{\w+\}/g), baseline[key].match(/\{\w+\}/g), `${language.value}.${key}`)
    }
    assert.ok(formatRoomMessage(dictionary.listeners, { count: 12 }).includes('12'))
    assert.ok(formatRoomMessage(dictionary.segment, { number: 3 }).includes('3'))
  }
})

test('locale aliases normalize and unknown locale safely falls back to Chinese', () => {
  for (const language of ['en-US', 'EN_us']) assert.equal(roomLocale(language), 'en')
  for (const language of ['zh-Hant', 'zh-HK', 'zh_TW']) assert.equal(roomLocale(language), 'zh-TW')
  for (const language of ['zh', 'zh-Hans', 'unsupported', 'constructor', 'toString', '']) assert.equal(roomLocale(language), 'zh-CN')
})

test('runtime room messages localize known failures and use local fallback for unknown provider errors', () => {
  for (const language of ROOM_LANGUAGES) {
    const dictionary = roomMessages(language.value)
    assert.equal(localizeRoomNotice('房间人数已满', language.value), dictionary.roomFull)
    assert.equal(localizeRoomNotice('本段翻译中断，请等待下一段讲解', language.value), dictionary.translationUnavailable)
    assert.equal(localizeRoomNotice('译音播放失败：Invalid audio', language.value), dictionary.playbackFailed)
    assert.equal(localizeRoomNotice('', language.value), '')
    if (language.value !== 'zh-CN') {
      assert.equal(localizeRoomNotice('供应商未识别的异常信息', language.value, 'unavailableAudio'), dictionary.unavailableAudio)
      assert.equal(localizeRoomNotice('Provider failure', language.value), dictionary.operationFailed)
    }
  }
})

test('display localization leaves actual speech, translations and stored error data intact', () => {
  const feed = new RoomTextFeed()
  const base = { epochId: 'epoch', targetLanguage: 'en', sequence: 1 }
  feed.accept({ ...base, type: 'translation.committed', payload: { text: '这里是银锭桥。' } })
  feed.accept({ ...base, type: 'translation.final', payload: { text: 'This is Yinding Bridge.' } })
  feed.accept({ ...base, sequence: 2, type: 'translation.final', payload: { text: '' } })
  const original = structuredClone(feed.items)
  const displayed = feed.items.map(item => item.status === 'error' ? localizeRoomNotice(item.text, 'ja', 'translationUnavailable') : item.text)
  assert.equal(displayed[0], 'This is Yinding Bridge.')
  assert.equal(displayed[1], roomMessages('ja').noTranslation)
  assert.deepEqual(feed.items, original)
})
