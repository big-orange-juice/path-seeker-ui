export function startTranslationMic(context: AudioContext, onFrame: (frame: Float32Array) => void): Promise<{ stop(): Promise<void> }>
