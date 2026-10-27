export function createPcmEncoder(inputRate, send, packetSamples = 800) {
  if (!Number.isFinite(inputRate) || inputRate < 16000) throw new Error("麦克风采样率必须至少为 16 kHz");
  if (!Number.isSafeInteger(packetSamples) || packetSamples < 1 || packetSamples > 32768) throw new Error("无效的 PCM 网络包长度");
  const ratio = inputRate / 16000;
  const radius = ratio === 1 ? 0 : Math.ceil(48 * ratio);
  const phases = 256;
  const kernels = Array.from({ length: radius ? phases : 0 }, (_, phase) => {
    const weights = new Float64Array(radius * 2 + 1);
    const cutoff = 7000 / inputRate;
    let total = 0;
    for (let index = -radius; index <= radius; index++) {
      const distance = index - phase / phases;
      const normalized = distance / radius;
      const window = Math.abs(normalized) <= 1 ? 0.42 + 0.5 * Math.cos(Math.PI * normalized) + 0.08 * Math.cos(2 * Math.PI * normalized) : 0;
      const weight = (distance === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * distance) / (Math.PI * distance)) * window;
      weights[index + radius] = weight;
      total += weight;
    }
    return weights.map(weight => weight / total);
  });
  let previous = new Float32Array();
  let bufferStart = 0;
  let outputSamples = 0;
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
    if (!radius) {
      for (const value of frame) sample(value);
      return;
    }
    const samples = new Float32Array(previous.length + frame.length);
    samples.set(previous);
    samples.set(frame, previous.length);
    let position = outputSamples * ratio - bufferStart;
    while (position < samples.length && (final || Math.floor(position) + radius < samples.length)) {
      const absolutePosition = outputSamples * ratio;
      const absoluteCenter = Math.floor(absolutePosition);
      const center = absoluteCenter - bufferStart;
      const weights = kernels[Math.min(phases - 1, Math.floor((absolutePosition - absoluteCenter) * phases))];
      const reference = samples[Math.min(center, samples.length - 1)];
      let filtered = reference;
      for (let index = -radius; index <= radius; index++) {
        filtered += (samples[Math.max(0, Math.min(samples.length - 1, center + index))] - reference) * weights[index + radius];
      }
      sample(filtered);
      outputSamples++;
      position = outputSamples * ratio - bufferStart;
    }
    const consumed = Math.max(0, Math.min(Math.floor(position) - radius, samples.length));
    previous = samples.slice(consumed);
    bufferStart += consumed;
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
