import type { CulturalPlace, DemoDatabase, Destination, IndoorSpace, Narration, TourRoute } from '../types.ts'

export const destinations: Destination[] = [
  { id:'18446744073709551001',code:'BJ-HH-001',name:'北京·后海',sceneType:'outdoor',address:'北京市西城区什刹海街道',openingHours:'全天开放',status:'enabled',mapProvider:'OpenStreetMap',coordinateSystem:'WGS84',latitude:39.9407,longitude:116.3868,boundaryGeoJson:'{"type":"Polygon","coordinates":[[[116.372,39.945],[116.401,39.945],[116.401,39.927],[116.372,39.927],[116.372,39.945]]]}',intro:'以什刹海水系、胡同生活与王府文化为主线的黄包车漫游目的地。',placeIds:['290000000000000001','290000000000000002','290000000000000003','290000000000000004','290000000000000005'],indoorSpaceIds:[] },
  { id:'18446744073709551002',code:'MUSEUM-001',name:'文化探索馆',sceneType:'indoor',address:'北京市西城区示范路 8 号',openingHours:'09:00–17:00（周一闭馆）',status:'enabled',mapProvider:'Tencent',coordinateSystem:'GCJ02',latitude:39.932,longitude:116.383,boundaryGeoJson:null,intro:'保留楼层、展厅、展品与设施管理能力的场馆示例。',placeIds:[],indoorSpaceIds:['380000000000000001','380000000000000002','380000000000000003','380000000000000004'] },
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

export const routes: TourRoute[] = [
  {id:'490000000000000001',destinationId:'18446744073709551001',code:'HH-R-01',name:'后海经典半日线',sceneType:'outdoor',theme:'水岸、胡同与王府',distanceKm:4.8,estimatedMinutes:150,status:'published',auditRemark:'',ownerName:'周策划',stops:[['01','290000000000000002','烟袋斜街东口落客','rickshaw',18],['02','290000000000000001','桥东侧安全区停靠','walk',12],['03','290000000000000003','鸦儿胡同步行进入','walk',15],['04','290000000000000004','后海北沿入口停靠','rickshaw',28],['05','290000000000000005','柳荫街入口下车','rickshaw',45]].map(([suffix,placeId,arrivalNote,transportMode,stayMinutes])=>({id:`5900000000000000${suffix}`,placeId:String(placeId),arrivalNote:String(arrivalNote),transportMode:transportMode as 'rickshaw'|'walk',stayMinutes:Number(stayMinutes)})),geometry:[{latitude:39.94086,longitude:116.39363},{latitude:39.94052,longitude:116.38615},{latitude:39.94366,longitude:116.39043},{latitude:39.94506,longitude:116.38272},{latitude:39.93682,longitude:116.38155}]},
  {id:'490000000000000002',destinationId:'18446744073709551001',code:'HH-R-02',name:'胡同故事轻游线',sceneType:'outdoor',theme:'街巷与市井',distanceKm:2.1,estimatedMinutes:70,status:'pending',auditRemark:'等待运营审核',ownerName:'陈导游',stops:[{id:'590000000000000006',placeId:'290000000000000002',arrivalNote:'东口集合',transportMode:'walk',stayMinutes:20},{id:'590000000000000007',placeId:'290000000000000001',arrivalNote:'桥边结束',transportMode:'rickshaw',stayMinutes:15}],geometry:[{latitude:39.94086,longitude:116.39363},{latitude:39.94052,longitude:116.38615}]},
  {id:'490000000000000003',destinationId:'18446744073709551001',code:'HH-R-03',name:'王府名人深度线',sceneType:'outdoor',theme:'名人与近代北京',distanceKm:3.4,estimatedMinutes:120,status:'draft',auditRemark:'',ownerName:'周策划',stops:[{id:'590000000000000008',placeId:'290000000000000004',arrivalNote:'北沿入口',transportMode:'rickshaw',stayMinutes:35},{id:'590000000000000009',placeId:'290000000000000005',arrivalNote:'柳荫街入口',transportMode:'rickshaw',stayMinutes:55}],geometry:[{latitude:39.94506,longitude:116.38272},{latitude:39.93682,longitude:116.38155}]},
  {id:'490000000000000004',destinationId:'18446744073709551002',code:'MG-R-01',name:'镇馆精品探索线',sceneType:'indoor',theme:'展厅与文物故事',distanceKm:0.6,estimatedMinutes:55,status:'published',auditRemark:'',ownerName:'馆方运营',stops:[{id:'590000000000000010',placeId:'380000000000000002',arrivalNote:'展厅入口',transportMode:'indoor',stayMinutes:25},{id:'590000000000000011',placeId:'380000000000000003',arrivalNote:'沿一层连廊抵达',transportMode:'indoor',stayMinutes:25}],geometry:[]},
]

export const mockDatabase: DemoDatabase = { destinations, places, indoorSpaces, routes }
