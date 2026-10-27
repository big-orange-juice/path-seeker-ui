class TranslationCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = true;
    this.frame = new Float32Array(Math.round(sampleRate * 0.02));
    this.length = 0;
    this.sequence = 0;
    this.samples = 0;
    this.port.onmessage = ({ data }) => {
      if (data === "stop" || data?.type === "stop") {
        this.recording = false;
        if (data?.flush !== false) this.flush();
        this.length = 0;
        this.port.postMessage({ stopped: true, sequence: this.sequence, samples: this.samples });
      }
    };
  }
  flush() {
    if (!this.length) return;
    const frame = this.length === this.frame.length ? this.frame : this.frame.slice(0, this.length);
    const startSample = this.samples;
    this.samples += frame.length;
    this.port.postMessage({ frame, sequence: this.sequence++, startSample }, [frame.buffer]);
    this.frame = new Float32Array(Math.round(sampleRate * 0.02));
    this.length = 0;
  }
  process(inputs, outputs) {
    for (const channel of outputs[0] || []) channel.fill(0);
    const samples = inputs[0]?.[0];
    if (this.recording && samples) {
      let offset = 0;
      while (offset < samples.length) {
        const count = Math.min(samples.length - offset, this.frame.length - this.length);
        this.frame.set(samples.subarray(offset, offset + count), this.length);
        this.length += count;
        offset += count;
        if (this.length === this.frame.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor("translation-capture", TranslationCapture);
