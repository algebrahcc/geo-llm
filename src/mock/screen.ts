export interface ScreenKpiItem {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  delta?: number;
}

export interface ScreenNoticeItem {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  time: string;
  detail?: string;
}

export const screenKpis: ScreenKpiItem[] = [
  { key: 'taskTotal', label: '方案生成总数', value: 128, delta: 8 },
  { key: 'taskOnline', label: '在研任务', value: 12, delta: -1 },
  { key: 'taskDone', label: '已交付方案', value: 86, delta: 5 },
  { key: 'aiCalls', label: '智能体调用次数', value: 342, delta: 21 },
  { key: 'users', label: '研判席位数', value: 24, delta: 2 },
  { key: 'dataVolume', label: '地理要素总量', value: '56', unit: 'TB', delta: 3 }
];

export const screenTaskTrend = {
  dates: ['05-18', '05-19', '05-20', '05-21', '05-22', '05-23', '05-24'],
  created: [18, 23, 19, 26, 31, 28, 33],
  completed: [12, 16, 14, 21, 22, 25, 27]
};

export const screenTaskDistribution = [
  { name: '渡河保障', value: 28 },
  { name: '机动路线', value: 22 },
  { name: '楼宇夺控', value: 34 },
  { name: '城市攻防', value: 26 },
  { name: '态势研判', value: 18 }
];

export const screenDataTypeDistribution = [
  { name: '遥感影像', value: 18.6 },
  { name: '数字高程', value: 12.4 },
  { name: '矢量基础', value: 9.8 },
  { name: '倾斜摄影', value: 6.5 },
  { name: '气象水文', value: 4.2 },
  { name: '地下管网', value: 3.1 },
  { name: 'POI地名', value: 1.6 }
];

export const screenSpatialCoverage = [
  { name: '影像保障', value: [85, 90, 70, 80, 95] },
  { name: '高程保障', value: [78, 72, 82, 88, 76] },
  { name: '矢量保障', value: [70, 65, 85, 90, 75] }
];

export const screenDataUpdateTrend = {
  dates: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  updates: [45, 52, 48, 61, 55, 42, 38]
};

export const screenSystemStatus = {
  health: 86,
  cpu: 42,
  memory: 63,
  storage: 57
};

export const screenHotKeywords = [
  { name: '水文要素', value: 820 },
  { name: '岸滩坡度', value: 710 },
  { name: '交通路网', value: 660 },
  { name: '桥梁承载', value: 580 },
  { name: '防御工事', value: 510 },
  { name: '道路阻断', value: 450 },
  { name: '障碍物类型', value: 420 },
  { name: '浮桥跨度', value: 380 },
  { name: '地质条件', value: 350 },
  { name: '目标坐标', value: 320 },
  { name: '楼宇识别', value: 300 },
  { name: '交通节点', value: 280 },
  { name: '战场环境', value: 250 },
  { name: '意图分类', value: 220 },
  { name: '路径算法', value: 200 }
];

export const screenAiRank = [
  { name: '机动路线规划智能体', value: 64 },
  { name: '渡河保障方案智能体', value: 52 },
  { name: '楼宇夺控智能体', value: 41 },
  { name: '障碍物识别智能体', value: 35 },
  { name: '态势研判智能体', value: 29 }
];

export interface ScreenGlobePoint {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  value: number;
}

export interface ScreenGlobeFlyline {
  id: string;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  name: string;
}

export const screenGlobePoints: ScreenGlobePoint[] = [
  { id: 'p1', name: '任务节点-台北', longitude: 121.52, latitude: 25.05, value: 86 },
  { id: 'p2', name: '任务节点-福州', longitude: 119.3, latitude: 26.08, value: 64 },
  { id: 'p3', name: '任务节点-厦门', longitude: 118.09, latitude: 24.48, value: 52 },
  { id: 'p4', name: '任务节点-高雄', longitude: 120.31, latitude: 22.62, value: 41 },
  { id: 'p5', name: '任务节点-花莲', longitude: 121.6, latitude: 23.98, value: 35 },
  { id: 'p6', name: '任务节点-台中', longitude: 120.67, latitude: 24.15, value: 29 },
  { id: 'p7', name: '任务节点-基隆', longitude: 121.74, latitude: 25.13, value: 22 },
  { id: 'p8', name: '任务节点-台南', longitude: 120.21, latitude: 22.99, value: 18 }
];

export const screenGlobeFlylines: ScreenGlobeFlyline[] = [
  { id: 'f1', fromLon: 119.3, fromLat: 26.08, toLon: 121.52, toLat: 25.05, name: '福州→台北' },
  { id: 'f2', fromLon: 118.09, fromLat: 24.48, toLon: 120.31, toLat: 22.62, name: '厦门→高雄' },
  { id: 'f3', fromLon: 121.52, fromLat: 25.05, toLon: 121.6, toLat: 23.98, name: '台北→花莲' },
  { id: 'f4', fromLon: 121.74, fromLat: 25.13, toLon: 120.67, toLat: 24.15, name: '基隆→台中' },
  { id: 'f5', fromLon: 120.21, fromLat: 22.99, toLon: 119.3, toLat: 26.08, name: '台南→福州' },
  { id: 'f6', fromLon: 120.67, fromLat: 24.15, toLon: 120.31, toLat: 22.62, name: '台中→高雄' }
];

export const screenNotices: ScreenNoticeItem[] = [
  {
    id: 'n1',
    level: 'warning',
    title: 'IMG 影像瓦片缺失：z=12 片区存在空洞',
    time: '10:12',
    detail: '建议补齐 GRST/TIFF 切片或降低默认缩放级别'
  },
  { id: 'n2', level: 'info', title: '智能体方案生成完成：渡河保障（3 版对比）', time: '09:47' },
  { id: 'n3', level: 'error', title: '机动路线约束冲突：限高与限宽无法同时满足', time: '09:03' },
  { id: 'n4', level: 'info', title: '数据目录新增：交通路网（离线）更新至 2026-05', time: '08:32' }
];
