const pageUrl = 'https://www.omahaaigc.com/path-seeker/client/ride'
try {
  const page = await fetch(pageUrl, { signal: AbortSignal.timeout(15000) })
  const html = await page.text()
  if (!page.ok) { console.log(JSON.stringify({ pageStatus: page.status })); process.exit(1) }
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => new URL(match[1], pageUrl).href)
  const bundles = await Promise.all(scripts.map(async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const body = await response.text()
    return { asset: new URL(url).pathname, status: response.status, minimaxVoice: body.includes('minimax-voice-20261014'), transcriptionEndpoint: body.includes('/ExhibitChat/transcribe'), browserVoice: body.includes('browser-voice-20261014') }
  }))
  const worklet = await fetch(new URL('worklets/voice-recording.worklet.js', 'https://www.omahaaigc.com/path-seeker/client/'), { signal: AbortSignal.timeout(15000) })
  const workletBody = await worklet.text()
  console.log(JSON.stringify({ pageStatus: page.status, bundles, recordingWorkletStatus: worklet.status, recordingWorkletPresent: workletBody.includes("registerProcessor('voice-recording'") }))
} catch (error) { console.log(JSON.stringify({ error: error.name, message: error.message })); process.exitCode = 1 }
