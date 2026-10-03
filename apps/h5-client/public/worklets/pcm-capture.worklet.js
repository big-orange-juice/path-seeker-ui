/**
 * AudioWorklet：把麦克风输入按固定帧长打包成 Float32，并附上该帧 RMS 能量。
 *
 * 只服务于「播放期说话打断」：主线程拿 RMS 判断用户是否开口，音频帧本身
 * 不录制、不编码、不上传，用完即丢。
 *
 * 用 gate 控制是否上报：不在播放期时主线程把 gate 关掉，音频帧直接丢弃，
 * 不跨线程传递，也不参与任何计算。
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.frameSize = options?.processorOptions?.frameSize ?? 512
    this.buffer = new Float32Array(this.frameSize)
    this.offset = 0
    this.gate = false
    this.port.onmessage = (event) => {
      if (event.data?.type === 'gate') this.gate = Boolean(event.data.value)
    }
  }

  process(inputs, outputs) {
    // 输出静音，保持节点被调度
    const output = outputs[0]
    if (output) {
      for (const channel of output) channel.fill(0)
    }

    const input = inputs[0]
    const channel = input && input[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i += 1) {
      if (!this.gate) {
        // 未开启时只吞样本，不计算也不上报
        continue
      }
      this.buffer[this.offset] = channel[i]
      this.offset += 1
      if (this.offset < this.frameSize) continue

      let sum = 0
      for (let j = 0; j < this.frameSize; j += 1) sum += this.buffer[j] * this.buffer[j]
      this.port.postMessage({ rms: Math.sqrt(sum / this.frameSize) })
      this.offset = 0
    }

    if (!this.gate) this.offset = 0
    return true
  }
}

registerProcessor('pcm-capture', PcmCapture)
