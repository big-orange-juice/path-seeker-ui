const auth = require('./services/auth');
const audio = require('./services/audio');
App({
  globalData: { chatContext: null, selectedRoute: '', foreground: true },
  onLaunch() { auth.restore(); },
  onShow() { this.globalData.foreground = true; },
  onHide() { this.globalData.foreground = false; this.globalData.backgroundAudio = audio.snapshot(); if (this.globalData.cancelVoiceInput) this.globalData.cancelVoiceInput(); audio.pause(); }
});
