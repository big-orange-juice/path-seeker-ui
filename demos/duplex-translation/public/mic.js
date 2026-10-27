export async function startTranslationMic(ctx, onFrame, { onError } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 } }, video: false,
  });
  let source;
  let node;
  let mute;
  let stopping;
  let stopped;
  let accepting = true;
  let timer;
  let lastFrame = performance.now();
  let sequence = 0;
  let samples = 0;
  const audioTrack = stream.getAudioTracks?.()[0] || stream.getTracks()[0];
  function fail(error) {
    if (!accepting) return;
    accepting = false;
    onError?.(error);
  }
  const interrupted = () => { if (!stopping) fail(new Error("麦克风采集已中断，请重新开始讲解")); };
  function release() {
    accepting = false;
    clearInterval(timer);
    for (const track of stream.getTracks()) track.removeEventListener?.("ended", interrupted);
    if (node) node.port.onmessage = null;
    source?.disconnect();
    node?.disconnect();
    mute?.disconnect();
    for (const track of stream.getTracks()) track.stop();
  }
  try {
    try {
      const modes = audioTrack?.getCapabilities?.().echoCancellation;
      if (Array.isArray(modes) && modes.includes("all")) {
        await audioTrack.applyConstraints({ echoCancellation: { exact: "all" } });
      }
    } catch { }
    await ctx.audioWorklet.addModule(new URL("./capture.worklet.js", import.meta.url));
    node = new AudioWorkletNode(ctx, "translation-capture");
    mute = ctx.createGain();
    mute.gain.value = 0;
    source = ctx.createMediaStreamSource(stream);
    node.port.onmessage = ({ data }) => {
      if (data.stopped) {
        const complete = data.sequence === undefined || (data.sequence === sequence && data.samples === samples);
        stopped?.(complete);
      } else if (data.frame && accepting) {
        if (data.sequence !== undefined && (data.sequence !== sequence || data.startSample !== samples)) {
          fail(new Error("麦克风音频不连续，请重新开始讲解"));
          return;
        }
        sequence++;
        samples += data.frame.length;
        lastFrame = performance.now();
        try { onFrame(data.frame); } catch (error) { fail(error); }
      }
    };
    source.connect(node).connect(mute).connect(ctx.destination);
    for (const track of stream.getTracks()) track.addEventListener?.("ended", interrupted);
    if (onError) timer = setInterval(() => {
      if (!stopping && performance.now() - lastFrame > 1500) interrupted();
    }, 250);
    return {
      stop({ flush = true } = {}) {
        if (!flush) accepting = false;
        if (stopping) return stopping;
        stopping = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => flush ? reject(new Error("麦克风停止确认超时，请重新连接")) : resolve(), 500);
          stopped = (complete) => {
            clearTimeout(timeout);
            if (flush && !complete) reject(new Error("麦克风末尾音频不完整，请重新连接"));
            else resolve();
          };
          node.port.postMessage({ type: "stop", flush });
        }).finally(release);
        return stopping;
      },
      getStats: () => ({ frames: sequence, samples, sampleRate: ctx.sampleRate, lastFrameAgeMs: performance.now() - lastFrame, audioSettings: audioTrack?.getSettings?.() || {} }),
    };
  } catch (error) { release(); throw error; }
}
