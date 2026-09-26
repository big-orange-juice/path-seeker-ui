/**
 * 麦克风采集：AudioWorklet 里按固定帧长打包 + 计算 RMS。
 * 只把数据喂给主线程做 VAD，不接扬声器（避免自听）。
 * 浏览器自带的 echoCancellation 是打断能成立的前提：否则 TTS 声音会被再次采集，自己打断自己。
 */
export async function startMicCapture({ ctx, workletUrl, frameSize = 512, onFrame }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });

  await ctx.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(ctx, "pcm-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    processorOptions: { frameSize },
  });

  // worklet 需要连到一个输出端才会被持续调度；用 0 增益节点保证不被听到
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const source = ctx.createMediaStreamSource(stream);
  source.connect(node);
  node.connect(mute).connect(ctx.destination);
  node.port.onmessage = (event) => onFrame(event.data.frame, event.data.rms);

  return {
    stop() {
      try {
        node.port.onmessage = null;
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      } catch {
        // 忽略断开时的异常
      }
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
