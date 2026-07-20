/** 去掉常见 Markdown 标记，供 TTS 朗读。 */
export function stripMarkdownForSpeech(input: string): string {
  return String(input || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

const HARD_END = /[。！？；…\n]/
const SOFT_END = /[，、,;：:]/

export interface SentencePullResult {
  sentences: string[]
  rest: string
}

/**
 * 从流式缓冲中尽量抽出完整句子。
 * - 硬边界：。！？；… 换行
 * - 缓冲过长时在逗号等软边界切分
 */
export function pullSpeakableSentences(
  buffer: string,
  options: { softLimit?: number; hardLimit?: number; flush?: boolean } = {},
): SentencePullResult {
  const softLimit = options.softLimit ?? 48
  const hardLimit = options.hardLimit ?? 96
  const flush = options.flush === true

  let rest = buffer
  const sentences: string[] = []

  const pushChunk = (raw: string) => {
    const cleaned = stripMarkdownForSpeech(raw)
    if (cleaned) {
      sentences.push(cleaned)
    }
  }

  while (rest.length > 0) {
    let cut = -1
    for (let i = 0; i < rest.length; i += 1) {
      if (HARD_END.test(rest[i] || "")) {
        cut = i + 1
        break
      }
    }

    if (cut > 0) {
      pushChunk(rest.slice(0, cut))
      rest = rest.slice(cut)
      continue
    }

    if (rest.length >= softLimit) {
      let softCut = -1
      const searchFrom = Math.min(rest.length, hardLimit)
      for (let i = searchFrom - 1; i >= Math.floor(softLimit * 0.45); i -= 1) {
        if (SOFT_END.test(rest[i] || "")) {
          softCut = i + 1
          break
        }
      }
      if (softCut > 0) {
        pushChunk(rest.slice(0, softCut))
        rest = rest.slice(softCut)
        continue
      }
    }

    if (rest.length >= hardLimit) {
      pushChunk(rest.slice(0, hardLimit))
      rest = rest.slice(hardLimit)
      continue
    }

    break
  }

  if (flush && rest.trim()) {
    pushChunk(rest)
    rest = ""
  }

  return { sentences, rest }
}
