import type { Catalog, Coordinate, CulturalPlace, Destination, TourRoute } from '../types.ts'
import { guideNarrationsForPlace } from './guideNarrations.ts'

export const destinations: Destination[] = [
  { id: 'beijing-houhai', scene: 'rickshaw', name: '北京 · 后海', region: '什刹海 / 西城区', subtitle: '黄包车慢游 · 湖与胡同', status: 'available' },
  { id: 'shanghai-zhujiajiao', scene: 'rickshaw', name: '上海 · 朱家角古镇', region: '青浦区 / 江南水乡', subtitle: '古镇水巷路线筹备中', status: 'comingSoon' },
  { id: 'culture-explorer', scene: 'museum', name: '文化探索馆', region: '器物主题展厅', subtitle: '青铜 · 陶瓷 · 书画', status: 'available' },
  { id: 'palace-museum', scene: 'museum', name: '故宫博物院', region: '北京 · 紫禁城', subtitle: '宫廷器物路线筹备中', status: 'comingSoon' },
  { id: 'shanghai-museum', scene: 'museum', name: '上海博物馆', region: '上海 · 人民广场', subtitle: '海派收藏路线筹备中', status: 'comingSoon' },
]

const basePlaces: CulturalPlace[] = [
  {
    id: '2095000000000000001', scene: 'rickshaw', destinationId: 'beijing-houhai', name: '银锭桥', subtitle: '一座桥，连接两片海', category: '湖岸风景',
    coordinate: [116.387179, 39.937614], address: '西城区 · 前海与后海交界处', era: '明代始建', duration: 3, accent: '#507e88', artwork: 'bridge',
    intro: '在后海的风里，读懂老北京的水岸生活。',
    narration: [
      { title: '从这里，认识什刹海', text: '您眼前这座小巧的石桥，叫作银锭桥。它位于前海和后海之间，因外形像一枚银锭而得名。桥并不高，却把两片水面、两岸街巷和人们的日常连接起来。先别急着赶路，站在桥边，看看水面如何从狭窄处舒展开来，您就能理解，这里为什么会成为认识什刹海的好起点。' },
      { title: '银锭观山的想象', text: '老北京有一景，叫“银锭观山”。在天气通透、视野开阔的时候，人们曾从这里向西远眺山色。如今城市的轮廓已经改变，但观景的方式仍然值得保留：把目光从近处的柳枝移到湖面，再移向远处。后海的故事，既在名胜里，也在这种不慌不忙的观看中。' },
    ],
    visitNote: '桥面和周边人流较多，请在安全停靠后步行观看。',
  },
  {
    id: '2095000000000000002', scene: 'rickshaw', destinationId: 'beijing-houhai', name: '烟袋斜街', subtitle: '沿着一条斜街，走进市井北京', category: '胡同人文',
    coordinate: [116.388600, 39.937784], address: '西城区 · 烟袋斜街', era: '传统商业街巷', duration: 3, accent: '#b18a55', artwork: 'hutong',
    intro: '短短一条街，装着店铺、吆喝和老城的记忆。',
    narration: [
      { title: '为什么是“斜街”', text: '北京老城的街道常常横平竖直，烟袋斜街却有自己的方向。它从鼓楼一带斜向什刹海，顺应着水岸与街巷的关系。走在这里，可以留意脚下道路的转折和两侧店面的尺度。这些并不宏大的细节，构成了北京胡同最亲切的部分。' },
      { title: '一条街的生意经', text: '关于“烟袋”这个名字，人们常提到旧时经营烟具的店铺，也会把街巷形状与烟袋联想在一起。今天的店铺早已换了许多，但街道连接生活与买卖的角色没有改变。看看门脸、招牌和屋檐，想象货物、行人和声音怎样在这条小街交汇。这是属于普通人的城市历史。' },
    ],
    visitNote: '商业街建议步行游览；黄包车在允许的路段接驳。',
  },
  {
    id: '2095000000000000003', scene: 'rickshaw', destinationId: 'beijing-houhai', name: '广化寺', subtitle: '湖岸深处，一处安静的院落', category: '古建寻踪',
    coordinate: [116.384624, 39.940044], address: '西城区 · 鸦儿胡同 31 号', era: '元代始建', duration: 4, accent: '#b56e5e', artwork: 'temple',
    intro: '从热闹的湖岸转入胡同，听一段古寺的故事。',
    narration: [
      { title: '藏在胡同里的古寺', text: '广化寺位于后海北岸的鸦儿胡同，历史可以追溯到元代。与辽阔的水面相比，寺院的空间显得收敛而有秩序。您可以先从外部观察山门和屋顶：中轴线、院落、殿宇层层展开，是中国传统建筑组织空间的一种方式。' },
      { title: '把脚步放轻', text: '寺院不仅是古建筑，也是今天仍然有人使用的宗教场所。欣赏建筑时，不妨降低声音，把注意力放在屋檐、门额和院落之间的关系上。这里的体验并不需要追求热闹，愿意放慢一点，就能感受到胡同日常与寺院生活之间的边界。是否开放、哪些区域可以参观，请以现场安排为准。' },
    ],
    visitNote: '开放时间以现场为准；宗教活动期间请尊重参观限制。',
  },
  {
    id: '2095000000000000004', scene: 'rickshaw', destinationId: 'beijing-houhai', name: '宋庆龄故居', subtitle: '后海北沿，庭院里的岁月', category: '名人故居',
    coordinate: [116.376921, 39.944263], address: '西城区 · 后海北沿 46 号', era: '近现代历史', duration: 4, accent: '#6d8871', artwork: 'garden',
    intro: '沿湖走进一处园林，认识一段近现代人生。',
    narration: [
      { title: '一处生活过的庭院', text: '后海北沿的这处庭院，是宋庆龄晚年生活和工作的地方。她于一九六三年迁居于此，在这里度过了人生最后的十八年。与宏大的历史叙述相比，故居提供了一种更贴近生活的认识方式：从居室、陈设和庭园，理解一个人的日常。' },
      { title: '园林与记忆', text: '这处院落保留着传统园林的气息。树木、水面和建筑并不是彼此分离的景物，而是共同组成生活的环境。参观时可以留意窗景与步道，感受人在其中行走时，视线如何不断变化。关于宋庆龄的生平与工作，请结合馆内正式展陈阅读，让眼前的空间与历史材料相互印证。' },
    ],
    visitNote: '入院参观可能需要购票或预约，路线体验不包含门票。',
  },
  {
    id: '2095000000000000005', scene: 'rickshaw', destinationId: 'beijing-houhai', name: '恭王府', subtitle: '一座王府，半部清代史的回声', category: '王府文化',
    coordinate: [116.379801, 39.935828], address: '西城区 · 前海西街 17 号', era: '清代建筑', duration: 5, accent: '#976452', artwork: 'palace',
    intro: '从府邸到花园，在建筑之间读一段清代往事。',
    narration: [
      { title: '府与园，两种空间', text: '恭王府是北京保存较为完整的清代王府建筑群。前部府邸讲究秩序与礼制，后部花园则以山石、水景和曲折路径营造游赏的趣味。把这两种空间放在一起看，会发现它们分别回应了身份、生活和审美的不同需要。' },
      { title: '建筑里的时代', text: '这座府邸曾与和珅、恭亲王奕䜣等历史人物产生联系。“恭王府”的名称，便与恭亲王有关。参观时，与其把每一处景物都当成传奇的证据，不如先观察院落如何布局、房屋怎样连接，再结合正式展陈认识人物与时代。建筑能告诉我们的，往往比传说更加丰富。' },
    ],
    visitNote: '需另行预约购票；黄包车游览停靠外围，不驶入院内。',
  },
  {
    id: '2095000000000000101', scene: 'museum', destinationId: 'culture-explorer', name: '青铜鼎', subtitle: '从器物走近礼制', category: '青铜器', address: '示例场馆 · 一层青铜展厅', era: '商周文化主题', duration: 3, accent: '#638779', artwork: 'bronze',
    intro: '从三足两耳的造型开始，观察中国古代的器物智慧。',
    narration: [{ title: '鼎的形与用', text: '鼎最初与烹煮有关，后来也成为礼仪中的重要器物。请先观察它的足、腹和耳，再想一想：这些结构如何帮助人们承托、加热和搬动器物？在不同历史时期，鼎的形制和纹饰会发生变化。本展品是场馆模式的示例，不对应某件具体馆藏。' }],
    visitNote: '场馆模式演示展品，请勿触摸展柜。',
  },
  {
    id: '2095000000000000102', scene: 'museum', destinationId: 'culture-explorer', name: '青花瓷瓶', subtitle: '在白与蓝之间，发现匠心', category: '陶瓷', address: '示例场馆 · 二层陶瓷展厅', era: '传统陶瓷主题', duration: 3, accent: '#65859e', artwork: 'porcelain',
    intro: '看笔触、辨层次，理解釉下彩的魅力。',
    narration: [{ title: '蓝色从哪里来', text: '青花瓷以含钴的色料在瓷坯上绘画，施釉后入窑烧制。色彩被覆盖在透明釉层之下，因此属于釉下彩。您可以观察纹样的浓淡与线条的转折，想象画工如何在曲面上运笔。本展品是用于体验讲解与章节路线的示例。' }],
    visitNote: '本件为独立 mock 示例，不对应真实馆藏编号。',
  },
  {
    id: '2095000000000000103', scene: 'museum', destinationId: 'culture-explorer', name: '山水画卷', subtitle: '咫尺之间，自有山河', category: '书画', address: '示例场馆 · 二层书画展厅', era: '传统书画主题', duration: 4, accent: '#819080', artwork: 'painting',
    intro: '跟随画家的视线，把一幅画慢慢读完。',
    narration: [{ title: '留白也是风景', text: '中国山水画常以墨色的浓淡和笔触的疏密组织画面。没有落墨的部分并不一定是空缺，它可能是水、云，也可能是留给观看者想象的空间。请从近处的山石看向远处的峰峦，感受画面如何引导视线移动。这里展示的是书画主题的概念示例。' }],
    visitNote: '观画时请关闭闪光灯。',
  },
]

export const places: CulturalPlace[] = basePlaces.map(place => place.scene === 'rickshaw'
  ? { ...place, guideNarrations: guideNarrationsForPlace(place) }
  : place)

const silver = places[0].coordinate!
const street = places[1].coordinate!
const temple = places[2].coordinate!
const residence = places[3].coordinate!
const palace = places[4].coordinate!
const northBank: Coordinate[] = [temple, [116.3838, 39.9400], [116.3828, 39.9405], [116.3815, 39.9415], [116.3803, 39.9425], [116.3794, 39.9436], [116.3784, 39.9440], [116.3778, 39.9442], residence]
const westBank: Coordinate[] = [residence, [116.3757, 39.9438], [116.3746, 39.9440], [116.3735, 39.9436], [116.3736, 39.9425], [116.3745, 39.9416], [116.3748, 39.9404], [116.3760, 39.9397], [116.3777, 39.9389], [116.3794, 39.9383], [116.3794, 39.9371], palace]
const eastBank: Coordinate[] = [silver, [116.3866, 39.9380], [116.3860, 39.9384], [116.3850, 39.9392], [116.3846, 39.9396], temple]

export const routes: TourRoute[] = [
  {
    id: '2096000000000000001', scene: 'rickshaw', destinationId: 'beijing-houhai', title: '后海慢游 · 湖与胡同', subtitle: '一程车铃，半日北京',
    description: '从银锭桥出发，穿过烟袋斜街，沿北岸拜访古寺与故居，最后抵达恭王府。在湖光与胡同之间，收集五段北京故事。',
    duration: 90, distance: '约 3.8 km', tag: '经典全景', color: '#24616a',
    stopIds: places.slice(0, 5).map(place => place.id),
    geometry: [silver, street, [116.3892, 39.9382], [116.3881, 39.9383], [116.3869, 39.9385], [116.3858, 39.9393], ...northBank, ...westBank.slice(1)],
    transportNote: '黄包车接驳 + 下车步行；街巷及院内按现场通行规则游览。',
  },
  {
    id: '2096000000000000002', scene: 'rickshaw', destinationId: 'beijing-houhai', title: '水岸寻静 · 古寺与故居', subtitle: '把时间交给后海北岸',
    description: '从银锭桥沿后海北岸向西，走过广化寺，停在宋庆龄故居。适合想慢慢听故事、看看湖景的您。',
    duration: 50, distance: '约 1.8 km', tag: '轻松半程', color: '#628068',
    stopIds: [places[0].id, places[2].id, places[3].id], geometry: [...eastBank, ...northBank.slice(1)],
    transportNote: '以湖岸接驳为主；寺院和故居需下车步行参观。',
  },
  {
    id: '2096000000000000003', scene: 'rickshaw', destinationId: 'beijing-houhai', title: '京味拾光 · 街巷与王府', subtitle: '从市井烟火，到深深庭院',
    description: '从烟袋斜街的市井生活走到银锭桥，再沿前海西侧前往恭王府，看看老北京不同尺度的日常。',
    duration: 60, distance: '约 2.2 km', tag: '人文精选', color: '#a2694a',
    stopIds: [places[1].id, places[0].id, places[4].id],
    geometry: [street, silver, [116.3864, 39.9375], [116.3854, 39.9377], [116.3841, 39.9379], [116.3827, 39.9380], [116.3808, 39.9376], [116.3800, 39.9372], palace],
    transportNote: '烟袋斜街步行；黄包车于允许停靠处接驳，王府门票另购。',
  },
  {
    id: '2096000000000000101', scene: 'museum', destinationId: 'culture-explorer', title: '器物里的中国', subtitle: '从青铜到丹青的三次相遇',
    description: '延续场馆路线体验，在青铜器、陶瓷与书画之间，通过讲解完成三个章节。',
    duration: 40, distance: '3 个展厅', tag: '综合精选', color: '#65786b', guideName: '陈老师', coverArtwork: 'bronze',
    stopIds: places.filter(place => place.scene === 'museum').map(place => place.id), geometry: [],
    transportNote: '馆内步行，按章节体验。展品与展厅为方案演示数据。',
  },
  {
    id: '2096000000000000102', scene: 'museum', destinationId: 'culture-explorer', title: '青花里的山河', subtitle: '从瓷上笔意，走进纸上山水',
    description: '先欣赏青花瓷瓶的线条与浓淡，再走近山水画卷，比较两种材质上的绘画语言。',
    duration: 25, distance: '2 个展厅', tag: '艺术漫游', color: '#65859e', guideName: '叶老师', coverArtwork: 'porcelain',
    stopIds: ['2095000000000000102', '2095000000000000103'], geometry: [],
    transportNote: '二层陶瓷展厅至书画展厅，馆内步行。',
  },
  {
    id: '2096000000000000103', scene: 'museum', destinationId: 'culture-explorer', title: '青铜之旅：从礼器到生活', subtitle: '看形制、读纹饰，认识一尊鼎',
    description: '以青铜鼎为主角，从造型、用途与装饰三个角度，细看器物中的礼制与生活。',
    duration: 20, distance: '1 个展厅', tag: '器物专题', color: '#54786d', guideName: '陈老师', coverArtwork: 'bronze',
    stopIds: ['2095000000000000101'], geometry: [], transportNote: '一层青铜展厅内深度观展。',
  },
  {
    id: '2096000000000000104', scene: 'museum', destinationId: 'culture-explorer', title: '一卷山水，慢慢看', subtitle: '把留白也读成风景',
    description: '围绕山水画卷，观察墨色、构图和留白，练习从近景走向远山的观看方式。',
    duration: 20, distance: '1 个展厅', tag: '艺术漫游', color: '#89917c', guideName: '叶老师', coverArtwork: 'painting',
    stopIds: ['2095000000000000103'], geometry: [], transportNote: '二层书画展厅内参观，请关闭闪光灯。',
  },
  {
    id: '2096000000000000105', scene: 'museum', destinationId: 'culture-explorer', title: '小小器物观察员', subtitle: '和孩子一起，发现形状的秘密',
    description: '从鼎的三足到瓷瓶的曲线，用容易理解的观察线索，让孩子认识器物的形状与用途。',
    duration: 30, distance: '2 个展厅', tag: '亲子同行', color: '#b18a55', guideName: '小林', coverArtwork: 'porcelain',
    stopIds: ['2095000000000000101', '2095000000000000102'], geometry: [], transportNote: '一层青铜展厅至二层陶瓷展厅，请照看同行儿童。',
  },
  {
    id: '2096000000000000106', scene: 'museum', destinationId: 'culture-explorer', title: '匠心三章：形、色与意', subtitle: '一次贯穿三个展厅的审美之旅',
    description: '从山水的意境出发，经青花的色彩，最后看青铜的形制，沿另一种顺序认识传统审美。',
    duration: 45, distance: '3 个展厅', tag: '综合精选', color: '#927562', guideName: '周老师', coverArtwork: 'painting',
    stopIds: ['2095000000000000103', '2095000000000000102', '2095000000000000101'], geometry: [],
    transportNote: '由二层书画展厅开始，经陶瓷展厅至一层青铜展厅。',
  },
]

export const catalog: Catalog = { destinations, places, routes }
