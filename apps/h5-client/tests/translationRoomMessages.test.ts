import test from 'node:test'
import assert from 'node:assert/strict'
import { ROOM_LANGUAGES, RoomTextFeed } from '../../../packages/ts-shared/src/translation-room.ts'
import { formatRoomMessage, localizeRoomNotice, roomLocale, roomMessages } from '../../../packages/ts-shared/src/translation-room-messages.ts'
import { tourMessages } from '../src/utils/tourMessages.ts'
import { isTourLocale, matchesTourSpeechLanguage, TOUR_LANGUAGES } from '../../../packages/ts-shared/src/tour.ts'

test('tour and room selectors expose the same eight languages in the same order', () => {
  const expected = ['zh', 'en', 'ru', 'es', 'fr', 'ja', 'ko', 'yue']
  assert.deepEqual(TOUR_LANGUAGES.map(language => language.value), expected)
  assert.deepEqual(ROOM_LANGUAGES.map(language => language.value === 'zh-CN' ? 'zh' : language.value), expected)
  assert.deepEqual(ROOM_LANGUAGES.map(language => language.label), TOUR_LANGUAGES.map(language => language.label))
  assert.equal(isTourLocale('de'), false)
  assert.equal(isTourLocale('zh-TW'), false)
  for (const language of ['ko', 'yue'] as const) {
    const dictionary = tourMessages(language), baseline = tourMessages('zh')
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(baseline).sort())
    for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) {
      assert.ok(dictionary[key].trim(), `${language}.${key}`)
      assert.deepEqual(dictionary[key].match(/\{\w+\}/g), baseline[key].match(/\{\w+\}/g), `${language}.${key}`)
    }
  }
})

test('speech selection distinguishes Cantonese voices from Mandarin voices', () => {
  for (const voice of ['zh-HK', 'yue-HK', 'yue', 'zh-yue', 'ZH_hk']) {
    assert.equal(matchesTourSpeechLanguage(voice, 'yue'), true)
    assert.equal(matchesTourSpeechLanguage(voice, 'zh'), false)
  }
  for (const voice of ['zh-CN', 'zh-TW', 'zh-Hans']) {
    assert.equal(matchesTourSpeechLanguage(voice, 'yue'), false)
    assert.equal(matchesTourSpeechLanguage(voice, 'zh'), true)
  }
  assert.equal(matchesTourSpeechLanguage('ko-KR', 'ko'), true)
  assert.equal(matchesTourSpeechLanguage('en-US', 'ko'), false)
})

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
  for (const language of ['yue', 'yue-HK', 'zh-yue', 'zh-HK']) assert.equal(roomLocale(language), 'yue')
  for (const language of ['ru-RU', 'RU_ru']) assert.equal(roomLocale(language), 'ru')
  for (const language of ['zh-Hant', 'zh_TW', 'de']) assert.equal(roomLocale(language), 'zh-CN')
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

test('navigation room entry and account labels follow every supported tour language', () => {
  const baseline = tourMessages('zh')
  for (const language of ['en', 'ru', 'es', 'fr', 'ja', 'ko', 'yue'] as const) {
    const dictionary = tourMessages(language)
    for (const key of ['liveCommentary', 'commentaryRoom', 'login', 'account', 'manageAccount', 'accountLogin', 'tourTitle', 'cityTour', 'allDestinations', 'map2dHint', 'switchJourney', 'switchJourneyConfirm', 'endJourneyConfirm', 'locationHint', 'locationAccuracy', 'confirm', 'cancel'] as const) {
      assert.ok(dictionary[key].trim())
      if (language !== 'yue') assert.notEqual(dictionary[key], baseline[key], `${language}.${key}`)
      assert.deepEqual(dictionary[key].match(/\{\w+\}/g), baseline[key].match(/\{\w+\}/g), `${language}.${key}`)
    }
  }
  assert.equal(tourMessages('en').liveCommentary, 'Live commentary')
  assert.equal(tourMessages('en').commentaryRoom, 'Room')
  assert.equal(tourMessages('en').login, 'Sign in')
})
