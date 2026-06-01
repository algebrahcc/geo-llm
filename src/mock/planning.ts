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
  PlanningRouteScene,
  PlanningRouteSegment,
  PlanningRouteSummary,
  PlanningTaskForm,
  PlanningToolbarItem
} from '@/views/planning/modules/types';

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
export const planningRouteSummaries = {
  'route-a': {
    key: 'route-a',
    label: '路线一',
    title: '快速通达路线',
    subtitle: '以主干道为主，优先时效',
    summary: '沿城区快速通道北上，整体速度最快，但需穿越一处桥头瓶颈，适合抢时增援。',
    metrics: [
      { label: '行程时间', value: '34 分钟', tone: 'primary' },
      { label: '总里程', value: '27.8 km', tone: 'success' },
      { label: '风险等级', value: '中高', tone: 'warning' },
      { label: '通行评分', value: '82', tone: 'primary' }
    ],
    highlights: ['采用快速路为主，整体时效最优', '桥头瓶颈区需安排前出疏导分队', '适合对抢时要求高的任务群快速机动'],
    risks: [
      { title: '桥头拥堵', detail: '淡水桥位附近流量叠加，可能导致队尾滞留。' },
      { title: '观察暴露', detail: '北段高架暴露度较高，需注意对向观察与压制风险。' }
    ]
  },
  'route-b': {
    key: 'route-b',
    label: '路线二',
    title: '均衡保障路线',
    subtitle: '兼顾时效与路段稳定性',
    summary: '绕开主桥位核心瓶颈后再切回主干道，整体节奏更稳，适合常规保障与持续投送。',
    metrics: [
      { label: '行程时间', value: '39 分钟', tone: 'primary' },
      { label: '总里程', value: '30.6 km', tone: 'warning' },
      { label: '风险等级', value: '中', tone: 'success' },
      { label: '通行评分', value: '88', tone: 'primary' }
    ],
    highlights: ['规避主桥位瓶颈区，整体更稳定', '适合中等规模机动与持续补给保障', '道路条件均衡，便于中途机动调整'],
    risks: [
      { title: '次级路段绕行', detail: '中段需通过次级道路，局部路宽不足。' },
      { title: '穿城交叉口', detail: '城区交叉口较多，队列需分段通行。' }
    ]
  },
  'route-c': {
    key: 'route-c',
    label: '路线三',
    title: '低风险机动路线',
    subtitle: '避开暴露区与主要桥梁压力点',
    summary: '整体绕行更明显，但能够避开主要威胁区和桥头压力点，适合稳妥推进和大车队机动。',
    metrics: [
      { label: '行程时间', value: '46 分钟', tone: 'warning' },
      { label: '总里程', value: '34.2 km', tone: 'warning' },
      { label: '风险等级', value: '低', tone: 'success' },
      { label: '通行评分', value: '91', tone: 'primary' }
    ],
    highlights: [
      '全程暴露风险最低，适合稳妥推进',
      '更适合重装车辆和大编组车队机动',
      '可作为路线一、二受阻时的低风险备选'
    ],
    risks: [
      { title: '耗时增加', detail: '整体绕行较长，不利于抢时任务。' },
      { title: '补给跨度更长', detail: '路线较长，对油料与中途保障提出更高要求。' }
    ]
  }
} as const satisfies Record<PlanningRouteKey, PlanningRouteSummary>;

// ──── 路线场景数据（路线规划模式） ────
export const planningRouteScenes = {
  'route-a': {
    route: {
      id: 'planning-route-a',
      name: '快速通达路线',
      color: '#63e6be',
      positions: [
        [121.606, 25.054],
        [121.58, 25.069],
        [121.553, 25.087],
        [121.516, 25.108],
        [121.477, 25.139],
        [121.433, 25.175]
      ]
    },
    risks: [
      {
        id: 'planning-risk-a-1',
        name: '桥头瓶颈区',
        color: '#fb7185',
        positions: [
          [121.449, 25.149],
          [121.468, 25.149],
          [121.471, 25.168],
          [121.451, 25.169]
        ]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-a-1', name: '观察高点', longitude: 121.503, latitude: 25.119, color: '#ffd166' },
      { id: 'planning-obstacle-a-2', name: '桥头拥堵点', longitude: 121.459, latitude: 25.159, color: '#fb7185' }
    ]
  },
  'route-b': {
    route: {
      id: 'planning-route-b',
      name: '均衡保障路线',
      color: '#5ea4ff',
      positions: [
        [121.606, 25.054],
        [121.587, 25.064],
        [121.56, 25.081],
        [121.529, 25.097],
        [121.49, 25.125],
        [121.454, 25.155],
        [121.433, 25.175]
      ]
    },
    risks: [
      {
        id: 'planning-risk-b-1',
        name: '次级路段收窄区',
        color: '#ff9f43',
        positions: [
          [121.51, 25.107],
          [121.529, 25.107],
          [121.531, 25.123],
          [121.512, 25.123]
        ]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-b-1', name: '坡度限制点', longitude: 121.545, latitude: 25.088, color: '#ffcf5c' },
      { id: 'planning-obstacle-b-2', name: '绕行汇入口', longitude: 121.479, latitude: 25.145, color: '#8de1ff' }
    ]
  },
  'route-c': {
    route: {
      id: 'planning-route-c',
      name: '低风险机动路线',
      color: '#f7b267',
      positions: [
        [121.606, 25.054],
        [121.59, 25.06],
        [121.564, 25.073],
        [121.534, 25.089],
        [121.501, 25.109],
        [121.47, 25.137],
        [121.444, 25.161],
        [121.433, 25.175]
      ]
    },
    risks: [
      {
        id: 'planning-risk-c-1',
        name: '补给跨度区',
        color: '#fbbf24',
        positions: [
          [121.49, 25.127],
          [121.51, 25.127],
          [121.513, 25.146],
          [121.492, 25.146]
        ]
      }
    ],
    obstacles: [
      { id: 'planning-obstacle-c-1', name: '补给提示点', longitude: 121.522, latitude: 25.101, color: '#2ee59d' },
      { id: 'planning-obstacle-c-2', name: '绕行检查点', longitude: 121.461, latitude: 25.149, color: '#ffd166' }
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
  { id: 'step-1', label: '路网数据加载', icon: 'mdi:database-check-outline', status: 'completed' },
  { id: 'step-2', label: '路线可行性分析', icon: 'mdi:map-check-outline', status: 'completed' },
  { id: 'step-3', label: '路况与障碍分析', icon: 'mdi:road-variant', status: 'running' },
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
