export const riverLeftTools = [
  { key: 'task', label: '任务', icon: 'mdi:file-document-edit-outline' },
  { key: 'analysis', label: '分析', icon: 'mdi:play-circle-outline' },
  { key: 'annotate', label: '标注', icon: 'mdi:map-marker-plus-outline' },
  { key: 'locate', label: '定位', icon: 'mdi:crosshairs-gps' }
] as const;

export const riverRightTools = [
  { key: 'layers', label: '图层', icon: 'mdi:layers-outline' },
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
  taskName: '台北河北岸快速渡河保障推演',
  taskType: '渡河保障',
  taskRange: '淡水河东南岸至北岸桥位群',
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
    longitude: 121.454,
    latitude: 25.058,
    height: 18000
  }
} as const;

export const riverStaticChannels = [
  {
    id: 'river-channel-main',
    name: '主渡河通道',
    color: '#5ea4ff',
    positions: [
      [121.418, 25.045],
      [121.434, 25.051],
      [121.448, 25.057],
      [121.465, 25.062],
      [121.484, 25.066]
    ]
  },
  {
    id: 'river-channel-alt',
    name: '备用浮渡通道',
    color: '#8de1ff',
    positions: [
      [121.408, 25.031],
      [121.425, 25.038],
      [121.442, 25.044],
      [121.458, 25.049]
    ]
  }
] as const;

export const riverStaticAssemblyZones = [
  {
    id: 'assembly-south',
    name: '南岸主集结区',
    color: '#2ee59d',
    positions: [
      [121.394, 25.018],
      [121.438, 25.018],
      [121.441, 25.042],
      [121.396, 25.043]
    ]
  },
  {
    id: 'assembly-support',
    name: '保障器材展开区',
    color: '#ffcf5c',
    positions: [
      [121.447, 25.022],
      [121.474, 25.022],
      [121.476, 25.039],
      [121.45, 25.04]
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
        [121.401, 25.026],
        [121.421, 25.038],
        [121.444, 25.048],
        [121.463, 25.059],
        [121.49, 25.071]
      ]
    },
    riskZones: [
      {
        id: 'plan-a-risk-1',
        name: '桥位火力风险区',
        color: '#fb7185',
        positions: [
          [121.455, 25.05],
          [121.477, 25.05],
          [121.48, 25.072],
          [121.458, 25.071]
        ]
      }
    ],
    marks: [
      { id: 'plan-a-mark-1', name: '推荐桥位', longitude: 121.45, latitude: 25.055, color: '#63e6be' },
      { id: 'plan-a-mark-2', name: '观察哨位', longitude: 121.476, latitude: 25.067, color: '#ffd166' }
    ]
  },
  'plan-b': {
    route: {
      id: 'plan-b-route',
      name: '方案二主路线',
      color: '#5ea4ff',
      positions: [
        [121.398, 25.022],
        [121.417, 25.031],
        [121.437, 25.041],
        [121.458, 25.052],
        [121.482, 25.061]
      ]
    },
    riskZones: [
      {
        id: 'plan-b-risk-1',
        name: '备用通道暴露区',
        color: '#fb7185',
        positions: [
          [121.421, 25.032],
          [121.44, 25.033],
          [121.445, 25.05],
          [121.423, 25.049]
        ]
      },
      {
        id: 'plan-b-risk-2',
        name: '双线汇聚风险区',
        color: '#ff9f43',
        positions: [
          [121.455, 25.047],
          [121.472, 25.047],
          [121.474, 25.061],
          [121.457, 25.061]
        ]
      }
    ],
    marks: [
      { id: 'plan-b-mark-1', name: '备用浮渡点', longitude: 121.428, latitude: 25.041, color: '#8de1ff' },
      { id: 'plan-b-mark-2', name: '北岸引导点', longitude: 121.482, latitude: 25.062, color: '#63e6be' }
    ]
  },
  'plan-c': {
    route: {
      id: 'plan-c-route',
      name: '方案三路线',
      color: '#f7b267',
      positions: [
        [121.404, 25.024],
        [121.425, 25.034],
        [121.445, 25.044],
        [121.46, 25.056],
        [121.476, 25.074]
      ]
    },
    riskZones: [
      {
        id: 'plan-c-risk-1',
        name: '北岸接应迟滞区',
        color: '#fbbf24',
        positions: [
          [121.463, 25.062],
          [121.485, 25.062],
          [121.487, 25.081],
          [121.466, 25.08]
        ]
      }
    ],
    marks: [
      { id: 'plan-c-mark-1', name: '北岸接应区', longitude: 121.474, latitude: 25.074, color: '#2ee59d' },
      { id: 'plan-c-mark-2', name: '抢修保障点', longitude: 121.446, latitude: 25.05, color: '#ffcf5c' }
    ]
  }
} as const;
