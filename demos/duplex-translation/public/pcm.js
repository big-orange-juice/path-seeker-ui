export function createPcmEncoder(inputRate, send, packetSamples = 800) {
  if (!Number.isFinite(inputRate) || inputRate < 16000) throw new Error("麦克风采样率必须至少为 16 kHz");
  const ratio = inputRate / 16000;
  let previous = new Float32Array();
  let position = 0;
  let packet = new ArrayBuffer(packetSamples * 2);
  let view = new DataView(packet);
  let count = 0;
  function sample(value) {
    const bounded = Math.max(-1, Math.min(1, value));
    view.setInt16(count * 2, Math.round(bounded * (bounded < 0 ? 32768 : 32767)), true);
    count += 1;
    if (count === packetSamples) {
      send(packet);
      packet = new ArrayBuffer(packetSamples * 2);
      view = new DataView(packet);
      count = 0;
    }
  }
  function feed(frame, final = false) {
    const samples = new Float32Array(previous.length + frame.length);
    samples.set(previous);
    samples.set(frame, previous.length);
    while (position < samples.length && (final || Math.floor(position) + 1 < samples.length)) {
      const left = Math.floor(position);
      const right = Math.min(left + 1, samples.length - 1);
      sample(samples[left] + (samples[right] - samples[left]) * (position - left));
      position += ratio;
    }
    const consumed = Math.min(Math.floor(position), samples.length);
    previous = samples.slice(consumed);
    position -= consumed;
  }
  function flush() {
    feed(new Float32Array(), true);
    if (count) send(packet.slice(0, count * 2));
    packet = new ArrayBuffer(packetSamples * 2);
    view = new DataView(packet);
    count = 0;
  }
  return { feed, flush };
}
