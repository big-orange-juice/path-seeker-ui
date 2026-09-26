/**
 * mock 供应商：不填密钥也能验证"打断 + 字幕同步 + 流式播放"完整链路。
 * 音频用 PCM 正弦波模拟，格式固定为 pcm / 24000Hz，与真实链路走同一套事件协议。
 */
let asrCounter = 0;

const MOCK_QUESTIONS = [
  "请用一句话介绍一下你自己",
  "现在几点了",
  "给我讲个冷笑话",
];

export function mockFormat() {
  return { format: "pcm", sampleRate: 24000 };
}

export async function mockTranscribe() {
  const text = MOCK_QUESTIONS[asrCounter % MOCK_QUESTIONS.length];
  asrCounter += 1;
  return text;
}

export const MOCK_REPLY_PREFIX = "我听到的是：";

export async function* mockChat({ userText, signal }) {
  const quote = String(userText || "").replace(/[。！？，、,.!?]+$/, "");
  const reply = `${MOCK_REPLY_PREFIX}${quote}。这是一条模拟回答，用来验证流式播放、字幕同步和随时打断。你可以在我说话的时候直接开口，我会立刻停下来听你说。说完了我再继续回答新的问题。`;
  for (const char of reply) {
    if (signal?.aborted) return;
    await sleep(28, signal);
    yield char;
  }
}

/** 生成一段 PCM16 单声道正弦波，时长随文本长度变化 */
export async function* mockSynthesize({ text, sampleRate, signal }) {
  const durationMs = Math.min(9000, Math.max(700, 210 * [...text].length));
  const total = Math.floor((sampleRate * durationMs) / 1000);
  const chunkSamples = Math.floor(sampleRate * 0.12);
  const maxAmplitude = 5200;
  let played = 0;

  while (played < total) {
    if (signal?.aborted) return;
    const size = Math.min(chunkSamples, total - played);
    const buffer = Buffer.alloc(size * 2);
    for (let i = 0; i < size; i += 1) {
      const t = (played + i) / sampleRate;
      const envelope = 0.65 + 0.35 * Math.sin(2 * Math.PI * 2.2 * t);
      const sample = Math.round(maxAmplitude * envelope * Math.sin(2 * Math.PI * 440 * t));
      buffer.writeInt16LE(sample, i * 2);
    }
    played += size;
    yield { hex: buffer.toString("hex"), isFinal: played >= total, meta: null, extra: null };
    await sleep(60, signal);
  }
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
