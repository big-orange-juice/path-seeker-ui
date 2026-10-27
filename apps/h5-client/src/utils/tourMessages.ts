import type { TourLocale } from '@path-seeker/ts-shared'

const zh = {
  keepNarration: '继续当前',
  chooseLanguage: '选择讲解语言', routes: '选择这一程', routeHint: '跟随不同导游，听见不同的北京。', search: '搜索路线或导游', start: '开始行程', startHint: '选择景点，点击播放收听讲解', back: '返回地图', end: '结束行程',
  play: '播放讲解', pause: '暂停', resume: '继续', content: '查看内容', close: '收起', next: '接下来看', complete: '完成这一站', locationFailed: '定位不可用，仍可手动选择站点', permissionDenied: '未获得定位权限，请在浏览器设置中允许后重试', enterFullscreen: '进入全屏', exitFullscreen: '退出全屏', loading: '正在加载…', retry: '重试',
  noRoutes: '暂无该语言的已发布路线', noNarration: '本站暂无该语言的讲解', voiceMissing: '设备未安装该语言语音，可继续阅读讲解', playbackFailed: '无法播放讲解，请重试或阅读正文', minutes: '分钟', stops: '站', finished: '行程已完成', ask: '问一问',
  routeUnavailable: '扫码路线不存在或尚未发布该语言版本，请重新选择', loadFailed: '加载失败，请重试', startFailed: '开始行程失败，请重试', saveFailed: '进度保存失败，请重试', video: '观看视频', guide: '导游', noMap: '地图服务尚未配置，仍可选择路线和播放讲解', changeLanguage: '切换语言',
  zoomIn: '放大地图', zoomOut: '缩小地图', overview: '路线全览', follow: '跟随视角', unfollow: '退出跟随', routeTools: '路线工具', showRoute: '显示路线', hideRoute: '隐藏路线',
  voiceAsk: '语音提问', voiceStop: '结束语音', voiceHint: '点击收音并打开问一问', voiceReleaseHint: '再次点击结束并发送', voiceCancel: '取消收音', voiceFinishing: '正在识别…', voiceUnsupported: '当前浏览器不支持语音识别，请点击问一问使用文字输入',
  extraAudio: '额外音频', beforeAudio: '讲解前', afterAudio: '讲解后', skipExtraAudio: '跳过额外音频', replayStop: '重新播放整站', playingNow: '正在播放', approximateResume: '系统语音按句恢复，位置为近似', autoplayBlocked: '浏览器阻止了自动播放', continuePlayback: '继续播放', extraAudioFailed: '额外音频播放失败，已跳过：', locationUnknown: '定位精度不足，地图跟随可能不准确', secondsShort: '秒',
  prevStop: '上一节点', nextStop: '下一节点', rewind15: '-15 秒', forward15: '+15 秒', enterStopPlay: '进入本节点播放', drawerNotPlaying: '正在播放其他节点：', browsingNoProgress: '浏览中，未切换行程进度', playbackProgress: '播放进度', seekAtStart: '已到本段开头', seekAtEnd: '已到本段末尾', sequentialAutoHint: '播完自动进入下一站', voiceFellBack: '当前音色不可用，已使用默认音色',
  queueTitle: '播放序列', queuePending: '个待播放', queueHint: '手动选择景点播放，已播放的景点会保存在序列中', queueOn: '已开启', queueOff: '已暂停', queueLockContent: '自动切换内容', queueUnlockContent: '允许自动切换', queuePlaying: '正在播放', queueCompleted: '已完成', queueSkipped: '已跳过', queueQueued: '待播放', queueEmpty: '还没有排队的景点', queuePlay: '立即播放', queueSkip: '跳过',
}

/** v5 新增文案的各语言翻译；缺失时回落中文基线（见 tourMessages） */
const extraMessages: Partial<Record<TourLocale, Partial<Record<keyof typeof zh, string>>>> = {
  zh: {},
  en: { keepNarration: 'Keep the current one', routeTools: 'Route tools', prevStop: 'Previous stop', nextStop: 'Next stop', rewind15: '-15 s', forward15: '+15 s', enterStopPlay: 'Play this stop', drawerNotPlaying: 'Playing another stop: ', browsingNoProgress: 'Browsing — journey progress unchanged', playbackProgress: 'Progress', seekAtStart: 'Start of this segment', seekAtEnd: 'End of this segment', sequentialAutoHint: 'The next stop starts when this one finishes.', voiceFellBack: 'This voice is unavailable; the default voice is used', queueTitle: 'Playback sequence', queuePending: 'pending', queueHint: 'Choose stops manually to play. Played stops appear in this sequence.', queueOn: 'On', queueOff: 'Paused', queueLockContent: 'Lock this content', queueUnlockContent: 'Allow content switching', queuePlaying: 'Playing', queueCompleted: 'Completed', queueSkipped: 'Skipped', queueQueued: 'Up next', queueEmpty: 'No stops are queued.', queuePlay: 'Play now', queueSkip: 'Skip' },
  ru: { keepNarration: 'Оставить текущую', routeTools: 'Инструменты маршрута', prevStop: 'Предыдущая остановка', nextStop: 'Следующая остановка', rewind15: '−15 с', forward15: '+15 с', enterStopPlay: 'Слушать эту остановку', drawerNotPlaying: 'Играет другая остановка: ', browsingNoProgress: 'Просмотр — прогресс маршрута не изменён', playbackProgress: 'Прогресс', seekAtStart: 'Начало фрагмента', seekAtEnd: 'Конец фрагмента', sequentialAutoHint: 'Следующая остановка начнётся после этой.', voiceFellBack: 'Этот голос недоступен, используется голос по умолчанию', queueTitle: 'Очередь воспроизведения', queuePending: 'в очереди', queueHint: 'Выбирайте остановки для прослушивания. Они сохраняются в этой очереди.', queueOn: 'Включено', queueOff: 'Пауза', queueLockContent: 'Закрепить этот материал', queueUnlockContent: 'Разрешить переключение', queuePlaying: 'Воспроизводится', queueCompleted: 'Завершено', queueSkipped: 'Пропущено', queueQueued: 'Далее', queueEmpty: 'В очереди нет остановок.', queuePlay: 'Воспроизвести', queueSkip: 'Пропустить' },
  es: { keepNarration: 'Seguir con la actual', routeTools: 'Herramientas de ruta', prevStop: 'Parada anterior', nextStop: 'Parada siguiente', rewind15: '−15 s', forward15: '+15 s', enterStopPlay: 'Reproducir esta parada', drawerNotPlaying: 'Reproduciendo otra parada: ', browsingNoProgress: 'Explorando: progreso del recorrido sin cambios', playbackProgress: 'Progreso', seekAtStart: 'Inicio del fragmento', seekAtEnd: 'Final del fragmento', sequentialAutoHint: 'La siguiente parada empieza al terminar esta.', voiceFellBack: 'Esta voz no está disponible; se usa la voz predeterminada', queueTitle: 'Secuencia de reproducción', queuePending: 'pendientes', queueHint: 'Elige las paradas para reproducir. Las escuchadas aparecen en esta secuencia.', queueOn: 'Activada', queueOff: 'En pausa', queueLockContent: 'Fijar este contenido', queueUnlockContent: 'Permitir cambiar de contenido', queuePlaying: 'Reproduciendo', queueCompleted: 'Completada', queueSkipped: 'Omitida', queueQueued: 'A continuación', queueEmpty: 'No hay paradas en cola.', queuePlay: 'Reproducir ahora', queueSkip: 'Omitir' },
  fr: { keepNarration: 'Garder l’étape actuelle', routeTools: 'Outils du parcours', prevStop: 'Étape précédente', nextStop: 'Étape suivante', rewind15: '−15 s', forward15: '+15 s', enterStopPlay: 'Lire cette étape', drawerNotPlaying: 'Lecture d’une autre étape : ', browsingNoProgress: 'Exploration : progression du parcours inchangée', playbackProgress: 'Progression', seekAtStart: 'Début du passage', seekAtEnd: 'Fin du passage', sequentialAutoHint: 'L’étape suivante démarre à la fin de celle-ci.', voiceFellBack: 'Cette voix est indisponible ; la voix par défaut est utilisée', queueTitle: 'Séquence de lecture', queuePending: 'en attente', queueHint: 'Choisissez les étapes à écouter. Les étapes lues figurent dans cette séquence.', queueOn: 'Activée', queueOff: 'En pause', queueLockContent: 'Garder ce contenu', queueUnlockContent: 'Autoriser le changement de contenu', queuePlaying: 'Lecture en cours', queueCompleted: 'Terminée', queueSkipped: 'Ignorée', queueQueued: 'À suivre', queueEmpty: 'Aucune étape en attente.', queuePlay: 'Lire maintenant', queueSkip: 'Ignorer' },
  ja: { keepNarration: '今のスポットを続ける', routeTools: 'コースツール', prevStop: '前のスポット', nextStop: '次のスポット', rewind15: '−15 秒', forward15: '+15 秒', enterStopPlay: 'このスポットを再生', drawerNotPlaying: '別のスポットを再生中：', browsingNoProgress: '閲覧中：コースの進行状況は変わりません', playbackProgress: '再生位置', seekAtStart: '区間の先頭', seekAtEnd: '区間の末尾', sequentialAutoHint: '再生後に次のスポットへ進みます。', voiceFellBack: 'この音声は利用できないため、既定の音声を使用します', queueTitle: '再生シーケンス', queuePending: '件が待機中', queueHint: 'スポットを選んで再生すると、再生したスポットが一覧に表示されます。', queueOn: 'オン', queueOff: '一時停止', queueLockContent: 'このコンテンツを固定', queueUnlockContent: '自動切り替えを許可', queuePlaying: '再生中', queueCompleted: '完了', queueSkipped: 'スキップ済み', queueQueued: '次に再生', queueEmpty: '再生待ちのスポットはありません。', queuePlay: '今すぐ再生', queueSkip: 'スキップ' },
}

const voiceMessages = {
  zh: { voiceHint: '点击收音并打开问一问', voiceReleaseHint: '再次点击结束并发送', voiceCancel: '取消收音', voiceFinishing: '正在识别…', voiceUnsupported: '当前浏览器不支持语音识别，请点击问一问使用文字输入' },
  en: { voiceHint: 'Tap to record and open Ask', voiceReleaseHint: 'Tap again to stop and send', voiceCancel: 'Cancel recording', voiceFinishing: 'Recognizing…', voiceUnsupported: 'Voice input is unavailable. Tap Ask to type.' },
  ru: { voiceHint: 'Нажмите, чтобы начать запись и открыть чат', voiceReleaseHint: 'Нажмите ещё раз, чтобы остановить и отправить', voiceCancel: 'Отменить запись', voiceFinishing: 'Распознавание…', voiceUnsupported: 'Голосовой ввод недоступен. Нажмите «Спросить», чтобы ввести текст.' },
  es: { voiceHint: 'Toca para grabar y abrir Preguntar', voiceReleaseHint: 'Toca de nuevo para detener y enviar', voiceCancel: 'Cancelar grabación', voiceFinishing: 'Reconociendo…', voiceUnsupported: 'La voz no está disponible. Toca Preguntar para escribir.' },
  fr: { voiceHint: 'Appuyez pour enregistrer et ouvrir la discussion', voiceReleaseHint: 'Appuyez à nouveau pour arrêter et envoyer', voiceCancel: 'Annuler l’enregistrement', voiceFinishing: 'Reconnaissance…', voiceUnsupported: 'La saisie vocale est indisponible. Appuyez sur la question pour écrire.' },
  ja: { voiceHint: 'タップして録音と質問を開く', voiceReleaseHint: 'もう一度タップして停止・送信', voiceCancel: '録音をキャンセル', voiceFinishing: '認識中…', voiceUnsupported: '音声入力は利用できません。「質問する」をタップして文字を入力してください。' },
}

const experienceMessages: Record<TourLocale, Partial<Record<keyof typeof zh, string>>> = {
  zh: { },
  en: { showRoute: 'Show route', hideRoute: 'Hide route', },
  ru: { showRoute: 'Показать маршрут', hideRoute: 'Скрыть маршрут', },
  es: { showRoute: 'Mostrar ruta', hideRoute: 'Ocultar ruta', },
  fr: { showRoute: 'Afficher le parcours', hideRoute: 'Masquer le parcours', },
  ja: { showRoute: 'ルートを表示', hideRoute: 'ルートを隠す', },
}

const navigationMessages = {
  zh: { liveCommentary: '实时讲解', commentaryRoom: '房间', login: '登录', account: '账号', manageAccount: '管理当前账号', accountLogin: '账号登录' },
  en: { liveCommentary: 'Live commentary', commentaryRoom: 'Room', login: 'Sign in', account: 'Account', manageAccount: 'Manage account', accountLogin: 'Sign in to your account' },
  ru: { liveCommentary: 'Живой комментарий', commentaryRoom: 'Комната', login: 'Войти', account: 'Аккаунт', manageAccount: 'Управление аккаунтом', accountLogin: 'Войти в аккаунт' },
  es: { liveCommentary: 'Comentarios en directo', commentaryRoom: 'Sala', login: 'Acceder', account: 'Cuenta', manageAccount: 'Gestionar cuenta', accountLogin: 'Acceder a tu cuenta' },
  fr: { liveCommentary: 'Commentaire en direct', commentaryRoom: 'Salon', login: 'Connexion', account: 'Compte', manageAccount: 'Gérer le compte', accountLogin: 'Se connecter à son compte' },
  ja: { liveCommentary: 'リアルタイム解説', commentaryRoom: 'ルーム', login: 'ログイン', account: 'アカウント', manageAccount: 'アカウント管理', accountLogin: 'アカウントにログイン' },
} satisfies Record<TourLocale, Record<'liveCommentary' | 'commentaryRoom' | 'login' | 'account' | 'manageAccount' | 'accountLogin', string>>

const tourInterfaceMessages = {
  zh: {
    noMatchingRoutes: '没有匹配的路线，请更换关键词',
    tourTitle: '寻迹 · 漫游', cityTour: '城市漫游', allDestinations: '全部目的地', map2dHint: '当前地图引擎不支持立体建筑',
    switchJourney: '切换行程', switchJourneyConfirm: '结束「{title}」并开始新行程？', endJourneyConfirm: '结束本次行程并保留已完成的站点记录？',
    locationHint: '点击跟随视角可在地图上查看当前位置', locationAccuracy: '定位已开启 · 精度约 {accuracy} 米', confirm: '确定', cancel: '取消',
  },
  en: {
    noMatchingRoutes: 'No matching routes. Try another keyword.',
    tourTitle: 'Path Seeker · Tour', cityTour: 'City tour', allDestinations: 'All destinations', map2dHint: 'This map does not support 3D buildings',
    switchJourney: 'Switch journey', switchJourneyConfirm: 'End “{title}” and start a new journey?', endJourneyConfirm: 'End this journey and keep completed stops?',
    locationHint: 'Tap follow to see your current location on the map.', locationAccuracy: 'Location on · Accuracy about {accuracy} m', confirm: 'Confirm', cancel: 'Cancel',
  },
  ru: {
    noMatchingRoutes: 'Маршруты не найдены. Попробуйте другое слово.',
    tourTitle: 'Path Seeker · Прогулка', cityTour: 'Прогулка по городу', allDestinations: 'Все направления', map2dHint: 'Эта карта не поддерживает трёхмерные здания',
    switchJourney: 'Сменить маршрут', switchJourneyConfirm: 'Завершить «{title}» и начать новый маршрут?', endJourneyConfirm: 'Завершить прогулку и сохранить пройденные остановки?',
    locationHint: 'Нажмите отслеживание, чтобы увидеть своё местоположение на карте.', locationAccuracy: 'Геолокация включена · Точность около {accuracy} м', confirm: 'Подтвердить', cancel: 'Отмена',
  },
  es: {
    noMatchingRoutes: 'No hay rutas coincidentes. Prueba otra palabra.',
    tourTitle: 'Path Seeker · Recorrido', cityTour: 'Recorrido por la ciudad', allDestinations: 'Todos los destinos', map2dHint: 'Este mapa no admite edificios en 3D',
    switchJourney: 'Cambiar recorrido', switchJourneyConfirm: '¿Finalizar «{title}» e iniciar un nuevo recorrido?', endJourneyConfirm: '¿Finalizar este recorrido y conservar las paradas completadas?',
    locationHint: 'Pulsa seguir para ver tu ubicación actual en el mapa.', locationAccuracy: 'Ubicación activada · Precisión de unos {accuracy} m', confirm: 'Confirmar', cancel: 'Cancelar',
  },
  fr: {
    noMatchingRoutes: 'Aucun parcours correspondant. Essayez un autre mot.',
    tourTitle: 'Path Seeker · Parcours', cityTour: 'Balade en ville', allDestinations: 'Toutes les destinations', map2dHint: 'Cette carte ne prend pas en charge les bâtiments en 3D',
    switchJourney: 'Changer de parcours', switchJourneyConfirm: 'Terminer « {title} » et commencer un nouveau parcours ?', endJourneyConfirm: 'Terminer ce parcours et conserver les étapes terminées ?',
    locationHint: 'Appuyez sur le suivi pour voir votre position sur la carte.', locationAccuracy: 'Localisation activée · Précision d’environ {accuracy} m', confirm: 'Confirmer', cancel: 'Annuler',
  },
  ja: {
    noMatchingRoutes: '一致するコースがありません。別のキーワードをお試しください。',
    tourTitle: 'Path Seeker · 散策', cityTour: '街歩き', allDestinations: 'すべての目的地', map2dHint: 'この地図は3D建物表示に対応していません',
    switchJourney: 'コースを切り替え', switchJourneyConfirm: '「{title}」を終了して、新しいコースを開始しますか？', endJourneyConfirm: '完了したスポットの記録を残して、このコースを終了しますか？',
    locationHint: '追跡ボタンで地図上の現在地を確認できます。', locationAccuracy: '位置情報は有効です · 精度は約{accuracy}メートル', confirm: '確認', cancel: 'キャンセル',
  },
} satisfies Record<TourLocale, Record<'noMatchingRoutes' | 'tourTitle' | 'cityTour' | 'allDestinations' | 'map2dHint' | 'switchJourney' | 'switchJourneyConfirm' | 'endJourneyConfirm' | 'locationHint' | 'locationAccuracy' | 'confirm' | 'cancel', string>>

export type TourMessages = Record<keyof typeof zh | keyof typeof navigationMessages.zh | keyof typeof tourInterfaceMessages.zh, string>

const messages: Record<TourLocale, Partial<Record<keyof typeof zh, string>>> = {
  zh,
  en: { chooseLanguage: 'Choose your language', routes: 'Choose your journey', routeHint: 'A different guide, a different side of Beijing.', search: 'Search routes or guides', start: 'Start journey', startHint: 'Choose a stop and tap play to hear the guide.', back: 'Back to map', end: 'End journey', play: 'Play narration', pause: 'Pause', resume: 'Resume', content: 'View story', close: 'Close', next: 'Up next', complete: 'Complete this stop', locationFailed: 'Location unavailable. Select a stop manually.', permissionDenied: 'Location permission is denied. Allow it in your browser settings and retry.', loading: 'Loading…', retry: 'Retry', noRoutes: 'No published routes in this language', noNarration: 'No narration in this language for this stop', voiceMissing: 'This language voice is unavailable. You can read the story.', playbackFailed: 'Unable to play. Retry or read the story.', minutes: 'min', stops: 'stops', finished: 'Journey completed', ask: 'Ask', routeUnavailable: 'This route or language version is unavailable. Choose another route.', loadFailed: 'Unable to load. Please retry.', startFailed: 'Unable to start. Please retry.', saveFailed: 'Progress could not be saved. Please retry.', video: 'Watch video', guide: 'Guide', noMap: 'Map unavailable. You can select routes and play stories.', changeLanguage: 'Change language', zoomIn: 'Zoom in', zoomOut: 'Zoom out', overview: 'Route overview', follow: 'Follow view', unfollow: 'Stop following', voiceAsk: 'Ask by voice', voiceStop: 'Stop listening', voiceHint: 'Tap and speak', voiceUnsupported: 'Voice input is not supported in this browser; switched to typing.', extraAudio: 'Extra audio', beforeAudio: 'Before the story', afterAudio: 'After the story', skipExtraAudio: 'Skip extra audio', replayStop: 'Replay this stop', playingNow: 'Now playing', approximateResume: 'System voice resumes sentence by sentence, so the position is approximate', autoplayBlocked: 'The browser blocked autoplay', continuePlayback: 'Continue playing', extraAudioFailed: 'Extra audio failed and was skipped: ', locationUnknown: 'Location accuracy is low; map following may be inaccurate.', secondsShort: 's' },
  ru: { chooseLanguage: 'Выберите язык', routes: 'Выберите маршрут', routeHint: 'У каждого гида — свой Пекин.', search: 'Маршруты и гиды', start: 'Начать прогулку', startHint: 'Выберите остановку и нажмите воспроизведение, чтобы слушать гида.', back: 'К карте', end: 'Завершить прогулку', play: 'Слушать рассказ', pause: 'Пауза', resume: 'Продолжить', content: 'Открыть рассказ', close: 'Закрыть', next: 'Далее', complete: 'Завершить остановку', locationFailed: 'Геолокация недоступна. Выберите остановку вручную.', permissionDenied: 'Доступ к геолокации запрещён. Разрешите его в настройках браузера и повторите.', loading: 'Загрузка…', retry: 'Повторить', noRoutes: 'Нет опубликованных маршрутов на этом языке', noNarration: 'Нет рассказа на этом языке', voiceMissing: 'Голос для этого языка недоступен. Можно прочитать рассказ.', playbackFailed: 'Не удалось воспроизвести. Повторите или прочитайте рассказ.', minutes: 'мин', stops: 'остановок', finished: 'Прогулка завершена', ask: 'Спросить', routeUnavailable: 'Маршрут или языковая версия недоступны. Выберите другой маршрут.', loadFailed: 'Не удалось загрузить. Повторите.', startFailed: 'Не удалось начать. Повторите.', saveFailed: 'Не удалось сохранить. Повторите.', video: 'Смотреть видео', guide: 'Гид', noMap: 'Карта недоступна. Можно выбирать маршруты и слушать рассказы.', changeLanguage: 'Сменить язык', zoomIn: 'Приблизить', zoomOut: 'Отдалить', overview: 'Весь маршрут', follow: 'Режим слежения', unfollow: 'Выйти из слежения', voiceAsk: 'Спросить голосом', voiceStop: 'Остановить', voiceHint: 'Нажмите и говорите', voiceUnsupported: 'Голосовой ввод недоступен в этом браузере; переключено на текст.', extraAudio: 'Дополнительное аудио', beforeAudio: 'Перед рассказом', afterAudio: 'После рассказа', skipExtraAudio: 'Пропускать дополнительное аудио', replayStop: 'Повторить остановку', playingNow: 'Сейчас играет', approximateResume: 'Системный голос продолжает по предложениям, позиция приблизительная', autoplayBlocked: 'Браузер заблокировал автовоспроизведение', continuePlayback: 'Продолжить воспроизведение', extraAudioFailed: 'Дополнительное аудио не воспроизвелось и пропущено: ', locationUnknown: 'Низкая точность геолокации может повлиять на отслеживание на карте.', secondsShort: 'с' },
  es: { chooseLanguage: 'Elige tu idioma', routes: 'Elige tu recorrido', routeHint: 'Cada guía cuenta un Pekín diferente.', search: 'Busca rutas o guías', start: 'Iniciar recorrido', startHint: 'Elige una parada y pulsa reproducir para escuchar al guía.', back: 'Volver al mapa', end: 'Finalizar recorrido', play: 'Escuchar relato', pause: 'Pausar', resume: 'Continuar', content: 'Ver relato', close: 'Cerrar', next: 'A continuación', complete: 'Completar esta parada', locationFailed: 'Ubicación no disponible. Selecciona una parada.', permissionDenied: 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador y reintenta.', loading: 'Cargando…', retry: 'Reintentar', noRoutes: 'No hay rutas publicadas en este idioma', noNarration: 'No hay relato en este idioma para esta parada', voiceMissing: 'La voz de este idioma no está disponible. Puedes leer el relato.', playbackFailed: 'No se puede reproducir. Reintenta o lee el relato.', minutes: 'min', stops: 'paradas', finished: 'Recorrido completado', ask: 'Preguntar', routeUnavailable: 'La ruta o versión de idioma no está disponible. Elige otra ruta.', loadFailed: 'No se pudo cargar. Reintenta.', startFailed: 'No se pudo iniciar. Reintenta.', saveFailed: 'No se pudo guardar. Reintenta.', video: 'Ver vídeo', guide: 'Guía', noMap: 'Mapa no disponible. Puedes elegir rutas y escuchar relatos.', changeLanguage: 'Cambiar idioma', zoomIn: 'Acercar', zoomOut: 'Alejar', overview: 'Ver toda la ruta', follow: 'Vista de seguimiento', unfollow: 'Dejar de seguir', voiceAsk: 'Preguntar por voz', voiceStop: 'Detener', voiceHint: 'Toca y habla', voiceUnsupported: 'Este navegador no admite voz; cambiado a texto.', extraAudio: 'Audio adicional', beforeAudio: 'Antes del relato', afterAudio: 'Después del relato', skipExtraAudio: 'Omitir el audio adicional', replayStop: 'Repetir esta parada', playingNow: 'Reproduciendo', approximateResume: 'La voz del sistema se reanuda frase a frase, así que la posición es aproximada', autoplayBlocked: 'El navegador bloqueó la reproducción automática', continuePlayback: 'Continuar la reproducción', extraAudioFailed: 'El audio adicional falló y se omitió: ', locationUnknown: 'La ubicación es poco precisa; el seguimiento en el mapa puede ser inexacto.', secondsShort: 's' },
  fr: {
    chooseLanguage: 'Choisissez votre langue', routes: 'Choisissez votre parcours', routeHint: 'Chaque guide vous fait découvrir un autre visage de Pékin.', search: 'Rechercher un parcours ou un guide', start: 'Commencer le parcours', startHint: 'Choisissez une étape et appuyez sur lecture pour écouter le guide.', back: 'Retour à la carte', end: 'Terminer le parcours',
    play: 'Écouter le récit', pause: 'Pause', resume: 'Reprendre', content: 'Lire le récit', close: 'Fermer', next: 'À suivre', complete: 'Terminer cette étape', locationFailed: 'Localisation indisponible. Sélectionnez une étape manuellement.', permissionDenied: 'Autorisation de localisation refusée. Autorisez-la dans les réglages du navigateur, puis réessayez.', loading: 'Chargement…', retry: 'Réessayer',
    noRoutes: 'Aucun parcours publié dans cette langue', noNarration: 'Aucun récit dans cette langue pour cette étape', voiceMissing: 'La voix de cette langue est indisponible. Vous pouvez lire le récit.', playbackFailed: 'Lecture impossible. Réessayez ou lisez le récit.', minutes: 'min', stops: 'étapes', finished: 'Parcours terminé', ask: 'Poser une question',
    routeUnavailable: 'Ce parcours ou sa version linguistique est indisponible. Choisissez un autre parcours.', loadFailed: 'Chargement impossible. Réessayez.', startFailed: 'Impossible de commencer. Réessayez.', saveFailed: 'Impossible de sauvegarder votre progression. Réessayez.', video: 'Voir la vidéo', guide: 'Guide', noMap: 'Carte indisponible. Vous pouvez choisir un parcours et écouter les récits.', changeLanguage: 'Changer de langue',
    zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', overview: 'Vue du parcours', follow: 'Suivre ma position', unfollow: 'Arrêter le suivi', voiceAsk: 'Poser une question à voix haute', voiceStop: 'Arrêter l’écoute', voiceHint: 'Appuyez et parlez', voiceUnsupported: 'Ce navigateur ne permet pas la saisie vocale. Saisissez votre question au clavier.',
    extraAudio: 'Audio supplémentaire', beforeAudio: 'Avant le récit', afterAudio: 'Après le récit', skipExtraAudio: 'Ignorer l’audio supplémentaire', replayStop: 'Réécouter cette étape', playingNow: 'Lecture en cours', approximateResume: 'La voix système reprend phrase par phrase, la position est donc approximative', autoplayBlocked: 'Le navigateur a bloqué la lecture automatique', continuePlayback: 'Continuer la lecture', extraAudioFailed: 'L’audio supplémentaire a échoué et a été ignoré : ', locationUnknown: 'La localisation est peu précise ; le suivi sur la carte peut être inexact.', secondsShort: 's',
  },
  ja: {
    chooseLanguage: 'ガイドの言語を選択', routes: 'コースを選択', routeHint: 'ガイドとともに、北京のさまざまな魅力を発見しましょう。', search: 'コースやガイドを検索', start: 'コースを開始', startHint: 'スポットを選び、再生ボタンでガイドをお聞きください。', back: '地図に戻る', end: 'コースを終了',
    play: 'ガイドを再生', pause: '一時停止', resume: '再開', content: '解説を読む', close: '閉じる', next: '次のスポット', complete: 'このスポットを完了', locationFailed: '位置情報を取得できません。スポットを手動で選択してください。', permissionDenied: '位置情報の利用が許可されていません。ブラウザの設定で許可してから再試行してください。', loading: '読み込み中…', retry: '再試行',
    noRoutes: 'この言語で公開されているコースはありません', noNarration: 'このスポットにはこの言語の解説がありません', voiceMissing: 'この言語の音声が利用できません。解説をお読みください。', playbackFailed: '再生できません。再試行するか、解説をお読みください。', minutes: '分', stops: 'スポット', finished: 'コースを完了しました', ask: '質問する',
    routeUnavailable: 'このコースまたは言語版は利用できません。別のコースを選択してください。', loadFailed: '読み込めませんでした。再試行してください。', startFailed: '開始できませんでした。再試行してください。', saveFailed: '進行状況を保存できませんでした。再試行してください。', video: '動画を見る', guide: 'ガイド', noMap: '地図が利用できません。コースの選択とガイドの再生は可能です。', changeLanguage: '言語を変更',
    zoomIn: '拡大', zoomOut: '縮小', overview: 'コース全体を表示', follow: '現在地を追跡', unfollow: '追跡を終了', voiceAsk: '音声で質問', voiceStop: '音声入力を終了', voiceHint: 'タップして話してください', voiceUnsupported: 'このブラウザーは音声入力に対応していません。文字で質問してください。',
    extraAudio: '追加音声', beforeAudio: '解説の前', afterAudio: '解説の後', skipExtraAudio: '追加音声をスキップ', replayStop: 'このスポットを最初から再生', playingNow: '再生中', approximateResume: 'システム音声は文単位で再開するため、位置はおおよそです', autoplayBlocked: 'ブラウザーが自動再生をブロックしました', continuePlayback: '再生を続ける', extraAudioFailed: '追加音声を再生できずスキップしました：', locationUnknown: '位置情報の精度が低いため、地図の追跡表示に誤差が生じる場合があります。', secondsShort: '秒',
  },
}

export function tourMessages(locale: TourLocale): TourMessages {
  return {
    // 中文基线保证任何语言都不会缺键（v5 新增文案见 extraMessages）
    ...zh,
    ...messages[locale],
    ...extraMessages[locale],
    ...experienceMessages[locale],
    ...voiceMessages[locale],
    ...navigationMessages[locale],
    ...tourInterfaceMessages[locale],
  }
}
