const auth = require('./services/auth');
const audio = require('./services/audio');
const config = require('./config');
const translation = require('./services/translation-session');
const location = require('./services/location');
App({
  globalData: { chatContext: null, selectedRoute: '', foreground: true },
  onLaunch() { auth.restore(); location.reportCapabilities(); },
  onShow() { this.globalData.foreground = true; location.setForeground(true); translation.resume(); },
  onHide() { this.globalData.foreground = false; location.setForeground(false); this.globalData.backgroundAudio = audio.snapshot(); translation.suspend(); if (this.globalData.cancelVoiceInput) this.globalData.cancelVoiceInput(); if (!config.background) audio.pause(); }
});
