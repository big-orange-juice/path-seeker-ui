class TranslationCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = true;
    this.port.onmessage = ({ data }) => {
      if (data === "stop") {
        this.recording = false;
        this.port.postMessage({ stopped: true });
      }
    };
  }
  process(inputs, outputs) {
    for (const channel of outputs[0] || []) channel.fill(0);
    const samples = inputs[0]?.[0];
    if (this.recording && samples) this.port.postMessage({ frame: samples.slice() });
    return true;
  }
}
registerProcessor("translation-capture", TranslationCapture);
