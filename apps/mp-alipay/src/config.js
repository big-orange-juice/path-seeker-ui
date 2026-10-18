module.exports = {
  appId: '2021007109685406',
  apiBase: 'https://www.omahaaigc.com/path-seeker/api',
  // 真机联调诊断日志：定位问答流式接收问题期间打开，上线前改回 false。
  diagnostics: true,
  authOptions: { guestLogin: false, passwordLogin: false },
  voiceId: 'male-qn-qingse',
  locales: [
    { value: 'zh', label: '中文' }, { value: 'en', label: 'English' },
    { value: 'ru', label: 'Русский' }, { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' }, { value: 'ja', label: '日本語' }
  ]
};
