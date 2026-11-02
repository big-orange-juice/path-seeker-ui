const messages = {
  zh: { arrivalAutoQueue: '{seconds} 秒后加入讲解', arrivalChooseAnother: '换一个', permissionDenied: '未获得定位权限，请允许支付宝及本小程序使用定位，并开启手机定位服务后重试' },
  en: { arrivalAutoQueue: 'Queue in {seconds}s', arrivalChooseAnother: 'Another stop', permissionDenied: 'Allow location for Alipay and this mini program, turn on your phone’s location service, then retry.' },
  ru: { arrivalAutoQueue: 'В очередь через {seconds} с', arrivalChooseAnother: 'Другая остановка', permissionDenied: 'Разрешите геолокацию для Alipay и мини-приложения, включите геолокацию телефона и повторите попытку.' },
  es: { arrivalAutoQueue: 'En cola en {seconds} s', arrivalChooseAnother: 'Otra parada', permissionDenied: 'Permite la ubicación para Alipay y este miniprograma, activa la ubicación del teléfono y vuelve a intentarlo.' },
  fr: { arrivalAutoQueue: 'En file dans {seconds} s', arrivalChooseAnother: 'Autre étape', permissionDenied: 'Autorisez la localisation pour Alipay et ce mini-programme, activez la localisation du téléphone, puis réessayez.' },
  ja: { arrivalAutoQueue: '{seconds}秒後に再生待ちへ', arrivalChooseAnother: '別のスポット', permissionDenied: 'Alipayとこのミニプログラムに位置情報を許可し、端末の位置情報をオンにして再試行してください。' },
};
module.exports = locale => messages[locale] || messages.zh;
