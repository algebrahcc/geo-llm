import type {
  PlanningLayerItem,
  PlanningOption,
  PlanningPreset,
  PlanningRouteKey,
  PlanningRouteScene,
  PlanningRouteSummary,
  PlanningTaskForm,
  PlanningToolbarItem
} from '@/views/planning/modules/types';

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

export const planningDefaultLayers = [
  { key: 'imagery', label: '影像底图', description: '全球 0-8', visible: true },
  { key: 'selected-route', label: '当前路线', description: '高亮显示当前选中的推荐路线', visible: true },
  { key: 'candidate-route', label: '备选路线', description: '展示其余候选路线用于对比', visible: true },
  { key: 'risk', label: '风险区', description: '桥隧、坡度、威胁与拥堵风险区', visible: true },
  { key: 'obstacle', label: '障碍点', description: '桥头拥堵、受限路段、观察点等关键障碍', visible: true },
  { key: 'markers', label: '起终点标记', description: '任务起点、终点与关键节点标记', visible: true }
] as const satisfies readonly PlanningLayerItem[];

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

export const planningPresets = {
  task: {
    longitude: 121.51,
    latitude: 25.09,
    height: 52000
  }
} as const satisfies Record<'task', PlanningPreset>;

export const planningRouteOptions = [
  { key: 'route-a', label: '路线一', subtitle: '快速通达' },
  { key: 'route-b', label: '路线二', subtitle: '均衡保障' },
  { key: 'route-c', label: '路线三', subtitle: '低风险机动' }
] as const;

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
