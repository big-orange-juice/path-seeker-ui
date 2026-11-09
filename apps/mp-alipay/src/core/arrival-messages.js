const messages = {
  ko: { arrivalAutoQueue: '{seconds}초 후 해설에 추가', arrivalChooseAnother: '다른 명소', permissionDenied: 'Alipay와 이 미니프로그램에 위치 권한을 허용하고 휴대전화의 위치 서비스를 켠 후 다시 시도해 주세요.' },
  yue: { arrivalAutoQueue: '{seconds} 秒後加入講解', arrivalChooseAnother: '換一個', permissionDenied: '未獲定位權限，請允許支付寶同呢個小程式使用定位，並開啟手機定位再試' },
  zh: { arrivalAutoQueue: '{seconds} 秒后加入讲解', arrivalChooseAnother: '换一个', permissionDenied: '未获得定位权限，请允许支付宝及本小程序使用定位，并开启手机定位服务后重试' },
  en: { arrivalAutoQueue: 'Queue in {seconds}s', arrivalChooseAnother: 'Another stop', permissionDenied: 'Allow location for Alipay and this mini program, turn on your phone’s location service, then retry.' },
  ru: { arrivalAutoQueue: 'В очередь через {seconds} с', arrivalChooseAnother: 'Другая остановка', permissionDenied: 'Разрешите геолокацию для Alipay и мини-приложения, включите геолокацию телефона и повторите попытку.' },
  es: { arrivalAutoQueue: 'En cola en {seconds} s', arrivalChooseAnother: 'Otra parada', permissionDenied: 'Permite la ubicación para Alipay y este miniprograma, activa la ubicación del teléfono y vuelve a intentarlo.' },
  fr: { arrivalAutoQueue: 'En file dans {seconds} s', arrivalChooseAnother: 'Autre étape', permissionDenied: 'Autorisez la localisation pour Alipay et ce mini-programme, activez la localisation du téléphone, puis réessayez.' },
  ja: { arrivalAutoQueue: '{seconds}秒後に再生待ちへ', arrivalChooseAnother: '別のスポット', permissionDenied: 'Alipayとこのミニプログラムに位置情報を許可し、端末の位置情報をオンにして再試行してください。' },
};
const locationMessages = {
  ko: { locationRetrying: '위치가 일시 중단되었습니다. 다시 찾는 중…', locationNetwork: '위치 네트워크 오류입니다. 연결을 확인해 주세요. 다시 시도 중…', locationTimeout: '위치 요청 시간이 초과되었습니다. 다시 찾는 중…', locationSignal: '위치 신호가 약합니다. Wi-Fi와 정확한 위치를 켜 주세요. 다시 시도 중…' },
  yue: { locationRetrying: '定位暫時中斷，重新取得中…', locationNetwork: '定位網絡出錯，重試中，請檢查網絡', locationTimeout: '定位回應逾時，重新取得中…', locationSignal: '定位訊號唔夠，請開啟 Wi-Fi 同精確定位，重試中' },
  zh: { locationRetrying: '定位暂时中断，正在重新获取…', locationNetwork: '定位网络异常，正在重试，请检查网络连接', locationTimeout: '定位响应超时，正在重新获取…', locationSignal: '定位信号不足，请开启 Wi-Fi 和精确定位，正在重试' },
  en: { locationRetrying: 'Location interrupted. Retrying…', locationNetwork: 'Location network error. Retrying; check your connection.', locationTimeout: 'Location timed out. Retrying…', locationSignal: 'Location signal is weak. Enable Wi-Fi and precise location. Retrying…' },
  ru: { locationRetrying: 'Геолокация прервана. Повторная попытка…', locationNetwork: 'Ошибка сети геолокации. Проверьте соединение; повторяем попытку.', locationTimeout: 'Истекло время ожидания геолокации. Повторяем…', locationSignal: 'Слабый сигнал. Включите Wi-Fi и точную геолокацию. Повторяем…' },
  es: { locationRetrying: 'Ubicación interrumpida. Reintentando…', locationNetwork: 'Error de red de ubicación. Comprueba la conexión; reintentando.', locationTimeout: 'La ubicación ha tardado demasiado. Reintentando…', locationSignal: 'Señal débil. Activa Wi-Fi y ubicación precisa. Reintentando…' },
  fr: { locationRetrying: 'Localisation interrompue. Nouvelle tentative…', locationNetwork: 'Erreur réseau de localisation. Vérifiez la connexion ; nouvelle tentative.', locationTimeout: 'Délai de localisation dépassé. Nouvelle tentative…', locationSignal: 'Signal faible. Activez le Wi-Fi et la position précise. Nouvelle tentative…' },
  ja: { locationRetrying: '位置情報が一時中断しました。再取得中…', locationNetwork: '位置情報の通信エラーです。接続を確認してください。再試行中…', locationTimeout: '位置情報がタイムアウトしました。再取得中…', locationSignal: '位置情報の信号が弱いため、Wi-Fiと正確な位置情報をオンにしてください。再試行中…' }
};
const routeMessages = {
  ko: { locationRouteEstimate: '코스 위의 추정 위치입니다. 위치를 다시 확인하는 중…', locationRouteAmbiguous: '코스에 위치를 표시했습니다. 현재 구간을 확인하는 중…' },
  yue: { locationRouteEstimate: '按路線估算位置，重新確認定位中…', locationRouteAmbiguous: '已喺路線上顯示位置，確認所在路段中…' },
  zh: { locationRouteEstimate: '按路线估算位置，正在重新确认定位…', locationRouteAmbiguous: '位置已显示在路线上，正在确认所在路段…' },
  en: { locationRouteEstimate: 'Estimated position on route. Confirming location…', locationRouteAmbiguous: 'Position shown on route. Confirming the current section…' },
  ru: { locationRouteEstimate: 'Положение на маршруте приблизительное. Уточняем…', locationRouteAmbiguous: 'Положение показано на маршруте. Уточняем участок…' },
  es: { locationRouteEstimate: 'Posición estimada en la ruta. Confirmando ubicación…', locationRouteAmbiguous: 'Posición mostrada en la ruta. Confirmando el tramo…' },
  fr: { locationRouteEstimate: 'Position estimée sur le parcours. Vérification en cours…', locationRouteAmbiguous: 'Position affichée sur le parcours. Vérification du tronçon…' },
  ja: { locationRouteEstimate: 'ルート上の推定位置です。現在地を確認中…', locationRouteAmbiguous: 'ルート上に位置を表示しています。区間を確認中…' }
};
const freshnessMessages = {
  ko: { locationStale: '최신 위치를 받지 못했습니다. 다시 찾는 중…' },
  yue: { locationStale: '未取得最新位置，重新定位中…' },
  zh: { locationStale: '尚未获得最新位置，正在重新定位…' },
  en: { locationStale: 'Waiting for an up-to-date position. Retrying…' },
  ru: { locationStale: 'Ожидаем актуальное местоположение. Повторяем…' },
  es: { locationStale: 'Esperando una posición actualizada. Reintentando…' },
  fr: { locationStale: 'En attente d’une position à jour. Nouvelle tentative…' },
  ja: { locationStale: '最新の位置情報を待っています。再取得中…' }
};
module.exports = locale => Object.assign({}, messages[locale] || messages.zh, locationMessages[locale] || locationMessages.zh, routeMessages[locale] || routeMessages.zh, freshnessMessages[locale] || freshnessMessages.zh);
