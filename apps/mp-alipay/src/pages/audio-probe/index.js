const config = require('../../config');
const auth = require('../../services/auth');
const http = require('../../services/http');
const audio = require('../../services/audio');
const translation = require('../../services/translation-session');
const modes = ['manual', 'scheduled', 'finite'];
const labels = ['手动触发 · 20 分钟', '定时触发 · 1 / 5 / 15 分钟', '有限文件对照 · 30 秒'];
const root = '/AudioContinuityProbe';
Page({
  data: { labels, modeIndex: 0, busy: false, active: false, playing: false, sessionId: '', playerSeconds: 0, serverStatus: '', mediaSeconds: 0, sentBytes: 0, error: '', notice: '', eventsText: '' },
  onLoad() {
    this._alive = true; this._foreground = true; this._sequence = 0; this._events = [];
    this._unsubscribe = auth.subscribe(() => {
      if (this._run && (auth.version() !== this._run.authVersion || !auth.current() || auth.current().userId !== this._run.userId)) this.stop();
    });
  },
  onShow() {
    this._foreground = true;
    if (this._run) { this.heartbeat('show'); this.refresh(); }
  },
  onHide() { this._foreground = false; this.heartbeat('hide'); },
  onUnload() {
    this._alive = false;
    this.stop();
    if (this._unsubscribe) this._unsubscribe();
  },
  mode(event) {
    const index = Number(event.detail.value);
    if (!this.data.active && !this.data.busy && modes[index]) this.setData({ modeIndex: index });
  },
  available() {
    if (!config.audioContinuityProbe) throw Error('当前版本未开放验证入口');
    if (!config.background || !config.backgroundAudio || typeof my.getBackgroundAudioManager !== 'function') throw Error('当前客户端未开放后台音频能力，请更新支付宝并检查构建配置');
    if (!/^https:\/\//i.test(config.apiBase)) throw Error('验证需要已配置白名单的 HTTPS 服务');
    if (translation.snapshot().room || translation.snapshot().reconnecting) throw Error('请先退出讲解房间，再开始验证');
    const playback = audio.snapshot();
    if (playback.owner && (playback.item || playback.playing || playback.requested)) throw Error('请先结束当前讲解或问答播放，再开始验证');
  },
  async start() {
    if (this.data.busy || this._run) return;
    const sequence = ++this._sequence;
    const valid = () => this._alive && this._foreground && sequence === this._sequence;
    this.setData({ busy: true, error: '', notice: '' });
    let created;
    try {
      this.available();
      const user = await auth.ensure();
      if (!valid()) return;
      const authVersion = auth.version();
      const capabilities = await http.request(root + '/capabilities');
      if (!valid() || auth.version() !== authVersion) return;
      if (!capabilities || !capabilities.enabled) throw Error('服务器尚未开启音频验证功能，请先完成后端部署');
      this.available();
      const mode = modes[this.data.modeIndex];
      created = await http.post(root + '/sessions', { mode }, { public: true, headers: { Authorization: 'Bearer ' + auth.current().accessToken } });
      if (!valid() || auth.version() !== authVersion) { this.revoke(created); return; }
      this.available();
      if (!created || typeof created.sessionId !== 'string' || !/^[a-f0-9]{32}$/.test(created.sessionId)
        || !new RegExp('^/AudioContinuityProbe/sessions/' + created.sessionId + '/media\\.mp3\\?ticket=[A-F0-9]{64}$').test(created.mediaPath)
        || !new RegExp('^' + created.sessionId + ':[A-F0-9]{64}$').test(created.controlFragment)) throw Error('服务器返回的验证会话格式无效');
      this._run = Object.assign({}, created, { mode, authVersion, userId: user.userId });
      this._lastRun = this._run; this._events = []; this._lastPlaying = null;
      this.setData({ active: true, sessionId: created.sessionId, playerSeconds: 0, eventsText: '', notice: mode === 'finite' ? '先听到一声，再锁屏；第 10 秒两声，第 20 秒三声。' : '听到启动声音后锁屏。手动模式请在另一设备打开控制链接；定时模式由服务器自动触发。' });
      this.applyStatus(created.state);
      const hooks = {
        change: state => this.playback(state),
        error: () => { this.heartbeat('error'); this.clearTimer(); if (this._alive) this.setData({ error: '播放器连接结束或播放失败。本轮不会自动重连，请保留记录后重新开始。' }); },
        finished: () => { this.heartbeat('ended'); this.clearTimer(); if (this._alive) this.setData({ notice: '有限文件播放结束，请记录锁屏期间是否听到了后两组声音。' }); },
        interrupted: () => { if (this._run) { this.stop(); if (this._alive) this.setData({ error: '验证被其他音频打断，请重新开始。' }); } }
      };
      this._timer = setInterval(() => this.heartbeat('heartbeat'), 5000);
      if (this._timer && this._timer.unref) this._timer.unref();
      const item = { id: created.sessionId, title: '寻迹 · 锁屏音频验证', url: config.apiBase + created.mediaPath };
      if (mode === 'finite') audio.playQueue('audio-probe', [item], hooks);
      else audio.playLive('audio-probe', item, hooks);
    } catch (error) {
      const current = sequence === this._sequence;
      if (created) { if (this._run && this._run.sessionId === created.sessionId) this.stop(); else this.revoke(created); }
      if (this._alive && current) this.setData({ error: error.message || '验证启动失败，请重试' });
    } finally { if (this._alive && sequence === this._sequence) this.setData({ busy: false }); }
  },
  playback(state) {
    if (!this._run || state.owner !== 'audio-probe') return;
    if (this._alive) this.setData({ playing: state.playing, playerSeconds: Math.floor(state.time || 0) });
    if (this._lastPlaying !== state.playing) {
      this._lastPlaying = state.playing;
      this.heartbeat(state.playing ? 'play' : 'pause');
    }
  },
  heartbeat(event) {
    const run = this._run;
    if (!run || (event === 'heartbeat' && this._heartbeatPending)) return;
    const data = { event, foreground: this._foreground, playerSeconds: Math.max(0, Math.min(86400, Number(audio.snapshot().time) || 0)) };
    this._events.push(Object.assign({ at: new Date().toISOString() }, data));
    if (this._events.length > 256) this._events.shift();
    const pending = http.post(root + '/sessions/' + run.sessionId + '/heartbeat', data);
    this._heartbeatPending = pending;
    pending.catch(() => {}).finally(() => { if (this._heartbeatPending === pending) this._heartbeatPending = null; });
  },
  clearTimer() { clearInterval(this._timer); this._timer = null; },
  revoke(run) {
    if (!run || !run.controlFragment || !run.sessionId) return Promise.resolve();
    const sequence = this._sequence;
    return http.request(root + '/sessions/' + encodeURIComponent(run.sessionId) + '/control', {
      method: 'DELETE', public: true, headers: { 'X-Probe-Control': run.controlFragment.split(':')[1] }
    }).catch(() => {
      if (this._alive && sequence === this._sequence && (!this._run || this._run.sessionId === run.sessionId))
        this.setData({ error: '停止请求未送达服务器，可在控制页结束本轮；会话也会自动到期。' });
    });
  },
  stop() {
    const run = this._run;
    this.heartbeat('stop'); this._run = null; this._sequence++;
    this.clearTimer(); audio.stop('audio-probe');
    if (this._alive) this.setData({ active: false, busy: false, playing: false });
    return this.revoke(run);
  },
  async refresh() {
    const run = this._run || this._lastRun;
    if (!run || this._refreshing) return;
    this._refreshing = true;
    try {
      const status = await http.request(root + '/sessions/' + run.sessionId + '/control', { public: true, headers: { 'X-Probe-Control': run.controlFragment.split(':')[1] } });
      if (this._alive && this._lastRun === run) this.applyStatus(status);
    } catch (error) { if (this._alive && this._lastRun === run) this.setData({ error: error.message }); }
    finally { this._refreshing = false; }
  },
  applyStatus(state) {
    if (!state) return;
    this._serverState = state;
    this.setData({ serverStatus: state.status, mediaSeconds: Math.floor(state.mediaSeconds || 0), sentBytes: state.sentBytes || 0,
      eventsText: (state.events || []).slice(-20).map(event => event.at + ' ' + event.type + (event.marker ? ' 声音 ' + event.marker : '')).join('\n') });
  },
  copyControl() {
    if (!this._run) return;
    my.setClipboard({ text: config.apiBase + root + '/control#' + this._run.controlFragment,
      success: () => my.showToast({ content: '已复制，请在另一台设备的浏览器打开' }) });
  },
  copyReport() {
    let device = {};
    try { const info = my.getSystemInfoSync(); device = { platform: info.platform, model: info.model, system: info.system, version: info.version, SDKVersion: info.SDKVersion }; } catch (_) {}
    my.setClipboard({ text: JSON.stringify({ device, sessionId: this.data.sessionId, mode: this._lastRun && this._lastRun.mode, server: this._serverState, clientEvents: this._events }, null, 2),
      success: () => my.showToast({ content: '已复制诊断记录，不含控制口令' }) });
  }
});
