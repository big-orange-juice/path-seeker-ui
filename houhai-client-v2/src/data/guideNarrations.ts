import type { CulturalPlace, GuideNarration } from '../types.ts'

const alternativeChapters: Record<string, { title: string; text: string }> = {
  bridge: { title: '和孩子一起找一找桥的形状', text: '先在桥边找一处不妨碍行人的位置，和孩子一起看看：桥面为什么会拱起来？桥下的水又通向哪里？银锭桥把前海和后海连接在一起，也让两岸的人能够走到对面。试着用手在空中画一画桥的轮廓，再看看水里的倒影。认识一座桥，可以先从形状和用途开始，不用急着记住所有年代。' },
  hutong: { title: '做一次胡同观察员', text: '走进烟袋斜街，可以和孩子轮流寻找三样东西：一块店铺招牌、一处屋檐、一条通向旁边的巷子。它们分别告诉我们这里卖什么、房子怎样遮风挡雨、街巷如何连接。观察时请靠边停下，不要站在街道中央。这条斜街和北京许多横平竖直的道路不同，沿着它走一走，就能体会老城怎样顺着水岸生长。' },
  temple: { title: '从门外认识一座寺院', text: '到广化寺，可以先从门外观察屋顶与入口，不必为了完成体验一定进入院内。请孩子找一找左右两边相似的部分，再想想中间的门为什么格外醒目。这样的观察能帮助我们认识传统建筑的对称与中轴。这里仍是宗教活动场所，保持安静、遵守现场安排，也是认识城市文化的一部分。' },
  garden: { title: '从窗户看进一段生活', text: '在宋庆龄故居，亲子参观可以从日常生活的问题开始：人在这里怎样读书、接待客人，又怎样在庭院里散步？把展陈里的照片和眼前的房间相互对照，会让历史人物变得更容易理解。庭园里的树木和水面也可以慢慢看，请沿开放步道行走，以正式展陈和现场说明为依据。' },
  palace: { title: '王府里的空间游戏', text: '来到恭王府，可以和孩子做一个观察游戏：前面的院落哪里显得整齐，后面的花园哪里又充满转折？府邸里排列有序的建筑，与园林里曲折的路径，提供了两种不同的空间体验。让孩子选一个喜欢的角度，说说看到了什么，比记住一串建筑名字更有趣。入内前请先确认预约与开放安排。' },
}

export function guideNarrationsForPlace(place: CulturalPlace): GuideNarration[] {
  const versions: GuideNarration[] = [{
    id: `${place.id}-history`, guideName: '陈老师', specialty: '城市历史',
    title: `${place.name} · 历史与人文`, duration: place.duration, chapters: place.narration,
  }]
  const familyChapter = alternativeChapters[place.artwork]
  if (familyChapter) versions.push({
    id: `${place.id}-family`, guideName: '小林', specialty: '亲子观察',
    title: `${place.name} · 和孩子一起看`, duration: 2, chapters: [familyChapter],
  })
  if (place.artwork === 'palace') versions.push({
    id: `${place.id}-architecture`, guideName: '周老师', specialty: '古建园林',
    title: '从府邸格局到园林意境', duration: 4,
    chapters: [
      { title: '从轴线读王府', text: '看恭王府，不妨先把视线放在建筑之间的关系上。前部府邸通过院落和轴线组织空间，门、厅堂与两侧建筑并不是随意排列的。沿开放参观动线前行，留意每次穿过门洞后视野的变化，您会感受到空间如何由外向内层层展开。这种秩序既服务于日常生活，也承载了清代府邸的礼制观念。' },
      { title: '花园怎样让风景变化', text: '到了后部花园，可以把注意力转向路径、山石、植物与建筑的组合。园林并不总让您一眼看尽全景，而是通过遮挡和转折，让景色随着脚步逐渐展开。试着在一个门洞前停留，再向前走几步，比一比近景和远景的关系。园林的趣味，常常就藏在这样细微的视线变化里。' },
    ],
  })
  return versions
}
