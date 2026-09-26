/**
 * 轮次检测（VAD）：
 * - 说话开始：能量超过阈值并持续 speechStartMs；播放期间要求更高的能量与更长的持续（bargeInHoldMs），避免外放回声误触发；
 * - 说话结束：静音持续 silenceEndMs，或整体超过 maxUtteranceMs；
 * - 结束时把 preRollMs 的静音前摇剪掉，保留 postRollMs 尾部，重采样为 16k 并编码 WAV 交给上层。
 */
import { encodeWav16, resampleLinear } from "./audio-utils.js";

export function createTurnDetector({ ctx, frameSize = 512, options = {}, onSpeechStart, onSpeechEnd }) {
  const frameMs = (frameSize / ctx.sampleRate) * 1000;
  const startFrames = Math.max(1, Math.round((options.speechStartMs ?? 150) / frameMs));
  const bargeFrames = Math.max(1, Math.round((options.bargeInHoldMs ?? 220) / frameMs));
  const stopFrames = Math.max(1, Math.round((options.silenceEndMs ?? 650) / frameMs));
  const maxFrames = Math.max(stopFrames + 1, Math.round((options.maxUtteranceMs ?? 20000) / frameMs));
  const preFrames = Math.max(1, Math.round((options.preRollMs ?? 300) / frameMs));
  const postFrames = Math.max(0, Math.round((options.postRollMs ?? 200) / frameMs));

  let state = "idle";
  let hot = 0;
  let cold = 0;
  let noiseFloor = 0.006;
  let collected = [];
  let preRing = [];

  function reset() {
    state = "idle";
    hot = 0;
    cold = 0;
    collected = [];
  }

  function feed(frame, rms, { playbackActive = false } = {}) {
    const startThreshold = Math.max(
      options.minRms ?? 0.012,
      noiseFloor * (options.noiseFloorMultiplier ?? 3),
      playbackActive ? (options.bargeInRms ?? 0.03) : 0,
    );
    const stopThreshold = Math.max((options.minRms ?? 0.012) * 0.7, noiseFloor * 1.6);

    if (state === "idle") {
      if (rms < startThreshold * 0.7) noiseFloor = noiseFloor * 0.98 + rms * 0.02;
      preRing.push(frame);
      if (preRing.length > preFrames) preRing.shift();
      hot = rms > startThreshold ? hot + 1 : 0;
      const need = playbackActive ? bargeFrames : startFrames;
      if (hot >= need) {
        state = "speech";
        collected = preRing.slice();
        preRing = [];
        cold = 0;
        onSpeechStart?.({ duringPlayback: playbackActive });
      }
      return;
    }

    collected.push(frame);
    cold = rms < stopThreshold ? cold + 1 : 0;
    if (cold >= stopFrames || collected.length >= maxFrames) finalize();
  }

  function finalize() {
    // 只裁掉多余尾静音，保留 postRollMs，方便识别模型确认句尾
    const trim = Math.max(0, cold - postFrames);
    const frames = trim > 0 ? collected.slice(0, collected.length - trim) : collected.slice();
    reset();

    let total = 0;
    for (const frame of frames) total += frame.length;
    if (!total) return;

    const merged = new Float32Array(total);
    let offset = 0;
    for (const frame of frames) {
      merged.set(frame, offset);
      offset += frame.length;
    }

    const pcm16k = resampleLinear(merged, ctx.sampleRate, 16000);
    const seconds = pcm16k.length / 16000;
    if (seconds < 0.35) return; // 太短，多半是咳嗽/碰撞声
    onSpeechEnd?.({ wav: encodeWav16(pcm16k, 16000), seconds });
  }

  return { feed, reset };
}
