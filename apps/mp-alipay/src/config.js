module.exports = {
  appId: '2021007110628321',
  apiBase: 'https://www.omahaaigc.com/path-seeker/api',
  // 息屏或切到后台时保持导览定位与讲解播放；关闭后恢复“离开页面即暂停”。
  background: true,
  // 真机联调诊断日志：定位问答流式接收问题期间打开，上线前改回 false。
  diagnostics: true,
  authOptions: { guestLogin: false, passwordLogin: false, requirePhoneNumber: false },
  voiceId: 'male-qn-qingse',
  locales: [
    { value: 'zh', label: '中文' }, { value: 'en', label: 'English' },
    { value: 'ru', label: 'Русский' }, { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' }, { value: 'ja', label: '日本語' }
  ]
};
