import type { Locale } from './types'

export const languages = [
  { id: 'zh', name: '中文', speech: 'zh-CN' },
  { id: 'en', name: 'English', speech: 'en-US' },
  { id: 'ru', name: 'Русский', speech: 'ru-RU' },
  { id: 'es', name: 'Español', speech: 'es-ES' },
] as const

const labels = {
  area: ['什刹海', 'Shichahai', 'Шичахай', 'Shichahai'],
  welcome: ['一程湖光，沿途听北京', 'Along the lake, listen to Beijing', 'Пекин: истории у озера', 'Pekín, historias junto al lago'],
  chooseLanguage: ['选择讲解语言', 'Choose your language', 'Выберите язык', 'Elige tu idioma'],
  enter: ['进入', 'Enter', 'Войти', 'Entrar'],
  language: ['语言', 'Language', 'Язык', 'Idioma'],
  routes: ['选择这一程', 'Choose your journey', 'Выберите маршрут', 'Elige tu recorrido'],
  routeHint: ['跟随不同导游，听见不同的北京。', 'A different guide, a different side of Beijing.', 'У каждого гида — свой Пекин.', 'Cada guía cuenta un Pekín diferente.'],
  search: ['搜索路线、导游或途经点', 'Search routes, guides or stops', 'Маршруты, гиды и остановки', 'Busca rutas, guías o paradas'],
  start: ['开始行程', 'Start journey', 'Начать поездку', 'Comenzar recorrido'],
  resumeJourney: ['继续当前行程', 'Return to your journey', 'Вернуться к поездке', 'Volver al recorrido'],
  switchJourney: ['结束当前行程，开始所选路线', 'End this journey and start selected route', 'Завершить поездку и начать выбранный маршрут', 'Finalizar e iniciar la ruta seleccionada'],
  startHint: ['开启定位，沿途为你讲解', 'Enable location for stories along the way', 'Включите геолокацию для рассказов по пути', 'Activa la ubicación para escuchar el recorrido'],
  noRoutes: ['没有找到路线，试试其他关键词。', 'No routes found. Try another search.', 'Маршруты не найдены. Измените запрос.', 'No hay rutas. Prueba otra búsqueda.'],
  minutes: ['分钟', 'min', 'мин', 'min'],
  stops: ['途经点', 'Stops', 'Остановки', 'Paradas'],
  selected: ['已选择', 'Selected', 'Выбрано', 'Seleccionada'],
  map: ['返回地图', 'Back to map', 'К карте', 'Volver al mapa'],
  now: ['此刻，听这里', 'The story here', 'История этого места', 'La historia de este lugar'],
  next: ['接下来看', 'Coming up', 'Далее по пути', 'A continuación'],
  approaching: ['正在接近', 'Approaching', 'Приближаемся к', 'Nos acercamos a'],
  uninterrupted: ['当前讲解将继续，结束后衔接新景点。', 'Your current story will finish before the next one starts.', 'Текущий рассказ продолжится до конца.', 'La narración actual terminará antes de pasar a la siguiente.'],
  play: ['播放讲解', 'Play story', 'Слушать рассказ', 'Escuchar'],
  pause: ['暂停讲解', 'Pause story', 'Пауза', 'Pausar'],
  resume: ['继续讲解', 'Resume story', 'Продолжить', 'Continuar'],
  paused: ['已暂停，点击继续后恢复讲解', 'Paused. Resume when you are ready.', 'Пауза. Нажмите «Продолжить».', 'En pausa. Continúa cuando quieras.'],
  waiting: ['留意沿途风景，到下一站附近继续讲解。', 'Enjoy the view. Stories continue near the next stop.', 'Наслаждайтесь видом. Рассказ продолжится у следующей остановки.', 'Disfruta del paisaje. La narración continúa cerca de la próxima parada.'],
  complete: ['这一程的故事已讲完，感谢同行。', 'The last story is finished. Thank you for joining us.', 'Последний рассказ завершён. Спасибо за поездку!', 'Terminó la última historia. Gracias por acompañarnos.'],
  expand: ['展开介绍', 'Read more', 'Подробнее', 'Leer más'],
  collapse: ['收起介绍', 'Read less', 'Свернуть', 'Leer menos'],
  showContent: ['展开讲解内容', 'Show story', 'Показать рассказ', 'Mostrar relato'],
  hideContent: ['收起内容，看看路线', 'Hide story, see the route', 'Скрыть рассказ, посмотреть маршрут', 'Ocultar relato y ver ruta'],
  video: ['观看视频', 'Watch video', 'Смотреть видео', 'Ver vídeo'],
  close: ['关闭', 'Close', 'Закрыть', 'Cerrar'],
  loading: ['正在准备沿途故事…', 'Preparing your stories…', 'Готовим рассказы…', 'Preparando las historias…'],
  loadError: ['内容暂时无法加载，请重试。', 'Stories could not load. Please retry.', 'Не удалось загрузить рассказы. Повторите попытку.', 'No se pudo cargar el contenido. Inténtalo de nuevo.'],
  retry: ['重试', 'Retry', 'Повторить', 'Reintentar'],
  mapError: ['地图暂不可用，仍可选择路线和听讲解。', 'Map unavailable. Routes and stories are still available.', 'Карта недоступна. Маршруты и рассказы доступны.', 'Mapa no disponible. Puedes elegir rutas y escuchar.'],
  mapLabel: ['沿途地图', 'Journey map', 'Карта маршрута', 'Mapa del recorrido'],
  zoomIn: ['放大', 'Zoom in', 'Приблизить', 'Acercar'],
  zoomOut: ['缩小', 'Zoom out', 'Отдалить', 'Alejar'],
  overview: ['路线全览', 'Whole route', 'Весь маршрут', 'Ver ruta completa'],
  locating: ['正在获取位置…', 'Finding your location…', 'Определяем местоположение…', 'Buscando tu ubicación…'],
  locationError: ['定位不可用，请允许浏览器访问位置后重试；也可手动选择途经点听讲解。', 'Location unavailable. Allow location access and retry, or select a stop manually.', 'Геолокация недоступна. Разрешите доступ или выберите остановку вручную.', 'Ubicación no disponible. Permite el acceso o elige una parada manualmente.'],
  lowAccuracy: ['定位精度不足，暂不自动切换讲解。', 'Location accuracy is low. Automatic stories are on hold.', 'Низкая точность геолокации. Автопереход приостановлен.', 'Ubicación imprecisa. Cambio automático en espera.'],
  tracking: ['沿途定位已开启', 'Location enabled', 'Геолокация включена', 'Ubicación activada'],
  speechError: ['语音暂不可用，点击播放重试，或阅读文字介绍。', 'Audio unavailable. Try play again or read the story.', 'Аудио недоступно. Повторите попытку или прочитайте текст.', 'Audio no disponible. Reintenta o lee el relato.'],
  voiceMissing: ['设备未提供此语言的语音，请安装对应语音包后重试；文字介绍仍可阅读。', 'No voice for this language is installed. Install one to listen; you can still read the story.', 'Голос для этого языка не установлен. Установите голосовой пакет или читайте текст.', 'No hay voz instalada para este idioma. Instálala o lee el relato.'],
  invalidRoute: ['扫码路线暂不可用，请选择其他路线。', 'The scanned route is unavailable. Choose another route.', 'Маршрут из QR-кода недоступен. Выберите другой.', 'La ruta del código no está disponible. Elige otra.'],
  end: ['结束行程', 'End journey', 'Завершить поездку', 'Finalizar recorrido'],
  photoUnavailable: ['实景图片暂不可用', 'Photo unavailable', 'Фото недоступно', 'Foto no disponible'],
  videoUnavailable: ['视频暂不可用，请稍后重试。', 'Video unavailable. Please try again later.', 'Видео недоступно. Попробуйте позже.', 'Vídeo no disponible. Inténtalo más tarde.'],
} satisfies Record<string, readonly [string, string, string, string]>

export type MessageKey = keyof typeof labels
export function message(locale: Locale, key: MessageKey): string {
  return labels[key][languages.findIndex(language => language.id === locale)]
}
export function isLocale(value: unknown): value is Locale {
  return languages.some(language => language.id === value)
}
