export async function startTranslationMic(ctx, onFrame) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false,
  });
  let source;
  let node;
  let mute;
  let stopping;
  let stopped;
  function release() {
    if (node) node.port.onmessage = null;
    source?.disconnect();
    node?.disconnect();
    mute?.disconnect();
    for (const track of stream.getTracks()) track.stop();
  }
  try {
    await ctx.audioWorklet.addModule(new URL("./capture.worklet.js", import.meta.url));
    node = new AudioWorkletNode(ctx, "translation-capture");
    mute = ctx.createGain();
    mute.gain.value = 0;
    source = ctx.createMediaStreamSource(stream);
    node.port.onmessage = ({ data }) => {
      if (data.stopped) stopped?.();
      else if (data.frame) onFrame(data.frame);
    };
    source.connect(node).connect(mute).connect(ctx.destination);
    return {
      stop() {
        if (stopping) return stopping;
        stopping = new Promise((resolve) => {
          const timeout = setTimeout(resolve, 500);
          stopped = () => { clearTimeout(timeout); resolve(); };
          node.port.postMessage("stop");
        }).finally(release);
        return stopping;
      },
    };
  } catch (error) { release(); throw error; }
}
