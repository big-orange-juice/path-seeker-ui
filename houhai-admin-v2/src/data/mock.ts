import type { ArtifactStage, CollectionItem, Coordinate, CulturalPlace, DemoDatabase, Destination, IndoorSpace, Locale, Narration, PublishStatus, SceneType, StageAudioStatus, StageImage, TourRoute } from '../types.ts'

export const destinations: Destination[] = [
  { id:'18446744073709551001',code:'BJ-HH-001',name:'北京·后海',sceneType:'outdoor',address:'北京市西城区什刹海街道',openingHours:'全天开放',status:'enabled',mapProvider:'Amap',coordinateSystem:'WGS84',latitude:39.9407,longitude:116.3868,boundaryGeoJson:'{"type":"Polygon","coordinates":[[[116.372,39.945],[116.401,39.945],[116.401,39.927],[116.372,39.927],[116.372,39.945]]]}',intro:'以什刹海水系、胡同生活与王府文化为主线的黄包车漫游目的地。',placeIds:['290000000000000001','290000000000000002','290000000000000003','290000000000000004','290000000000000005'],indoorSpaceIds:[] },
  { id:'18446744073709551002',code:'MUSEUM-001',name:'文化探索馆',sceneType:'indoor',address:'北京市西城区示范路 8 号',openingHours:'09:00–17:00（周一闭馆）',status:'enabled',mapProvider:'Amap',coordinateSystem:'WGS84',latitude:39.932,longitude:116.383,boundaryGeoJson:null,intro:'保留楼层、展厅、展品与设施管理能力的场馆示例。',placeIds:[],indoorSpaceIds:['380000000000000001','380000000000000002','380000000000000003','380000000000000004'] },
]

const narration = (placeId:string,suffix:string,guideName:string,guideStyle:string,title:string,script:string): Narration => ({ id:`${placeId}-${suffix}`,guideId:`guide-${suffix}`,guideName,guideStyle,title,durationSeconds:suffix==='01'?168:132,script,audioUrl:null,status:'published' })
const narrations = (id:string, topic:string): Narration[] => [
  narration(id,'01','顾远','城市史学者',`${topic}的城市记忆`,`${topic}看似只是路线上的一站，却连接着北京水系、街巷与居民生活。请留意建筑朝向和周边道路，它们保存了城市变化的线索。`),
  narration(id,'02','阿槐','胡同故事家',`车夫眼里的${topic}`,`老北京拉车人会用${topic}作为辨路和歇脚的地标。跟着车辙想象昔日街声，也看看今天仍在继续的胡同日常。`),
]

export const places: CulturalPlace[] = [
  { id:'290000000000000001',destinationId:'18446744073709551001',code:'HH-YDQ',name:'银锭桥',category:'历史桥梁',address:'前海与后海交界处',latitude:39.94052,longitude:116.38615,recommendedMinutes:12,status:'published',description:'燕京小八景“银锭观山”的取景点。',narrations:narrations('290000000000000001','银锭桥') },
  { id:'290000000000000002',destinationId:'18446744073709551001',code:'HH-YDXJ',name:'烟袋斜街',category:'历史街巷',address:'地安门外大街鼓楼前',latitude:39.94086,longitude:116.39363,recommendedMinutes:18,status:'published',description:'北京最古老的商业街之一，街形如烟袋。',narrations:narrations('290000000000000002','烟袋斜街') },
  { id:'290000000000000003',destinationId:'18446744073709551001',code:'HH-GHS',name:'广化寺',category:'宗教建筑',address:'鸦儿胡同 31 号',latitude:39.94366,longitude:116.39043,recommendedMinutes:15,status:'published',description:'北京佛教协会所在地，寺院格局严整。',narrations:narrations('290000000000000003','广化寺') },
  { id:'290000000000000004',destinationId:'18446744073709551001',code:'HH-SQL',name:'宋庆龄故居',category:'名人故居',address:'后海北沿 46 号',latitude:39.94506,longitude:116.38272,recommendedMinutes:28,status:'published',description:'原醇亲王府花园，兼具园林与近现代历史。',narrations:narrations('290000000000000004','宋庆龄故居') },
  { id:'290000000000000005',destinationId:'18446744073709551001',code:'HH-GWF',name:'恭王府',category:'王府园林',address:'柳荫街甲 14 号',latitude:39.93682,longitude:116.38155,recommendedMinutes:45,status:'published',description:'现存规模完整的清代王府建筑群。',narrations:[...narrations('290000000000000005','恭王府'),narration('290000000000000005','03','林澄','园林导览员','花园里的福字路线','后花园以蝠池、福字碑等意象串起祈福叙事，也形成一条适合慢游的园林路线。')] },
]

export const indoorSpaces: IndoorSpace[] = [
  {id:'380000000000000001',destinationId:'18446744073709551002',name:'一层',kind:'floor',parentId:null,description:'常设展与服务设施'},
  {id:'380000000000000002',destinationId:'18446744073709551002',name:'城市记忆厅',kind:'gallery',parentId:'380000000000000001',description:'地方历史常设展'},
  {id:'380000000000000003',destinationId:'18446744073709551002',name:'工艺生活厅',kind:'gallery',parentId:'380000000000000001',description:'传统工艺专题展'},
  {id:'380000000000000004',destinationId:'18446744073709551002',name:'咨询台',kind:'facility',parentId:'380000000000000001',description:'入口右侧'},
]

/* ------------------------------------------------------------------ *
 * 站点内容种子：按「文化点 / 文物 × 语言」维护，一条路线只使用其语言的种子。
 * ------------------------------------------------------------------ */

type SegmentSeed = [title: string, text: string, audioUrl: string | null, durationSeconds: number]
type PronunciationSeed = [phrase: string, pronunciation: string, note: string]

interface StageSeed {
  name: string; category: string; summary: string
  guideId: string; guideName: string; guideStyle: string
  segments: SegmentSeed[]
  pronunciations?: PronunciationSeed[]
  images?: StageImage[]
}

/** 站点配图占位：本地 SVG，避免 Demo 依赖外部图片资源。 */
export function createStageImage(id: string, caption: string, glyph: string, hue: number, source: StageImage['source'] = 'upload'): StageImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 26% 26%)"/><stop offset="1" stop-color="hsl(${hue} 32% 10%)"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="252" cy="58" r="40" fill="#ffffff14"/><text x="26" y="130" fill="#e6cf95" font-family="Georgia,serif" font-size="${glyph.length > 4 ? 20 : 38}">${glyph}</text><text x="26" y="164" fill="#c8d2cd" font-family="sans-serif" font-size="12">${caption}</text></svg>`
  return { id, caption, source, url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }
}

const indoorStageSeeds: { id: string; order: number; content: Partial<Record<Locale, StageSeed>> }[] = [
  {
    id: '690000000000000001', order: 1,
    content: {
      zh: { name: '大克鼎', category: '青铜器', summary: '西周晚期青铜重器，内壁铭文记录册命与土地赏赐。', guideId: 'guide-01', guideName: '顾远', guideStyle: '城市史学者',
        segments: [['先看器形', '先看整体：大口、深腹，三只蹄足稳稳落地，口沿上一对直耳。再看腹部环带纹，下面压着一圈兽面纹。把这几处看全，西周晚期青铜鼎的形制就大致清楚了。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/023_%E9%9D%92%E9%93%9C%E9%BC%8E.mp3', 91]],
        pronunciations: [['大克鼎', 'da4 ke4 ding3', '器名读音'], ['蹄足', 'ti2 zu2', '鼎的器足形制'], ['兽面纹', 'shou4 mian4 wen2', '青铜器常见纹样']],
        images: [createStageImage('690000000000000001-img-1', '器身全形 · 展柜实拍', '大克鼎', 32)] },
      en: { name: 'Da Ke Ding', category: 'Bronze', summary: 'A late Western Zhou cauldron whose inscription records land grants.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Urban historian',
        segments: [['Form and inscription', 'Look at the whole shape first: a wide mouth, a deep belly on three hoof-shaped legs, and a pair of upright handles. Then read the band of ring patterns above the animal masks, and finally the inscription cast on the inner wall.', null, 0]],
        pronunciations: [['Da Ke Ding', 'da4 ke4 ding3', 'Object name pronunciation']],
        images: [createStageImage('690000000000000001-img-1-en', 'Gallery view of the cauldron', 'Da Ke Ding', 32)] },
    },
  },
  {
    id: '690000000000000002', order: 2,
    content: {
      zh: { name: '青铜棘刺纹尊', category: '青铜器', summary: '春秋时期青铜酒器，器身布满棘刺状装饰。', guideId: 'guide-01', guideName: '顾远', guideStyle: '城市史学者',
        segments: [['器身观察', '各位，这件器物的名字有点长，但真正值得先看的不是名字，是器身上那层密密的尖刺。把目光落上去——是不是和咱们印象里的青铜礼器不太一样？猛一看不像酒器，倒像带着一身防备。它叫青铜棘刺纹尊，出土于松江区广富林遗址，年代目前推测为春秋时期。', 'demo:', 110]],
        pronunciations: [['青铜棘刺纹尊', 'qing1 tong2 ji2 ci4 wen2 zun1', '器名全称读音'], ['棘刺', 'ji2 ci4', '器表密集的尖刺状装饰'], ['尊', 'zun1', '青铜酒器器类'], ['范铸', 'fan4 zhu4', '青铜器铸造工艺'], ['广富林遗址', 'guang3 fu4 lin2 yi2 zhi3', '出土地点'], ['宴飨', 'yan4 xiang3', '礼仪活动']],
        images: [createStageImage('690000000000000002-img-1', '器身棘刺纹特写', '棘刺纹尊', 40), createStageImage('690000000000000002-img-2', '器物形制与尺寸对照', '形制图', 200, 'ai')] },
      en: { name: 'Bronze Zun with Spike Pattern', category: 'Bronze', summary: 'A Spring and Autumn wine vessel covered with dense spikes.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Urban historian',
        segments: [['Reading the surface', 'The name is long, but what deserves your first look is the dense layer of spikes across the body. Unearthed at Guangfulin in Songjiang, this wine vessel is dated to the Spring and Autumn period.', null, 0]],
        pronunciations: [['zun', 'zun1', 'Vessel type pronunciation']],
        images: [createStageImage('690000000000000002-img-1-en', 'Spike pattern close-up', 'Zun', 40)] },
      es: { name: 'Zun de bronce con espinas', category: 'Bronce', summary: 'Vasija de vino del período de Primaveras y Otoños cubierta de espinas.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Historiador urbano',
        segments: [['Leer la superficie', 'El nombre es largo, pero lo primero que merece tu mirada es la densa capa de espinas sobre el cuerpo. Fue hallada en Guangfulin, Songjiang, y se data en el período de Primaveras y Otoños.', null, 0]],
        pronunciations: [],
        images: [createStageImage('690000000000000002-img-1-es', 'Detalle de las espinas', 'Zun', 40)] },
    },
  },
  {
    id: '690000000000000003', order: 3,
    content: {
      zh: { name: '越王剑', category: '兵器', summary: '保存状态出色的青铜兵器，剑身纹饰与铭文清晰。', guideId: 'guide-03', guideName: '林澄', guideStyle: '园林导览员',
        segments: [['剑身与铭文', '把视线从剑柄移到剑身：菱形暗格纹一路铺开，靠近剑格的位置能看到两行铭文。剑刃至今少见锈蚀，是青铜兵器中保存状态非常出色的一件。', null, 0]],
        pronunciations: [['越王剑', 'yue4 wang2 jian4', '器名读音'], ['菱形暗格纹', 'ling2 xing2 an4 ge2 wen2', '剑身纹饰']],
        images: [createStageImage('690000000000000003-img-1', '剑身纹饰与铭文', '越王剑', 208)] },
      en: { name: 'Sword of the King of Yue', category: 'Weapon', summary: 'A bronze sword with remarkably clear patterns and inscriptions.', guideId: 'guide-03', guideName: 'Lin Cheng', guideStyle: 'Garden guide',
        segments: [['Blade and inscription', 'Move your eyes from the hilt to the blade: a diamond pattern runs along it, and two lines of inscription sit near the guard. The edge is almost free of corrosion.', null, 0]],
        pronunciations: [],
        images: [createStageImage('690000000000000003-img-1-en', 'Blade pattern and inscription', 'Sword', 208)] },
    },
  },
  {
    id: '690000000000000004', order: 4,
    content: {
      zh: { name: '练形十二生肖纹镜', category: '铜镜', summary: '十二生肖与传统时间观念在器物上的集中表达。', guideId: 'guide-02', guideName: '阿槐', guideStyle: '胡同故事家',
        segments: [['镜背的一圈时间', '把镜面翻过来，外圈是十二生肖，内圈是练形纹样。生肖与时间的对应关系被匠人绕成一圈，照镜子的动作于是也带上了纪年的意味。', null, 0]],
        pronunciations: [['练形', 'lian4 xing2', '镜背纹样题材'], ['十二生肖纹镜', 'shi2 er4 sheng1 xiao4 wen2 jing4', '器名读音']],
        images: [createStageImage('690000000000000004-img-1', '镜背纹样拓片', '生肖纹镜', 18, 'ai')] },
      en: { name: 'Mirror with Twelve Zodiac Animals', category: 'Bronze mirror', summary: 'The twelve zodiac animals arranged around a linked pattern.', guideId: 'guide-02', guideName: 'A Huai', guideStyle: 'Hutong storyteller',
        segments: [['A circle of time', 'Turn the mirror over: the outer ring carries the twelve zodiac animals, the inner ring a linked pattern. Time and reflection were designed to sit in one object.', null, 0]],
        pronunciations: [],
        images: [createStageImage('690000000000000004-img-1-en', 'Rubbing of the mirror back', 'Mirror', 18, 'ai')] },
    },
  },
  {
    id: '690000000000000005', order: 5,
    content: {
      zh: { name: '铜鎏金阿育王塔', category: '宗教艺术', summary: '以鎏金工艺与塔式结构呈现佛教造像艺术。', guideId: 'guide-03', guideName: '林澄', guideStyle: '园林导览员',
        segments: [['塔式结构与鎏金', '先看轮廓：塔身分层收束，四角起翘，表面残留的鎏金在光下泛暖。塔式造像把塔形与楼阁式屋檐叠在一起，是佛教艺术中国化的一条线索。', null, 0]],
        pronunciations: [['鎏金', 'liu2 jin1', '金属装饰工艺'], ['阿育王塔', 'a1 yu4 wang2 ta3', '塔式造像名称']],
        images: [createStageImage('690000000000000005-img-1', '塔身鎏金细节', '阿育王塔', 46), createStageImage('690000000000000005-img-2', '造像复原示意', '结构示意', 260, 'ai')] },
      en: { name: 'Gilt-bronze Ashoka Pagoda', category: 'Religious art', summary: 'A gilt pagoda model showing how Buddhist art met local architecture.', guideId: 'guide-03', guideName: 'Lin Cheng', guideStyle: 'Garden guide',
        segments: [['Structure and gilding', 'Look at the outline first: the body narrows in tiers, the corners lift, and traces of gilding still warm the surface. Models like this combine the stupa with Chinese eaves.', null, 0]],
        pronunciations: [],
        images: [createStageImage('690000000000000005-img-1-en', 'Gilded details of the pagoda', 'Pagoda', 46)] },
    },
  },
]

const outdoorStageSeeds: Record<string, Partial<Record<Locale, StageSeed>>> = {
  '290000000000000002': {
    zh: { name: '烟袋斜街', category: '历史街巷', summary: '北京最古老的商业街之一，街形如烟袋。', guideId: 'guide-02', guideName: '阿槐', guideStyle: '胡同故事家',
      segments: [['为什么是斜的', '北京老城的胡同多横平竖直，这条却东北—西南斜插向什刹海，全长两百多米，平均只有四米宽。元代这一带水面更大，这条街很可能是顺着当年的水岸自然走出来的。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/003_%E7%83%9F%E8%A2%8B%E6%96%9C%E8%A1%97.mp3', 58]],
      pronunciations: [['斜街', 'xie2 jie1', '与正街相对的街形'], ['幌子', 'huang3 zi', '旧时店铺门前的招幌'], ['什刹海', 'shi2 cha4 hai3', '地名，刹读 chà']],
      images: [createStageImage('290000000000000002-img-1', '烟袋斜街街景', '烟袋斜街', 32)] },
    en: { name: 'Yandai Xiejie', category: 'Historic lane', summary: 'One of the oldest commercial lanes in Beijing, laid out like a tobacco pipe.', guideId: 'guide-02', guideName: 'A Huai', guideStyle: 'Hutong storyteller',
      segments: [['Why it runs diagonally', 'Most lanes in the old city run straight; this one cuts north-east to south-west towards Shichahai. Over two hundred metres long and only four metres wide, it most likely followed the Yuan dynasty shoreline.', null, 0]],
      images: [createStageImage('290000000000000002-img-1-en', 'Yandai Xiejie lane', 'Yandai', 32)] },
    es: { name: 'Calle Yandai Xiejie', category: 'Calle histórica', summary: 'Una de las calles comerciales más antiguas de Pekín, con forma de pipa.', guideId: 'guide-02', guideName: 'A Huai', guideStyle: 'Narrador de hutongs',
      segments: [['Por qué es diagonal', 'La mayoría de los hutongs son rectos; este cruza en diagonal hacia Shichahai. Con más de doscientos metros de largo y solo cuatro de ancho, probablemente siguió la antigua orilla del lago.', null, 0]],
      images: [createStageImage('290000000000000002-img-1-es', 'Vista de la calle', 'Yandai', 32)] },
    ru: { name: 'Улица Яньдай Сецзе', category: 'Старинная улица', summary: 'Одна из старейших торговых улиц Пекина, по форме напоминающая трубку.', guideId: 'guide-02', guideName: 'А Хуай', guideStyle: 'Рассказчик хутунов',
      segments: [['Почему она идёт по диагонали', 'Большинство переулков старого города прямые, а этот идёт по диагонали к Шичахаю. Длина более двухсот метров, ширина всего четыре — вероятно, улица повторяла старую береговую линию эпохи Юань.', null, 0]],
      images: [createStageImage('290000000000000002-img-1-ru', 'Вид улицы', 'Яньдай', 32)] },
  },
  '290000000000000001': {
    zh: { name: '银锭桥', category: '历史桥梁', summary: '燕京小八景“银锭观山”的取景点。', guideId: 'guide-01', guideName: '顾远', guideStyle: '城市史学者',
      segments: [['桥与两片水', '这座小桥全长十几米，却正好卡在前海与后海的分界上。靠栏往东看，水面是收的；往西看，一下子就铺开了——一座小桥把两片水、两岸街巷和来往的人全串在一起。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/001_%E9%93%B6%E9%94%AD%E6%A1%A5.mp3', 64]],
      pronunciations: [['银锭', 'yin2 ding4', '桥名，锭指银元宝'], ['银锭观山', 'yin2 ding4 guan1 shan1', '燕京小八景之一']],
      images: [createStageImage('290000000000000001-img-1', '银锭桥与后海水面', '银锭桥', 168)] },
    en: { name: 'Yinding Bridge', category: 'Historic bridge', summary: 'Where Qianhai and Houhai part, once praised for its view of the western hills.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Urban historian',
      segments: [['A bridge between two lakes', 'Only a dozen metres long, the bridge sits exactly where Qianhai and Houhai divide. Lean on the rail: the water narrows to the east and opens up to the west.', null, 0]],
      images: [createStageImage('290000000000000001-img-1-en', 'Yinding Bridge and Houhai', 'Yinding', 168)] },
    ru: { name: 'Мост Иньдин', category: 'Старинный мост', summary: 'Здесь расходятся озёра Цяньхай и Хоухай.', guideId: 'guide-01', guideName: 'Гу Юань', guideStyle: 'Историк города',
      segments: [['Мост между двумя озёрами', 'Мост длиной всего в несколько метров стоит там, где Цяньхай отделяется от Хоухая. Обопритесь на перила: на востоке вода сужается, на западе открывается простор.', null, 0]],
      images: [createStageImage('290000000000000001-img-1-ru', 'Мост Иньдин и озеро', 'Иньдин', 168)] },
    es: { name: 'Puente Yinding', category: 'Puente histórico', summary: 'Donde se separan los lagos Qianhai y Houhai.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Historiador urbano',
      segments: [['Un puente entre dos lagos', 'Con apenas una docena de metros, el puente marca la división entre Qianhai y Houhai. Apóyate en la baranda: el agua se estrecha al este y se abre al oeste.', null, 0]],
      images: [createStageImage('290000000000000001-img-1-es', 'Puente y lago', 'Yinding', 168)] },
  },
  '290000000000000003': {
    zh: { name: '广化寺', category: '宗教建筑', summary: '北京佛教协会所在地，寺院格局严整。', guideId: 'guide-01', guideName: '顾远', guideStyle: '城市史学者',
      segments: [['敕赐与中轴', '山门匾额写着“敕赐广化寺”，说明它当年有官方身份。往里看，影壁、山门、天王殿、大雄宝殿、藏经阁一路向北，钟鼓楼对称站立——传统寺院是用顺序与对称来安排空间的。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/005_%E5%B9%BF%E5%8C%96%E5%AF%BA.mp3', 71]],
      pronunciations: [['敕赐', 'chi4 ci4', '匾额用语，指朝廷赐建'], ['鸦儿胡同', 'ya1 er2 hu2 tong4', '寺院所在胡同'], ['刹', 'cha4', '“内八刹”之刹读 chà']],
      images: [createStageImage('290000000000000003-img-1', '广化寺山门', '广化寺', 96)] },
    en: { name: 'Guanghua Temple', category: 'Religious building', summary: 'A Yuan dynasty temple still in use, laid out on a strict axis.', guideId: 'guide-01', guideName: 'Gu Yuan', guideStyle: 'Urban historian',
      segments: [['Imperial grant and axis', 'The plaque reads “Guanghua Temple by imperial grant”. Inside, gate, halls and library follow one axis, with bell and drum towers facing each other — order and symmetry shape the space.', null, 0]],
      images: [createStageImage('290000000000000003-img-1-en', 'Guanghua Temple gate', 'Guanghua', 96)] },
    ru: { name: 'Храм Гуанхуа', category: 'Религиозное здание', summary: 'Храм эпохи Юань, где симметрия организует пространство.', guideId: 'guide-01', guideName: 'Гу Юань', guideStyle: 'Историк города',
      segments: [['Ворота и ось', 'Над воротами написано «Гуанхуа, дарованный императором». Внутри ворота, залы и библиотека выстроены по одной оси, а колокольная и барабанная башни стоят друг напротив друга.', null, 0]],
      images: [createStageImage('290000000000000003-img-1-ru', 'Ворота храма', 'Гуанхуа', 96)] },
  },
  '290000000000000004': {
    zh: { name: '宋庆龄故居', category: '名人故居', summary: '原醇亲王府花园，兼具园林与近现代历史。', guideId: 'guide-03', guideName: '林澄', guideStyle: '园林导览员',
      segments: [['一院两百多年', '这处院落本身远比宋庆龄住在这里的时间更长：康熙年间是大学士明珠的府邸花园，乾隆时成了和珅别院，嘉庆年间改建为成亲王府，光绪时又成为醇亲王府的花园。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/007_%E5%AE%8B%E5%BA%86%E9%BE%84%E6%95%85%E5%B1%85.mp3', 81]],
      pronunciations: [['醇亲王府', 'chun2 qin1 wang2 fu3', '晚清王府名称'], ['恩波亭', 'en1 bo1 ting2', '引御水入园后所建'], ['箑亭', 'sha4 ting2', '箑为古体“扇”字']],
      images: [createStageImage('290000000000000004-img-1', '故居临湖院落', '宋庆龄故居', 148)] },
    en: { name: 'Former Residence of Soong Ching-ling', category: 'Historic residence', summary: 'A lakeside garden: princely garden first, residence later.', guideId: 'guide-03', guideName: 'Lin Cheng', guideStyle: 'Garden guide',
      segments: [['Two centuries of one garden', 'The garden is far older than the years Soong Ching-ling lived here: a Qing scholar’s garden, then a prince’s residence, before it became her home in 1963.', null, 0]],
      images: [createStageImage('290000000000000004-img-1-en', 'Lakeside courtyard', 'Residence', 148)] },
    ru: { name: 'Дом-музей Сун Цинлин', category: 'Историческая усадьба', summary: 'Сад у озера, бывший княжеской усадьбой.', guideId: 'guide-03', guideName: 'Линь Чэн', guideStyle: 'Гид по садам',
      segments: [['Двести лет одного сада', 'Сад гораздо старше лет, которые Сун Цинлин провела здесь: сначала сад учёного эпохи Цин, затем княжеская усадьба, и лишь в 1963 году — её дом.', null, 0]],
      images: [createStageImage('290000000000000004-img-1-ru', 'Двор у озера', 'Усадьба', 148)] },
  },
  '290000000000000005': {
    zh: { name: '恭王府', category: '王府园林', summary: '现存规模完整的清代王府建筑群。', guideId: 'guide-02', guideName: '阿槐', guideStyle: '胡同故事家',
      segments: [['看屋顶与轴线', '府邸中路用绿色琉璃筒瓦，东西两路用灰筒瓦——这不是审美偏好，是等级。府邸分东、中、西三路，每路都是若干进四合院，最后由一道一百六十多米长的后罩楼稳稳收住。', 'https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/wenlv_demo/009_%E6%81%AD%E7%8E%8B%E5%BA%9C.mp3', 81]],
      pronunciations: [['锡晋斋', 'xi1 jin4 zhai1', '西路楠木厅堂'], ['萃锦园', 'cui4 jin3 yuan2', '府后花园名称'], ['后罩楼', 'hou4 zhao4 lou2', '王府最后一进楼房']],
      images: [createStageImage('290000000000000005-img-1', '府邸绿琉璃屋顶', '恭王府', 44), createStageImage('290000000000000005-img-2', '萃锦园花园布局', '花园示意', 190, 'ai')] },
    en: { name: 'Prince Gong’s Mansion', category: 'Princely garden', summary: 'The best-preserved Qing princely residence in Beijing.', guideId: 'guide-02', guideName: 'A Huai', guideStyle: 'Hutong storyteller',
      segments: [['Roofs and axes', 'The central route uses green glazed tiles, the side routes grey ones — rank, not taste. Three parallel routes of courtyards end at a long rear building that closes the compound.', null, 0]],
      images: [createStageImage('290000000000000005-img-1-en', 'Green glazed roofs', 'Mansion', 44)] },
    ru: { name: 'Дворец князя Гуна', category: 'Княжеский сад', summary: 'Наиболее полно сохранившаяся княжеская усадьба Пекина.', guideId: 'guide-02', guideName: 'А Хуай', guideStyle: 'Рассказчик хутунов',
      segments: [['Крыши и оси', 'Центральная линия использует зелёную черепицу, боковые — серую: это не вкус, а ранг. Три параллельные линии дворов завершает длинное заднее здание.', null, 0]],
      images: [createStageImage('290000000000000005-img-1-ru', 'Зелёные крыши усадьбы', 'Дворец', 44)] },
  },
}

/* ------------------------------------------------------------------ *
 * 路线：一条路线一种语言；同一线路的不同语言是各自独立的路线记录。
 * ------------------------------------------------------------------ */

interface RouteVersionSeed {
  locale: Locale; name: string; theme: string
  status: PublishStatus; auditRemark: string
  arrivalNotes: string[]
}
interface RouteSeed {
  id: string; code: string; destinationId: string; sceneType: SceneType
  distanceKm: number; estimatedMinutes: number; ownerName: string
  stopPlaceIds: string[]; transportModes: ('rickshaw' | 'walk' | 'indoor')[]; stayMinutes: number[]
  geometry: Coordinate[]
  versions: RouteVersionSeed[]
}

const stop = (placeId: string, transportMode: 'rickshaw' | 'walk' | 'indoor', stayMinutes: number, arrivalNote: string, index: number) => ({ id: `${placeId}-stop-${index + 1}`, placeId, arrivalNote, transportMode, stayMinutes })

const routeSeeds: RouteSeed[] = [
  {
    id: '490000000000000001', code: 'HH-R-01', destinationId: '18446744073709551001', sceneType: 'outdoor',
    distanceKm: 4.8, estimatedMinutes: 150, ownerName: '周策划',
    stopPlaceIds: ['290000000000000002', '290000000000000001', '290000000000000003', '290000000000000004', '290000000000000005'],
    transportModes: ['rickshaw', 'walk', 'walk', 'rickshaw', 'rickshaw'], stayMinutes: [18, 12, 15, 28, 45],
    geometry: [{ latitude: 39.94086, longitude: 116.39363 }, { latitude: 39.94052, longitude: 116.38615 }, { latitude: 39.94366, longitude: 116.39043 }, { latitude: 39.94506, longitude: 116.38272 }, { latitude: 39.93682, longitude: 116.38155 }],
    versions: [
      { locale: 'zh', name: '后海经典半日线', theme: '水岸、胡同与王府', status: 'published', auditRemark: '', arrivalNotes: ['烟袋斜街东口落客', '桥东侧安全区停靠', '鸦儿胡同步行进入', '后海北沿入口停靠', '柳荫街入口下车'] },
      { locale: 'en', name: 'Houhai Classic Half Day', theme: 'Shoreline, hutongs and a princely mansion', status: 'published', auditRemark: '', arrivalNotes: ['Drop-off at the east end of Yandai Xiejie', 'Stop at the safe zone east of the bridge', 'Walk in via Ya’er Hutong', 'Stop at the north shore entrance', 'Get off at the Liuyin Street entrance'] },
      { locale: 'ru', name: 'Хоухай: классический маршрут', theme: 'Озёра, хутуны и усадьба', status: 'pending', auditRemark: '等待多语言版本审核', arrivalNotes: ['Высадка у восточного входа на Яньдай Сецзе', 'Остановка у восточной стороны моста', 'Пеший проход через переулок Яэр', 'Остановка у северного берега', 'Выход у входа на улицу Люинь'] },
    ],
  },
  {
    id: '490000000000000002', code: 'HH-R-02', destinationId: '18446744073709551001', sceneType: 'outdoor',
    distanceKm: 2.1, estimatedMinutes: 70, ownerName: '陈导游',
    stopPlaceIds: ['290000000000000002', '290000000000000001'],
    transportModes: ['walk', 'rickshaw'], stayMinutes: [20, 15],
    geometry: [{ latitude: 39.94086, longitude: 116.39363 }, { latitude: 39.94052, longitude: 116.38615 }],
    versions: [
      { locale: 'zh', name: '胡同故事轻游线', theme: '街巷与市井', status: 'pending', auditRemark: '等待运营审核', arrivalNotes: ['东口集合', '桥边结束'] },
      { locale: 'en', name: 'Hutong Story Stroll', theme: 'Lanes and everyday life', status: 'published', auditRemark: '', arrivalNotes: ['Meet at the east entrance', 'Finish beside the bridge'] },
      { locale: 'es', name: 'Paseo por los hutongs', theme: 'Callejones y vida cotidiana', status: 'draft', auditRemark: '', arrivalNotes: ['Encuentro en la entrada este', 'Final junto al puente'] },
    ],
  },
  {
    id: '490000000000000003', code: 'HH-R-03', destinationId: '18446744073709551001', sceneType: 'outdoor',
    distanceKm: 3.4, estimatedMinutes: 120, ownerName: '周策划',
    stopPlaceIds: ['290000000000000004', '290000000000000005'],
    transportModes: ['rickshaw', 'rickshaw'], stayMinutes: [35, 55],
    geometry: [{ latitude: 39.94506, longitude: 116.38272 }, { latitude: 39.93682, longitude: 116.38155 }],
    versions: [
      { locale: 'zh', name: '王府名人深度线', theme: '名人与近代北京', status: 'draft', auditRemark: '', arrivalNotes: ['北沿入口', '柳荫街入口'] },
    ],
  },
  {
    id: '490000000000000004', code: 'MG-R-01', destinationId: '18446744073709551002', sceneType: 'indoor',
    distanceKm: 0.6, estimatedMinutes: 55, ownerName: '馆方运营',
    stopPlaceIds: ['380000000000000002', '380000000000000003'],
    transportModes: ['indoor', 'indoor'], stayMinutes: [25, 25],
    geometry: [],
    versions: [
      { locale: 'zh', name: '镇馆精品探索线', theme: '展厅与文物故事', status: 'published', auditRemark: '', arrivalNotes: ['展厅入口', '沿一层连廊抵达'] },
      { locale: 'en', name: 'Museum Highlights', theme: 'Galleries and object stories', status: 'published', auditRemark: '', arrivalNotes: ['Gallery entrance', 'Reach via the first-floor corridor'] },
    ],
  },
]

/** 从路线种子展开：每条语言版本生成一条独立路线。 */
export const routes: TourRoute[] = routeSeeds.flatMap(seed => seed.versions.map(version => ({
  id: version.locale === 'zh' ? seed.id : `${seed.id}-${version.locale}`,
  destinationId: seed.destinationId, code: version.locale === 'zh' ? seed.code : `${seed.code}-${version.locale.toUpperCase()}`,
  name: version.name, sceneType: seed.sceneType, theme: version.theme,
  distanceKm: seed.distanceKm, estimatedMinutes: seed.estimatedMinutes,
  status: version.status, auditRemark: version.auditRemark, ownerName: seed.ownerName,
  locale: version.locale,
  stops: seed.stopPlaceIds.map((placeId, index) => stop(placeId, seed.transportModes[index] ?? 'walk', seed.stayMinutes[index] ?? 10, version.arrivalNotes[index] ?? '', index)),
  geometry: seed.geometry,
})))

function buildStage(input: {
  id: string; route: TourRoute; order: number; placeId: string | null; seed: StageSeed
  audioStatus: StageAudioStatus; translationOf?: string | null
}): ArtifactStage {
  const isSource = input.route.locale === 'zh'
  const segments = input.seed.segments.map((segment, index) => ({
    id: `${input.id}-seg-${index + 1}`, title: segment[0], text: segment[1],
    // 只有中文路线产出 TTS 音频，其它语言由 C 端使用系统语音朗读
    audioUrl: isSource ? segment[2] : null,
    durationSeconds: isSource ? segment[3] : 0,
  }))
  return {
    id: input.id, routeId: input.route.id, destinationId: input.route.destinationId, order: input.order,
    name: input.seed.name, category: input.seed.category, summary: input.seed.summary, placeId: input.placeId,
    locale: input.route.locale,
    guideId: input.seed.guideId, guideName: input.seed.guideName, guideStyle: input.seed.guideStyle,
    audioStatus: isSource ? input.audioStatus : 'none',
    audioDurationSeconds: isSource ? segments.reduce((total, segment) => total + segment.durationSeconds, 0) : 0,
    segments,
    pronunciations: (input.seed.pronunciations ?? []).map((seed, index) => ({ id: `${input.id}-pro-${index + 1}`, phrase: seed[0], pronunciation: seed[1], note: seed[2] })),
    images: input.seed.images ?? [],
    videoUrl: null, status: input.route.status === 'published' ? 'published' : 'draft', updatedAt: '2026-09-23 11:20',
    translationOf: input.translationOf ?? null,
  }
}

const baseRouteIdOf = (route: TourRoute) => route.id.replace(/-[a-z]{2}$/, '')

/** 室内文物站点：按路线的语言版本生成对应语言的站点内容。 */
function buildIndoorStages(route: TourRoute): ArtifactStage[] {
  return indoorStageSeeds.flatMap(seed => {
    const content = seed.content[route.locale]
    if (!content) return []
    return [buildStage({
      id: `${route.id}-stage-${seed.order}`, route, order: seed.order, placeId: null, seed: content,
      audioStatus: seed.content.zh?.segments.some(segment => segment[2]) ? 'ready' : 'none',
      translationOf: route.locale === 'zh' ? null : `${baseRouteIdOf(route)}-stage-${seed.order}`,
    })]
  })
}

/** 户外文化点站点：按路线的语言版本从对应语言种子生成。 */
function buildOutdoorStages(route: TourRoute): ArtifactStage[] {
  return route.stops.flatMap((item, index) => {
    const seed = outdoorStageSeeds[item.placeId]?.[route.locale]
    if (!seed) return []
    return [buildStage({
      id: `${route.id}-stage-${index + 1}`, route, order: index + 1, placeId: item.placeId, seed,
      audioStatus: 'ready', translationOf: route.locale === 'zh' ? null : `${baseRouteIdOf(route)}-stage-${index + 1}`,
    })]
  })
}

export const stages: ArtifactStage[] = routes.flatMap(route => route.sceneType === 'indoor' ? buildIndoorStages(route) : buildOutdoorStages(route))

/** 内容：与“内容”列表页一致，文物与文化点共用一张表。 */
export const collections: CollectionItem[] = [
  { id: '790000000000000001', code: 'COL-2026-001', name: '青铜剑', destinationId: '18446744073709551002', kind: 'relic', category: '青铜器', era: '商周', material: '青铜', location: '城市记忆厅 · 展柜 A-03', recommendedMinutes: 8, description: '剑身窄长，菱形暗格纹清晰，是展厅里青铜兵器类别的代表藏品。', imageUrl: createStageImage('790000000000000001-img-1', '青铜剑 · 展柜实拍', '青铜剑', 204).url, guideVersions: 3, status: 'published' },
  { id: '790000000000000002', code: 'HH-YDQ', name: '银锭桥', destinationId: '18446744073709551001', kind: 'place', category: '历史桥梁', era: '明代', material: '石构', location: '前海与后海交界处', recommendedMinutes: 12, description: '燕京小八景“银锭观山”的取景点，连接前海与后海的水面分界。', imageUrl: createStageImage('790000000000000002-img-1', '银锭桥与后海水面', '银锭桥', 168).url, guideVersions: 2, status: 'published' },
  { id: '790000000000000003', code: 'HH-GWF', name: '恭王府', destinationId: '18446744073709551001', kind: 'place', category: '王府园林', era: '清代', material: '木构院落', location: '柳荫街甲 14 号', recommendedMinutes: 45, description: '现存规模完整的清代王府建筑群，分府邸与花园两部分。', imageUrl: createStageImage('790000000000000003-img-1', '府邸绿琉璃屋顶', '恭王府', 44).url, guideVersions: 3, status: 'published' },
  { id: '790000000000000004', code: 'COL-2026-002', name: '铜鎏金阿育王塔', destinationId: '18446744073709551002', kind: 'relic', category: '宗教艺术', era: '五代', material: '铜鎏金', location: '工艺生活厅 · 展柜 B-01', recommendedMinutes: 10, description: '塔身分层收束，四角起翘，表面残留鎏金，用于佛教艺术专题讲解。', imageUrl: createStageImage('790000000000000004-img-1', '塔身鎏金细节', '阿育王塔', 46).url, guideVersions: 1, status: 'draft' },
]

export const mockDatabase: DemoDatabase = { destinations, places, indoorSpaces, routes, stages, collections }
