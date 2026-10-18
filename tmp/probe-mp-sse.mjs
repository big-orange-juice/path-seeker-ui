// 临时诊断脚本：用与支付宝小程序相同的请求形态访问生产接口，观察 SSE 的实际返回。
const base = 'https://www.omahaaigc.com/path-seeker/api';
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';

const login = await fetch(base + '/AppUser/GuestLogin', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ platform: 4, device: 'Alipay/probe', langCode: 'zh' })
}).then(r => r.json());
const token = login.data.accessToken;
console.log(stamp(), 'login ok', login.data.userId);

const sessionRaw = await fetch(base + '/ExhibitChat/sessions', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify({ museumId: '345536575083515904', routeId: null, title: 'probe' })
}).then(async r => ({ status: r.status, body: await r.text() }));
console.log(stamp(), 'session', sessionRaw.status, sessionRaw.body.slice(0, 300));
const session = JSON.parse(sessionRaw.body);
const sessionId = typeof session.data === 'string' ? session.data : session.data && session.data.id;

for (const enableAudio of [false, true]) {
  const controller = new AbortController();
  const res = await fetch(base + '/ExhibitChat/send-with-audio', {
    method: 'POST', signal: controller.signal,
    headers: {
      'content-type': 'application/json', accept: 'text/event-stream',
      authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      sessionId, clientMessageId: 'probe-' + enableAudio + '-' + Date.now(),
      message: '用一句话介绍什刹海', enableAudio, voiceId: 'male-qn-qingse'
    })
  });
  console.log(stamp(), '== audio=' + enableAudio, 'status', res.status,
    'content-type', res.headers.get('content-type'),
    'transfer-encoding', res.headers.get('transfer-encoding'),
    'content-length', res.headers.get('content-length'),
    'x-accel-buffering', res.headers.get('x-accel-buffering'));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let chunks = 0, text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks++;
    const piece = decoder.decode(value, { stream: true });
    const summary = piece.replace(/\s+/g, ' ').slice(0, 160);
    console.log(stamp(), 'chunk', chunks, value.byteLength + 'B', summary);
    text += piece;
  }
  console.log(stamp(), 'stream end; chunks=' + chunks,
    'bytes=' + Buffer.byteLength(text), 'has done=' + /event: done/.test(text),
    'has error=' + /event: error/.test(text));
  console.log('--- tail:', JSON.stringify(text.slice(-400)));
}
