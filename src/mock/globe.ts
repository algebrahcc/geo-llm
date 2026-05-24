export const globeLeftTools = [
  { key: 'analysis', label: '地理分析工具', icon: 'mdi:robot-outline' },
  { key: 'locate', label: '定位', icon: 'mdi:crosshairs-gps' },
  { key: 'measure-distance', label: '测距', icon: 'mdi:ruler' },
  { key: 'measure-area', label: '测面', icon: 'mdi:vector-polygon' },
  { key: 'annotate', label: '标注', icon: 'mdi:map-marker-plus-outline' },
  { key: 'clear', label: '清除', icon: 'mdi:delete-sweep-outline' }
] as const;

export const globeRightTools = [
  { key: 'layers', label: '图层', icon: 'mdi:layers-outline' },
  { key: 'reset', label: '复位', icon: 'mdi:home-outline' },
  { key: 'pitch', label: '俯仰', icon: 'mdi:axis-arrow' },
  { key: 'rotate', label: '旋转', icon: 'mdi:rotate-orbit' },
  { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
  { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' }
] as const;

export const globeDefaultLayers = [
  { key: 'imagery', label: '影像底图', description: 'Cesium 真实地球底图', visible: true },
  { key: 'road', label: '道路', description: '预置道路线数据', visible: true },
  { key: 'pipeline', label: '管网', description: '预置地下管网数据', visible: true },
  { key: 'mark', label: '标注', description: '人工与分析结果标注', visible: true },
  { key: 'route', label: '路线', description: '分析与任务路线', visible: true }
] as const;

export const globePresets = {
  default: { name: '默认区域', longitude: 121.0, latitude: 23.7, height: 18000000 },
  task: { name: '任务区域', longitude: 121.52, latitude: 25.05, height: 520000 }
} as const;

export const globeAnalysisSteps = [
  '正在获取区域数据...',
  '正在分析地形条件...',
  '正在评估道路与管网约束...',
  '正在生成推荐标注与路线...'
] as const;

export const globeStaticRoads = [
  {
    id: 'road-1',
    name: '一号主干道',
    color: '#4dabf7',
    positions: [
      [121.44, 25.03],
      [121.48, 25.05],
      [121.53, 25.06],
      [121.58, 25.08]
    ]
  },
  {
    id: 'road-2',
    name: '二号联络线',
    color: '#74c0fc',
    positions: [
      [121.46, 24.99],
      [121.51, 25.01],
      [121.56, 25.03],
      [121.61, 25.05]
    ]
  }
] as const;

export const globeStaticPipelines = [
  {
    id: 'pipe-1',
    name: '输水管线',
    color: '#ff922b',
    positions: [
      [121.43, 25.07],
      [121.49, 25.08],
      [121.56, 25.08],
      [121.62, 25.07]
    ]
  }
] as const;

export const globeStaticRoutes = [
  {
    id: 'route-1',
    name: '既定路线',
    color: '#ffd43b',
    positions: [
      [121.42, 25.02],
      [121.48, 25.04],
      [121.55, 25.07],
      [121.62, 25.1]
    ]
  }
] as const;

export const globeStaticMarks = [
  { id: 'mark-1', name: '桥梁节点', longitude: 121.5, latitude: 25.06, color: '#ff6b6b' },
  { id: 'mark-2', name: '物资点位', longitude: 121.58, latitude: 25.09, color: '#2b8a3e' }
] as const;

export const globeAnalysisResult = {
  route: {
    id: 'analysis-route',
    name: 'AI 推荐路线',
    color: '#63e6be',
    positions: [
      [121.43, 25.0],
      [121.49, 25.03],
      [121.56, 25.07],
      [121.64, 25.12]
    ]
  },
  area: {
    id: 'analysis-area',
    name: '关注区域',
    color: '#f06595',
    positions: [
      [121.48, 25.03],
      [121.58, 25.04],
      [121.57, 25.11],
      [121.47, 25.1]
    ]
  },
  marks: [
    { id: 'analysis-mark-1', name: '推荐登陆点', longitude: 121.53, latitude: 25.05, color: '#63e6be' },
    { id: 'analysis-mark-2', name: '风险观察点', longitude: 121.6, latitude: 25.1, color: '#f06595' }
  ]
} as const;
