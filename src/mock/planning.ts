import type {
  PlanningAnalysisStep,
  PlanningLayerItem,
  PlanningMissionForm,
  PlanningMissionResultSummary,
  PlanningOption,
  PlanningPlanMetric,
  PlanningPlanResult,
  PlanningPreset,
  PlanningRouteKey,
  PlanningRouteResultCard,
  PlanningRouteScene,
  PlanningRouteSegment,
  PlanningRouteSettingsForm,
  PlanningRouteSummary,
  PlanningSupportResultCard,
  PlanningSupportSettingsForm,
  PlanningTaskForm,
  PlanningToolbarItem
} from '@/views/planning/modules/types';
import {
  planningRouteACoords,
  planningRouteBCoords,
  planningRouteCCoords
} from './planning-route-coords';

// ──── 工具栏 ────
export const planningLeftTools = [
  { key: 'task', label: '任务', icon: 'mdi:file-document-edit-outline' },
  { key: 'pick-start', label: '起点', icon: 'mdi:map-marker-radius-outline' },
  { key: 'pick-end', label: '终点', icon: 'mdi:map-marker-check-outline' },
  { key: 'clear', label: '清空', icon: 'mdi:delete-sweep-outline' }
] as const satisfies readonly PlanningToolbarItem[];

export const planningRightTools = [
  { key: 'layers', label: '图层', icon: 'mdi:layers-outline' },
  { key: 'result', label: '结果', icon: 'mdi:routes' },
  { key: 'reset', label: '复位', icon: 'mdi:home-outline' },
  { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
  { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' },
  { key: 'shot', label: '截图', icon: 'mdi:camera-outline' }
] as const satisfies readonly PlanningToolbarItem[];

// ──── 图层 ────
export const planningDefaultLayers = [
  { key: 'imagery', label: '影像底图', description: '全球 0-8', visible: true },
  { key: 'selected-route', label: '当前路线', description: '高亮显示当前选中的推荐路线', visible: true },
  { key: 'candidate-route', label: '备选路线', description: '展示其余候选路线用于对比', visible: true },
  { key: 'risk', label: '风险区', description: '桥隧、坡度、威胁与拥堵风险区', visible: true },
  { key: 'obstacle', label: '障碍点', description: '桥头拥堵、受限路段、观察点等关键障碍', visible: true },
  { key: 'markers', label: '起终点标记', description: '任务起点、终点与关键节点标记', visible: true },
  { key: 'waypoints', label: '途经点标记', description: '机动方案中的途经点位置标记', visible: true }
] as const satisfies readonly PlanningLayerItem[];

// ──── 路线偏好选项 ────
export const planningPreferenceOptions = [
  { label: '最快到达', value: 'fastest' },
  { label: '距离最短', value: 'shortest' },
  { label: '风险最低', value: 'safest' }
] as const satisfies readonly PlanningOption[];

export const planningConstraintOptions = [
  { label: '避开威胁区', value: 'avoid-threat' },
  { label: '避开桥梁瓶颈', value: 'avoid-bridge' },
  { label: '控制坡度', value: 'slope-limit' },
  { label: '优先主干道', value: 'prefer-main-road' }
] as const satisfies readonly PlanningOption[];

// ──── 机动方案专用选项 ────
export const planningPriorityOptions = [
  { label: '用时最短', value: 'time' },
  { label: '距离最短', value: 'distance' },
  { label: '风险最低', value: 'risk' }
] as const satisfies readonly PlanningOption[];

export const planningRoadTypeOptions = [
  { label: '高速公路', value: 'highway' },
  { label: '国道', value: 'national' },
  { label: '省道', value: 'provincial' },
  { label: '乡道', value: 'rural' }
] as const satisfies readonly PlanningOption[];

export const planningTerrainOptions = [
  { label: '平原/丘陵优先', value: 'flat' },
  { label: '山区优先', value: 'mountain' },
  { label: '无偏好', value: 'none' }
] as const satisfies readonly PlanningOption[];

export const planningAvoidanceOptions = [
  { label: '避开拥堵路段', value: 'congestion' },
  { label: '避开施工路段', value: 'construction' },
  { label: '远离高风险区域', value: 'high-risk' }
] as const satisfies readonly PlanningOption[];

export const planningVehicleTypeOptions = [
  { label: '轮式车辆', value: 'wheeled' },
  { label: '履带车辆', value: 'tracked' },
  { label: '混合编队', value: 'mixed' }
] as const satisfies readonly PlanningOption[];

export const planningFormationOptions = [
  { label: '分队编组', value: 'squad' },
  { label: '单车行进', value: 'single' },
  { label: '纵队编组', value: 'column' }
] as const satisfies readonly PlanningOption[];

// ──── 路线规划默认表单 ────
export const planningDefaultTaskForm: PlanningTaskForm = {
  taskName: '台北城区机动支援路线规划',
  startName: '南港综合保障点',
  endName: '淡水北岸接应区',
  startLongitude: 121.606,
  startLatitude: 25.054,
  endLongitude: 121.433,
  endLatitude: 25.175,
  routePreference: 'fastest',
  constraints: ['avoid-threat', 'prefer-main-road']
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

// ──── 视角预设 ────
export const planningPresets = {
  task: {
    longitude: 114.0,
    latitude: 30.0,
    height: 4500000
  }
} as const satisfies Record<'task', PlanningPreset>;

// ──── 路线选项（路线规划模式） ────
export const planningRouteOptions = [
  { key: 'route-a', label: '路线一', subtitle: '快速通达' },
  { key: 'route-b', label: '路线二', subtitle: '均衡保障' },
  { key: 'route-c', label: '路线三', subtitle: '低风险机动' }
] as const;

// ──── 路线摘要（路线规划模式） ────
// 指标数据来自 OSRM 真实路网计算
export const planningRouteSummaries = {
  'route-a': {
    key: 'route-a',
    label: '路线一',
    title: '快速通达路线',
    subtitle: '时效最优·27.4 km',
    summary: '沿城区快速通道北上，整体速度最快。途经南港路→基隆路→国道→洲美快速→淡水，全程约27.4km。',
    metrics: [
      { label: '行程时间', value: '33 分钟', tone: 'primary' },
      { label: '总里程', value: '27.4 km', tone: 'success' },
      { label: '风险等级', value: '中高', tone: 'warning' },
      { label: '通行评分', value: '86', tone: 'primary' }
    ],
    highlights: ['OSRM最快路径·27.4km', '沿城市高快速路通行时效最优', '适合抢时任务快速机动'],
    risks: [
      { title: '城区多灯控路口', detail: '南港路段交通信号密集，增加延误风险。' },
      { title: '洲美快速路段', detail: '交通瓶颈，高峰时段速度骤降。' }
    ]
  },
  'route-b': {
    key: 'route-b',
    label: '路线二',
    title: '均衡通行路线',
    subtitle: '均衡·31.8 km',
    summary: '绕行南侧增辟走廊，经基隆路→大街→剑南路→中正路至淡水，里程稍长，但绕开部分拥堵点，整体节奏更稳。',
    metrics: [
      { label: '行程时间', value: '47 分钟', tone: 'warning' },
      { label: '总里程', value: '31.8 km', tone: 'warning' },
      { label: '风险等级', value: '中', tone: 'success' },
      { label: '通行评分', value: '82', tone: 'primary' }
    ],
    highlights: ['绕行增辟走廊，避开最拥堵段', '适合常规保障与补给投送', '途经剑南路辅路，道路条件均衡'],
    risks: [
      { title: '次级路段', detail: '增辟段局部路宽不足，大编组速度受限。' },
      { title: '交叉口多', detail: '途经城区交叉口较多，需分段通行。' }
    ]
  },
  'route-c': {
    key: 'route-c',
    label: '路线三',
    title: '低风险绕行路线',
    subtitle: '低风险·35.3 km',
    summary: '大幅绕行东侧与南侧经过多个经要道路，整体绕行明显，能避开大多数威胁区域和交通压力点，适合大编组稳妥推进。',
    metrics: [
      { label: '行程时间', value: '60 分钟', tone: 'warning' },
      { label: '总里程', value: '35.3 km', tone: 'warning' },
      { label: '风险等级', value: '低', tone: 'success' },
      { label: '通行评分', value: '79', tone: 'primary' }
    ],
    highlights: [
      '全程迂回绕行，暴露风险最低',
      '适合重装车辆与大编组稳妥推进',
      '作为第一、二线受阻时的低风险备选'
    ],
    risks: [
      { title: '耗时长', detail: '整体绕行较远，不利于抢时任务。' },
      { title: '补给跨度', detail: '路线最长，对油料与中途保障要求更高。' }
    ]
  }
} as const satisfies Record<PlanningRouteKey, PlanningRouteSummary>;

// ──── 路线场景数据（路线规划模式） ────
// 所有路线 waypoints 来自 OSRM 真实道路网络引擎
export const planningRouteScenes = {
  'route-a': {
    route: {
      id: 'planning-route-a',
      name: '快速通达路线',
      color: '#63e6be',
      positions: planningRouteACoords as unknown as readonly [number, number][]
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
        ] as unknown as readonly [number, number][]
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
      positions: planningRouteBCoords as unknown as readonly [number, number][]
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
        ] as unknown as readonly [number, number][]
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
      positions: planningRouteCCoords as unknown as readonly [number, number][]
    },
    risks: [
      {
        id: 'planning-risk-c-1',
        name: '长途补给薄弱区',
        color: '#fbbf24',
        positions: [
          [121.528, 25.096],
          [121.548, 25.096],
          [121.550, 25.115],
          [121.530, 25.115]
        ] as unknown as readonly [number, number][]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-c-1', name: '大安段绕行提示', longitude: 121.546, latitude: 25.089, color: '#2ee59d' },
      { id: 'planning-obstacle-c-2', name: '新增绕行检查点', longitude: 121.466, latitude: 25.142, color: '#ffd166' }
    ]
  }
} as const satisfies Record<PlanningRouteKey, PlanningRouteScene>;

// ──── 机动方案 - 3个推荐方案 ────
export const planningPlanResults: readonly PlanningPlanResult[] = [
  {
    key: 'plan-a',
    label: '方案一',
    tag: '用时最短',
    tagType: 'success',
    score: 92.3,
    metrics: [
      { label: '总里程', value: '1,758', unit: 'km' },
      { label: '预计耗时', value: '18时42分', unit: '' },
      { label: '平均速度', value: '94', unit: 'km/h' },
      { label: '油耗估算', value: '2,850', unit: 'L' }
    ],
    routeDescription: '北京某基地 → 武汉 → 长沙 → 赣州 → 厦门某区域',
    mainRoads: '京港澳高速 → 沪昆高速 → 厦蓉高速 → 鹏光高速',
    isRecommended: true
  },
  {
    key: 'plan-b',
    label: '方案二',
    tag: '距离最短',
    tagType: 'info',
    score: 88.1,
    metrics: [
      { label: '总里程', value: '1,612', unit: 'km' },
      { label: '预计耗时', value: '20时35分', unit: '' },
      { label: '平均速度', value: '78', unit: 'km/h' },
      { label: '油耗估算', value: '2,610', unit: 'L' }
    ],
    routeDescription: '北京某基地 → 合肥 → 南昌 → 赣州 → 厦门某区域',
    mainRoads: '京台高速 → 沪昆高速 → 吕赣高速 → 鹏光高速',
    isRecommended: false
  },
  {
    key: 'plan-c',
    label: '方案三',
    tag: '风险最低',
    tagType: 'warning',
    score: 85.7,
    metrics: [
      { label: '总里程', value: '1,892', unit: 'km' },
      { label: '预计耗时', value: '21时18分', unit: '' },
      { label: '平均速度', value: '89', unit: 'km/h' },
      { label: '油耗估算', value: '2,920', unit: 'L' }
    ],
    routeDescription: '北京某基地 → 郑州 → 武汉 → 长沙 → 厦门某区域',
    mainRoads: '京港澳高速 → 沪渝高速 → 长张高速 → 厦蓉高速',
    isRecommended: false
  }
];

// ──── 机动方案 - 方案结果汇总 ────
export const planningMissionResultSummary: PlanningMissionResultSummary = {
  totalPlans: 3,
  bestPlan: '方案一',
  bestScore: 92.3
};

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

// ──── 机动方案 - 方案一详细路段 ────
export const planningPlanADetailSegments: readonly PlanningRouteSegment[] = [
  {
    id: 'seg-1',
    index: 1,
    section: '京港澳高速（北京段）',
    roadName: '京港澳高速',
    distance: 278,
    duration: '02:45',
    roadCondition: '畅通'
  },
  {
    id: 'seg-2',
    index: 2,
    section: '京港澳高速（湖北段）',
    roadName: '京港澳高速',
    distance: 342,
    duration: '03:18',
    roadCondition: '畅通'
  },
  {
    id: 'seg-3',
    index: 3,
    section: '京港澳高速（湖南段）',
    roadName: '京港澳高速',
    distance: 510,
    duration: '05:32',
    roadCondition: '畅通'
  },
  {
    id: 'seg-4',
    index: 4,
    section: '沪昆高速（江西段）',
    roadName: '沪昆高速',
    distance: 286,
    duration: '03:35',
    roadCondition: '缓行'
  },
  {
    id: 'seg-5',
    index: 5,
    section: '厦蓉高速（江西段）',
    roadName: '厦蓉高速',
    distance: 244,
    duration: '02:48',
    roadCondition: '畅通'
  },
  {
    id: 'seg-6',
    index: 6,
    section: '鹏光高速（赣州-厦门）',
    roadName: '鹏光高速',
    distance: 98,
    duration: '01:04',
    roadCondition: '畅通'
  }
];

export const planningPlanATotalDistance = 1758;
export const planningPlanATotalDuration = '18:42';

// ──── 机动规划 - 推进区域选项 ────
export const planningAdvanceAreaOptions = [
  { label: '施工区', value: 'construction' },
  { label: '洪涝区', value: 'flood' },
  { label: '地质灾害区', value: 'geological' },
  { label: '管制区域', value: 'restricted' },
  { label: '其他区域', value: 'other' }
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

// ──── 机动保障 - 约束条件选项 ────
export const planningSupportConstraintOptions = [
  { label: '必须避开城区', value: 'avoid-urban' },
  { label: '必须经过补给站', value: 'via-supply' },
  { label: '夜间隐蔽机动', value: 'night-stealth' },
  { label: '全程通信覆盖', value: 'comms-coverage' },
  { label: '规避桥梁隧道', value: 'avoid-bridge-tunnel' }
] as const satisfies readonly PlanningOption[];

// ──── 机动规划默认表单 ────
export const planningDefaultRouteSettingsForm: PlanningRouteSettingsForm = {
  startName: '南港综合保障点',
  startLongitude: 121.606,
  startLatitude: 25.054,
  waypointName: '',
  endName: '淡水北岸接应区',
  endLongitude: 121.433,
  endLatitude: 25.175,
  routePreference: 'time',
  timeWeight: 30,
  distanceWeight: 30,
  riskWeight: 40,
  advanceAreas: ['construction', 'flood'],
  roadGrade: 'highway-national',
  difficultyLevels: ['highway', 'national'],
  taskType: 'emergency',
  fleetScale: 'medium',
  vehicleModel: 'wheeled-apc',
  arrivalDeadline: '4h'
};

export const planningDefaultSupportSettingsForm: PlanningSupportSettingsForm = {
  missionName: '台北城区机动保障支援',
  missionCause: 'combat-ready',
  missionDesc: '为前线部队提供油料与维修保障支援',
  personnelCount: 120,
  vehicleCount: 25,
  deadline: '24h',
  vehicleType: 'wheeled',
  avgFuelConsumption: 35,
  fuelType: 'diesel',
  fuelAmount: 5000,
  supportLevel: 80,
  needRepair: true,
  needRushRepair: false,
  otherNeeds: '',
  departTime: '06:00',
  arriveTime: '18:00',
  durationLimit: '12h',
  constraints: ['via-supply', 'comms-coverage']
};

// ──── 机动规划方案卡片数据 ────
export const planningRouteResultCards: readonly PlanningRouteResultCard[] = [
  {
    key: 'route-card-a',
    title: '方案一',
    subtitle: '风险最低路线',
    tag: '推荐',
    tagType: 'success',
    score: 92.5,
    duration: '34 分钟',
    distance: '27.8 km',
    highlights: ['全程暴露风险最低', '适合大编组稳妥推进', '可规避主要威胁区域'],
    mainPath: '南港保障点 → 城区快速路 → 淡水北岸',
    isRecommended: true
  },
  {
    key: 'route-card-b',
    title: '方案二',
    subtitle: '时间最短路线',
    tag: '最快',
    tagType: 'info',
    score: 87.3,
    duration: '26 分钟',
    distance: '22.4 km',
    highlights: ['全程时效最优', '需穿越桥头瓶颈区', '适合紧急增援任务'],
    mainPath: '南港保障点 → 滨海大道 → 淡水北岸',
    isRecommended: false
  },
  {
    key: 'route-card-c',
    title: '方案三',
    subtitle: '距离最短路线',
    tag: '最短',
    tagType: 'warning',
    score: 84.1,
    duration: '31 分钟',
    distance: '19.6 km',
    highlights: ['行驶距离最短', '途经城区较密集路段', '中途调整灵活'],
    mainPath: '南港保障点 → 城区主干道 → 淡水北岸',
    isRecommended: false
  }
];

// ──── 机动保障方案卡片数据 ────
export const planningSupportResultCards: readonly PlanningSupportResultCard[] = [
  {
    key: 'support-card-a',
    title: '方案一',
    subtitle: '综合保障方案',
    tag: '综合最优',
    tagType: 'success',
    rating: 5,
    score: 94.2,
    duration: '16小时30分',
    distance: '1,758 km',
    highlights: ['补给点覆盖均匀', '全程通信保障', '维修站点分布合理'],
    isRecommended: true
  },
  {
    key: 'support-card-b',
    title: '方案二',
    subtitle: '快速保障方案',
    tag: '快速',
    tagType: 'info',
    rating: 4,
    score: 89.5,
    duration: '12小时15分',
    distance: '1,820 km',
    highlights: ['优先高速通行', '最短到达时间', '燃油消耗较高'],
    isRecommended: false
  },
  {
    key: 'support-card-c',
    title: '方案三',
    subtitle: '经济保障方案',
    tag: '经济',
    tagType: 'warning',
    rating: 4,
    score: 86.8,
    duration: '18小时40分',
    distance: '1,612 km',
    highlights: ['燃油消耗最低', '路线距离最短', '保障资源需求少'],
    isRecommended: false
  },
  {
    key: 'support-card-d',
    title: '方案四',
    subtitle: '最小保障方案',
    tag: '轻量',
    tagType: 'error',
    rating: 3,
    score: 78.3,
    duration: '20小时10分',
    distance: '1,680 km',
    highlights: ['保障人员最少', '补给站仅必要节点', '适合低风险场景'],
    isRecommended: false
  }
];

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

// ──── 机动保障 AI 助手 - 分析步骤 ────
// 首位为知识库检索，体现知识库联动
export const planningSupportAnalysisSteps: readonly PlanningAnalysisStep[] = [
  { id: 'support-step-0', label: '知识库检索', icon: 'mdi:book-search-outline', status: 'pending' },
  { id: 'support-step-1', label: '路网解析', icon: 'mdi:database-check-outline', status: 'pending' },
  { id: 'support-step-2', label: '障碍识别', icon: 'mdi:shield-alert-outline', status: 'pending' },
  { id: 'support-step-3', label: '预案生成', icon: 'mdi:file-document-edit-outline', status: 'pending' },
  { id: 'support-step-4', label: '兵力车量计算', icon: 'mdi:truck-outline', status: 'pending' },
  { id: 'support-step-5', label: '油料计算', icon: 'mdi:gas-station-outline', status: 'pending' },
  { id: 'support-step-6', label: '保障布设', icon: 'mdi:map-marker-radius-outline', status: 'pending' },
  { id: 'support-step-7', label: '方案评估', icon: 'mdi:clipboard-check-outline', status: 'pending' }
];

// ──── 机动规划 AI 助手 - 快捷操作标签 ────
export const planningRouteQuickTags = [
  { label: '路网', icon: 'mdi:road-variant' },
  { label: '障碍', icon: 'mdi:shield-alert-outline' },
  { label: '交通', icon: 'mdi:traffic-light' },
  { label: '多路径', icon: 'mdi:source-branch' },
  { label: '路线', icon: 'mdi:routes' },
  { label: '风险评估', icon: 'mdi:shield-check-outline' }
];

// ──── 机动保障 AI 助手 - 快捷操作标签 ────
export const planningSupportQuickTags = [
  { label: '路网', icon: 'mdi:road-variant' },
  { label: '障碍', icon: 'mdi:shield-alert-outline' },
  { label: '预案', icon: 'mdi:file-document-edit-outline' },
  { label: '兵力', icon: 'mdi:account-group-outline' },
  { label: '油料', icon: 'mdi:gas-station-outline' },
  { label: '布设', icon: 'mdi:map-marker-radius-outline' }
];
