const auth = require('./services/auth');
const audio = require('./services/audio');
const config = require('./config');
const translation = require('./services/translation-session');
const location = require('./services/location');
const invitation = require('./services/room-invitation');
App({
  globalData: { chatContext: null, selectedRoute: '', foreground: true },
  onLaunch() { this._coldStart = true; auth.restore(); location.reportCapabilities(); },
  onShow(options = {}) {
    const coldStart = this._coldStart; this._coldStart = false;
    this.globalData.foreground = true; location.setForeground(true);
    const code = invitation.read(options.query);
    const newInvitation = code && this._lastInviteCode !== code;
    this._lastInviteCode = code;
    if (code) {
      if (translation.snapshot().room && translation.snapshot().room.code === code) translation.resume();
      else if (!coldStart && newInvitation) my.reLaunch({ url: invitation.url(code) });
    } else translation.resume();
  },
  onHide() { this.globalData.foreground = false; location.setForeground(false); this.globalData.backgroundAudio = audio.snapshot(); translation.suspend(); if (this.globalData.cancelVoiceInput) this.globalData.cancelVoiceInput(); if (!config.background) audio.pause(); }
});
