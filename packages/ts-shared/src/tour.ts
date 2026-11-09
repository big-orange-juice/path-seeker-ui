export const TOUR_LANGUAGES = [
  { value: 'zh', label: '中文', speech: 'zh-CN' },
  { value: 'en', label: 'English', speech: 'en-US' },
  { value: 'ru', label: 'Русский', speech: 'ru-RU' },
  { value: 'es', label: 'Español', speech: 'es-ES' },
  { value: 'fr', label: 'Français', speech: 'fr-FR' },
  { value: 'ja', label: '日本語', speech: 'ja-JP' },
  { value: 'ko', label: '한국어', speech: 'ko-KR' },
  { value: 'yue', label: '粤语', speech: 'zh-HK' },
] as const

export type TourLocale = typeof TOUR_LANGUAGES[number]['value']

export function isTourLocale(value: unknown): value is TourLocale {
  return TOUR_LANGUAGES.some(language => language.value === value)
}

export function tourLanguageLabel(value: string | null | undefined) {
  return TOUR_LANGUAGES.find(language => language.value === value)?.label ?? value ?? '中文'
}

export function matchesTourSpeechLanguage(language: string, locale: TourLocale): boolean {
  const normalized = language.replace(/_/g, '-').toLowerCase()
  const cantonese = /^(yue|zh-yue)(-|$)/.test(normalized) || normalized === 'zh-hk'
  if (locale === 'yue') return cantonese
  if (locale === 'zh') return normalized.split('-')[0] === 'zh' && !cantonese
  return normalized.split('-')[0] === locale
}
