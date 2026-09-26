/**
 * 一轮对话的编排：ASR -> DeepSeek -> 切句 -> TTS -> 下发。
 * 打断语义：
 *  1. 客户端 VAD 听到人声后先发 /api/barge-in，服务端立即 abort 掉在飞的 LLM/TTS 请求；
 *  2. 客户端同时把还没播出的音频分片丢掉（本地完成，不等网络）；
 *  3. 用户说完整句后带 heardText（实际听到的半句）再发 /api/turn，服务端把它补进上下文，
 *     近似实现"按播放位置回填对话历史"。
 */
import { streamChat } from "./deepseek.js";
import { DemoError, isAbortError } from "./errors.js";
import { transcribeWav } from "./minimax.js";
import { mockChat, mockFormat, mockTranscribe } from "./mock.js";
import { createSegmenter, toSpeakable } from "./segmenter.js";
import { OrderedTtsPipeline } from "./tts-pipeline.js";

export class VoiceSession {
  constructor({ id, config, sendFrame, log = console.log }) {
    this.id = id;
    this.config = config;
    this.sendFrame = sendFrame;
    this.log = log;
    this.systemMessage = { role: "system", content: config.deepseek.systemPrompt };
    this.history = [this.systemMessage];
    this.current = null;
  }

  emit(event, data = {}) {
    this.sendFrame({ event, data });
  }

  /** 建连后同步给前端的参数（音频格式、VAD 阈值），保证配置文件是唯一事实来源 */
  hello() {
    const audio = this.config.mock.enabled
      ? { ...mockFormat(), voiceId: "mock-tone" }
      : { format: this.config.minimax.format, sampleRate: this.config.minimax.sampleRate, voiceId: this.config.minimax.voiceId };
    this.emit("hello", {
      session: this.id,
      mock: this.config.mock.enabled,
      model: this.config.mock.enabled ? "mock" : this.config.deepseek.model,
      audio,
      voice: this.config.voice,
    });
  }

  abortCurrent({ reason = "user", notify = true } = {}) {
    const run = this.current;
    if (!run) return false;
    this.current = null;
    run.controller.abort();
    run.pipeline?.abort();
    if (notify) this.emit("interrupted", { turnKey: run.turnKey, reason });
    this.log(`[session ${this.id}] turn ${run.turnKey} 已打断（${reason}）`);
    return true;
  }

  reset() {
    this.abortCurrent({ notify: false, reason: "reset" });
    this.history = [this.systemMessage];
    this.emit("session.reset", { session: this.id });
  }

  async handleTurn({ turnKey, text = "", audioBase64 = "", heardText = "" }) {
    this.abortCurrent({ reason: "superseded-turn", notify: true });

    const controller = new AbortController();
    const signal = controller.signal;
    const run = { turnKey, controller, pipeline: null, startedAt: Date.now(), sentenceCount: 0 };
    this.current = run;
    const metrics = { asrMs: null, firstTextMs: null, firstAudioMs: null };
    const hasAudio = typeof audioBase64 === "string" && audioBase64.length > 0;

    this.emit("turn.start", { turnKey, source: hasAudio ? "voice" : "text" });

    try {
      if (heardText.trim()) {
        this.history.push({ role: "assistant", content: `（上一条回答被打断，用户只听到）${heardText.trim()}` });
      }

      let userText = String(text || "").trim();
      if (!userText && hasAudio) {
        const startedAt = Date.now();
        this.emit("asr.start", { turnKey });
        const wavBuffer = Buffer.from(audioBase64, "base64");
        userText = this.config.mock.enabled
          ? await mockTranscribe()
          : await transcribeWav({ config: this.config, wavBuffer, signal });
        metrics.asrMs = Date.now() - startedAt;
        this.emit("asr.result", { turnKey, text: userText, ms: metrics.asrMs });
      }
      if (!userText) throw new DemoError("asr_empty", "没有识别到有效内容，请再说一次");
      if (signal.aborted) return;

      this.history.push({ role: "user", content: userText });
      this.emit("user.text", { turnKey, text: userText });

      const pipeline = new OrderedTtsPipeline({
        config: this.config,
        emitChunk: (item, chunk) => {
          if (signal.aborted) return;
          if (metrics.firstAudioMs === null && chunk.hex) metrics.firstAudioMs = Date.now() - run.startedAt;
          this.emit("audio.chunk", {
            turnKey,
            index: item.index,
            hex: chunk.hex,
            isFinal: Boolean(chunk.isFinal),
            meta: chunk.meta ?? null,
          });
        },
      });
      run.pipeline = pipeline;

      const segmenter = createSegmenter((sentence) => {
        const speakable = toSpeakable(sentence);
        if (!speakable) return;
        const index = run.sentenceCount;
        run.sentenceCount += 1;
        if (metrics.firstTextMs === null) metrics.firstTextMs = Date.now() - run.startedAt;
        this.emit("text.delta", { turnKey, index, text: sentence });
        pipeline.push(speakable);
      });

      let fullText = "";
      const stream = this.config.mock.enabled
        ? mockChat({ userText, signal })
        : streamChat({ config: this.config, messages: this.history.slice(-13), signal });
      for await (const delta of stream) {
        fullText += delta;
        segmenter.push(delta);
      }
      segmenter.flush();
      await pipeline.finish();
      if (signal.aborted) return;

      this.history.push({ role: "assistant", content: fullText });
      this.#trimHistory();
      this.emit("turn.done", { turnKey, totalMs: Date.now() - run.startedAt, ...metrics });
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return;
      this.log(`[session ${this.id}] turn ${turnKey} 失败：${error?.message || error}`);
      this.emit("error", {
        turnKey,
        code: error?.code || "turn_failed",
        message: error?.message || String(error),
      });
    } finally {
      if (this.current === run) this.current = null;
    }
  }

  #trimHistory() {
    const limit = 12;
    if (this.history.length <= limit + 1) return;
    this.history = [this.systemMessage, ...this.history.slice(-limit)];
  }
}
