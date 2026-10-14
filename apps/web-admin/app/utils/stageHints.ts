export function buildStageHints(input: string, existing: unknown, createId: () => string) {
  const previous = Array.isArray(existing)
    ? existing.filter((hint): hint is Record<string, unknown> => Boolean(hint) && typeof hint === 'object')
    : []
  const contents = input.split('\n').map(content => content.trim()).filter(Boolean)
  const matched = new Set<number>()
  const matches = contents.map(content => {
    const index = previous.findIndex((hint, hintIndex) =>
      !matched.has(hintIndex) && String(hint.content ?? hint.text ?? '').trim() === content)
    if (index >= 0) matched.add(index)
    return index
  })
  const hints = contents.map((content, index) => {
    const match = matches[index] ?? -1
    const previousContent = String(previous[index]?.content ?? previous[index]?.text ?? '').trim()
    const fallback = match < 0 && previousContent && !matched.has(index) ? index : -1
    if (fallback >= 0) matched.add(fallback)
    const hint = previous[match >= 0 ? match : fallback] ?? {}
    return {
      ...hint,
      hint_id: String(hint.hint_id ?? '').trim() || createId(),
      content,
      sort_order: index + 1,
    }
  })
  for (const hint of previous) {
    if (String(hint.content ?? hint.text ?? '').trim() || !hint.media_url) continue
    hints.push({
      ...hint,
      hint_id: String(hint.hint_id ?? '').trim() || createId(),
      content: '',
      sort_order: hints.length + 1,
    })
  }
  return hints
}
