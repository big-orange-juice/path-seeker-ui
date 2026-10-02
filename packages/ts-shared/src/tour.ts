export const TOUR_LANGUAGES = [
  { value: 'zh', label: '中文', speech: 'zh-CN' },
  { value: 'en', label: 'English', speech: 'en-US' },
  { value: 'ru', label: 'Русский', speech: 'ru-RU' },
  { value: 'es', label: 'Español', speech: 'es-ES' },
] as const

export type TourLocale = typeof TOUR_LANGUAGES[number]['value']

export function isTourLocale(value: unknown): value is TourLocale {
  return TOUR_LANGUAGES.some(language => language.value === value)
}

export function tourLanguageLabel(value: string | null | undefined) {
  return TOUR_LANGUAGES.find(language => language.value === value)?.label ?? value ?? '中文'
}
