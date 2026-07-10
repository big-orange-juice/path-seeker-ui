/**
 * Demo 任务数据 —— 纯前端 mock，不对接真实后端。
 * 仅保留「普通选择题」与「拼图」两种题型，覆盖完整主链路。
 */
window.DemoData = (() => {
  const MISSIONS = [
    {
      id: "route-bronze",
      title: "青铜迷踪",
      theme: "馆藏探秘",
      summary: "在青铜馆中追踪一枚失落的纹饰碎片，用观察与推理还原一段被掩埋的叙事。",
      difficultyLevel: "medium",
      difficultyLabel: "进阶",
      recommendedAgeBand: "10-15",
      availableAgeBands: ["6-9", "10-15", "16+"],
      estimatedMinutes: 35,
      chapterCount: 3,
      rewardTitle: "青铜纹饰徽章",
      coverTheme: "bronze",
      prologue: [
        {
          eyebrow: "开场",
          title: "馆灯初亮",
          content: "夜巡刚结束，青铜馆的感应灯仍在缓慢呼吸。你收到一条匿名线索：某件容器的纹饰，昨夜被人动过。",
        },
        {
          eyebrow: "任务",
          title: "追踪碎片",
          content: "你需要沿着三处关键展位完成识别与作答。每解开一站，就会解锁下一段被隐去的解说。",
        },
        {
          eyebrow: "提示",
          title: "如何探索",
          content: "到达展品前先完成现场识别，观看短片后再作答。可自由选择章节顺序，但建议按叙事推进。",
        },
      ],
      chapters: [
        {
          id: "ch-bronze-1",
          stageNo: 1,
          title: "兽面纹的注视",
          targetLocation: "青铜馆 · A 区 03 号展柜",
          objective: "在鼎腹兽面纹中找出与线索图对应的关键特征。",
          artifact: {
            title: "兽面纹鼎",
            subtitle: "商晚期 · 高 42cm · 青铜",
            location: "青铜馆 A 区",
            detailCallout: "注意鼎腹正中兽面的眼部与角部比例。",
            observationPoint: "侧光下，角纹会出现细微的凹凸反差。",
            suspiciousPoint: "右侧耳部有一处与整体风格略异的修补痕迹。",
            checklist: ["对照线索图中的「目」形纹", "确认角纹是否对称", "记录柜签上的馆藏编号"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "馆方档案片段：兽面纹如何成为权力与秩序的视觉符号。",
          },
          puzzle: {
            id: "pz-bronze-1",
            type: "choice",
            prompt: "根据观察与短片，兽面纹鼎腹上最能对应线索图的特征是？",
            hint: "把注意力放在「目」与角的组合，而不是整体轮廓。",
            options: [
              { id: "a", key: "A", text: "双角外撇且目纹呈臣字状" },
              { id: "b", key: "B", text: "无角，仅有云雷纹环绕" },
              { id: "c", key: "C", text: "单角直立，口部张开呈圆形" },
              { id: "d", key: "D", text: "完全素面，无任何兽面痕迹" },
            ],
            answerId: "a",
            score: 30,
            narrative: "你锁定了臣字目与外撇双角——这正是线索图里被圈出的关键符号。",
          },
        },
        {
          id: "ch-bronze-2",
          stageNo: 2,
          title: "残片拼合",
          targetLocation: "青铜馆 · 修复间观摩窗",
          objective: "将残片纹饰拼回完整图样，还原被遮盖的铭文区域。",
          artifact: {
            title: "纹饰拓片残件",
            subtitle: "近代拓片 · 局部残损",
            location: "修复间观摩窗",
            detailCallout: "残片上保留了部分雷纹与铭文边框。",
            observationPoint: "拼合时优先对齐边框直线，再处理曲线纹样。",
            suspiciousPoint: "其中一块边缘颜色偏深，可能是后补墨。",
            checklist: ["先找带直线边框的碎片", "对照完整拓片缩略图", "注意纹路走向是否连续"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "修复师口述：拓片如何帮助我们理解青铜器表面的「第二层叙事」。",
          },
          puzzle: {
            id: "pz-bronze-2",
            type: "jigsaw",
            prompt: "拖动方块，将拓片残件重新拼合完整。",
            hint: "先把四角固定，再处理中间雷纹。",
            grid: 3,
            // 用 CSS 渐变生成可辨识的「伪拓片」图，无需额外图片资源
            palette: "bronze",
            score: 40,
            narrative: "残片归位后，铭文边框完整显露——下一段线索就藏在这里。",
          },
        },
        {
          id: "ch-bronze-3",
          stageNo: 3,
          title: "最后的判读",
          targetLocation: "青铜馆 · 叙事长廊",
          objective: "综合前两站信息，判断这批线索真正指向的历史语境。",
          artifact: {
            title: "叙事长廊投影墙",
            subtitle: "综合解读节点",
            location: "青铜馆叙事长廊",
            detailCallout: "把兽面特征与拓片铭文边框放在一起看。",
            observationPoint: "短片末尾的馆藏编号与第一站柜签一致。",
            suspiciousPoint: "匿名线索的笔迹，与馆内讲解词风格高度相似。",
            checklist: ["回顾第一站的臣字目", "确认第二站铭文边框", "思考线索发布者的身份"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "终章旁白：所有线索并非来自「窃贼」，而是一场精心设计的馆内解谜。",
          },
          puzzle: {
            id: "pz-bronze-3",
            type: "choice",
            prompt: "综合全部线索，这条「匿名任务」最可能的真实意图是？",
            hint: "注意短片结尾的馆方署名。",
            options: [
              { id: "a", key: "A", text: "有人企图盗取鼎器" },
              { id: "b", key: "B", text: "馆方设计的沉浸式教育任务" },
              { id: "c", key: "C", text: "游客误触报警系统" },
              { id: "d", key: "D", text: "展柜灯光故障引发的误会" },
            ],
            answerId: "b",
            score: 30,
            narrative: "你识破了「匿名」的外衣——这是一场引导观众深度阅读展品的沉浸式任务。",
          },
        },
      ],
    },
    {
      id: "route-silk",
      title: "丝路织影",
      theme: "丝路文明",
      summary: "跟随一匹残损织锦的纹样，穿梭于丝路馆的色彩与符号之间。",
      difficultyLevel: "easy",
      difficultyLabel: "入门",
      recommendedAgeBand: "6-9",
      availableAgeBands: ["6-9", "10-15"],
      estimatedMinutes: 25,
      chapterCount: 2,
      rewardTitle: "丝路织锦书签",
      coverTheme: "silk",
      prologue: [
        {
          eyebrow: "开场",
          title: "织机未歇",
          content: "丝路馆的光线偏暖。讲解员留下一张便条：请帮我把这匹织锦的故事讲完。",
        },
      ],
      chapters: [
        {
          id: "ch-silk-1",
          stageNo: 1,
          title: "联珠纹的来路",
          targetLocation: "丝路馆 · 织锦厅",
          objective: "识别联珠纹母题，理解其跨文化传播路径。",
          artifact: {
            title: "联珠对鸟纹锦",
            subtitle: "唐代 · 丝织",
            location: "丝路馆织锦厅",
            detailCallout: "圆形联珠环内是一对相向的鸟。",
            observationPoint: "联珠并非装饰点缀，而是文化交汇的标志。",
            suspiciousPoint: "边饰色彩有后世修补。",
            checklist: ["数清联珠的数量规律", "观察对鸟的姿态", "对照地图上的传播路线"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "动画短片：联珠纹如何从波斯世界走向长安织机。",
          },
          puzzle: {
            id: "pz-silk-1",
            type: "choice",
            prompt: "联珠纹最能体现的文化特征是？",
            hint: "想想它为什么会同时出现在不同文明的器物上。",
            options: [
              { id: "a", key: "A", text: "仅属于中原本土传统" },
              { id: "b", key: "B", text: "丝路文化交流与融合的视觉证据" },
              { id: "c", key: "C", text: "现代设计师的创意" },
              { id: "d", key: "D", text: "与贸易完全无关的宗教符号" },
            ],
            answerId: "b",
            score: 50,
            narrative: "联珠环环相扣，正如丝路上的文明彼此照见。",
          },
        },
        {
          id: "ch-silk-2",
          stageNo: 2,
          title: "色彩拼图",
          targetLocation: "丝路馆 · 互动台",
          objective: "拼合织锦色彩分区图，完成纹样阅读。",
          artifact: {
            title: "织锦色谱板",
            subtitle: "互动教具",
            location: "丝路馆互动台",
            detailCallout: "按经纬方向理解色块分布。",
            observationPoint: "主色块通常落在图案中心。",
            suspiciousPoint: "边角有一块颜色被故意打乱。",
            checklist: ["先拼中心色块", "再对齐边饰", "对照完整示意图"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "染色工艺微纪录片：从植物到丝线的色彩之旅。",
          },
          puzzle: {
            id: "pz-silk-2",
            type: "jigsaw",
            prompt: "将色谱板拼回正确顺序。",
            hint: "中心偏暖、边缘偏冷。",
            grid: 2,
            palette: "silk",
            score: 50,
            narrative: "色块归位，织锦的完整叙事重新展开。",
          },
        },
      ],
    },
    {
      id: "route-jade",
      title: "玉声回廊",
      theme: "玉器美学",
      summary: "听玉、观玉、辨玉——在玉器馆完成一次关于材质与礼制的轻量探索。",
      difficultyLevel: "hard",
      difficultyLabel: "挑战",
      recommendedAgeBand: "16+",
      availableAgeBands: ["10-15", "16+"],
      estimatedMinutes: 40,
      chapterCount: 2,
      rewardTitle: "和田玉影纪念卡",
      coverTheme: "jade",
      prologue: [
        {
          eyebrow: "开场",
          title: "回廊有声",
          content: "玉器馆的脚步声被地毯吞没。你只听见玻璃柜里的静——以及一段若有若无的解说录音。",
        },
      ],
      chapters: [
        {
          id: "ch-jade-1",
          stageNo: 1,
          title: "温润的判断",
          targetLocation: "玉器馆 · 礼器厅",
          objective: "区分礼仪用玉与装饰用玉的关键视觉线索。",
          artifact: {
            title: "青玉璧",
            subtitle: "战国 · 青玉",
            location: "玉器馆礼器厅",
            detailCallout: "璧的圆形与中孔比例是礼制的一部分。",
            observationPoint: "表面抛光均匀，边缘无使用磨损。",
            suspiciousPoint: "底座说明牌的年代写法与邻柜不一致。",
            checklist: ["观察中孔比例", "感受光透过玉质的层次", "阅读礼制说明"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "学者访谈：为何「以玉比德」会成为长久的文化隐喻。",
          },
          puzzle: {
            id: "pz-jade-1",
            type: "choice",
            prompt: "青玉璧在礼制语境中，最核心的象征是？",
            hint: "与「天」相关的圆形意象。",
            options: [
              { id: "a", key: "A", text: "财富与交易媒介" },
              { id: "b", key: "B", text: "祭天与等级秩序的礼器" },
              { id: "c", key: "C", text: "日常佩饰无特殊含义" },
              { id: "d", key: "D", text: "仅用于墓葬防潮" },
            ],
            answerId: "b",
            score: 50,
            narrative: "圆形象天——玉璧把抽象的秩序，落成了可触摸的形制。",
          },
        },
        {
          id: "ch-jade-2",
          stageNo: 2,
          title: "纹理复原",
          targetLocation: "玉器馆 · 显微观察台",
          objective: "拼合显微纹理图，辨认真玉特征。",
          artifact: {
            title: "玉质显微图",
            subtitle: "互动观察",
            location: "显微观察台",
            detailCallout: "真玉在显微下呈现交织纤维结构。",
            observationPoint: "注意纹理走向是否自然连续。",
            suspiciousPoint: "某块图样过于均匀，像是印刷品。",
            checklist: ["对齐纤维走向", "排除过于规则的假图", "对照讲解员提示"],
          },
          video: {
            src: "./assets/movie.mp4",
            caption: "显微镜头下的玉：结构如何暴露真伪。",
          },
          puzzle: {
            id: "pz-jade-2",
            type: "jigsaw",
            prompt: "拼合显微纹理，完成真玉判读。",
            hint: "纤维纹理应像交织的丝网，而非平行条纹。",
            grid: 3,
            palette: "jade",
            score: 50,
            narrative: "纹理归位，真玉的温润结构一目了然。",
          },
        },
      ],
    },
  ];

  const DIFFICULTY_LABELS = {
    easy: "入门",
    medium: "进阶",
    hard: "挑战",
  };

  const AGE_OPTIONS = [
    { value: "all", label: "全部年龄" },
    { value: "6-9", label: "6-9 岁" },
    { value: "10-15", label: "10-15 岁" },
    { value: "16+", label: "16+" },
  ];

  const DIFFICULTY_OPTIONS = [
    { value: "all", label: "全部难度" },
    { value: "easy", label: "入门" },
    { value: "medium", label: "进阶" },
    { value: "hard", label: "挑战" },
  ];

  function getMission(id) {
    return MISSIONS.find((m) => m.id === id) || null;
  }

  function getChapter(missionId, chapterId) {
    const mission = getMission(missionId);
    if (!mission) return null;
    return mission.chapters.find((c) => c.id === chapterId) || null;
  }

  function listMissions() {
    return MISSIONS.map((m) => ({
      id: m.id,
      title: m.title,
      theme: m.theme,
      summary: m.summary,
      difficultyLevel: m.difficultyLevel,
      difficultyLabel: m.difficultyLabel || DIFFICULTY_LABELS[m.difficultyLevel],
      recommendedAgeBand: m.recommendedAgeBand,
      estimatedMinutes: m.estimatedMinutes,
      chapterCount: m.chapterCount,
      rewardTitle: m.rewardTitle,
      coverTheme: m.coverTheme,
    }));
  }

  return {
    MISSIONS,
    AGE_OPTIONS,
    DIFFICULTY_OPTIONS,
    DIFFICULTY_LABELS,
    getMission,
    getChapter,
    listMissions,
  };
})();
