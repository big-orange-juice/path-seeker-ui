const messages = {
  zh: { arrivalAutoQueue: '{seconds} 秒后加入讲解', arrivalChooseAnother: '换一个' },
  en: { arrivalAutoQueue: 'Queue in {seconds}s', arrivalChooseAnother: 'Another stop' },
  ru: { arrivalAutoQueue: 'В очередь через {seconds} с', arrivalChooseAnother: 'Другая остановка' },
  es: { arrivalAutoQueue: 'En cola en {seconds} s', arrivalChooseAnother: 'Otra parada' },
  fr: { arrivalAutoQueue: 'En file dans {seconds} s', arrivalChooseAnother: 'Autre étape' },
  ja: { arrivalAutoQueue: '{seconds}秒後に再生待ちへ', arrivalChooseAnother: '別のスポット' },
};
module.exports = locale => messages[locale] || messages.zh;
