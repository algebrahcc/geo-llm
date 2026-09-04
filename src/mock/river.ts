import type {
  AiAnalysisStep,
  CrossingPlanCard,
  CrossingResourceSpec,
  CrossingSettingForm
} from '@/views/river/modules/types';

export const riverFlowTemplate = [
  { key: 'env', label: '环境分析', description: '河道宽度、水面状态与周边地形分析' },
  { key: 'surface', label: '面源评估分析', description: '涉水面、岸滩条件与可展开区评估' },
  { key: 'knowledge', label: '知识抽取', description: '提取渡河案例与装备约束规则' },
  { key: 'parallel', label: '平行方案设计', description: '生成三条候选保障方案' },
  { key: 'algorithm', label: '算法模块', description: '机动路径与资源分配计算' },
  { key: 'risk', label: '风险评估', description: '识别火力、延误与阻绝风险' },
  { key: 'output', label: '输出方案生成', description: '汇总推荐结论与保障动作' }
] as const;

// 预设视角：淡水河关渡段（关渡大桥—社子岛头）
export const riverPresets = {
  task: {
    longitude: 121.4585,
    latitude: 25.1185,
    height: 14000
  }
} as const;

/**
 * 淡水河河道中心线（WGS84）。
 * 关渡大桥坐标为公开资料验证值（121.4572, 25.1256），其余点沿真实河道走向插值（±150m）。
 * 详见 docs/渡河场景点位表.md。
 */
export const riverStaticChannels = [
  {
    id: 'river-channel-main',
    name: '关渡段主渡河通道',
    color: '#5ea4ff',
    positions: [
      [121.4572, 25.1256],
      [121.4583, 25.123],
      [121.4592, 25.1205],
      [121.46, 25.1178],
      [121.4608, 25.115],
      [121.4622, 25.1116],
      [121.464, 25.1076]
    ]
  },
  {
    id: 'river-channel-alt',
    name: '上游备用浮渡段',
    color: '#8de1ff',
    positions: [
      [121.464, 25.1076],
      [121.4662, 25.1038],
      [121.469, 25.1002],
      [121.4722, 25.0968],
      [121.4762, 25.093],
      [121.4812, 25.089]
    ]
  }
] as const;

export const riverStaticAssemblyZones = [
  {
    id: 'assembly-south',
    name: '八里岸集结区',
    color: '#2ee59d',
    positions: [
      [121.4455, 25.1155],
      [121.452, 25.116],
      [121.4525, 25.1225],
      [121.446, 25.1215]
    ]
  },
  {
    id: 'assembly-support',
    name: '五股器材展开区',
    color: '#ffcf5c',
    positions: [
      [121.447, 25.106],
      [121.4535, 25.1065],
      [121.454, 25.1115],
      [121.4475, 25.111]
    ]
  }
] as const;

export const riverPlanSummaries = {
  'plan-a': {
    key: 'plan-a',
    label: '方案一',
    title: '门桥漕渡主渡方案（关渡大桥上游渡场）',
    summary:
      '西岸狮子头滩地集结，门桥编组于关渡大桥上游约1km处漕渡横越约450m河幅，在关渡宫南侧登陆场上岸，优先保证主突击群过河时效。',
    metrics: [
      { label: '完成时长', value: '82 分钟', tone: 'primary' },
      { label: '资源消耗', value: '中等', tone: 'success' },
      { label: '风险等级', value: '中', tone: 'warning' },
      { label: '置信度', value: '86%', tone: 'primary' }
    ],
    actions: [
      '八里岸器材先行展开，利用平潮窗口压缩门桥编组下水时间',
      '狮子头观察哨前出，监视关渡大桥桥区与对岸红树林滩地',
      '门桥编组分两梯次进入渡场，减轻下水场拥堵'
    ],
    risks: [
      { title: '下水场拥堵', detail: '西岸龙形滩地通道容量有限，梯队易堆积' },
      { title: '登陆场受限', detail: '东岸红树林保育区不可通行，登陆点须避开北缘' }
    ],
    materials: [
      { id: 'mat-a-1', name: '方案一通道截图', type: '截图', status: '待生成' },
      { id: 'mat-a-2', name: '主渡场保障标注', type: '标注', status: '已挂接' }
    ]
  },
  'plan-b': {
    key: 'plan-b',
    label: '方案二',
    title: '浮桥分段架设方案（社子岛头渡场）',
    summary:
      '在方案一渡场上游约800m的社子岛头—五股段架设浮桥，打通西岸器材转换场至社子岛通道，通行能力强但架设期间桥位暴露。',
    metrics: [
      { label: '完成时长', value: '76 分钟', tone: 'primary' },
      { label: '资源消耗', value: '较高', tone: 'warning' },
      { label: '风险等级', value: '中高', tone: 'error' },
      { label: '置信度', value: '79%', tone: 'primary' }
    ],
    actions: [
      '舟桥器材于五股转换场完成拼装后分批下水',
      '社子岛头接引组提前到位，浮桥贯通后立即疏导车流',
      '感潮强流时段停止作业，锚定浮桥待平潮'
    ],
    risks: [
      { title: '桥位暴露', detail: '架设期间浮桥横跨主槽，易受漂流物与火力威胁' },
      { title: '纵深受限', detail: '社子岛地势低洼、堤防高，重装上岸后机动受限' }
    ],
    materials: [
      { id: 'mat-b-1', name: '方案二路线草图', type: '截图', status: '待生成' },
      { id: 'mat-b-2', name: '桥位风险点', type: '标注', status: '已挂接' }
    ]
  },
  'plan-c': {
    key: 'plan-c',
    label: '方案三',
    title: '冲锋舟突击方案（渡船头—竹围段）',
    summary: '利用关渡大桥下游感潮平潮窗口，冲锋舟梯队从八里渡船头出发多点突击横渡至竹围岸段，部署快但单次运力有限。',
    metrics: [
      { label: '完成时长', value: '95 分钟', tone: 'warning' },
      { label: '资源消耗', value: '中等', tone: 'success' },
      { label: '风险等级', value: '低', tone: 'success' },
      { label: '置信度', value: '83%', tone: 'primary' }
    ],
    actions: [
      '无人机先行侦察竹围岸段与河口强潮区流况',
      '渡船头下水面多点同时下水，缩短梯队暴露时间',
      '登陆后向淡水方向纵深机动，抢占岸滩要点'
    ],
    risks: [
      { title: '河口强潮', detail: '靠近河口潮流增强，须严格按平潮窗口行动' },
      { title: '运力有限', detail: '冲锋舟仅能输送轻装人员，重装备无法渡河' }
    ],
    materials: [
      { id: 'mat-c-1', name: '方案三接应区截图', type: '截图', status: '待生成' },
      { id: 'mat-c-2', name: '竹围登陆点', type: '标注', status: '已挂接' }
    ]
  }
} as const;

export const riverPlanScenes = {
  'plan-a': {
    route: {
      id: 'plan-a-route',
      name: '方案一渡河路线',
      color: '#63e6be',
      // 八里岸集结 → 狮子头下水 → 横渡约500m → 关渡宫南侧登陆 → 纵深机动
      positions: [
        [121.4468, 25.1192],
        [121.4515, 25.1196],
        [121.4552, 25.1198],
        [121.4592, 25.1205],
        [121.4608, 25.1208],
        [121.4665, 25.1215]
      ]
    },
    riskZones: [
      {
        id: 'plan-a-risk-1',
        name: '关渡大桥火力封锁区',
        color: '#fb7185',
        positions: [
          [121.4585, 25.1193],
          [121.4623, 25.1217],
          [121.4559, 25.1319],
          [121.4521, 25.1295]
        ]
      },
      {
        id: 'plan-a-risk-2',
        name: '红树林滩地风险区',
        color: '#fb7185',
        positions: [
          [121.4595, 25.113],
          [121.4645, 25.1135],
          [121.466, 25.117],
          [121.4615, 25.1178]
        ]
      }
    ],
    marks: [
      { id: 'plan-a-mark-1', name: '主渡场下水点', longitude: 121.4552, latitude: 25.1198, color: '#63e6be' },
      { id: 'plan-a-mark-2', name: '关渡登陆场', longitude: 121.4608, latitude: 25.1208, color: '#63e6be' },
      { id: 'plan-a-mark-3', name: '狮子头观察哨', longitude: 121.453, latitude: 25.1225, color: '#ffd166' }
    ]
  },
  'plan-b': {
    route: {
      id: 'plan-b-route',
      name: '方案二渡河路线',
      color: '#5ea4ff',
      // 五股器材转换场 → 西岸桥头 → 浮桥桥位（河心） → 社子岛头接引 → 岛内纵深
      positions: [
        [121.448, 25.113],
        [121.4555, 25.1134],
        [121.4595, 25.1136],
        [121.4635, 25.114],
        [121.4685, 25.115]
      ]
    },
    riskZones: [
      {
        id: 'plan-b-risk-1',
        name: '感潮强流带',
        color: '#fb7185',
        positions: [
          [121.458, 25.115],
          [121.4638, 25.1148],
          [121.468, 25.104],
          [121.4622, 25.1042]
        ]
      },
      {
        id: 'plan-b-risk-2',
        name: '器材转换滞留区',
        color: '#ff9f43',
        positions: [
          [121.447, 25.109],
          [121.453, 25.1095],
          [121.4535, 25.1125],
          [121.4475, 25.112]
        ]
      }
    ],
    marks: [
      { id: 'plan-b-mark-1', name: '浮桥桥位', longitude: 121.4595, latitude: 25.1136, color: '#8de1ff' },
      { id: 'plan-b-mark-2', name: '社子岛头接引点', longitude: 121.4655, latitude: 25.1135, color: '#63e6be' },
      { id: 'plan-b-mark-3', name: '五股器材转换场', longitude: 121.45, latitude: 25.111, color: '#ffcf5c' }
    ]
  },
  'plan-c': {
    route: {
      id: 'plan-c-route',
      name: '方案三渡河路线',
      color: '#f7b267',
      // 八里渡船头下水 → 横渡 → 竹围岸段多点登陆 → 向淡水方向纵深
      positions: [
        [121.436, 25.142],
        [121.4395, 25.1435],
        [121.4428, 25.1452],
        [121.4462, 25.1468],
        [121.45, 25.1485]
      ]
    },
    riskZones: [
      {
        id: 'plan-c-risk-1',
        name: '河口强潮区',
        color: '#fbbf24',
        positions: [
          [121.4425, 25.148],
          [121.447, 25.1495],
          [121.443, 25.156],
          [121.4385, 25.1545]
        ]
      }
    ],
    marks: [
      { id: 'plan-c-mark-1', name: '渡船头下水面', longitude: 121.4398, latitude: 25.1438, color: '#f7b267' },
      { id: 'plan-c-mark-2', name: '竹围登陆点', longitude: 121.4462, latitude: 25.1468, color: '#2ee59d' }
    ]
  }
} as const;

// ─────────────────── 新版渡河工程保障 Mock ───────────────────

/** 设置表单默认值 */
export const defaultCrossingSettingForm: CrossingSettingForm = {
  taskName: '淡水河关渡段快速渡河保障',
  location: '淡水河关渡段（八里—关渡）西岸至东岸',
  taskType: '渡河保障',
  actionTime: '2026-06-15 06:00',
  forceScale: '1个合成营',
  riverWidth: 450,
  waterDepthRange: '4~8m',
  flowVelocity: '0.8~1.8 m/s',
  riverbedTerrain: '泥沙质为主',
  weatherCondition: '晴 29°C 东南风3级 涨潮',
  visibilityKm: 15,
  strategicIntent: '无明确敌情',
  availableResources: ['登陆艇', '冲锋舟', '浮桥', '无人机'],
  timeConstraint: '3小时内完成渡河',
  otherRequirements: '避开关渡红树林保育区，利用平潮窗口作业'
};

/** 任务类型选项 */
export const crossingTaskTypeOptions = [
  { label: '渡河保障', value: '渡河保障' },
  { label: '伴随保障', value: '伴随保障' },
  { label: '桥位抢修', value: '桥位抢修' },
  { label: '门桥渡河', value: '门桥渡河' }
];

/** 兵力规模选项 */
export const forceScaleOptions = [
  { label: '1个连', value: '1个连' },
  { label: '1个营', value: '1个营' },
  { label: '1个合成营', value: '1个合成营' },
  { label: '1个团', value: '1个团' }
];

/** 可用资源选项 */
export const resourceOptions = [
  { label: '登陆艇', value: '登陆艇' },
  { label: '冲锋舟', value: '冲锋舟' },
  { label: '浮桥', value: '浮桥' },
  { label: '无人机', value: '无人机' },
  { label: '工兵作业车', value: '工兵作业车' },
  { label: '架桥坦克', value: '架桥坦克' },
  { label: '两栖坦克', value: '两栖坦克' }
];

/** 可用资源规格属性（长度/宽度/高度等，供方案助手面板回显） */
export const crossingResourceSpecs: Record<string, CrossingResourceSpec> = {
  登陆艇: {
    name: '登陆艇',
    model: '通用机械化登陆艇',
    icon: '🚢',
    count: 3,
    attrs: [
      { label: '长度', value: '28.4 m' },
      { label: '宽度', value: '7.2 m' },
      { label: '高度', value: '5.6 m' },
      { label: '吃水深度', value: '1.6 m' },
      { label: '载重量', value: '60 t' },
      { label: '水上航速', value: '18 km/h' },
      { label: '满载排水量', value: '120 t' },
      { label: '适航流速', value: '≤ 3.0 m/s' }
    ]
  },
  冲锋舟: {
    name: '冲锋舟',
    model: '突击型橡皮冲锋舟',
    icon: '🛶',
    count: 16,
    attrs: [
      { label: '长度', value: '5.6 m' },
      { label: '宽度', value: '2.2 m' },
      { label: '高度', value: '1.1 m' },
      { label: '载员', value: '10 人' },
      { label: '载重量', value: '1.2 t' },
      { label: '水上航速', value: '46 km/h' },
      { label: '抗风等级', value: '≤ 5 级' },
      { label: '适航流速', value: '≤ 2.5 m/s' }
    ]
  },
  浮桥: {
    name: '浮桥',
    model: '重型舟桥器材',
    icon: '🌉',
    count: 1,
    attrs: [
      { label: '单节长度', value: '6.75 m' },
      { label: '桥面宽度', value: '6.5 m' },
      { label: '舟体高度', value: '2.1 m' },
      { label: '架设长度', value: '265 m/套' },
      { label: '通载等级', value: '60 t 级' },
      { label: '架设时间', value: '约 60 min' },
      { label: '适应流速', value: '≤ 3.0 m/s' },
      { label: '适应岸坡', value: '≤ 8°' }
    ]
  },
  无人机: {
    name: '无人机',
    model: '侦察型固定翼无人机',
    icon: '🛩️',
    count: 4,
    attrs: [
      { label: '机身长度', value: '1.8 m' },
      { label: '翼展宽度', value: '3.2 m' },
      { label: '机身高度', value: '0.6 m' },
      { label: '续航时间', value: '4 h' },
      { label: '侦察半径', value: '15 km' },
      { label: '巡航速度', value: '90 km/h' },
      { label: '抗风等级', value: '≤ 6 级' },
      { label: '工作海拔', value: '≤ 4500 m' }
    ]
  },
  工兵作业车: {
    name: '工兵作业车',
    model: '综合工程保障车',
    icon: '🚜',
    count: 6,
    attrs: [
      { label: '长度', value: '7.5 m' },
      { label: '宽度', value: '3.1 m' },
      { label: '高度', value: '3.2 m' },
      { label: '整备质量', value: '16 t' },
      { label: '最高车速', value: '70 km/h' },
      { label: '涉水深度', value: '1.2 m' },
      { label: '爬坡度', value: '60 %' },
      { label: '连续作业', value: '8 h' }
    ]
  },
  架桥坦克: {
    name: '架桥坦克',
    model: '装甲冲击桥车',
    icon: '🛡️',
    count: 2,
    attrs: [
      { label: '行军长度', value: '11.8 m' },
      { label: '车体宽度', value: '3.5 m' },
      { label: '车体高度', value: '3.3 m' },
      { label: '桥体跨长', value: '22 m' },
      { label: '通载等级', value: '60 t 级' },
      { label: '架设时间', value: '约 5 min' },
      { label: '战斗全重', value: '42 t' },
      { label: '适应流速', value: '≤ 2.5 m/s' }
    ]
  },
  两栖坦克: {
    name: '两栖坦克',
    model: '两栖突击战车',
    icon: '⚔️',
    count: 8,
    attrs: [
      { label: '长度', value: '8.0 m' },
      { label: '宽度', value: '3.3 m' },
      { label: '高度', value: '2.9 m' },
      { label: '战斗全重', value: '28 t' },
      { label: '水上航速', value: '12 km/h' },
      { label: '陆上速度', value: '60 km/h' },
      { label: '适航浪高', value: '≤ 1.2 m' },
      { label: '适航流速', value: '≤ 2.0 m/s' }
    ]
  }
};

/** AI 分析步骤模板 */
export const aiAnalysisStepTemplate: AiAnalysisStep[] = [
  { key: 'env', label: '环境与水文条件分析', status: 'waiting', description: '分析河宽、水深、流速、地形等环境参数' },
  { key: 'retrieve', label: '知识库检索与匹配', status: 'waiting', description: '', tool: '知识库检索' },
  { key: 'crossing', label: '渡场点选择与路线分析', status: 'waiting', description: '基于知识库匹配结果选择最优渡场' },
  { key: 'risk', label: '风险评估与综合分析', status: 'waiting', description: '评估水文风险、装备适配性、时间约束' },
  { key: 'recommend', label: '首选方案推荐', status: 'waiting', description: '综合评分推荐最优方案' }
];

/** 底部方案卡片数据（固定三个方案，不做淘汰；渡场取自 docs/渡河场景点位表.md） */
export const crossingPlanCards: CrossingPlanCard[] = [
  {
    rank: 1,
    key: 'plan-a',
    label: '方案一',
    title: '门桥漕渡主渡方案',
    isRecommended: true,
    stars: 5,
    duration: '~2h46min',
    capacity: '1个营/h',
    safety: '优',
    scenario: '门桥+浮桥混合编组，适合关渡窄段快速突渡',
    routeDesc: '八里狮子头滩地集结，于关渡大桥上游约1km渡场漕渡横越约450m，在关渡宫南侧登陆场上岸',
    keyEquipment: ['冲锋舟×8', '重型浮桥1套', '工兵作业车×4'],
    advantages: ['渡河速度最快，可在3小时内完成', '混合编组灵活性强', '狮子头高地观察条件好'],
    risks: ['涨落潮时流速增大，须利用平潮窗口', '东岸登陆须避开红树林保育区北缘'],
    conditions: ['平潮窗口流速<1.5m/s', '能见度>5km', '风力<4级']
  },
  {
    rank: 2,
    key: 'plan-b',
    label: '方案二',
    title: '浮桥分段架设方案',
    isRecommended: false,
    stars: 4,
    duration: '~3h20min',
    capacity: '2个营/h',
    safety: '良',
    scenario: '重型浮桥在社子岛头—五股段分段架设，适合大规模装备渡河',
    routeDesc: '自五股器材转换场下水，于社子岛头段架设浮桥贯通两岸，接引至延平北路方向',
    keyEquipment: ['重型浮桥2套', '舟桥器材32套', '架桥坦克×2'],
    advantages: ['通行能力最强，适合重装部队', '浮桥稳定性好', '可多段并行'],
    risks: ['架设时间较长，桥位暴露于主槽', '社子岛地势低洼，纵深机动受限'],
    conditions: ['河宽<1000m', '水深<12m', '岸滩坡度<8°']
  },
  {
    rank: 3,
    key: 'plan-c',
    label: '方案三',
    title: '冲锋舟突击渡河方案',
    isRecommended: false,
    stars: 3,
    duration: '~1h50min',
    capacity: '0.5个营/h',
    safety: '中',
    scenario: '纯冲锋舟突击，在关渡大桥下游渡船头—竹围段多点登陆',
    routeDesc: '从八里渡船头下水面出发，冲锋舟梯队按平潮窗口直渡，在竹围岸段多点同时登陆',
    keyEquipment: ['冲锋舟×16', '无人机×4', '登陆艇×3'],
    advantages: ['部署最快，机动灵活', '对岸滩要求低', '隐蔽性好'],
    risks: ['单次运力有限', '重装备无法渡河', '河口强潮区须严格按窗口行动'],
    conditions: ['平潮窗口流速<1.5m/s', '人员轻装', '天气良好']
  }
];
