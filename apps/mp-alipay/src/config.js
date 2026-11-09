module.exports = {
  appId: '2021007110628321',
  apiBase: 'https://www.omahaaigc.com/path-seeker/api',
  // 息屏或切到后台时保持导览定位与讲解播放；关闭后恢复“离开页面即暂停”。
  background: true,
  routeCorrection: false,
  driverHostInApp: true,
  // 真机联调诊断日志：定位问答流式接收问题期间打开，上线前改回 false。
  diagnostics: true,
  authOptions: { guestLogin: false, passwordLogin: false, requirePhoneNumber: true },
  voiceId: 'male-qn-qingse',
  locales: require('./shared/tour').TOUR_LANGUAGES
};
