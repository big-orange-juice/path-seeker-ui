/**
 * 有序 TTS 流水线：
 * - 允许提前向后两家（maxLookahead）发起合成，缩短句间空档；
 * - 但给客户端的分片必须严格按句子顺序输出（第 i 句没发完，绝不发第 i+1 句），
 *   否则前端按顺序拼接 MP3/PCM 会decode失败或串音。
 */
import { DemoError, isAbortError } from "./errors.js";
import { synthesizeSentence } from "./minimax.js";
import { mockSynthesize } from "./mock.js";

export class OrderedTtsPipeline {
  constructor({ config, emitChunk, maxLookahead = 2 }) {
    this.config = config;
    this.emitChunk = emitChunk;
    this.maxLookahead = maxLookahead;
    this.items = [];
    this.head = 0;
    this.running = 0;
    this.finished = false;
    this.aborted = false;
    this.failure = null;
    this.doneResolved = false;
    this.controller = new AbortController();
    this.donePromise = new Promise((resolve) => {
      this.resolveDone = resolve;
    });
  }

  push(text) {
    const item = { index: this.items.length, text, queue: [], done: false, started: false, error: null, finalEmitted: false };
    this.items.push(item);
    this.#maybeStart();
    return item;
  }

  abort() {
    this.aborted = true;
    this.controller.abort();
    this.#resolveDone();
  }

  async finish() {
    this.finished = true;
    this.#resolveDone();
    await this.donePromise;
    if (this.failure) throw this.failure;
    if (this.aborted) throw new DemoError("aborted", "已被打断");
  }

  #maybeStart() {
    while (!this.aborted && !this.failure && this.running < this.maxLookahead) {
      const next = this.items.find((item) => !item.started);
      if (!next) return;
      next.started = true;
      this.running += 1;
      void this.#run(next);
    }
  }

  async #run(item) {
    try {
      const signal = this.controller.signal;
      const stream = this.config.mock.enabled
        ? mockSynthesize({ text: item.text, sampleRate: this.config.minimax.sampleRate, signal })
        : synthesizeSentence({ config: this.config, text: item.text, signal });
      for await (const chunk of stream) {
        item.queue.push(chunk);
        this.#pump();
      }
    } catch (error) {
      if (!isAbortError(error)) item.error = error;
    } finally {
      item.done = true;
      this.running -= 1;
      this.#pump();
      this.#maybeStart();
    }
  }

  #pump() {
    while (!this.aborted && !this.failure && this.head < this.items.length) {
      const item = this.items[this.head];
      while (item.queue.length) {
        const chunk = item.queue.shift();
        if (chunk.isFinal) item.finalEmitted = true;
        this.emitChunk(item, chunk);
      }
      if (item.error) {
        this.failure = item.error;
        this.controller.abort();
        this.#resolveDone();
        return;
      }
      if (!item.done) return;
      if (!item.finalEmitted) this.emitChunk(item, { hex: "", isFinal: true, meta: null, extra: null });
      this.head += 1;
    }
    this.#resolveDone();
  }

  #resolveDone() {
    if (this.doneResolved) return;
    const allDone = this.finished && this.head >= this.items.length;
    if (this.aborted || this.failure || allDone) {
      this.doneResolved = true;
      this.resolveDone();
    }
  }
}
