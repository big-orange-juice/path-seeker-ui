import { readFileSync, writeFileSync } from 'node:fs'

const configText = readFileSync('D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System/CulturalTourismSystem.WebApi/appsettings.json', 'utf8')
const settings = JSON.parse(configText.match(/"MiniMax"\s*:\s*(\{[\s\S]*?\n\s*\})/)[1])
const key = process.env.MINIMAX_API_KEY?.trim() || settings.ApiKey?.trim()
if (!key) { console.log('MiniMax credential is not configured.'); process.exit(2) }
let wav = Buffer.alloc(44 + 32000)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8)
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28)
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(32000, 40)
const body = new FormData()
if (process.argv.includes('--round-trip')) {
  const voiceResponse = await fetch(`${settings.BaseUrl || 'https://api.minimaxi.com'}${settings.GetVoicePath || '/v1/get_voice'}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_type: 'system' }), signal: AbortSignal.timeout(15000),
  })
  const voices = await voiceResponse.json()
  const voiceId = settings.DefaultVoiceId || voices.system_voice?.[0]?.voice_id
  if (!voiceId) { console.log(JSON.stringify({ stage: 'voices', httpStatus: voiceResponse.status, code: voices.base_resp?.status_code, keys: Object.keys(voices) })); process.exit(1) }
  const ttsResponse = await fetch(`${settings.BaseUrl || 'https://api.minimaxi.com'}${settings.SynthesisPath || '/v1/t2a_v2'}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: settings.DefaultModel || 'speech-2.8-hd', text: '你好，请介绍一下这里的历史。', stream: false, output_format: 'hex',
      voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 16000, format: 'wav', channel: 1 } }), signal: AbortSignal.timeout(40000),
  })
  const tts = await ttsResponse.json()
  if (!ttsResponse.ok || tts.base_resp?.status_code !== 0 || !tts.data?.audio) {
    console.log(JSON.stringify({ stage: 'tts', httpStatus: ttsResponse.status, providerCode: tts.base_resp?.status_code, message: String(tts.base_resp?.status_msg || '').replaceAll(key, '[REDACTED]') }))
    process.exit(1)
  }
  wav = Buffer.from(tts.data.audio, 'hex')
  writeFileSync(new URL('./fixture.wav', import.meta.url), wav)
  console.log(JSON.stringify({ stage: 'tts', bytes: wav.length }))
}
body.append('model', settings.AsrModel || 'asr-1.0')
body.append('file', new Blob([wav], { type: 'audio/wav' }), 'probe.wav')
body.append('response_format', 'json'); body.append('stream', 'false')
try {
  const response = await fetch(`${settings.BaseUrl || 'https://api.minimaxi.com'}${settings.AsrPath || '/v1/speech_to_text'}`, {
    method: 'POST', body, headers: { Authorization: `Bearer ${key}`, language: 'zh' }, signal: AbortSignal.timeout(30000),
  })
  const raw = await response.text()
  let payload; try { payload = JSON.parse(raw) } catch {}
  const statusMessage = String(payload?.base_resp?.status_msg || '').replaceAll(key, '[REDACTED]')
  console.log(JSON.stringify({ httpStatus: response.status, contentType: response.headers.get('content-type'), providerCode: payload?.base_resp?.status_code ?? payload?.code ?? null, providerMessage: statusMessage || String(payload?.message || payload?.msg || '').replaceAll(key, '[REDACTED]'), textReturned: Boolean(payload?.text), testText: process.argv.includes('--round-trip') ? payload?.text : undefined, responseKeys: payload && Object.keys(payload), bodyLength: raw.length }))
} catch (error) {
  console.log(JSON.stringify({ error: error.name, cause: error.cause?.code || '', message: error.message.replaceAll(key, '[REDACTED]') }))
  process.exitCode = 1
}
