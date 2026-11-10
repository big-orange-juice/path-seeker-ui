const auth = require('./services/auth');
const audio = require('./services/audio');
const config = require('./config');
const translation = require('./services/translation-session');
const location = require('./services/location');
const invitation = require('./services/room-invitation');
App({
  globalData: { chatContext: null, selectedRoute: '', foreground: true },
  onLaunch(options = {}) { this._coldStart = true; this.globalData.roomInvitation = invitation.entry(options.query); auth.restore(); location.reportCapabilities(); },
  onShow(options = {}) {
    const coldStart = this._coldStart; this._coldStart = false;
    this.globalData.foreground = true; location.setForeground(true);
    const entry = invitation.entry(options.query);
    const code = entry && entry.roomCode;
    const invitationUrl = entry && invitation.url(code, entry);
    if (coldStart && entry) this.globalData.roomInvitation = entry;
    const newInvitation = entry && this._lastInvitationUrl !== invitationUrl;
    this._lastInvitationUrl = invitationUrl;
    if (code) {
      if (translation.snapshot().room && translation.snapshot().room.code === code) translation.resume();
      if (!coldStart && newInvitation) my.reLaunch({ url: invitationUrl });
    } else translation.resume();
  },
  onHide() { this.globalData.foreground = false; location.setForeground(false); this.globalData.backgroundAudio = audio.snapshot(); translation.suspend(); if (this.globalData.cancelVoiceInput) this.globalData.cancelVoiceInput(); if (!config.background) audio.pause(); }
});
