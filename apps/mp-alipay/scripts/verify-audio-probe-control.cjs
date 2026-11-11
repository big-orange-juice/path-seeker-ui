const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const controlUrl = process.argv[2] || 'https://www.omahaaigc.com/path-seeker/api/AudioContinuityProbe/control';
const outputDirectory = path.resolve(process.argv[3] || 'outputs/alipay-field-validation');
const sessionId = 'abcdef0123456789abcdef0123456789';
const token = 'B'.repeat(64);

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [];
  const requests = [];
  const errors = [];
  let state = { sessionId, mode: 'manual', status: 'streaming', mediaSeconds: 62, sentBytes: 372000, events: [] };
  let sequence = 0;
  const record = name => checks.push({ name, result: 'passed' });
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
    await context.route('**/AudioContinuityProbe/sessions/**', async route => {
      const request = route.request();
      const parsed = new URL(request.url());
      assert.equal(request.headers()['x-probe-control'], token);
      assert.equal(parsed.search, '');
      assert.equal(parsed.hash, '');
      assert.equal(request.headers().authorization, undefined);
      requests.push({ method: request.method(), pathname: parsed.pathname });
      assert.ok(parsed.pathname.startsWith('/path-seeker/api/AudioContinuityProbe/sessions/' + sessionId));
      if (parsed.pathname.endsWith('/trigger')) {
        assert.equal(request.method(), 'POST');
        const command = request.postDataJSON();
        assert.ok(command.requestId.length >= 8);
        assert.ok([1, 2, 3].includes(command.marker));
        state = { ...state, events: [...state.events, { sequence: ++sequence, at: new Date().toISOString(), type: 'marker.queued', marker: command.marker, seconds: 62 }] };
      } else if (request.method() === 'DELETE') state = { ...state, status: 'stopped' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: state }) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(controlUrl + '#' + sessionId + ':' + token, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /text\/html/);
    assert.match(response.headers()['cache-control'], /no-store/);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('streaming'));
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(await page.locator('#connection').inputValue(), '');
    record('Published control HTML loads and clears fragment credentials');
    assert.ok(requests[0].pathname.startsWith('/path-seeker/api/'));
    record('Reverse proxy prefix is preserved and credentials stay in request headers');
    await page.locator('[data-marker="3"]').click();
    await page.waitForFunction(() => document.getElementById('events').textContent.includes('标记=3'));
    assert.equal(requests.filter(request => request.pathname.endsWith('/trigger')).length, 1);
    record('Marker button posts a unique command and renders the resulting event');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const downloadPath = path.join(outputDirectory, 'browser-simulated-diagnostics.json');
    await download.saveAs(downloadPath);
    const diagnostics = await fs.readFile(downloadPath, 'utf8');
    assert.equal(JSON.parse(diagnostics).sessionId, sessionId);
    assert.ok(!diagnostics.includes(token));
    record('Diagnostic download is JSON and excludes control credentials');
    await page.screenshot({ path: path.join(outputDirectory, 'control-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(outputDirectory, 'control-mobile.png'), fullPage: true });
    record('Control page fits a 390px viewport without horizontal scrolling');
    await page.locator('#stop').click();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('stopped'));
    assert.equal(await page.locator('[data-marker="1"]').isDisabled(), true);
    assert.equal(await page.locator('#stop').isDisabled(), true);
    record('Stop command disables further triggers');
    state = { ...state, mode: 'finite', status: 'streaming' };
    await page.locator('#connection').fill(controlUrl + '#' + sessionId + ':' + token);
    await page.locator('#connect').click();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('finite'));
    assert.equal(await page.locator('[data-marker="1"]').isDisabled(), true);
    record('Finite file mode cannot enqueue dynamic markers');
    await page.locator('#connection').fill('invalid');
    await page.locator('#connect').click();
    await page.waitForFunction(() => document.getElementById('notice').textContent.includes('完整控制链接'));
    record('Invalid pasted credentials show a useful error');
    assert.deepEqual(errors, []);
    record('No browser JavaScript errors');
    const capability = await context.request.get(controlUrl.replace(/\/control$/, '/capabilities'));
    assert.equal(capability.status(), 401);
    record('Published capabilities endpoint requires authentication');
    await fs.writeFile(path.join(outputDirectory, 'control-browser-report.json'), JSON.stringify({
      checkedAt: new Date().toISOString(), url: controlUrl, result: 'passed', checks, requests,
      boundary: 'Published HTML and unauthenticated capabilities are real HTTPS requests. Session, trigger and stop requests are intercepted with simulated responses; no production session is created and no phone playback is verified.'
    }, null, 2));
    process.stdout.write(JSON.stringify({ result: 'passed', checks: checks.length, report: path.join(outputDirectory, 'control-browser-report.json') }) + '\n');
  } finally { await browser.close(); }
}

main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
