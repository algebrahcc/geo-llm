import type {
  AiAnalysisStep,
  CrossingPlanCard,
  CrossingSettingForm,
  EngineeringPlan,
  EvaluateForm,
  FilterForm,
  FusionDataSummary,
  KnowledgeHitDisplay,
  PortAssessment,
  PortFilterResult,
  ResourceStatItem
} from '@/views/river/modules/types';

// ─────────────────── 旧版保留 ───────────────────

export const riverLeftTools = [
  { key: 'task', label: '任务', icon: 'mdi:file-document-edit-outline' },
  { key: 'analysis', label: '分析', icon: 'mdi:play-circle-outline' },
  { key: 'annotate', label: '标注', icon: 'mdi:map-marker-plus-outline' },
  { key: 'locate', label: '定位', icon: 'mdi:crosshairs-gps' }
] as const;

export const riverRightTools = [
  { key: 'layers', label: '图层面板', icon: 'mdi:layers-outline' },
  { key: 'reset', label: '复位', icon: 'mdi:home-outline' },
  { key: 'pitch', label: '俯仰', icon: 'mdi:axis-arrow' },
  { key: 'rotate', label: '旋转', icon: 'mdi:rotate-orbit' },
  { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
  { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' }
] as const;

export const riverDefaultLayers = [
  { key: 'imagery', label: '影像底图', description: '全球 0-8', visible: true },
  { key: 'channel', label: '渡河通道', description: '展示渡河主通道与浮渡方向', visible: true },
  { key: 'assembly', label: '集结区', description: '显示我方与保障单元集结范围', visible: true },
  { key: 'risk', label: '风险区', description: '展示火力、涉水与阻绝风险区', visible: true },
  { key: 'mark', label: '关键点位', description: '桥位、观察点、登陆点等关键标注', visible: true },
  { key: 'route', label: '方案路线', description: '当前方案机动与保障路线', visible: true }
] as const;

export const riverDefaultTaskForm = {
  taskName: '淡水河北岸快速渡河保障推演',
  taskType: '渡河保障',
  taskRange: '淡水河关渡段南岸至北岸桥位群',
  troopScale: '1 个合成营',
  vehicleCount: '28 辆',
  mainEquipment: '机械化步战车、浮桥分队、工兵保障车',
  timeRequirement: '90 分钟内完成前沿保障展开'
} as const;

export const riverTaskTypeOptions = [
  { label: '渡河保障', value: '渡河保障' },
  { label: '伴随保障', value: '伴随保障' },
  { label: '桥位抢修', value: '桥位抢修' }
] as const;

export const riverFlowTemplate = [
  { key: 'env', label: '环境分析', description: '河道宽度、水面状态与周边地形分析' },
  { key: 'surface', label: '面源评估分析', description: '涉水面、岸滩条件与可展开区评估' },
  { key: 'knowledge', label: '知识抽取', description: '提取渡河案例与装备约束规则' },
  { key: 'parallel', label: '平行方案设计', description: '生成三条候选保障方案' },
  { key: 'algorithm', label: '算法模块', description: '机动路径与资源分配计算' },
  { key: 'risk', label: '风险评估', description: '识别火力、延误与阻绝风险' },
  { key: 'output', label: '输出方案生成', description: '汇总推荐结论与保障动作' }
] as const;

export const riverPresets = {
  task: {
    longitude: 121.48,
    latitude: 25.12,
    height: 18000
  }
} as const;

export const riverStaticChannels = [
  {
    id: 'river-channel-main',
    name: '主渡河通道',
    color: '#5ea4ff',
    positions: [
      [121.465, 25.085],
      [121.467, 25.090],
      [121.469, 25.095],
      [121.470, 25.100],
      [121.473, 25.105],
      [121.476, 25.110],
      [121.478, 25.115],
      [121.482, 25.122],
      [121.485, 25.130]
    ]
  },
  {
    id: 'river-channel-alt',
    name: '备用浮渡通道',
    color: '#8de1ff',
    positions: [
      [121.455, 25.088],
      [121.457, 25.092],
      [121.462, 25.100],
      [121.465, 25.105],
      [121.468, 25.110],
      [121.470, 25.115],
      [121.474, 25.121],
      [121.478, 25.128]
    ]
  }
] as const;

export const riverStaticAssemblyZones = [
  {
    id: 'assembly-south',
    name: '南岸主集结区',
    color: '#2ee59d',
    positions: [
      [121.460, 25.086],
      [121.482, 25.086],
      [121.486, 25.100],
      [121.462, 25.100]
    ]
  },
  {
    id: 'assembly-support',
    name: '保障器材展开区',
    color: '#ffcf5c',
    positions: [
      [121.454, 25.086],
      [121.462, 25.084],
      [121.467, 25.098],
      [121.458, 25.100]
    ]
  }
] as const;

export const riverPlanOptions = [
  { key: 'plan-a', label: '方案一', subtitle: '浮桥主渡' },
  { key: 'plan-b', label: '方案二', subtitle: '多点机动' },
  { key: 'plan-c', label: '方案三', subtitle: '北岸牵引' }
] as const;

export const riverPlanSummaries = {
  'plan-a': {
    key: 'plan-a',
    label: '方案一',
    title: '浮桥主渡保障方案',
    summary: '以主渡河通道为核心，先展开南岸保障，再组织浮桥分队快速接续，优先保证主突击群过河时效。',
    metrics: [
      { label: '完成时长', value: '82 分钟', tone: 'primary' },
      { label: '资源消耗', value: '中等', tone: 'success' },
      { label: '风险等级', value: '中', tone: 'warning' },
      { label: '置信度', value: '86%', tone: 'primary' }
    ],
    actions: [
      '南岸保障器材先行展开，压缩桥位架设等待时间',
      '桥位观察组提前前出，确保主渡通道无新增阻断',
      '浮桥分队与机动群分两梯次进入通道，减轻拥堵'
    ],
    risks: [
      { title: '主通道拥堵', detail: '桥位附近道路容量有限，易出现梯队堆积' },
      { title: '岸滩承载波动', detail: '南岸展开区局部泥泞，重装车辆需绕行' }
    ],
    materials: [
      { id: 'mat-a-1', name: '方案一通道截图', type: '截图', status: '待生成' },
      { id: 'mat-a-2', name: '桥位保障标注', type: '标注', status: '已挂接' }
    ]
  },
  'plan-b': {
    key: 'plan-b',
    label: '方案二',
    title: '多点机动保障方案',
    summary: '采用主通道与备用浮渡通道分流，缩短单通道压力，适合高密度车辆快速展开，但对协同调度要求更高。',
    metrics: [
      { label: '完成时长', value: '76 分钟', tone: 'primary' },
      { label: '资源消耗', value: '较高', tone: 'warning' },
      { label: '风险等级', value: '中高', tone: 'error' },
      { label: '置信度', value: '79%', tone: 'primary' }
    ],
    actions: [
      '将保障车辆拆分至两条通道，降低单点等待',
      '北岸引导组提前到位，减少登陆后再编成时间',
      '备用浮渡点位需保留应急撤收通道'
    ],
    risks: [
      { title: '协同复杂', detail: '双通道并行对指挥同步要求较高' },
      { title: '备用通道暴露', detail: '备用浮渡点位更接近风险观察区' }
    ],
    materials: [
      { id: 'mat-b-1', name: '方案二路线草图', type: '截图', status: '待生成' },
      { id: 'mat-b-2', name: '双通道风险点', type: '标注', status: '已挂接' }
    ]
  },
  'plan-c': {
    key: 'plan-c',
    label: '方案三',
    title: '北岸牵引接应方案',
    summary: '以北岸牵引与接应为核心，先在北岸形成接应面，再组织南岸梯次过河，整体更稳但总时长偏长。',
    metrics: [
      { label: '完成时长', value: '95 分钟', tone: 'warning' },
      { label: '资源消耗', value: '中等', tone: 'success' },
      { label: '风险等级', value: '低', tone: 'success' },
      { label: '置信度', value: '83%', tone: 'primary' }
    ],
    actions: [
      '优先保证北岸接应区清障与引导标识部署',
      '主桥位采取稳态过河节奏，避免过早压入所有车辆',
      '保留一支快速修复力量应对桥位波动'
    ],
    risks: [
      { title: '时长偏长', detail: '整体推进稳健，但抢时效果不如方案一、二' },
      { title: '北岸引导依赖高', detail: '接应组迟滞会影响后续梯次衔接' }
    ],
    materials: [
      { id: 'mat-c-1', name: '方案三接应区截图', type: '截图', status: '待生成' },
      { id: 'mat-c-2', name: '北岸接应点位', type: '标注', status: '已挂接' }
    ]
  }
} as const;

export const riverPlanScenes = {
  'plan-a': {
    route: {
      id: 'plan-a-route',
      name: '方案一路线',
      color: '#63e6be',
      positions: [
        [121.461, 25.090],
        [121.467, 25.098],
        [121.471, 25.105],
        [121.474, 25.109],
        [121.476, 25.112],
        [121.478, 25.118],
        [121.481, 25.125],
        [121.485, 25.135]
      ]
    },
    riskZones: [
      {
        id: 'plan-a-risk-1',
        name: '桥位火力风险区',
        color: '#fb7185',
        positions: [
          [121.473, 25.110],
          [121.483, 25.110],
          [121.486, 25.118],
          [121.474, 25.118]
        ]
      }
    ],
    marks: [
      { id: 'plan-a-mark-1', name: '推荐桥位', longitude: 121.476, latitude: 25.112, color: '#63e6be' },
      { id: 'plan-a-mark-2', name: '观察哨位', longitude: 121.483, latitude: 25.108, color: '#ffd166' }
    ]
  },
  'plan-b': {
    route: {
      id: 'plan-b-route',
      name: '方案二主路线',
      color: '#5ea4ff',
      positions: [
        [121.455, 25.088],
        [121.460, 25.097],
        [121.464, 25.102],
        [121.468, 25.108],
        [121.472, 25.114],
        [121.476, 25.120],
        [121.481, 25.128],
        [121.488, 25.138]
      ]
    },
    riskZones: [
      {
        id: 'plan-b-risk-1',
        name: '备用通道暴露区',
        color: '#fb7185',
        positions: [
          [121.456, 25.098],
          [121.472, 25.098],
          [121.476, 25.110],
          [121.460, 25.110]
        ]
      },
      {
        id: 'plan-b-risk-2',
        name: '双线汇聚风险区',
        color: '#ff9f43',
        positions: [
          [121.478, 25.120],
          [121.494, 25.120],
          [121.498, 25.134],
          [121.482, 25.134]
        ]
      }
    ],
    marks: [
      { id: 'plan-b-mark-1', name: '备用浮渡点', longitude: 121.464, latitude: 25.102, color: '#8de1ff' },
      { id: 'plan-b-mark-2', name: '北岸引导点', longitude: 121.475, latitude: 25.122, color: '#63e6be' }
    ]
  },
  'plan-c': {
    route: {
      id: 'plan-c-route',
      name: '方案三路线',
      color: '#f7b267',
      positions: [
        [121.460, 25.092],
        [121.466, 25.100],
        [121.471, 25.107],
        [121.474, 25.112],
        [121.477, 25.118],
        [121.480, 25.124],
        [121.483, 25.130],
        [121.488, 25.140]
      ]
    },
    riskZones: [
      {
        id: 'plan-c-risk-1',
        name: '北岸接应迟滞区',
        color: '#fbbf24',
        positions: [
          [121.482, 25.128],
          [121.498, 25.128],
          [121.502, 25.142],
          [121.486, 25.142]
        ]
      }
    ],
    marks: [
      { id: 'plan-c-mark-1', name: '北岸接应区', longitude: 121.482, latitude: 25.125, color: '#2ee59d' },
      { id: 'plan-c-mark-2', name: '抢修保障点', longitude: 121.473, latitude: 25.112, color: '#ffcf5c' }
    ]
  }
} as const;

// ─────────────────── 渡河资源评估 Mock ───────────────────

/** 渡口评估数据 */
export const portAssessments: PortAssessment[] = [
  {
    id: 'port-a',
    name: 'A号渡口',
    type: '天然渡口',
    grade: '推荐',
    score: 92,
    passAbility: 95,
    concealment: 88,
    protection: 90,
    terrain: 85,
    logistics: 92,
    longitude: 121.465,
    latitude: 25.088
  },
  {
    id: 'port-b',
    name: 'B号渡口',
    type: '可建设渡口',
    grade: '推荐',
    score: 89,
    passAbility: 92,
    concealment: 85,
    protection: 88,
    terrain: 82,
    logistics: 90,
    longitude: 121.472,
    latitude: 25.10
  },
  {
    id: 'port-c',
    name: 'C号渡口',
    type: '天然渡口',
    grade: '较优',
    score: 81,
    passAbility: 86,
    concealment: 78,
    protection: 82,
    terrain: 75,
    logistics: 84,
    longitude: 121.478,
    latitude: 25.112
  },
  {
    id: 'port-d',
    name: 'D号渡口',
    type: '可建设渡口',
    grade: '较优',
    score: 78,
    passAbility: 82,
    concealment: 76,
    protection: 79,
    terrain: 72,
    logistics: 80,
    longitude: 121.485,
    latitude: 25.12
  },
  {
    id: 'port-e',
    name: 'E号渡口',
    type: '天然渡口',
    grade: '一般',
    score: 65,
    passAbility: 70,
    concealment: 62,
    protection: 66,
    terrain: 58,
    logistics: 68,
    longitude: 121.492,
    latitude: 25.125
  },
  {
    id: 'port-f',
    name: 'F号渡口',
    type: '不推荐渡口',
    grade: '不推荐',
    score: 42,
    passAbility: 48,
    concealment: 38,
    protection: 42,
    terrain: 35,
    logistics: 44,
    longitude: 121.50,
    latitude: 25.13
  }
];

/** 评估区域选项 */
export const regionOptions = [
  { label: '基础区域', value: '基础区域' },
  { label: '东部战区', value: '东部战区' },
  { label: '南部战区', value: '南部战区' }
];

/** 评估河段选项 */
export const riverSectionOptions = [
  { label: '淡水河(上游段)', value: '淡水河(上游段)' },
  { label: '淡水河(中游段)', value: '淡水河(中游段)' },
  { label: '淡水河(下游段)', value: '淡水河(下游段)' }
];

/** 任务能力需求选项 */
export const taskCapacityOptions = [
  { label: '快速渡河', value: '快速渡河' },
  { label: '大规模渡河', value: '大规模渡河' },
  { label: '隐蔽渡河', value: '隐蔽渡河' }
];

/** 评估条件默认值 */
export const defaultEvaluateForm: EvaluateForm = {
  region: '基础区域',
  riverSection: '淡水河(中游段)',
  evaluateTime: Date.now(),
  taskCapacity: '快速渡河',
  taskDays: 3,
  vehicleCount: 28,
  weights: {
    passAbility: 30,
    concealment: 20,
    protection: 20,
    terrain: 15,
    logistics: 15
  },
  resourceTypes: ['天然渡口', '可建设渡口', '工程装备', '舟桥器材']
};

/** 关键资源统计 */
export const resourceStatItems: ResourceStatItem[] = [
  { category: '工程装备', count: 23, unit: '件', icon: 'mdi:wrench-outline' },
  { category: '舟桥器材', count: 156, unit: '套', icon: 'mdi:bridge' },
  { category: '冲击舟', count: 48, unit: '艘', icon: 'mdi:sail-boat' },
  { category: '浮桁材', count: 1820, unit: '条', icon: 'mdi:align-horizontal-distribute' },
  { category: '浮游船', count: 6, unit: '艘', icon: 'mdi:ferry' },
  { category: '运输车辆', count: 192, unit: '辆', icon: 'mdi:truck-outline' }
];

// ─────────────────── 智能筛选 Mock ───────────────────

/** 筛选条件默认值 */
export const defaultFilterForm: FilterForm = {
  taskName: '淡水河渡河工程保障任务',
  taskType: '架设浮桥',
  expectedTime: '2026-06-01 08:00',
  duration: '4h',
  vehicleType: '轮式车辆',
  direction: '南岸→北岸',
  priority: '高',
  depthRadius: 30,
  velocityRange: 2.0,
  widthMin: 80,
  widthMax: 500,
  bankSlope: 2.5,
  bankGeomorphology: ['平坦', '缓坡'],
  availableResource: '浮桥器材',
  avoidFloodArea: true,
  otherRequirements: ''
};

/** 任务类型选项 */
export const filterTaskTypeOptions = [
  { label: '架设浮桥', value: '架设浮桥' },
  { label: '门桥渡河', value: '门桥渡河' },
  { label: '漕渡', value: '漕渡' },
  { label: '泅渡', value: '泅渡' }
];

/** 优先级选项 */
export const priorityOptions = [
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' }
];

/** 通行方向选项 */
export const directionOptions = [
  { label: '南岸→北岸', value: '南岸→北岸' },
  { label: '北岸→南岸', value: '北岸→南岸' },
  { label: '双向', value: '双向' }
];

/** 候选港口筛选结果 */
export const portFilterResults: PortFilterResult[] = [
  {
    id: 'fp-a',
    name: 'A号渡口',
    score: 92,
    depth: 3.2,
    width: 180,
    velocity: 1.2,
    feasibility: '可行',
    longitude: 121.465,
    latitude: 25.088
  },
  {
    id: 'fp-b',
    name: 'B号渡口',
    score: 87,
    depth: 4.5,
    width: 220,
    velocity: 1.5,
    feasibility: '较优',
    longitude: 121.472,
    latitude: 25.10
  },
  {
    id: 'fp-c',
    name: 'C号渡口',
    score: 78,
    depth: 2.8,
    width: 150,
    velocity: 1.8,
    feasibility: '较优',
    longitude: 121.478,
    latitude: 25.112
  },
  {
    id: 'fp-d',
    name: 'D号渡口',
    score: 72,
    depth: 5.1,
    width: 260,
    velocity: 0.9,
    feasibility: '一般',
    longitude: 121.485,
    latitude: 25.12
  },
  {
    id: 'fp-e',
    name: 'E号渡口',
    score: 58,
    depth: 6.3,
    width: 310,
    velocity: 2.1,
    feasibility: '一般',
    longitude: 121.492,
    latitude: 25.125
  },
  {
    id: 'fp-f',
    name: 'F号渡口',
    score: 35,
    depth: 8.2,
    width: 380,
    velocity: 2.8,
    feasibility: '不可行',
    longitude: 121.50,
    latitude: 25.13
  }
];

/** 推荐工程方案 Top3 */
export const engineeringPlans: EngineeringPlan[] = [
  {
    rank: 1,
    label: '方案一',
    isRecommended: true,
    portName: 'A号渡口',
    engineeringType: '浮桥架设',
    equipmentType: '重型浮桥',
    requiredTime: '4h',
    estimatedTime: '3.5h',
    equipmentList: '重型浮桥1套、舟桥器材32套、冲击舟8艘',
    supportAbility: '高',
    concealment: '中',
    score: 92
  },
  {
    rank: 2,
    label: '方案二',
    isRecommended: false,
    portName: 'B号渡口',
    engineeringType: '门桥渡河',
    equipmentType: '中型门桥',
    requiredTime: '5h',
    estimatedTime: '4.5h',
    equipmentList: '中型门桥2套、舟桥器材24套、冲击舟6艘',
    supportAbility: '中',
    concealment: '高',
    score: 87
  },
  {
    rank: 3,
    label: '方案三',
    isRecommended: false,
    portName: 'C号渡口',
    engineeringType: '混合渡河',
    equipmentType: '轻型浮桥',
    requiredTime: '6h',
    estimatedTime: '5.5h',
    equipmentList: '轻型浮桥1套、舟桥器材18套、冲击舟4艘',
    supportAbility: '中',
    concealment: '高',
    score: 78
  }
];

/** 智能筛选步骤 */
export const filterSteps = [
  { key: 'parse', label: '任务需求解析', status: 'success' as const },
  { key: 'collect', label: '多源数据收集', status: 'success' as const },
  { key: 'river', label: '河流信息分析', status: 'success' as const },
  { key: 'terrain', label: '地形地貌评估', status: 'success' as const },
  { key: 'port', label: '港口方案筛选', status: 'running' as const },
  { key: 'generate', label: '工程方案生成', status: 'waiting' as const }
];

// ─────────────────── 融合数据 Mock ───────────────────

export const defaultFusionData: FusionDataSummary = {
  waterInfo: {
    flowRate: '1,250 m³/s',
    avgVelocity: '1.5 m/s',
    bankWaterLevel: '3.2 m'
  },
  terrainInfo: {
    terrainType: '冲积平原',
    slopeRange: '2° ~ 8°',
    vegetationCoverage: '35%'
  },
  remoteSensing: {
    latestImage: '2026-05-28',
    resolution: '0.5m',
    intelligenceLevel: '高'
  },
  textIntel: {
    reportCount: 12,
    intelligenceLevel: '中'
  }
};

/** 工程装备资源分布详情 */
export const equipmentResourceDetails = [
  { name: '重型浮桥', count: 2, unit: '套', location: 'A号渡口', status: '可用' },
  { name: '中型浮桥', count: 3, unit: '套', location: 'B号渡口', status: '可用' },
  { name: '轻型浮桥', count: 5, unit: '套', location: 'C号渡口', status: '可用' },
  { name: '工兵作业车', count: 8, unit: '辆', location: '集结区', status: '待命' },
  { name: '架桥坦克', count: 3, unit: '辆', location: '集结区', status: '待命' },
  { name: '工程机械', count: 2, unit: '台', location: '后方', status: '维修中' }
];

/** 舟桥器材资源分布详情 */
export const pontoonResourceDetails = [
  { name: '79式舟桥', count: 48, unit: '套', location: 'A号渡口', status: '可用' },
  { name: '84式舟桥', count: 36, unit: '套', location: 'B号渡口', status: '可用' },
  { name: '特种舟桥', count: 24, unit: '套', location: 'C号渡口', status: '可用' },
  { name: '锚定门桥', count: 18, unit: '套', location: 'D号渡口', status: '部分可用' },
  { name: '闭塞门桥', count: 30, unit: '套', location: '集结区', status: '待命' }
];

// ─────────────────── 新版渡河保障方案 Mock ───────────────────

/** 设置表单默认值 */
export const defaultCrossingSettingForm: CrossingSettingForm = {
  taskName: '淡水河北岸快速渡河保障',
  location: '淡水河关渡段南岸至北岸',
  taskType: '渡河保障',
  actionTime: '2026-06-15 06:00',
  forceScale: '1个合成营',
  riverWidth: 400,
  waterDepthRange: '3~7m',
  flowVelocity: '1.0~2.0 m/s',
  riverbedTerrain: '泥沙质为主',
  weatherCondition: '晴 28°C 南风3级',
  visibilityKm: 15,
  strategicIntent: '无明确敌情',
  availableResources: ['登陆艇', '冲锋舟', '浮桥', '无人机'],
  timeConstraint: '3小时内完成渡河',
  otherRequirements: '人员装备安全优先'
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
  { label: '架桥坦克', value: '架桥坦克' }
];

/** AI 分析步骤模板 */
export const aiAnalysisStepTemplate: AiAnalysisStep[] = [
  { key: 'env', label: '环境与水文条件分析', status: 'waiting', description: '分析河宽、水深、流速、地形等环境参数' },
  { key: 'retrieve', label: '知识库检索与匹配', status: 'waiting', description: '', tool: '知识库检索' },
  { key: 'crossing', label: '渡场点选择与路线分析', status: 'waiting', description: '基于知识库匹配结果选择最优渡场' },
  { key: 'risk', label: '风险评估与综合分析', status: 'waiting', description: '评估水文风险、装备适配性、时间约束' },
  { key: 'recommend', label: '首选方案推荐', status: 'waiting', description: '综合评分推荐最优方案' }
];

/** 底部方案卡片数据 */
export const crossingPlanCards: CrossingPlanCard[] = [
  {
    rank: 1,
    label: '方案一',
    title: '两栖快速渡河方案',
    isRecommended: true,
    stars: 5,
    duration: '~2h46min',
    capacity: '1个营/h',
    safety: '优',
    scenario: '冲锋舟+浮桥混合编组，适合快速突渡',
    routeDesc: '从A方案出发点沿主渡河通道前进，经浮桥段抵达北岸集结区',
    keyEquipment: ['冲锋舟×8', '重型浮桥1套', '工兵作业车×4'],
    advantages: ['渡河速度最快，可在3小时内完成', '混合编组灵活性强', '适应多种水文条件'],
    risks: ['流速偏高时冲锋舟操控难度增大', '浮桥架设需要稳定水文窗口'],
    conditions: ['流速<3.5m/s', '能见度>5km', '风力<4级']
  },
  {
    rank: 2,
    label: '方案二',
    title: '浮桥分段渡河方案',
    isRecommended: false,
    stars: 4,
    duration: '~3h20min',
    capacity: '2个营/h',
    safety: '良',
    scenario: '重型浮桥分段架设，适合大规模装备渡河',
    routeDesc: '从B号渡口沿备用浮渡通道，分段架设浮桥过河',
    keyEquipment: ['重型浮桥2套', '舟桥器材32套', '架桥坦克×2'],
    advantages: ['通行能力最强，适合重装部队', '浮桥稳定性好', '可多段并行'],
    risks: ['架设时间较长', '对岸滩承载力要求高', '河道宽度大增加工程量'],
    conditions: ['河宽<1500m', '水深<12m', '岸滩坡度<8°']
  },
  {
    rank: 3,
    label: '方案三',
    title: '冲锋舟突击渡河方案',
    isRecommended: false,
    stars: 3,
    duration: '~1h50min',
    capacity: '0.5个营/h',
    safety: '中',
    scenario: '纯冲锋舟突击，适合轻装先遣队快速过河',
    routeDesc: '从C号渡口使用冲锋舟直渡，多点同时登陆',
    keyEquipment: ['冲锋舟×16', '无人机×4', '登陆艇×3'],
    advantages: ['部署最快，机动灵活', '对岸滩要求低', '隐蔽性好'],
    risks: ['单次运力有限', '重装备无法渡河', '高流速下安全风险大'],
    conditions: ['流速<2.5m/s', '人员轻装', '天气良好']
  }
];
