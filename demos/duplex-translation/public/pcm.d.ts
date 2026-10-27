export function createPcmEncoder(inputRate: number, send: (packet: ArrayBuffer) => void, packetSamples?: number): { feed(frame: Float32Array): void; flush(): void }
