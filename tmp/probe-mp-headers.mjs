// 临时诊断脚本：只观察 send-with-audio 的响应头，拿到头就断开，避免再跑一轮完整 TTS。
const base = 'https://www.omahaaigc.com/path-seeker/api';
const login = await fetch(base + '/AppUser/GuestLogin', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ platform: 4, device: 'Alipay/probe', langCode: 'zh' })
}).then(r => r.json());
const token = login.data.accessToken;
const session = await fetch(base + '/ExhibitChat/sessions', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify({ museumId: '345536575083515904', title: 'probe-headers' })
}).then(r => r.json());

const res = await fetch(base + '/ExhibitChat/send-with-audio', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'text/event-stream', authorization: 'Bearer ' + token },
  body: JSON.stringify({
    sessionId: session.data.id, clientMessageId: 'probe-h-' + Date.now(),
    message: '用一句话介绍什刹海', enableAudio: false, voiceId: 'male-qn-qingse'
  })
});
console.log('status', res.status);
for (const [k, v] of res.headers) console.log(k + ':', v);
await res.body.cancel();
