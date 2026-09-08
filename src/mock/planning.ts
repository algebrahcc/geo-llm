import type {
  PlanningAnalysisStep,
  PlanningLayerItem,
  PlanningMissionForm,
  PlanningOption,
  PlanningPreset,
  PlanningRouteKey,
  PlanningRouteResultCard,
  PlanningRouteScene,
  PlanningRouteSettingsForm,
  PlanningRouteSummary,
  PlanningTaskForm,
  RouteTrafficAnalysis
} from '@/views/planning/modules/types';
import { planningRouteACoords, planningRouteBCoords, planningRouteCCoords } from './planning-route-coords';

// ──── 图层 ────
export const planningDefaultLayers = [
  { key: 'imagery', label: '影像底图', icon: 'mdi:satellite-variant', description: '全球 0-8', visible: true },
  {
    key: 'selected-route',
    label: '当前路线',
    icon: 'mdi:route',
    description: '高亮显示当前选中的推荐路线',
    visible: true
  },
  {
    key: 'candidate-route',
    label: '备选路线',
    icon: 'mdi:routes',
    description: '展示其余候选路线用于对比',
    visible: true
  },
  {
    key: 'risk',
    label: '风险区',
    icon: 'mdi:shield-alert',
    description: '桥隧、坡度、威胁与拥堵风险区',
    visible: true
  },
  {
    key: 'obstacle',
    label: '障碍点',
    icon: 'mdi:map-marker-alert',
    description: '桥头拥堵、受限路段、观察点等关键障碍',
    visible: true
  },
  {
    key: 'markers',
    label: '起终点标记',
    icon: 'mdi:map-marker',
    description: '任务起点、终点与关键节点标记',
    visible: true
  },
  {
    key: 'waypoints',
    label: '途经点标记',
    icon: 'mdi:waypoints',
    description: '机动方案中的途经点位置标记',
    visible: true
  }
] as const satisfies readonly PlanningLayerItem[];

// ──── 机动方案专用选项 ────
export const planningVehicleTypeOptions = [
  { label: '轮式车辆', icon: 'mdi:car', value: 'wheeled' },
  { label: '履带车辆', icon: 'mdi:tractor', value: 'tracked' },
  { label: '混合编队', icon: 'mdi:car-multiple', value: 'mixed' }
] as const satisfies readonly PlanningOption[];

// ──── 路线规划默认表单 ────
export const planningDefaultTaskForm: PlanningTaskForm = {
  taskName: '台北北部部队投送机动规划',
  description: '合成营装备由南港装载地域向淡水沙崙卸载地域投送',
  startName: '南港装载地域',
  endName: '淡水沙崙卸载地域',
  startLongitude: 121.606,
  startLatitude: 25.054,
  endLongitude: 121.433,
  endLatitude: 25.175,
  routePreference: 'fastest',
  constraints: ['avoid-threat', 'prefer-main-road'],
  waypoints: []
};

// ──── 机动方案默认表单 ────
export const planningDefaultMissionForm: PlanningMissionForm = {
  startName: '北京某基地',
  startLongitude: 116.4074,
  startLatitude: 39.9042,
  endName: '厦门某区域',
  endLongitude: 118.0894,
  endLatitude: 24.4798,
  waypoints: [
    { id: 'wp-1', name: '武汉', longitude: 114.3054, latitude: 30.5931, order: 1 },
    { id: 'wp-2', name: '长沙', longitude: 112.9388, latitude: 28.2282, order: 2 },
    { id: 'wp-3', name: '赣州', longitude: 114.9359, latitude: 25.8307, order: 3 }
  ],
  priorityCondition: 'time',
  roadTypePreferences: ['highway', 'national', 'provincial', 'rural'],
  terrainPreference: 'flat',
  avoidanceConditions: ['congestion', 'construction', 'high-risk'],
  vehicleType: 'wheeled',
  vehicleCount: 50,
  formationType: 'squad'
};

// ──── 视角预设：台北市北部（覆盖南港—淡水全程，约 27~35km） ────
export const planningPresets = {
  task: {
    longitude: 121.505,
    latitude: 25.118,
    height: 55000
  }
} as const satisfies Record<'task', PlanningPreset>;

// ──── 路线摘要（路线规划模式） ────
// 指标数据来自 OSRM 真实路网计算；途经道路为台北市真实道路
export const planningRouteSummaries = {
  'route-a': {
    key: 'route-a',
    label: '路线一',
    title: '快速通达路线',
    subtitle: '时效最优·27.4 km',
    summary:
      '沿洲美快速通道北上：南港装载地域→成功路/成美桥→堤顶大道→剑南路→洲美快速道路→大度路→台2乙→淡水沙崙卸载地域，全程约27.4km。',
    metrics: [
      { label: '行程时间', value: '33 分钟', tone: 'primary' },
      { label: '总里程', value: '27.4 km', tone: 'success' },
      { label: '风险等级', value: '中高', tone: 'warning' },
      { label: '通行评分', value: '86', tone: 'primary' }
    ],
    highlights: ['OSRM最快路径·27.4km', '洲美快速道路市域快道，通行时效最优', '适合抢时任务快速机动'],
    risks: [
      { title: '南港路段多灯控', detail: '起点城区信号灯密集，编队出装载地域需梯次放行。' },
      { title: '洲美快速高峰拥堵', detail: '07:00–09:00 通勤瓶颈，车队需分批通过。' }
    ]
  },
  'route-b': {
    key: 'route-b',
    label: '路线二',
    title: '均衡通行路线',
    subtitle: '均衡·31.8 km',
    summary:
      '绕行市区主干道：南港装载地域→基隆路→民权东路一带→承德路→大度路→台2乙→淡水沙崙卸载地域，绕开剑南路隧道，节奏更稳。',
    metrics: [
      { label: '行程时间', value: '47 分钟', tone: 'warning' },
      { label: '总里程', value: '31.8 km', tone: 'warning' },
      { label: '风险等级', value: '中', tone: 'success' },
      { label: '通行评分', value: '82', tone: 'primary' }
    ],
    highlights: ['绕开剑南路隧道限行，避开最拥堵段', '适合常规投送与保障编组', '经市区主干道，路况均衡'],
    risks: [
      { title: '城区交叉口多', detail: '基隆路、民权东路一线交叉口密集，需分段通行。' },
      { title: '地方车流汇入', detail: '承德路段岔口多，编队保持车距梯次推进。' }
    ]
  },
  'route-c': {
    key: 'route-c',
    label: '路线三',
    title: '低风险绕行路线',
    subtitle: '低风险·35.3 km',
    summary:
      '外围绕行：南港装载地域→研究院路→内湖堤顶→大直→北投外围→大度路→台2乙→淡水沙崙卸载地域，绕开市区高流量段与隧道。',
    metrics: [
      { label: '行程时间', value: '60 分钟', tone: 'warning' },
      { label: '总里程', value: '35.3 km', tone: 'warning' },
      { label: '风险等级', value: '低', tone: 'success' },
      { label: '通行评分', value: '79', tone: 'primary' }
    ],
    highlights: ['全程外围绕行，暴露风险最低', '适合重装车辆与大编组稳妥推进', '作为第一、二线受阻时的低风险备选'],
    risks: [
      { title: '耗时长', detail: '绕行较远，不利于抢时任务。' },
      { title: '补给跨度', detail: '路线最长，对油料与中途保障要求更高。' }
    ]
  }
} as const satisfies Record<PlanningRouteKey, PlanningRouteSummary>;

// ──── 各路线交通状况分析（模拟路况感知数据，分段描述 + 延误估算 + 机动建议） ────
// 分段名称对应台北市真实道路（南港路/成功路/堤顶大道/洲美快速道路/大度路/台2乙等）
export const planningRouteTraffic: Record<PlanningRouteKey, RouteTrafficAnalysis> = {
  'route-a': {
    level: '缓行',
    avgSpeed: '46 km/h',
    delayMin: 8,
    segments: [
      {
        name: '南港路段（兴中路/南港路）',
        level: '缓行',
        note: '装载地域周边信号灯控密集，早高峰车流集中，均速约 28 km/h'
      },
      { name: '成功路—堤顶大道段', level: '畅通', note: '堤外道路车流稀疏，可保持 60 km/h 以上' },
      { name: '洲美快速段', level: '拥堵', note: '通勤瓶颈，高峰期排队约 1.2 km，通行缓慢' }
    ],
    impacts: [
      '洲美快速拥堵段预计延误 8 分钟，若 07:00–09:00 通行建议按上限预留时间',
      '瓶颈段车流密集，大编组通过时宜分批放行，避免队列暴露'
    ]
  },
  'route-b': {
    level: '基本畅通',
    avgSpeed: '40 km/h',
    delayMin: 5,
    segments: [
      { name: '基隆路段（城区）', level: '基本畅通', note: '车流平稳，个别路口需等 1–2 个信号周期' },
      { name: '民权东路—承德路段', level: '畅通', note: '绕开剑南路隧道与主城拥堵核心，路况良好' },
      { name: '大度路段', level: '基本畅通', note: '局部路宽收窄，重车交会需减速' }
    ],
    impacts: [
      '全线无严重拥堵点，预计延误约 5 分钟，多为信号等待',
      '承德路段岔口较多，注意地方车流汇入，建议保持车距梯次通行'
    ]
  },
  'route-c': {
    level: '畅通',
    avgSpeed: '35 km/h',
    delayMin: 0,
    segments: [
      { name: '研究院路—堤顶大道段', level: '畅通', note: '远离主城交通压力区，路面空闲' },
      { name: '大直—北投外围段', level: '畅通', note: '车流稀少，沿线无信号瓶颈' },
      { name: '台2乙淡金公路段', level: '基本畅通', note: '局部路窄限速 40 km/h，临河弯道较多' }
    ],
    impacts: [
      '全线畅通无延误，但绕行里程长，按低匀速机动对油料消耗约高 15%',
      '外围路段夜间照明差，夜间机动需加强灯火管制与警戒'
    ]
  }
};

// ──── 路线场景数据（路线规划模式） ────
// 所有路线 waypoints 来自 OSRM 真实道路网络引擎
export const planningRouteScenes = {
  'route-a': {
    route: {
      id: 'planning-route-a',
      name: '快速通达路线',
      color: '#63e6be',
      positions: planningRouteACoords
    },
    risks: [
      {
        id: 'planning-risk-a-1',
        name: '洲美快速高流量区',
        color: '#fb7185',
        positions: [
          [121.476, 25.119],
          [121.492, 25.119],
          [121.494, 25.138],
          [121.478, 25.138]
        ] as readonly [number, number][]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-a-1', name: '红灯密集路口', longitude: 121.595, latitude: 25.053, color: '#ffd166' },
      { id: 'planning-obstacle-a-2', name: '洲美快速路瓶颈', longitude: 121.484, latitude: 25.129, color: '#fb7185' }
    ]
  },
  'route-b': {
    route: {
      id: 'planning-route-b',
      name: '均衡通行路线',
      color: '#5ea4ff',
      positions: planningRouteBCoords
    },
    risks: [
      {
        id: 'planning-risk-b-1',
        name: '增辟走廊收窄区',
        color: '#ff9f43',
        positions: [
          [121.565, 25.098],
          [121.582, 25.098],
          [121.584, 25.112],
          [121.567, 25.112]
        ] as readonly [number, number][]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-b-1', name: '剑南路段限速', longitude: 121.559, latitude: 25.101, color: '#ffcf5c' },
      { id: 'planning-obstacle-b-2', name: '中正路交叉口', longitude: 121.442, latitude: 25.171, color: '#8de1ff' }
    ]
  },
  'route-c': {
    route: {
      id: 'planning-route-c',
      name: '低风险绕行路线',
      color: '#f7b267',
      positions: planningRouteCCoords
    },
    risks: [
      {
        id: 'planning-risk-c-1',
        name: '长途补给薄弱区',
        color: '#fbbf24',
        positions: [
          [121.528, 25.096],
          [121.548, 25.096],
          [121.55, 25.115],
          [121.53, 25.115]
        ] as readonly [number, number][]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-c-1', name: '大安段绕行提示', longitude: 121.546, latitude: 25.089, color: '#2ee59d' },
      { id: 'planning-obstacle-c-2', name: '新增绕行检查点', longitude: 121.466, latitude: 25.142, color: '#ffd166' }
    ]
  }
} as const satisfies Record<PlanningRouteKey, PlanningRouteScene>;

// ──── 机动方案 - 分析步骤 ────
export const planningAnalysisSteps: readonly PlanningAnalysisStep[] = [
  { id: 'step-0', label: '知识库检索', icon: 'mdi:book-search-outline', status: 'pending' },
  { id: 'step-1', label: '路网数据加载', icon: 'mdi:database-check-outline', status: 'pending' },
  { id: 'step-2', label: '路线可行性分析', icon: 'mdi:map-check-outline', status: 'pending' },
  { id: 'step-3', label: '路况与障碍分析', icon: 'mdi:road-variant', status: 'pending' },
  { id: 'step-4', label: '风险评估分析', icon: 'mdi:shield-check-outline', status: 'pending' },
  { id: 'step-5', label: '方案生成与优化', icon: 'mdi:file-cog-outline', status: 'pending' },
  { id: 'step-6', label: '结果输出', icon: 'mdi:export-variant', status: 'pending' }
];

// ──── 机动规划 - 推进区域选项 ────
// ──── 机动规划 AI 助手 - 分析步骤 ────
// 首位为知识库检索，体现知识库联动
export const planningRouteAnalysisSteps: readonly PlanningAnalysisStep[] = [
  { id: 'route-step-0', label: '知识库检索', icon: 'mdi:book-search-outline', status: 'pending' },
  { id: 'route-step-1', label: '路网数据解析', icon: 'mdi:database-check-outline', status: 'pending' },
  { id: 'route-step-2', label: '障碍识别分析', icon: 'mdi:shield-alert-outline', status: 'pending' },
  { id: 'route-step-3', label: '交通状况评估', icon: 'mdi:traffic-light', status: 'pending' },
  { id: 'route-step-4', label: '多路径规划', icon: 'mdi:source-branch', status: 'pending' },
  { id: 'route-step-5', label: '路线风险评估', icon: 'mdi:shield-check-outline', status: 'pending' },
  { id: 'route-step-6', label: '方案优化排序', icon: 'mdi:sort-ascending', status: 'pending' },
  { id: 'route-step-7', label: '结果输出', icon: 'mdi:export-variant', status: 'pending' }
];

// ──── 机动规划结果卡片（默认静态数据，供结果面板兜底展示） ────
export const planningRouteResultCards: readonly PlanningRouteResultCard[] = [
  {
    key: 'route-card-route-a',
    title: '推荐方案',
    subtitle: planningRouteSummaries['route-a'].subtitle,
    tag: '推荐',
    tagType: 'success',
    isRecommended: true,
    score: Number(planningRouteSummaries['route-a'].metrics.find(m => m.label === '通行评分')?.value ?? 85),
    duration: planningRouteSummaries['route-a'].metrics.find(m => m.label === '行程时间')?.value ?? '--',
    distance: planningRouteSummaries['route-a'].metrics.find(m => m.label === '总里程')?.value ?? '--',
    highlights: [...planningRouteSummaries['route-a'].highlights],
    mainPath: planningRouteSummaries['route-a'].title,
    traffic: planningRouteTraffic['route-a']
  },
  {
    key: 'route-card-route-b',
    title: '最快方案',
    subtitle: planningRouteSummaries['route-b'].subtitle,
    tag: '最快',
    tagType: 'info',
    isRecommended: false,
    score: Number(planningRouteSummaries['route-b'].metrics.find(m => m.label === '通行评分')?.value ?? 78),
    duration: planningRouteSummaries['route-b'].metrics.find(m => m.label === '行程时间')?.value ?? '--',
    distance: planningRouteSummaries['route-b'].metrics.find(m => m.label === '总里程')?.value ?? '--',
    highlights: [...planningRouteSummaries['route-b'].highlights],
    mainPath: planningRouteSummaries['route-b'].title,
    traffic: planningRouteTraffic['route-b']
  },
  {
    key: 'route-card-route-c',
    title: '最稳方案',
    subtitle: planningRouteSummaries['route-c'].subtitle,
    tag: '最稳',
    tagType: 'warning',
    isRecommended: false,
    score: Number(planningRouteSummaries['route-c'].metrics.find(m => m.label === '通行评分')?.value ?? 72),
    duration: planningRouteSummaries['route-c'].metrics.find(m => m.label === '行程时间')?.value ?? '--',
    distance: planningRouteSummaries['route-c'].metrics.find(m => m.label === '总里程')?.value ?? '--',
    highlights: [...planningRouteSummaries['route-c'].highlights],
    mainPath: planningRouteSummaries['route-c'].title,
    traffic: planningRouteTraffic['route-c']
  }
];

// ──── 机动规划 - 推进优先级选项 ────
export const planningAdvancePriorityOptions = [
  { label: '时间优先', value: 'time' },
  { label: '距离优先', value: 'distance' },
  { label: '安全优先', value: 'safety' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 道路等级选项 ────
export const planningRoadGradeOptions = [
  { label: '不限', value: 'any' },
  { label: '高速/国道优先', value: 'highway-national' },
  { label: '省道及以上', value: 'provincial-above' },
  { label: '仅高速', value: 'highway-only' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 难度等级选项 ────
export const planningDifficultyOptions = [
  { label: '高速', value: 'highway' },
  { label: '国道', value: 'national' },
  { label: '省道', value: 'provincial' },
  { label: '乡道', value: 'rural' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 任务类型选项 ────
export const planningTaskTypeOptions = [
  { label: '部队投送', value: 'troop-projection' },
  { label: '紧急支援', value: 'emergency' },
  { label: '常规机动', value: 'regular' },
  { label: '物资投送', value: 'supply' },
  { label: '侦察巡逻', value: 'recon' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 车队规模选项 ────
export const planningFleetScaleOptions = [
  { label: '小队（5辆以内）', value: 'small' },
  { label: '中队（5-20辆）', value: 'medium' },
  { label: '大队（20-50辆）', value: 'large' },
  { label: '加强大队（50辆以上）', value: 'extra-large' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 车型类型选项 ────
export const planningVehicleModelOptions = [
  { label: '轮式装甲车', value: 'wheeled-apc' },
  { label: '履带装甲车', value: 'tracked-apc' },
  { label: '卡车运输车', value: 'truck' },
  { label: '混合编队', value: 'mixed' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 到达时限选项 ────
export const planningArrivalDeadlineOptions = [
  { label: '2小时内', value: '2h' },
  { label: '4小时内', value: '4h' },
  { label: '8小时内', value: '8h' },
  { label: '24小时内', value: '24h' },
  { label: '无限制', value: 'none' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划 - 路线偏好选项 ────
export const planningRoutePrefOptions = [
  { label: '时间最优', value: 'time' },
  { label: '空间最优', value: 'space' },
  { label: '距离最短', value: 'distance' },
  { label: '风险最低', value: 'risk' }
] as const satisfies readonly PlanningOption[];

// ──── 机动保障 - 任务起因选项 ────
export const planningMissionCauseOptions = [
  { label: '战备拉动', value: 'combat-ready' },
  { label: '演习任务', value: 'exercise' },
  { label: '应急响应', value: 'emergency' },
  { label: '日常保障', value: 'routine' }
] as const satisfies readonly PlanningOption[];

// ──── 机动保障 - 油料类型选项 ────
export const planningFuelTypeOptions = [
  { label: '柴油', value: 'diesel' },
  { label: '汽油', value: 'gasoline' },
  { label: '混合', value: 'mixed' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划默认表单 ────
export const planningDefaultRouteSettingsForm: PlanningRouteSettingsForm = {
  taskName: '台北北部部队投送机动规划',
  startName: '南港装载地域',
  startLongitude: 121.606,
  startLatitude: 25.054,
  endName: '淡水沙崙卸载地域',
  endLongitude: 121.433,
  endLatitude: 25.175,
  waypoints: [],
  routePreference: 'time',
  forceScale: 'medium',
  advanceArea: 'multiple',
  roadGrades: ['highway', 'national'],
  vehicleFormation: 'mixed',
  waypointName: '',
  timeWeight: 30,
  distanceWeight: 30,
  riskWeight: 40,
  advanceAreas: ['construction', 'flood'],
  advancePriority: 'time',
  roadGrade: 'highway-national',
  difficultyLevels: ['highway', 'national'],
  taskType: 'troop-projection',
  fleetScale: 'medium',
  vehicleModel: 'wheeled-apc',
  arrivalDeadline: '4h'
};

// ──── 机动规划 AI 助手 - 快捷操作标签 ────
export const planningRouteQuickTags = [
  { label: '路网', icon: 'mdi:road-variant' },
  { label: '障碍', icon: 'mdi:shield-alert-outline' },
  { label: '交通', icon: 'mdi:traffic-light' },
  { label: '多路径', icon: 'mdi:source-branch' },
  { label: '路线', icon: 'mdi:routes' },
  { label: '风险评估', icon: 'mdi:shield-check-outline' }
];

// ──── 机动规划 AI 助手 - 快捷操作标签 ────
