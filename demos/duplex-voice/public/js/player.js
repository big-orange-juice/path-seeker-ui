/**
 * 流式播放器：
 * - 用 WebAudio 时钟排期（source.start(时间点)），句子之间自然衔接，不用 <audio> 逐段播；
 * - 严格按句子序号排期：第 i 句解码完成但第 i-1 句还没排期时，必须等，否则会串音；
 * - 被打断时本地立即 stop 所有声源并清空队列（不等服务端确认）；
 * - 通过 onProgress 回调把"当前播放到哪句、句内进度"交给 UI 做字幕同步高亮。
 */
export function createPlayer({ ctx, onProgress, onNotice }) {
  const gain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  gain.connect(analyser);
  analyser.connect(ctx.destination);
  const timeData = new Uint8Array(analyser.fftSize);

  let format = "mp3";
  let sampleRate = 32000;
  let turnKey = null;
  let blocked = false;
  let playhead = 0;
  let nextIndex = 0;
  const pendingChunks = new Map(); // mp3：index -> Uint8Array[]
  const readyBuffers = new Map(); // 解码完成待排期
  const decoding = new Set(); // 正在解码的句子（await 期间两个队列都为空，必须单独计数）
  const sources = new Set();
  let timeline = []; // { index, startAt, endAt }
  let timer = 0;
  let lastReportedIndex = null;

  function configure(audio) {
    if (!audio) return;
    format = audio.format === "pcm" ? "pcm" : "mp3";
    sampleRate = Number(audio.sampleRate) || sampleRate;
  }

  async function unlock() {
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // 忽略：等下一次用户手势
      }
    }
  }

  function beginTurn(key) {
    turnKey = key;
    blocked = false;
    nextIndex = 0;
    pendingChunks.clear();
    readyBuffers.clear();
    playhead = Math.max(playhead, ctx.currentTime);
  }

  function pushChunk({ index, bytes, isFinal, turn }) {
    if (blocked) return;
    if (turnKey && turn && turn !== turnKey) return;

    if (format === "pcm") {
      if (bytes.length) schedulePcm(index, bytes);
      return;
    }

    const parts = pendingChunks.get(index) || [];
    if (bytes.length) parts.push(bytes);
    pendingChunks.set(index, parts);
    if (isFinal) void decodeAndQueue(index, parts);
  }

  async function decodeAndQueue(index, parts) {
    pendingChunks.delete(index);
    decoding.add(index);
    let total = 0;
    for (const part of parts) total += part.length;
    if (!total) {
      readyBuffers.set(index, null);
      decoding.delete(index);
      flushReady();
      return;
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }

    try {
      const buffer = await ctx.decodeAudioData(merged.buffer);
      readyBuffers.set(index, buffer);
    } catch {
      readyBuffers.set(index, null);
      onNotice?.(`第 ${index + 1} 句音频解码失败，已跳过`);
    }
    decoding.delete(index);
    flushReady();
  }

  function flushReady() {
    while (readyBuffers.has(nextIndex)) {
      const buffer = readyBuffers.get(nextIndex);
      readyBuffers.delete(nextIndex);
      if (buffer) scheduleBuffer(nextIndex, buffer);
      nextIndex += 1;
    }
  }

  function schedulePcm(index, bytes) {
    const samples = bytes.length >> 1;
    if (!samples) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;
    scheduleBuffer(index, buffer);
  }

  function scheduleBuffer(index, buffer) {
    // 留一点点提前量抵消主线程抖动；playhead 保证后一句紧贴前一句
    const startAt = Math.max(ctx.currentTime + 0.06, playhead);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => sources.delete(source);
    source.start(startAt);
    sources.add(source);
    playhead = startAt + buffer.duration;
    timeline.push({ index, startAt, endAt: playhead });
    ensureLoop();
  }

  function stopAll({ block = true } = {}) {
    blocked = block;
    stopLoop();
    for (const source of sources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // 忽略已结束的声源
      }
    }
    sources.clear();
    timeline = [];
    pendingChunks.clear();
    readyBuffers.clear();
    decoding.clear();
    playhead = 0;
    nextIndex = 0;
    lastReportedIndex = null;
    onProgress?.({ index: null, progress: 0, playbackMs: 0, playedCount: 0, speaking: false });
  }

  /** 当前输出电平（0~1），给波形走带用 */
  function getOutputLevel() {
    if (timeline.length === 0) return 0;
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const value = (timeData[i] - 128) / 128;
      sum += value * value;
    }
    return Math.sqrt(sum / timeData.length);
  }

  function isSpeaking() {
    return timeline.some((entry) => entry.endAt > ctx.currentTime);
  }

  /**
   * 还有活没干完：已排期、正在解码、待排期的都算。
   * 只看到 timeline 会漏掉"分片已到但 mp3 还在解码"的情况，那种时刻 turn.done 已到、声音还没响。
   */
  function isBusy() {
    return (
      timeline.length > 0 ||
      sources.size > 0 ||
      pendingChunks.size > 0 ||
      readyBuffers.size > 0 ||
      decoding.size > 0
    );
  }

  function ensureLoop() {
    // 用定时器而不是 requestAnimationFrame：后台标签页/无渲染环境下 rAF 会被节流甚至停掉，
    // 但音频还在播，字幕高亮必须继续走。
    if (timer) return;
    timer = setInterval(tick, 50);
  }

  function tick() {
    if (!timeline.length) {
      clearInterval(timer);
      timer = 0;
    }
    const now = ctx.currentTime;
    timeline = timeline.filter((entry) => entry.endAt > now - 0.5);

    let active = null;
    for (const entry of timeline) {
      if (entry.startAt <= now && entry.endAt > now) {
        active = entry;
        break;
      }
    }

    if (active) {
      const spans = timeline.filter((entry) => entry.index === active.index);
      const startAt = Math.min(...spans.map((entry) => entry.startAt));
      const endAt = Math.max(...spans.map((entry) => entry.endAt));
      const duration = Math.max(0.001, endAt - startAt);
      const progress = Math.min(1, Math.max(0, (now - startAt) / duration));
      lastReportedIndex = active.index;
      onProgress?.({ index: active.index, progress, playbackMs: Math.max(0, (now - startAt) * 1000), playedCount: countStarted(now), speaking: true });
    } else {
      if (lastReportedIndex !== null) {
        lastReportedIndex = null;
        onProgress?.({ index: null, progress: 0, playbackMs: 0, playedCount: countStarted(now), speaking: false });
      }
    }

    if (timeline.length) ensureLoop();
  }

  function stopLoop() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }

  function countStarted(now) {
    const started = new Set();
    for (const entry of timeline) {
      if (entry.startAt <= now) started.add(entry.index);
    }
    return started.size;
  }

  return { configure, unlock, beginTurn, pushChunk, stopAll, getOutputLevel, isSpeaking, isBusy, debug };

  /** 调试快照：排查"音频在响但字幕不动"这类问题时看它 */
  function debug() {
    return {
      now: Number(ctx.currentTime.toFixed(2)),
      playhead: Number(playhead.toFixed(2)),
      timerAlive: Boolean(timer),
      blocked,
      format,
      sources: sources.size,
      nextIndex,
      pendingMp3: [...pendingChunks.keys()],
      ready: [...readyBuffers.keys()],
      decoding: [...decoding],
      timeline: timeline.map((entry) => ({
        index: entry.index,
        startAt: Number(entry.startAt.toFixed(2)),
        endAt: Number(entry.endAt.toFixed(2)),
      })),
    };
  }
}
