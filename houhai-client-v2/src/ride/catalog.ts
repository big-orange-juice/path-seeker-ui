import { catalog } from '../data/catalog.ts'
import type { Locale, RideCatalog, RideRoute } from './types.ts'
import { ridePhotos } from './media.ts'

type LocalText = Record<Locale, string>
const names: Record<string, LocalText> = {
  bridge: { zh: '银锭桥', en: 'Yinding Bridge', ru: 'Мост Иньдин', es: 'Puente Yinding' },
  hutong: { zh: '烟袋斜街', en: 'Yandai Xiejie', ru: 'Улица Яньдай Сецзе', es: 'Calle Yandai Xiejie' },
  temple: { zh: '广化寺', en: 'Guanghua Temple', ru: 'Храм Гуанхуа', es: 'Templo Guanghua' },
  garden: { zh: '宋庆龄故居', en: 'Former Residence of Soong Ching-ling', ru: 'Дом-музей Сун Цинлин', es: 'Antigua residencia de Soong Ching-ling' },
  palace: { zh: '恭王府', en: "Prince Gong’s Mansion", ru: 'Дворец князя Гуна', es: 'Mansión del príncipe Gong' },
}
const stories: Record<string, LocalText> = {
  bridge: {
    zh: '眼前的银锭桥，连接着前海和后海。这座小巧的石桥既是水面的分界，也是两岸日常生活的纽带。请把视线从桥面移向水面，看看湖岸、柳树和胡同如何在这里交汇。“银锭观山”是老北京的一处名景；今天，我们也可以从这座桥开始，认识什刹海的水与城。',
    en: 'Yinding Bridge connects Qianhai and Houhai. This small stone bridge marks a meeting of two lakes and links everyday life on their shores. Look from the bridge towards the water: lakeside willows and narrow hutong lanes meet here. The view of distant hills from this bridge was once celebrated in old Beijing. Today it remains a good place to understand how water and neighbourhoods shape Shichahai.',
    ru: 'Мост Иньдин соединяет озёра Цяньхай и Хоухай. Этот небольшой каменный мост связывает не только два берега, но и повседневную жизнь соседних кварталов. Посмотрите на воду, ивы и узкие переулки хутунов. Когда-то отсюда любовались далёкими горами. Сегодня мост помогает понять, как озёра и старые кварталы вместе создают облик Шичахая.',
    es: 'El puente Yinding conecta los lagos Qianhai y Houhai. Este pequeño puente de piedra une también la vida cotidiana de ambas orillas. Mira hacia el agua: aquí se encuentran los sauces, la ribera y los estrechos hutongs. La vista de las montañas desde este puente fue célebre en el antiguo Pekín. Hoy permite entender cómo el agua y los barrios dan forma a Shichahai.',
  },
  hutong: {
    zh: '烟袋斜街的方向，与北京老城常见的横平竖直不同。它从鼓楼一带斜向什刹海，顺应着湖岸和街巷的关系。沿途可以留意店铺招牌、屋檐和巷口。这些细小的线索，记录了街道如何连接买卖与日常生活。关于“烟袋”的名字，人们常把它与过去经营烟具的店铺联系起来。',
    en: 'Yandai Xiejie runs diagonally through a city known for its regular street grid. It leads from the Drum Tower area towards Shichahai, following the relationship between the lanes and the lakeshore. Notice shop signs, rooflines and the entrances to side alleys. These details tell the story of trade and daily life. The street’s name, often translated as Tobacco Pipe Lane, is commonly associated with its former tobacco pipe shops.',
    ru: 'Улица Яньдай Сецзе идёт по диагонали, в отличие от привычной прямоугольной сетки старого Пекина. Она ведёт от района Барабанной башни к Шичахаю. Обратите внимание на вывески, карнизы и входы в переулки: в них сохранилась история торговли и повседневной жизни. Название улицы, которое часто переводят как «переулок курительных трубок», связывают с лавками, торговавшими такими трубками.',
    es: 'Yandai Xiejie cruza en diagonal una ciudad conocida por sus calles rectas. Va desde la zona de la Torre del Tambor hacia Shichahai, adaptándose a la ribera. Observa los letreros, los aleros y las entradas a los callejones: cuentan la historia del comercio y de la vida diaria. Su nombre, que suele traducirse como Calle de las Pipas de Tabaco, se relaciona con las antiguas tiendas de pipas.',
  },
  temple: {
    zh: '广化寺藏在后海北岸的鸦儿胡同里，历史可追溯到元代。从外部观察山门和屋顶，就能体会传统建筑的中轴与对称。相比开阔的湖面，寺院的院落显得安静而收敛。这里仍是宗教活动场所，可以先从车上认识它；若要进入，请遵守现场开放安排，并保持安静。',
    en: 'Guanghua Temple stands in Ya’er Hutong on the north side of Houhai. Its history reaches back to the Yuan dynasty. From outside, the entrance and roofline reveal the symmetry and central axis of traditional architecture. The enclosed courtyards contrast with the open lake. This is still a place of worship. You can appreciate it from your ride; entry depends on the current visiting arrangements.',
    ru: 'Храм Гуанхуа находится в переулке Яэр на северном берегу Хоухая. Его история восходит к эпохе Юань. Даже снаружи можно увидеть симметрию и центральную ось традиционной архитектуры. Тихие замкнутые дворы контрастируют с простором озера. Это действующий храм. Во время поездки можно рассмотреть его снаружи; посещение зависит от местных правил.',
    es: 'El templo Guanghua se encuentra en el hutong Ya’er, al norte de Houhai. Su historia se remonta a la dinastía Yuan. Desde fuera, la entrada y los tejados muestran la simetría de la arquitectura tradicional. Los patios cerrados contrastan con la amplitud del lago. Sigue siendo un lugar de culto. Puedes observarlo durante el paseo; para entrar, consulta las condiciones de visita.',
  },
  garden: {
    zh: '后海北沿的这处庭院，是宋庆龄晚年生活和工作的地方。她于一九六三年迁居于此。认识这处故居，可以从房间、庭园和日常生活的细节入手。树木、水面和建筑共同构成了庭院的环境。车上看到的是故居沿街的景象；若想进一步参观室内展陈，需要按照现场开放和预约安排进入。',
    en: 'This lakeside courtyard was the home and workplace of Soong Ching-ling in her later years. She moved here in 1963. Rooms, gardens and everyday objects offer a personal perspective on her life. Trees, water and buildings form a single garden setting. From the rickshaw you see the street-facing part of the residence. Interior exhibitions require a separate visit under the site’s opening and booking arrangements.',
    ru: 'Этот двор у озера был домом и местом работы Сун Цинлин в последние годы её жизни. Она переехала сюда в 1963 году. Комнаты, сад и повседневные предметы позволяют узнать её с более личной стороны. Деревья, вода и здания образуют единый ансамбль. Из велорикши видна уличная сторона усадьбы; для осмотра экспозиции нужно отдельное посещение.',
    es: 'Este patio junto al lago fue el hogar y lugar de trabajo de Soong Ching-ling durante sus últimos años. Se trasladó aquí en 1963. Las habitaciones, el jardín y los objetos cotidianos ofrecen una mirada personal a su vida. Árboles, agua y edificios forman un conjunto. Desde el vehículo se ve el exterior; las exposiciones interiores requieren una visita aparte según los horarios y las reservas.',
  },
  palace: {
    zh: '恭王府是北京保存较为完整的清代王府建筑群。前部府邸以院落和轴线组织空间，后部园林则用山石、水景与曲折路径营造变化。从街外认识王府，可以先留意围墙、门与街巷的尺度。真正走入府邸和花园，需要另行安排参观；这趟讲解先带你理解它与老北京城市生活的关系。',
    en: 'Prince Gong’s Mansion is one of Beijing’s best-preserved princely residences from the Qing dynasty. The front section is ordered around courtyards and axes, while the garden uses rocks, water and winding paths to create changing views. From the street, notice the walls, gates and the scale of nearby lanes. Visiting the buildings and garden requires separate admission. This story introduces their place in the life of old Beijing.',
    ru: 'Дворец князя Гуна — одна из наиболее полно сохранившихся княжеских усадеб Пекина эпохи Цин. Передняя часть построена вокруг дворов и осей, а сад создаёт сменяющиеся виды с помощью камней, воды и извилистых дорожек. С улицы обратите внимание на стены, ворота и соседние переулки. Для осмотра дворца и сада требуется отдельное посещение.',
    es: 'La mansión del príncipe Gong es una de las residencias principescas mejor conservadas de la dinastía Qing en Pekín. La parte delantera se organiza en patios y ejes; el jardín combina rocas, agua y caminos sinuosos. Desde la calle, observa los muros, las puertas y las proporciones de los callejones. La visita al interior y al jardín requiere una entrada aparte.',
  },
}

const routeTexts: Record<string, { title: LocalText; guide: LocalText; style: LocalText; introduction: LocalText }> = {
  '2096000000000000001': {
    title: { zh: '后海慢游 · 湖与胡同', en: 'Houhai · Lakes and hutongs', ru: 'Хоухай · Озёра и хутуны', es: 'Houhai · Lagos y hutongs' },
    guide: { zh: '陈老师', en: 'Guide Chen', ru: 'Гид Чэнь', es: 'Guía Chen' },
    style: { zh: '城市历史 · 细说北京', en: 'City history · Beijing in detail', ru: 'История города · Пекин в деталях', es: 'Historia urbana · Pekín al detalle' },
    introduction: { zh: '我是陈老师。这一程，我们从城市历史出发，看看水岸与胡同怎样共同塑造北京。', en: 'I am your guide Chen. We will explore how the lakes and hutongs shaped Beijing through its history.', ru: 'Я ваш гид Чэнь. Мы узнаем, как озёра и хутуны создавали Пекин на протяжении его истории.', es: 'Soy tu guía Chen. Descubriremos cómo los lagos y los hutongs dieron forma a la historia de Pekín.' },
  },
  '2096000000000000002': {
    title: { zh: '水岸寻静 · 古寺与故居', en: 'Quiet shores · Temple and residence', ru: 'Тихий берег · Храм и усадьба', es: 'Orillas tranquilas · Templo y residencia' },
    guide: { zh: '小林', en: 'Guide Lin', ru: 'Гид Линь', es: 'Guía Lin' },
    style: { zh: '亲子观察 · 一起发现', en: 'Family discovery · Look closer', ru: 'Для всей семьи · Наблюдаем вместе', es: 'En familia · Descubrimos juntos' },
    introduction: { zh: '我是小林。试着和同行的家人一起，找找眼前的形状、屋顶和倒影，不必急着记住年代。', en: 'I am your guide Lin. Look together for shapes, roofs and reflections. There is no need to memorise dates: start with what you can see.', ru: 'Я ваш гид Линь. Давайте вместе искать интересные формы, крыши и отражения. Не нужно запоминать даты: начнём с того, что видно вокруг.', es: 'Soy tu guía Lin. Busquemos formas, tejados y reflejos en familia. No hace falta memorizar fechas: empecemos por lo que vemos.' },
  },
  '2096000000000000003': {
    title: { zh: '京味拾光 · 街巷与王府', en: 'Old Beijing · Lanes and a mansion', ru: 'Старый Пекин · Улицы и дворец', es: 'Viejo Pekín · Callejones y palacio' },
    guide: { zh: '周老师', en: 'Guide Zhou', ru: 'Гид Чжоу', es: 'Guía Zhou' },
    style: { zh: '古建园林 · 看懂空间', en: 'Architecture · Reading the city', ru: 'Архитектура · Читаем город', es: 'Arquitectura · Leer la ciudad' },
    introduction: { zh: '我是周老师。这一程，请留意门、屋檐和街道的尺度。建筑之间的关系，也是理解北京的一条线索。', en: 'I am your guide Zhou. Notice gates, rooflines and the scale of the streets. The spaces between buildings offer another way to understand Beijing.', ru: 'Я ваш гид Чжоу. Обратите внимание на ворота, карнизы и ширину улиц. Пространство между зданиями помогает по-новому понять Пекин.', es: 'Soy tu guía Zhou. Observa puertas, aleros y la anchura de las calles. Los espacios entre edificios nos ayudan a entender Pekín.' },
  },
}

export function buildRideCatalog(locale: Locale): RideCatalog {
  const routes: RideRoute[] = catalog.routes.filter(route => route.scene === 'rickshaw' && routeTexts[route.id]).map(route => {
    const copy = routeTexts[route.id]
    const stops = route.stopIds.flatMap(id => {
      const place = catalog.places.find(candidate => candidate.id === id)
      if (!place) return []
      const name = names[place.artwork][locale]
      const text = stories[place.artwork][locale]
      return [{ ...place, name, subtitle: name, intro: text, category: copy.style[locale], address: name, visitNote: '',
        narration: [{ title: name, text: `${copy.introduction[locale]} ${text}` }], guideNarrations: undefined,
        photo: ridePhotos[place.artwork],
      }]
    })
    return { ...route, title: copy.title[locale], subtitle: copy.style[locale], description: copy.introduction[locale], tag: copy.style[locale],
      distance: route.distance.replace('约 ', ''), transportNote: '', guideName: copy.guide[locale], specialty: copy.style[locale], introduction: copy.introduction[locale], stops }
  })
  return { locale, routes }
}

export async function getRideCatalog(locale: Locale): Promise<RideCatalog> {
  return structuredClone(buildRideCatalog(locale))
}
