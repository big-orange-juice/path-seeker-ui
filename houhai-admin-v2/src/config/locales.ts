import type { Locale } from '../types'

/** 内容语言清单：与 C 端讲解语言保持一致，B 端界面与操作文案仍为中文。 */
export const contentLocales: { id: Locale; label: string; short: string; speech: string }[] = [
  { id: 'zh', label: '中文', short: '中', speech: 'zh-CN' },
  { id: 'en', label: 'English', short: 'EN', speech: 'en-US' },
  { id: 'ru', label: 'Русский', short: 'RU', speech: 'ru-RU' },
  { id: 'es', label: 'Español', short: 'ES', speech: 'es-ES' },
]

export function localeLabel(locale: Locale): string {
  return contentLocales.find(item => item.id === locale)?.label ?? locale
}

export function localeShort(locale: Locale): string {
  return contentLocales.find(item => item.id === locale)?.short ?? locale
}
