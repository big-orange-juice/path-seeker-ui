class VoiceRecordingProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const output = outputs[0]
    if (output) {
      for (const channel of output) channel.fill(0)
    }
    const channel = inputs[0]?.[0]
    if (channel?.length) this.port.postMessage(channel.slice())
    return true
  }
}

registerProcessor('voice-recording', VoiceRecordingProcessor)
