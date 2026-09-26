/**
 * 句子切分：把 LLM 增量文本切成"可朗读短句"。
 * 目的有两个：① 让 TTS 尽早开始（首句尽量短）；② 用句子作为字幕与音频对齐的最小单位。
 */

const HARD_BREAK = /[。！？!?…；;\n]/;
const SOFT_BREAK = /[，,、：:]/;
const TRAILING_MARK = /[”’"'）)\]】》」』]/;

export function createSegmenter(onSentence, options = {}) {
  const firstMin = options.firstMin ?? 8; // 首句放宽：出现逗号就可以切，尽快出声
  const min = options.min ?? 16;
  const max = options.max ?? 72;
  let buffer = "";

  function flush() {
    const text = buffer.trim();
    buffer = "";
    if (text) onSentence(text);
    return text;
  }

  function push(delta) {
    buffer += delta;
    for (;;) {
      const cut = findCut(buffer, buffer.length === delta.length ? firstMin : min);
      if (cut <= 0) break;
      const sentence = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut);
      if (sentence) onSentence(sentence);
    }
  }

  function findCut(text, softMin) {
    for (let i = 0; i < text.length; i += 1) {
      if (!HARD_BREAK.test(text[i])) continue;
      // 把句末引号、括号一起带上
      let end = i + 1;
      while (end < text.length && TRAILING_MARK.test(text[end])) end += 1;
      return end;
    }
    if (text.length >= softMin) {
      for (let i = text.length - 1; i >= 0; i -= 1) {
        if (SOFT_BREAK.test(text[i])) return i + 1;
      }
    }
    if (text.length >= max) {
      for (let i = max; i > max - 16 && i > 0; i -= 1) {
        if (SOFT_BREAK.test(text[i - 1]) || HARD_BREAK.test(text[i - 1])) return i;
      }
      return max;
    }
    return 0;
  }

  return { push, flush };
}

/** TTS 朗读前清洗：去掉 Markdown 标记与代码块，避免把符号读出来 */
export function toSpeakable(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " 代码省略 ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[\s>*+-]+/gm, "")
    .replace(/[*_#>~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
