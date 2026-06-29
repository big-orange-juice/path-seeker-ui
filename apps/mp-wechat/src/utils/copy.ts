export function toSingleSentence(text: string, fallback = "") {
  const normalized = text.trim()

  if (!normalized) {
    return fallback
  }

  const segments = normalized
    .split(/[。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!segments.length) {
    return normalized
  }

  return `${segments[0]}。`
}
