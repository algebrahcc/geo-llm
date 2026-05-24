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
  { key: 'taskTotal', label: '任务总数', value: 128, delta: 8 },
  { key: 'taskOnline', label: '在线任务', value: 12, delta: -1 },
  { key: 'taskDone', label: '已完成', value: 86, delta: 5 },
  { key: 'aiCalls', label: 'AI 分析次数', value: 342, delta: 21 },
  { key: 'users', label: '用户数', value: 24, delta: 2 },
  { key: 'dataVolume', label: '数据总量', value: '56', unit: 'TB', delta: 3 }
];

export const screenTaskTrend = {
  dates: ['05-18', '05-19', '05-20', '05-21', '05-22', '05-23', '05-24'],
  created: [18, 23, 19, 26, 31, 28, 33],
  completed: [12, 16, 14, 21, 22, 25, 27]
};

export const screenTaskDistribution = [
  { name: '侦察监视', value: 28 },
  { name: '应急处置', value: 22 },
  { name: '保障规划', value: 34 },
  { name: '态势研判', value: 26 },
  { name: '其它', value: 18 }
];

export const screenSpatialCoverage = [
  { name: '影像数据', value: [85, 90, 70, 80, 95] },
  { name: '矢量数据', value: [70, 65, 85, 90, 75] }
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
  { name: '河道通行', value: 820 },
  { name: '桥梁承载', value: 710 },
  { name: '道路拥堵', value: 660 },
  { name: '气象影响', value: 580 },
  { name: '补给点位', value: 510 },
  { name: '水文气象', value: 450 },
  { name: '地理空间', value: 420 },
  { name: '智能决策', value: 380 },
  { name: '辅助规划', value: 350 },
  { name: '楼宇识别', value: 320 },
  { name: '路径算法', value: 300 },
  { name: '离线地图', value: 280 },
  { name: '瓦片加载', value: 250 },
  { name: '知识图谱', value: 220 },
  { name: '语义搜索', value: 200 }
];

export const screenAiRank = [
  { name: '机动路线规划', value: 64 },
  { name: '渡河保障方案', value: 52 },
  { name: '楼宇夺控', value: 41 },
  { name: '数据目录检索', value: 35 },
  { name: '态势问答', value: 29 }
];

export const screenNotices: ScreenNoticeItem[] = [
  {
    id: 'n1',
    level: 'warning',
    title: '离线瓦片缺失：z=12 片区存在空洞',
    time: '10:12',
    detail: '建议补齐 tiles/12/* 区域或降低默认缩放级别'
  },
  { id: 'n2', level: 'info', title: 'AI 方案生成完成：渡河保障方案（3 版对比）', time: '09:47' },
  { id: 'n3', level: 'error', title: '路径规划约束冲突：限高与限宽无法同时满足', time: '09:03' },
  { id: 'n4', level: 'info', title: '数据目录新增：道路网（离线）更新至 2026-05', time: '08:32' }
];
