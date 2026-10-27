const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { createRequire } = require('node:module')
const { chromium } = require('C:/Users/zhmou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const root = path.resolve(__dirname, '../..')
const { transpileModule, ModuleKind, ScriptTarget } = createRequire(path.join(root, 'apps/h5-client/package.json'))('typescript')

async function main() {
  const guard = transpileModule(await fs.readFile(path.join(root, 'apps/h5-client/src/utils/roomEchoGuard.ts'), 'utf8'), {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  }).outputText
  const player = await fs.readFile(path.join(root, 'demos/duplex-translation/public/player.js'), 'utf8')
  const html = `<!doctype html><html><body><script type="module">
    import { createRoomEchoGuard } from '/guard.js';
    import { createTranslationPlayer } from '/player.js';
    const context = new AudioContext();
    const player = createTranslationPlayer(context, active => window.playing = active, error => { throw error; });
    player.configure({ format: 'pcm', sampleRate: 16000 });
    window.guard = createRoomEchoGuard(active => { window.blocked = active; if (active) player.stop(); });
    window.blocked = window.guard.isCapturing();
    window.startPlayback = async () => {
      await context.resume();
      player.push({ audio: '0010'.repeat(32000), isFinal: true });
    };
    window.ready = true;
  </script></body></html>`
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/guard.js' || request.url === '/player.js' ? 'text/javascript' : 'text/html')
    response.end(request.url === '/guard.js' ? guard : request.url === '/player.js' ? player : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
    const errors = []
    const context = await browser.newContext()
    const address = `http://127.0.0.1:${server.address().port}`
    const open = async target => {
      const page = await target.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(address)
      await page.waitForFunction(() => window.ready)
      return page
    }
    const listener = await open(context)
    await listener.evaluate(() => window.startPlayback())
    await listener.waitForFunction(() => window.playing === true)
    const host = await open(context)
    await host.evaluate(() => { window.release = window.guard.capture() })
    await listener.waitForFunction(() => window.blocked === true && window.playing === false)
    const newListener = await open(context)
    assert.equal(await newListener.evaluate(() => window.blocked), true)
    const separate = await browser.newContext()
    const remoteListener = await open(separate)
    assert.equal(await remoteListener.evaluate(() => window.blocked), false)
    await host.evaluate(() => window.release())
    await listener.waitForFunction(() => window.blocked === false)
    await newListener.waitForFunction(() => window.blocked === false)
    assert.equal(await listener.evaluate(() => window.playing), false)
    await listener.evaluate(() => window.startPlayback())
    await listener.waitForFunction(() => window.playing === true)
    await host.evaluate(() => { window.release = window.guard.capture() })
    await listener.waitForFunction(() => window.blocked === true && window.playing === false)
    await host.goto(`${address}/?returned`)
    await host.waitForFunction(() => window.ready)
    await listener.waitForFunction(() => window.blocked === false)
    assert.deepEqual(errors, [])
    const result = { browser: 'Microsoft Edge headless', playingAudioStoppedAcrossTabs: true, newTabDetectsCapture: true, independentBrowserContextUnaffected: true, releaseDoesNotReplay: true, freshPlaybackResumes: true, navigationReleasesCapture: true, pageErrors: errors }
    await fs.writeFile(path.join(__dirname, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
