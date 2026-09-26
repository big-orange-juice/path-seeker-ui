/**
 * AudioWorklet：把输入按 frameSize 打包成 Float32 帧，并附带该帧 RMS 能量。
 * 主线程用它做 VAD（说话开始/结束）和"是否打断"的判定。
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options?.processorOptions?.frameSize ?? 512;
    this.buffer = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    // 输出静音，保持节点被调度
    const output = outputs[0];
    if (output) {
      for (const channel of output) channel.fill(0);
    }

    const input = inputs[0];
    const channel = input && input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.offset] = channel[i];
      this.offset += 1;
      if (this.offset < this.frameSize) continue;

      let sum = 0;
      for (let j = 0; j < this.frameSize; j += 1) sum += this.buffer[j] * this.buffer[j];
      this.port.postMessage({ frame: this.buffer.slice(0), rms: Math.sqrt(sum / this.frameSize) });
      this.offset = 0;
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
