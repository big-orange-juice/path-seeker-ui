export function createTranslationPlayer(ctx, onState, onError) {
  let generation = 0;
  let pending = [];
  let queue = Promise.resolve();
  let queued = 0;
  let decoding = 0;
  let playhead = 0;
  let format = "mp3";
  let sampleRate = 32000;
  let maxQueueSeconds = Infinity;
  const sources = new Set();
  function busy() { return Boolean(sources.size || decoding || queued || pending.length); }
  function stop() {
    generation += 1;
    for (const source of sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sources.clear();
    pending = [];
    queue = Promise.resolve();
    queued = 0;
    decoding = 0;
    playhead = 0;
    onState(false);
  }
  function configure(options) {
    if (options.format && !["mp3", "pcm"].includes(options.format)) throw new Error(`不支持的音频格式：${options.format}`);
    format = options.format || format;
    sampleRate = Number(options.sampleRate) || sampleRate;
    if (Number.isFinite(options.maxQueueSeconds)) maxQueueSeconds = options.maxQueueSeconds;
  }
  function push(payload) {
    configure(payload);
    if (payload.encoding && payload.encoding !== "hex") throw new Error("仅支持 hex 音频编码");
    if (payload.audio) {
      if (!/^(?:[\da-f]{2})+$/i.test(payload.audio)) throw new Error("音频 hex 数据无效");
      const bytes = new Uint8Array(payload.audio.length / 2);
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(payload.audio.slice(index * 2, index * 2 + 2), 16);
      pending.push(bytes);
    }
    if (format === "pcm" || payload.isFinal) flush();
  }
  function flush() {
    if (!pending.length) return;
    const parts = pending;
    const current = generation;
    const currentFormat = format;
    const currentSampleRate = sampleRate;
    pending = [];
    queued += 1;
    queue = queue.then(async () => {
      if (current !== generation) return;
      queued -= 1;
      decoding += 1;
      try {
        const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
        let offset = 0;
        for (const part of parts) { bytes.set(part, offset); offset += part.length; }
        let buffer;
        if (currentFormat === "pcm") {
          if (bytes.length % 2) throw new Error("PCM 分片不是完整的 16bit 采样");
          buffer = ctx.createBuffer(1, bytes.length / 2, currentSampleRate);
          const channel = buffer.getChannelData(0);
          const view = new DataView(bytes.buffer);
          for (let index = 0; index < channel.length; index += 1) channel[index] = view.getInt16(index * 2, true) / 32768;
        } else buffer = await ctx.decodeAudioData(bytes.buffer);
        if (current !== generation) return;
        if (playhead - ctx.currentTime + buffer.duration > maxQueueSeconds) {
          stop();
          onError(new Error("收听积压超过两分钟，请重新接入最新讲解"));
          return;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const start = Math.max(ctx.currentTime + 0.03, playhead);
        source.onended = () => { sources.delete(source); source.disconnect(); onState(busy()); };
        sources.add(source);
        source.start(start);
        playhead = start + buffer.duration;
      } catch (error) {
        if (current === generation) onError(error);
      } finally {
        if (current === generation) { decoding -= 1; onState(busy()); }
      }
    });
  }
  function discardPending() { pending = []; }
  return { busy, stop, configure, push, flush, discardPending };
}
