// ────────────────────────────────────────────────────────────────
// Extended metadata interfaces for Geo-LLM catalog
// ────────────────────────────────────────────────────────────────

/** 数据质量 */
export interface DataQuality {
  completeness: number; // 0-100
  timeliness: number; // 0-100
  accuracy: number; // 0-100
  score: number; // 综合分 0-100
  grade: 'A' | 'B' | 'C' | 'D';
}

/** 数据血缘 */
export interface Lineage {
  source: string;
  sourceUrl?: string;
  collectedAt?: string;
  processedSteps: string[];
  version: string;
  parentId?: number;
}

/** 标准化处理状态 */
export interface StandardizeStatus {
  coordinateTransformed: boolean;
  targetCRS?: string;
  fieldMapped: boolean;
  schemaVersion?: string;
  formatConverted: boolean;
  originalFormat?: string;
}

/** 瓦片协议类型 */
export type TileProtocol = 'TMS' | 'WMS' | 'WMTS' | 'WFS';

/** 瓦片/服务发布状态 */
export interface TileStatus {
  tiled: boolean;
  tileFormat?: string;
  serviceUrl?: string;
  protocols: TileProtocol[];
  minZoom?: number;
  maxZoom?: number;
}

/** 智能体 Key */
export type AgentKey =
  | 'geo-analysis'
  | 'mobility-planning'
  | 'river-crossing'
  | 'image-recognition'
  | 'building-control'
  | 'knowledge'
  | 'planning';

/** 智能体中文名映射 */
export const agentLabelMap: Record<AgentKey, string> = {
  'geo-analysis': '地理分析助手',
  'mobility-planning': '机动规划助手',
  'river-crossing': '渡河保障助手',
  'image-recognition': '影像识别助手',
  'building-control': '楼宇夺控助手',
  knowledge: '知识检索',
  planning: '路线规划'
};

/** 任务场景标签 */
export type ScenarioTag =
  | '渡河保障'
  | '机动路线规划'
  | '楼宇夺控'
  | '城市攻防'
  | '交通研判'
  | '地形分析'
  | '目标识别'
  | '态势感知'
  | '预案生成';

/** 审核状态 */
export interface AuditStatus {
  auditor: string;
  auditTime: string;
  status: 'approved' | 'pending' | 'rejected';
  comments?: string;
}

/** 模型微调状态 */
export interface FinetuneStatus {
  used: boolean;
  taskTypes?: string[];
  sampleCount?: number;
  annotationComplete?: number; // 0-100
  modelVersion?: string;
}

// ────────────────────────────────────────────────────────────────
// CatalogItem (主接口 — 向后兼容原有字段 + 扩展字段)
// ────────────────────────────────────────────────────────────────
export interface CatalogItem {
  id: number;
  name: string;
  ingestTime: string;
  timePhase: string;
  range: string;
  type: string;
  status: 'published' | 'draft' | 'offline';
  size: string;
  source: string;
  description?: string;
  format?: string;
  resolution?: string;
  coordinateSystem?: string;
  bbox?: [number, number, number, number];
  updateTime?: string;
  tags?: string[];
  /* ─── 扩展字段 ─── */
  quality?: DataQuality;
  lineage?: Lineage;
  standardizeStatus?: StandardizeStatus;
  tileStatus?: TileStatus;
  agentBinding?: AgentKey[];
  scenarioTags?: ScenarioTag[];
  audit?: AuditStatus;
  finetuneStatus?: FinetuneStatus;
}

// ────────────────────────────────────────────────────────────────
// Category (分类树)
// ────────────────────────────────────────────────────────────────
export interface CatalogCategory {
  label: string;
  key: string;
  children?: { label: string; key: string }[];
}

export const catalogCategories: CatalogCategory[] = [
  {
    label: '遥感影像',
    key: 'img',
    children: [
      { label: '卫星光学影像', key: 'img-optical' },
      { label: '雷达/SAR 影像', key: 'img-sar' },
      { label: '航空摄影', key: 'img-aerial' },
      { label: '多光谱/高光谱', key: 'img-multi' }
    ]
  },
  {
    label: '数字高程',
    key: 'dem',
    children: [
      { label: 'DEM 数字高程模型', key: 'dem-dem' },
      { label: 'DSM 数字地表模型', key: 'dem-dsm' },
      { label: '派生产品(坡度/坡向)', key: 'dem-derived' }
    ]
  },
  {
    label: '倾斜摄影与三维',
    key: 'oblique',
    children: [
      { label: '城市级倾斜摄影', key: 'oblique-city' },
      { label: '单体精细模型', key: 'oblique-single' },
      { label: '三维网格瓦片', key: 'oblique-3dtiles' }
    ]
  },
  {
    label: '气象水文',
    key: 'hydro',
    children: [
      { label: '降雨与预报', key: 'hydro-rain' },
      { label: '河网水系', key: 'hydro-river' },
      { label: '湖泊水库', key: 'hydro-lake' },
      { label: '水文站点监测', key: 'hydro-station' }
    ]
  },
  {
    label: '地下管网',
    key: 'pipe',
    children: [
      { label: '供水管网', key: 'pipe-water' },
      { label: '排水/燃气/热力', key: 'pipe-other' },
      { label: '电力/通信管线', key: 'pipe-elec' }
    ]
  },
  {
    label: '矢量基础地理',
    key: 'vec',
    children: [
      { label: '地形图(DLG)', key: 'vec-dlg' },
      { label: '建筑分布', key: 'vec-building' },
      { label: '交通路网', key: 'vec-traffic' },
      { label: '行政边界', key: 'vec-admin' },
      { label: '土地利用', key: 'vec-landuse' }
    ]
  },
  {
    label: '地名地址与POI',
    key: 'poi',
    children: [
      { label: '要地志', key: 'poi-strategic' },
      { label: '重要目标', key: 'poi-target' },
      { label: '公共设施', key: 'poi-facility' }
    ]
  },
  {
    label: '战场环境专题',
    key: 'battlefield',
    children: [
      { label: '气候与天气', key: 'bf-climate' },
      { label: '地质与土壤', key: 'bf-geology' },
      { label: '电磁环境', key: 'bf-em' },
      { label: '人口与经济', key: 'bf-pop' }
    ]
  },
  {
    label: '障碍物与目标识别',
    key: 'obstacle',
    children: [
      { label: '城市障碍物', key: 'obs-urban' },
      { label: '交通设施受损', key: 'obs-traffic' },
      { label: '防御工事', key: 'obs-defense' }
    ]
  },
  {
    label: '多模态语料',
    key: 'corpus',
    children: [
      { label: '文本语料', key: 'corpus-text' },
      { label: '图像标注样本', key: 'corpus-image' },
      { label: '视频/音频', key: 'corpus-media' }
    ]
  },
  {
    label: '历史方案整编',
    key: 'plan',
    children: [
      { label: '渡河方案', key: 'plan-river' },
      { label: '路线方案', key: 'plan-route' },
      { label: '楼宇方案', key: 'plan-building' }
    ]
  }
];

export const catalogTypes = [
  '总览',
  '遥感影像',
  '数字高程',
  '倾斜摄影',
  '气象水文',
  '地下管网',
  '矢量基础',
  '地名地址',
  '战场专题',
  '障碍物与目标',
  '多模态语料',
  '历史方案'
];

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function q(c: number, t: number, a: number): DataQuality {
  const score = Math.round((c + t + a) / 3);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  return { completeness: c, timeliness: t, accuracy: a, score, grade };
}

function lin(source: string, steps: string[], version = 'v1.0', collectedAt?: string): Lineage {
  return { source, processedSteps: steps, version, collectedAt };
}

function std(coord = true, field = true, fmt = true): StandardizeStatus {
  return {
    coordinateTransformed: coord,
    targetCRS: coord ? 'CGCS 2000' : undefined,
    fieldMapped: field,
    schemaVersion: field ? 'v1.0' : undefined,
    formatConverted: fmt
  };
}

function tile(tiled: boolean, protocols: TileProtocol[] = ['WMS', 'WMTS']): TileStatus {
  return { tiled, protocols };
}

// ────────────────────────────────────────────────────────────────
// Sample Data — 11 类，每类 5-10 条，覆盖 IMG/GRST/EGC
// ────────────────────────────────────────────────────────────────
export const catalogData: CatalogItem[] = [
  // ═══════════════ 1. 遥感影像 (8 items) ═══════════════
  {
    id: 1, name: '长江流域高清光学影像', ingestTime: '2026-05-22', timePhase: '2026Q2',
    range: '长江流域', type: '遥感影像', status: 'published', size: '2.8 GB', source: '卫星采集',
    description: '覆盖长江流域全域的高分辨率卫星影像数据，含多光谱和全色波段，适用于土地利用分类、植被覆盖度分析。',
    format: 'GeoTIFF', resolution: '2m', coordinateSystem: 'WGS 84 / UTM Zone 49N',
    bbox: [96.3, 24.5, 122.4, 35.8], updateTime: '2026-05-22',
    tags: ['卫星影像', '多光谱', '长江流域'],
    quality: q(95, 92, 88), lineage: lin('卫星采集', ['原始数据接收', '辐射校正', '几何校正', '正射纠正', '镶嵌裁剪'], 'v2.1', '2026-05-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['地形分析', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-05-20', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 2, name: '西部地区卫星光学影像', ingestTime: '2026-05-05', timePhase: '2026Q1',
    range: '西部地区', type: '遥感影像', status: 'offline', size: '5.2 GB', source: '卫星采集',
    description: '覆盖西部干旱半干旱地区的卫星影像，含全色与多光谱波段，适用于荒漠化监测。',
    format: 'GeoTIFF', resolution: '5m', coordinateSystem: 'WGS 84 / UTM Zone 47N',
    bbox: [73.5, 26.4, 108.6, 49.2], updateTime: '2026-05-05', tags: ['卫星影像', '西部', '荒漠化'],
    quality: q(88, 85, 82), lineage: lin('卫星采集', ['数据接收', '预处理', '镶嵌'], 'v1.3', '2026-03-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['地形分析', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-05-03', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 3, name: '高分系列卫星影像 (IMG格式)', ingestTime: '2026-04-20', timePhase: '2026Q1',
    range: '华东重点区域', type: '遥感影像', status: 'published', size: '3.6 GB', source: '高分专项',
    description: '高分一号/二号华东区域高分辨率遥感影像，IMG 格式，适用于城市精细化管理与侦察分析。',
    format: 'IMG', resolution: '1m', coordinateSystem: 'CGCS 2000',
    bbox: [114.8, 28.5, 122.9, 35.0], updateTime: '2026-04-20', tags: ['高分卫星', 'IMG格式', '华东'],
    quality: q(96, 94, 90), lineage: lin('高分专项数据中心', ['数据分发', '格式转换(IMG)', '金字塔构建', '质量检查'], 'v2.0', '2026-04-01'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, schemaVersion: 'v1.0', formatConverted: true, originalFormat: 'GeoTIFF' },
    tileStatus: tile(true, ['TMS', 'WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'image-recognition', 'mobility-planning'], scenarioTags: ['城市攻防', '交通研判', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-04-18', status: 'approved', comments: '质量优秀' },
    finetuneStatus: { used: true, taskTypes: ['目标检测', '语义分割'], sampleCount: 5000, annotationComplete: 85, modelVersion: 'YOLOv8-geo-v2' }
  },
  {
    id: 4, name: '全国SAR雷达影像 (GRST格式)', ingestTime: '2026-03-18', timePhase: '2026Q1',
    range: '全国', type: '遥感影像', status: 'published', size: '12.5 GB', source: 'SAR卫星',
    description: '全国覆盖SAR雷达影像，GRST 格式，不受云雨天气影响，适用于全天候监测与变化检测。',
    format: 'GRST', resolution: '10m', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-18', tags: ['SAR', 'GRST格式', '雷达', '全天候'],
    quality: q(92, 90, 87), lineage: lin('SAR卫星数据中心', ['SLC数据接收', '多视处理', '滤波', '地理编码(GRST)', '镶嵌'], 'v1.5', '2026-02-20'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'WGS 84', fieldMapped: true, formatConverted: true, originalFormat: 'SLC' },
    tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'image-recognition'], scenarioTags: ['态势感知', '目标识别', '地形分析'],
    audit: { auditor: '王工', auditTime: '2026-03-15', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['变化检测', '地物分类'], sampleCount: 12000, annotationComplete: 70, modelVersion: 'SARNet-v1' }
  },
  {
    id: 5, name: '重点城市多光谱影像', ingestTime: '2026-05-12', timePhase: '2026Q2',
    range: '东部沿海城市', type: '遥感影像', status: 'published', size: '4.1 GB', source: 'Sentinel-2',
    description: 'Sentinel-2 多光谱卫星影像，13 个光谱波段，适用于植被指数、水体提取、城市热岛分析。',
    format: 'GeoTIFF', resolution: '10m', coordinateSystem: 'WGS 84 / UTM Zone 50N',
    bbox: [116.0, 22.0, 123.0, 40.0], updateTime: '2026-05-12', tags: ['多光谱', 'Sentinel-2', '波段分析'],
    quality: q(94, 93, 89), lineage: lin('ESA Copernicus', ['L1C下载', '大气校正(L2A)', '波段合成', '裁剪'], 'v2.0', '2026-05-01'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'river-crossing'], scenarioTags: ['地形分析', '渡河保障', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-05-10', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 6, name: '沿海城市航空摄影', ingestTime: '2026-04-10', timePhase: '2025Q4',
    range: '某沿海城市', type: '遥感影像', status: 'published', size: '8.3 GB', source: '航空摄影',
    description: '有人机航空摄影城市高分辨率正射影像，0.2m 分辨率，适用于城市精细化管理。',
    format: 'GeoTIFF', resolution: '0.2m', coordinateSystem: 'CGCS 2000',
    bbox: [120.5, 29.8, 122.2, 31.5], updateTime: '2026-04-10', tags: ['航空摄影', '高分辨率', '正射影像'],
    quality: q(97, 88, 92), lineage: lin('测绘航空', ['航线规划', '航空拍摄', '空三加密', '正射纠正', '匀光匀色'], 'v3.0', '2025-11-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['TMS', 'WMS', 'WMTS']),
    agentBinding: ['building-control', 'image-recognition', 'geo-analysis'], scenarioTags: ['楼宇夺控', '城市攻防', '目标识别'],
    audit: { auditor: '赵工', auditTime: '2026-04-08', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['建筑检测', '车辆检测'], sampleCount: 8000, annotationComplete: 65 }
  },
  {
    id: 7, name: '夜光遥感影像', ingestTime: '2026-03-28', timePhase: '2025',
    range: '全国', type: '遥感影像', status: 'draft', size: '1.8 GB', source: 'NPP-VIIRS',
    description: 'NPP-VIIRS 夜光遥感年度合成影像，反映人类活动强度，可用于人口密度估算。',
    format: 'GeoTIFF', resolution: '500m', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-28', tags: ['夜光', '夜间灯光', '人口密度'],
    quality: q(85, 80, 78), lineage: lin('NOAA', ['原始数据下载', '辐射校正', '年度合成', '投影转换'], 'v1.0', '2026-01-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['态势感知', '城市攻防'],
    audit: { auditor: '张工', auditTime: '2026-03-25', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 8, name: 'SAR时序变化检测数据 (GRST格式)', ingestTime: '2026-05-08', timePhase: '2025-2026',
    range: '重点边境区域', type: '遥感影像', status: 'published', size: '6.7 GB', source: 'SAR卫星',
    description: '多时相SAR影像变化检测数据集，GRST 格式，可识别地表变化区域（新建建筑、防御工事等）。',
    format: 'GRST', resolution: '5m', coordinateSystem: 'WGS 84',
    bbox: [97.0, 21.0, 108.0, 29.0], updateTime: '2026-05-08', tags: ['SAR', 'GRST格式', '变化检测', '多时相'],
    quality: q(90, 88, 85), lineage: lin('SAR卫星数据中心', ['多时相SLC获取', '配准', '干涉处理', '变化检测', 'GRST编码'], 'v1.2', '2026-04-15'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'WGS 84', fieldMapped: true, formatConverted: true, originalFormat: 'SLC' },
    tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['image-recognition', 'geo-analysis'], scenarioTags: ['目标识别', '态势感知', '城市攻防'],
    audit: { auditor: '王工', auditTime: '2026-05-06', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['变化检测'], sampleCount: 3000, annotationComplete: 55 }
  },

  // ═══════════════ 2. 数字高程 (6 items) ═══════════════
  {
    id: 101, name: '黄河流域 DEM', ingestTime: '2026-05-18', timePhase: '2026Q2',
    range: '黄河流域', type: '数字高程', status: 'published', size: '1.2 GB', source: 'SRTM',
    description: 'SRTM 雷达数据生成的黄河流域 DEM，适用于地形分析、水文模拟、坡度坡向计算。',
    format: 'GeoTIFF', resolution: '30m', coordinateSystem: 'WGS 84',
    bbox: [95.9, 32.2, 119.1, 42.5], updateTime: '2026-05-18', tags: ['DEM', '高程', '黄河流域', 'SRTM'],
    quality: q(90, 88, 85), lineage: lin('SRTM数据中心', ['原始雷达数据', '相位解缠', '高程提取', '空洞填补(ASTER)'], 'v3.0', '2026-04-01'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'river-crossing', 'mobility-planning'], scenarioTags: ['地形分析', '渡河保障', '机动路线规划'],
    audit: { auditor: '张工', auditTime: '2026-05-16', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 102, name: '全国 DEM 30m', ingestTime: '2026-04-28', timePhase: '2025',
    range: '全国', type: '数字高程', status: 'published', size: '8.9 GB', source: 'SRTM',
    description: '全国 30m 分辨率 DEM，SRTM V3.0，空洞区域已用 ASTER GDEM 填补。',
    format: 'GeoTIFF', resolution: '30m', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-04-28', tags: ['DEM', '全国', 'SRTM', '地形'],
    quality: q(92, 90, 87), lineage: lin('SRTM V3.0', ['雷达数据处理', '全球拼接', '空洞填补', '投影转换'], 'v3.0', '2025-12-01'),
    standardizeStatus: std(), tileStatus: tile(true, ['TMS', 'WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'mobility-planning', 'river-crossing'], scenarioTags: ['地形分析', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-04-25', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 103, name: '重点城市高分辨率 DEM (EGC格式)', ingestTime: '2026-05-10', timePhase: '2026Q1',
    range: '某沿海城市', type: '数字高程', status: 'published', size: '2.1 GB', source: 'LiDAR航测',
    description: '机载 LiDAR 点云生成的城市高分辨率 DEM，EGC 格式，5m 分辨率，支撑可视域计算。',
    format: 'EGC', resolution: '5m', coordinateSystem: 'CGCS 2000',
    bbox: [120.5, 29.8, 122.2, 31.5], updateTime: '2026-05-10', tags: ['DEM', 'EGC格式', '高分辨率', 'LiDAR'],
    quality: q(97, 92, 95), lineage: lin('机载LiDAR', ['点云获取', '地面点分类', 'DEM生成(5m)', 'EGC编码', '质量检查'], 'v2.0', '2026-02-20'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'LAS' },
    tileStatus: tile(true, ['TMS', 'WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'building-control', 'mobility-planning'], scenarioTags: ['地形分析', '楼宇夺控', '城市攻防'],
    audit: { auditor: '赵工', auditTime: '2026-05-08', status: 'approved', comments: '质量优秀' }, finetuneStatus: { used: false }
  },
  {
    id: 104, name: 'DSM 数字地表模型（含建筑物）', ingestTime: '2026-04-15', timePhase: '2025Q4',
    range: '某城市主城区', type: '数字高程', status: 'published', size: '3.4 GB', source: '航空摄影测量',
    description: '密集匹配生成的 DSM，含建筑物、植被高度信息，适用于建筑高度分析。',
    format: 'GeoTIFF', resolution: '2m', coordinateSystem: 'CGCS 2000',
    bbox: [116.1, 39.7, 116.7, 40.1], updateTime: '2026-04-15', tags: ['DSM', '地表模型', '建筑高度'],
    quality: q(94, 88, 90), lineage: lin('航空摄影测量', ['航空拍摄', '密集匹配', 'DSM生成', '噪声去除', '编辑'], 'v1.5', '2025-12-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['building-control', 'geo-analysis'], scenarioTags: ['楼宇夺控', '城市攻防', '地形分析'],
    audit: { auditor: '李工', auditTime: '2026-04-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 105, name: '沿海海底地形 DEM (GRST格式)', ingestTime: '2026-03-20', timePhase: '2025',
    range: '东南沿海', type: '数字高程', status: 'draft', size: '4.8 GB', source: '多波束测深',
    description: '多波束测深数据生成的海底地形 DEM，GRST 格式，适用于渡河/两栖作战水下地形分析。',
    format: 'GRST', resolution: '10m', coordinateSystem: 'WGS 84',
    bbox: [116.0, 21.0, 122.0, 28.0], updateTime: '2026-03-20', tags: ['DEM', 'GRST格式', '海底地形', '渡河'],
    quality: q(82, 78, 80), lineage: lin('海洋测绘', ['多波束测深', '数据清理', '潮位改正', 'DEM生成', 'GRST编码'], 'v1.0', '2025-08-15'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'WGS 84', fieldMapped: true, formatConverted: true, originalFormat: 'XYZ' },
    tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'geo-analysis'], scenarioTags: ['渡河保障', '地形分析'],
    audit: { auditor: '王工', auditTime: '2026-03-18', status: 'pending', comments: '待补充潮位改正数据' }, finetuneStatus: { used: false }
  },
  {
    id: 106, name: '战场区域精细 DEM (EGC格式)', ingestTime: '2026-05-15', timePhase: '2026Q2',
    range: '某预设战场', type: '数字高程', status: 'published', size: '1.5 GB', source: '无人机LiDAR',
    description: '无人机载 LiDAR 获取的战场超高分辨率 DEM，EGC 格式，1m 分辨率，支撑坡度/通视分析。',
    format: 'EGC', resolution: '1m', coordinateSystem: 'CGCS 2000',
    bbox: [110.0, 30.0, 111.0, 31.0], updateTime: '2026-05-15', tags: ['DEM', 'EGC格式', '战场', '超高分辨率'],
    quality: q(96, 95, 94), lineage: lin('无人机LiDAR', ['航线规划', 'LiDAR扫描', '点云处理', 'DEM生成(1m)', 'EGC编码'], 'v2.0', '2026-04-20'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'LAS' },
    tileStatus: tile(true, ['TMS', 'WMS', 'WMTS']),
    agentBinding: ['mobility-planning', 'geo-analysis', 'river-crossing'], scenarioTags: ['机动路线规划', '渡河保障', '地形分析', '城市攻防'],
    audit: { auditor: '张工', auditTime: '2026-05-13', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 3. 倾斜摄影与三维 (6 items) ═══════════════
  {
    id: 201, name: '北京市倾斜摄影模型', ingestTime: '2026-05-15', timePhase: '2025Q4',
    range: '北京市', type: '倾斜摄影', status: 'published', size: '15.6 GB', source: '无人机航拍',
    description: '五镜头倾斜摄影北京市城六区三维实景模型，纹理清晰，可用于城市规划与三维空间分析。',
    format: 'OSGB', resolution: '0.05m', coordinateSystem: 'CGCS 2000',
    bbox: [116.0, 39.6, 116.8, 40.2], updateTime: '2026-05-15', tags: ['倾斜摄影', '三维模型', '北京'],
    quality: q(96, 90, 93), lineage: lin('测绘无人机', ['航线规划', '五镜头拍摄', '空三加密', '实景三维建模', '纹理映射'], 'v3.0', '2025-10-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['building-control', 'geo-analysis', 'image-recognition'], scenarioTags: ['楼宇夺控', '城市攻防', '目标识别'],
    audit: { auditor: '赵工', auditTime: '2026-05-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 202, name: '上海外滩倾斜摄影模型', ingestTime: '2026-04-22', timePhase: '2025Q4',
    range: '上海市', type: '倾斜摄影', status: 'published', size: '22.4 GB', source: '航空倾斜摄影',
    description: '有人机五镜头倾斜摄影上海外滩核心区域实景三维模型，建筑细节丰富。',
    format: 'OSGB', resolution: '0.03m', coordinateSystem: 'CGCS 2000',
    bbox: [121.4, 31.2, 121.6, 31.3], updateTime: '2026-04-22', tags: ['倾斜摄影', '三维模型', '上海'],
    quality: q(97, 88, 95), lineage: lin('测绘航空', ['航线规划', '五镜头拍摄', '空三加密', '密集匹配', '模型重建'], 'v2.0', '2025-11-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['building-control', 'geo-analysis'], scenarioTags: ['楼宇夺控', '城市攻防'],
    audit: { auditor: '赵工', auditTime: '2026-04-20', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 203, name: '某战场区域倾斜摄影', ingestTime: '2026-05-08', timePhase: '2026Q1',
    range: '某预设战场', type: '倾斜摄影', status: 'published', size: '18.9 GB', source: '无人机航拍',
    description: '战场区域实景三维模型，覆盖城镇、交通枢纽、桥梁等关键目标。',
    format: 'OSGB', resolution: '0.08m', coordinateSystem: 'CGCS 2000',
    bbox: [110.0, 30.0, 110.8, 30.6], updateTime: '2026-05-08', tags: ['倾斜摄影', '战场', '实景三维'],
    quality: q(93, 90, 88), lineage: lin('军用无人机', ['航线规划', '多角度拍摄', '空三加密', '模型生成', '纹理优化'], 'v1.5', '2026-02-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['building-control', 'mobility-planning', 'geo-analysis'], scenarioTags: ['楼宇夺控', '机动路线规划', '城市攻防', '态势感知'],
    audit: { auditor: '王工', auditTime: '2026-05-05', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 204, name: '桥梁单体精细化三维模型', ingestTime: '2026-04-18', timePhase: '2026Q1',
    range: '某特大桥', type: '倾斜摄影', status: 'published', size: '5.2 GB', source: '无人机+地面扫描',
    description: '无人机倾斜摄影与地面三维激光扫描融合的特大桥精细化三维模型。',
    format: 'glTF', resolution: '0.02m', coordinateSystem: 'CGCS 2000',
    bbox: [117.2, 34.5, 117.4, 34.6], updateTime: '2026-04-18', tags: ['单体模型', '桥梁', '精细化'],
    quality: q(98, 92, 96), lineage: lin('无人机+地面扫描', ['无人机拍摄', '地面激光扫描', '点云融合', '模型重建', '纹理映射'], 'v1.0', '2026-03-05'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'building-control'], scenarioTags: ['渡河保障', '交通研判', '楼宇夺控'],
    audit: { auditor: '张工', auditTime: '2026-04-15', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 205, name: '城市级 3D Tiles 瓦片模型', ingestTime: '2026-03-10', timePhase: '2025',
    range: '某省会城市', type: '倾斜摄影', status: 'published', size: '45.2 GB', source: '航空摄影测量',
    description: '城市级 3D Tiles 三维瓦片模型，支持 LOD 多级加载，适用于 Cesium 三维引擎。',
    format: '3D Tiles', resolution: '0.1m', coordinateSystem: 'CGCS 2000',
    bbox: [113.8, 34.5, 114.2, 34.9], updateTime: '2026-03-10', tags: ['3D Tiles', '城市级', 'LOD', 'Cesium'],
    quality: q(95, 85, 90), lineage: lin('航空摄影测量', ['航空拍摄', '空三加密', '模型重建', 'LOD生成', '3D Tiles编码'], 'v2.0', '2025-09-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['building-control', 'geo-analysis'], scenarioTags: ['楼宇夺控', '城市攻防', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-03-08', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 206, name: '历史建筑群倾斜摄影', ingestTime: '2026-02-25', timePhase: '2025Q3',
    range: '某历史文化名城', type: '倾斜摄影', status: 'draft', size: '11.3 GB', source: '无人机航拍',
    description: '历史文化名城核心保护区实景三维模型，含古建筑群精细纹理。',
    format: 'OSGB', resolution: '0.04m', coordinateSystem: 'CGCS 2000',
    bbox: [108.9, 34.2, 109.1, 34.3], updateTime: '2026-02-25', tags: ['倾斜摄影', '历史建筑', '文化遗产'],
    quality: q(92, 82, 90), lineage: lin('测绘无人机', ['航线规划', '拍摄', '空三加密', '模型重建'], 'v1.0', '2025-08-20'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['building-control', 'geo-analysis'], scenarioTags: ['楼宇夺控', '城市攻防'],
    audit: { auditor: '赵工', auditTime: '2026-02-22', status: 'pending', comments: '待补充部分区域' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 4. 气象水文 (7 items) ═══════════════
  {
    id: 301, name: '华东地区逐日降雨分布', ingestTime: '2026-05-10', timePhase: '2026Q2',
    range: '华东地区', type: '气象水文', status: 'draft', size: '320 MB', source: '气象局接口',
    description: '气象局实时接口获取的华东逐日降雨量栅格数据，可用于洪涝预警。',
    format: 'NetCDF', resolution: '1km', coordinateSystem: 'WGS 84',
    bbox: [114.8, 23.5, 122.9, 38.3], updateTime: '2026-05-10', tags: ['气象', '降雨', '华东'],
    quality: q(88, 95, 82), lineage: lin('气象局接口', ['API数据拉取', '格式转换', '空间插值', '质量控制'], 'v1.0', '2026-05-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['river-crossing', 'mobility-planning'], scenarioTags: ['渡河保障', '机动路线规划', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-05-08', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 302, name: '淮河流域水文监测数据', ingestTime: '2026-04-25', timePhase: '2026Q1',
    range: '淮河流域', type: '气象水文', status: 'published', size: '180 MB', source: '水文站监测',
    description: '淮河流域 200+ 水文站点逐日流量、水位及水质指标数据集。',
    format: 'CSV + GeoJSON', resolution: '站点级', coordinateSystem: 'WGS 84',
    bbox: [111.9, 30.9, 121.0, 36.4], updateTime: '2026-04-25', tags: ['水文', '流量', '淮河'],
    quality: q(90, 92, 85), lineage: lin('淮河水文局', ['站点数据采集', '整编', '质量控制', '空间化'], 'v1.2', '2026-03-30'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'geo-analysis'], scenarioTags: ['渡河保障', '地形分析'],
    audit: { auditor: '王工', auditTime: '2026-04-22', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 303, name: '重点流域河网水系矢量', ingestTime: '2026-04-10', timePhase: '2025',
    range: '长江/黄河/淮河/海河', type: '气象水文', status: 'published', size: '560 MB', source: '水利部',
    description: '四大流域河网水系矢量数据，含河流中心线、水系等级、流速、河宽等属性。',
    format: 'GeoPackage', resolution: '1:50000', coordinateSystem: 'CGCS 2000',
    bbox: [96.0, 24.0, 135.0, 53.0], updateTime: '2026-04-10', tags: ['河网', '水系', '矢量', '四大流域'],
    quality: q(93, 88, 90), lineage: lin('水利部', ['基础水文数据', '矢量化', '属性赋值', '拓扑检查', '质量验证'], 'v2.0', '2025-12-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['river-crossing', 'geo-analysis', 'mobility-planning'], scenarioTags: ['渡河保障', '地形分析', '机动路线规划'],
    audit: { auditor: '李工', auditTime: '2026-04-08', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 304, name: '重点湖泊水库水位监测', ingestTime: '2026-05-05', timePhase: '2026Q2',
    range: '全国大型湖泊水库', type: '气象水文', status: 'published', size: '95 MB', source: '水利遥感',
    description: '全国 320+ 座大型湖泊水库实时水位、库容监测数据。',
    format: 'CSV + GeoJSON', resolution: '站点级', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-05-05', tags: ['湖泊', '水库', '水位', '库容'],
    quality: q(88, 92, 82), lineage: lin('水利遥感中心', ['卫星遥感', '水面面积反演', '水位站数据融合', '质量控制'], 'v1.1', '2026-04-20'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'geo-analysis'], scenarioTags: ['渡河保障', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-05-03', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 305, name: '逐时降雨预报产品', ingestTime: '2026-05-18', timePhase: '2026Q2',
    range: '华东地区', type: '气象水文', status: 'published', size: '1.2 GB', source: '气象局预报系统',
    description: '逐小时降雨预报栅格，预报时效 72h，3km 分辨率，适用于行动窗口期天气预判。',
    format: 'NetCDF', resolution: '3km', coordinateSystem: 'WGS 84',
    bbox: [114.8, 23.5, 122.9, 38.3], updateTime: '2026-05-18', tags: ['降雨预报', '逐时', '72h'],
    quality: q(80, 95, 75), lineage: lin('气象局预报系统', ['数值预报', '后处理', '空间降尺度', '格式输出'], 'v1.0', '2026-05-18'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['river-crossing', 'mobility-planning'], scenarioTags: ['渡河保障', '机动路线规划'],
    audit: { auditor: '王工', auditTime: '2026-05-17', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 306, name: '潮汐潮流预报数据', ingestTime: '2026-04-28', timePhase: '2026Q2',
    range: '东南沿海', type: '气象水文', status: 'draft', size: '420 MB', source: '海洋预报台',
    description: '东南沿海重点港口潮汐潮流预报数据，含潮位、流速、流向。',
    format: 'NetCDF', resolution: '站点级', coordinateSystem: 'WGS 84',
    bbox: [116.0, 21.0, 122.0, 28.0], updateTime: '2026-04-28', tags: ['潮汐', '潮流', '沿海'],
    quality: q(82, 90, 78), lineage: lin('海洋预报台', ['潮位站数据', '潮流模型', '预报输出', '质量控制'], 'v1.0', '2026-04-15'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['river-crossing'], scenarioTags: ['渡河保障'],
    audit: { auditor: '王工', auditTime: '2026-04-25', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 307, name: '土壤含水量遥感反演', ingestTime: '2026-05-02', timePhase: '2026Q1',
    range: '华北平原', type: '气象水文', status: 'published', size: '680 MB', source: '遥感反演',
    description: '微波遥感反演的华北平原土壤含水量数据，适用于工程地质评估与可通行性分析。',
    format: 'GeoTIFF', resolution: '25m', coordinateSystem: 'WGS 84',
    bbox: [113.0, 34.0, 120.0, 40.0], updateTime: '2026-05-02', tags: ['土壤含水量', '微波遥感', '可通行性'],
    quality: q(85, 82, 80), lineage: lin('微波遥感', ['SMOS数据', '反演算法', '空间降尺度', '质量控制'], 'v1.0', '2026-03-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['mobility-planning', 'river-crossing'], scenarioTags: ['机动路线规划', '渡河保障', '地形分析'],
    audit: { auditor: '张工', auditTime: '2026-04-30', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 5. 地下管网 (6 items) ═══════════════
  {
    id: 401, name: '某市综合地下管网矢量数据', ingestTime: '2026-05-08', timePhase: '2025Q3',
    range: '某市', type: '地下管网', status: 'published', size: '450 MB', source: '测绘院',
    description: '某市主城区供水、排水、燃气、热力四类地下管线矢量数据。',
    format: 'Shapefile', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-05-08', tags: ['矢量', '管网', '地下管线'],
    quality: q(90, 85, 88), lineage: lin('测绘院', ['管线探测', '数据采集', '属性录入', '拓扑检查', '入库'], 'v2.1', '2025-06-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-05-06', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 402, name: '某市供水管网', ingestTime: '2026-04-20', timePhase: '2025Q4',
    range: '某市', type: '地下管网', status: 'published', size: '120 MB', source: '自来水公司',
    description: '某市供水管网矢量数据，含主干管、支管、阀门井、水表井等。',
    format: 'GeoPackage', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-20', tags: ['供水', '管网', '阀门'],
    quality: q(92, 88, 90), lineage: lin('自来水公司', ['管线普查', '数据录入', '属性校验', '入库'], 'v1.5', '2025-10-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防'],
    audit: { auditor: '李工', auditTime: '2026-04-18', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 403, name: '某市燃气管网', ingestTime: '2026-04-20', timePhase: '2025Q4',
    range: '某市', type: '地下管网', status: 'published', size: '85 MB', source: '燃气公司',
    description: '某市燃气管网矢量数据，含高/中/低压管线、调压站、阀门井等。',
    format: 'GeoPackage', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-20', tags: ['燃气', '管网', '调压站'],
    quality: q(90, 85, 88), lineage: lin('燃气公司', ['管线探测', '数据采集', '属性录入', '入库'], 'v1.0', '2025-09-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防'],
    audit: { auditor: '李工', auditTime: '2026-04-18', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 404, name: '某市电力管线', ingestTime: '2026-04-15', timePhase: '2025Q3',
    range: '某市', type: '地下管网', status: 'published', size: '110 MB', source: '供电公司',
    description: '某市地下电力管线矢量数据，含电缆沟、电缆井、变电站等。',
    format: 'Shapefile', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-15', tags: ['电力', '管线', '电缆'],
    quality: q(88, 82, 85), lineage: lin('供电公司', ['管线探测', '数据采集', '属性校验', '入库'], 'v1.2', '2025-08-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防'],
    audit: { auditor: '李工', auditTime: '2026-04-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 405, name: '某市通信管线', ingestTime: '2026-04-15', timePhase: '2025Q3',
    range: '某市', type: '地下管网', status: 'draft', size: '95 MB', source: '通信运营商',
    description: '某市地下通信管线矢量数据，含光缆、管道、人井等。',
    format: 'Shapefile', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-15', tags: ['通信', '管线', '光缆'],
    quality: q(85, 80, 82), lineage: lin('通信运营商', ['管线探测', '数据采集', '属性录入'], 'v1.0', '2025-07-20'),
    standardizeStatus: std(), tileStatus: tile(false, []),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防'],
    audit: { auditor: '李工', auditTime: '2026-04-12', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 406, name: '某市排水管网（雨污分流）', ingestTime: '2026-04-25', timePhase: '2025Q4',
    range: '某市', type: '地下管网', status: 'published', size: '155 MB', source: '排水管理处',
    description: '某市雨污分流排水管网矢量数据，含雨水管、污水管、检查井、泵站等。',
    format: 'GeoPackage', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-25', tags: ['排水', '雨污分流', '泵站'],
    quality: q(90, 86, 88), lineage: lin('排水管理处', ['管线探测', '雨污分流普查', '数据录入', '质量检查', '入库'], 'v2.0', '2025-11-05'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis', 'river-crossing'], scenarioTags: ['城市攻防', '渡河保障'],
    audit: { auditor: '李工', auditTime: '2026-04-22', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 6. 矢量基础地理 (8 items) ═══════════════
  {
    id: 501, name: '1:500 地形图(DLG) — 某市主城区', ingestTime: '2026-04-15', timePhase: '2025',
    range: '某市主城区', type: '矢量基础', status: 'published', size: '1.8 GB', source: '测绘院',
    description: '某市主城区 1:500 数字线划图(DLG)，含等高线、房屋、道路、水系等地形要素。',
    format: 'DWG', resolution: '1:500', coordinateSystem: 'CGCS 2000',
    bbox: [117.8, 34.5, 118.3, 34.9], updateTime: '2026-04-15', tags: ['DLG', '地形图', '等高线', '1:500'],
    quality: q(95, 88, 92), lineage: lin('测绘院', ['外业测量', '内业编辑', '质量检查', '入库'], 'v2.0', '2025-06-10'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'DWG' },
    tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning', 'building-control'], scenarioTags: ['地形分析', '楼宇夺控', '城市攻防'],
    audit: { auditor: '赵工', auditTime: '2026-04-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 502, name: '城市建筑分布面状矢量', ingestTime: '2026-04-20', timePhase: '2025',
    range: '某省会城市', type: '矢量基础', status: 'published', size: '560 MB', source: '遥感提取+人工修正',
    description: '高分辨率遥感影像提取的城市建筑分布面状矢量，含层数、用途、面积等属性。',
    format: 'GeoJSON', resolution: '1:2000', coordinateSystem: 'CGCS 2000',
    bbox: [113.8, 34.5, 114.2, 34.9], updateTime: '2026-04-20', tags: ['建筑', '面状矢量', '城市'],
    quality: q(88, 82, 85), lineage: lin('遥感提取+人工修正', ['高分辨率影像', '语义分割', '矢量化', '人工修正', '属性赋值'], 'v1.5', '2025-12-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['building-control', 'geo-analysis', 'image-recognition'], scenarioTags: ['楼宇夺控', '城市攻防', '目标识别'],
    audit: { auditor: '张工', auditTime: '2026-04-18', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['建筑检测'], sampleCount: 15000, annotationComplete: 60, modelVersion: 'BuildingSeg-v2' }
  },
  {
    id: 503, name: '城市道路路网', ingestTime: '2026-03-25', timePhase: '2025',
    range: '全国地级以上城市', type: '矢量基础', status: 'published', size: '3.2 GB', source: 'OSM+测绘院',
    description: '全国城市道路路网矢量数据，含道路等级、车道数、限速、限高、限重等属性。',
    format: 'GeoPackage', resolution: '1:10000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-25', tags: ['道路', '路网', '限速', '限高'],
    quality: q(90, 85, 88), lineage: lin('OSM+测绘院', ['OSM数据下载', '测绘数据融合', '属性补全', '拓扑检查', '质量验证'], 'v3.0', '2026-01-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['mobility-planning', 'geo-analysis', 'planning'], scenarioTags: ['机动路线规划', '交通研判', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-03-22', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 504, name: '公路网络（含等级属性）', ingestTime: '2026-03-20', timePhase: '2025',
    range: '全国', type: '矢量基础', status: 'published', size: '2.8 GB', source: '交通运输部',
    description: '全国公路网络矢量数据，含高速、国道、省道、县道等级别及通行能力属性。',
    format: 'Shapefile', resolution: '1:50000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-20', tags: ['公路', '高速公路', '国道', '通行能力'],
    quality: q(92, 88, 90), lineage: lin('交通运输部', ['基础数据获取', '属性更新', '拓扑检查', '入库'], 'v2.5', '2025-12-01'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['mobility-planning', 'planning'], scenarioTags: ['机动路线规划', '交通研判'],
    audit: { auditor: '李工', auditTime: '2026-03-18', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 505, name: '铁路网矢量', ingestTime: '2026-03-15', timePhase: '2025',
    range: '全国', type: '矢量基础', status: 'published', size: '1.1 GB', source: '铁路总公司',
    description: '全国铁路网矢量数据，含高铁、普铁、城际铁路及设计时速等属性。',
    format: 'Shapefile', resolution: '1:50000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-15', tags: ['铁路', '高铁', '普铁'],
    quality: q(93, 88, 90), lineage: lin('铁路总公司', ['基础数据获取', '属性更新', '拓扑检查'], 'v2.0', '2025-11-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['mobility-planning', 'geo-analysis'], scenarioTags: ['机动路线规划', '交通研判', '态势感知'],
    audit: { auditor: '李工', auditTime: '2026-03-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 506, name: '桥梁分布矢量', ingestTime: '2026-04-05', timePhase: '2025',
    range: '全国主要公路', type: '矢量基础', status: 'published', size: '380 MB', source: '交通运输部',
    description: '全国主要公路桥梁分布矢量数据，含名称、类型、跨径、承载能力等属性。',
    format: 'GeoJSON', resolution: '1:10000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-04-05', tags: ['桥梁', '承载能力', '跨径', '渡河'],
    quality: q(90, 85, 88), lineage: lin('交通运输部', ['桥梁普查', '数据录入', '属性校验', '空间化'], 'v1.5', '2025-10-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['river-crossing', 'mobility-planning'], scenarioTags: ['渡河保障', '交通研判', '机动路线规划'],
    audit: { auditor: '王工', auditTime: '2026-04-03', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 507, name: '行政边界（省/市/区/县）', ingestTime: '2026-01-15', timePhase: '2025',
    range: '全国', type: '矢量基础', status: 'published', size: '220 MB', source: '民政部',
    description: '全国行政区划边界矢量数据（四级），附带行政区划代码、名称、面积等属性。',
    format: 'GeoJSON', resolution: '1:1000000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-01-15', tags: ['行政区划', '边界', '省市区县'],
    quality: q(98, 90, 95), lineage: lin('民政部', ['行政区划数据', '矢量化', '属性赋值', '年度更新'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['态势感知', '机动路线规划'],
    audit: { auditor: '张工', auditTime: '2026-01-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 508, name: '土地利用现状', ingestTime: '2026-03-30', timePhase: '2025',
    range: '全国', type: '矢量基础', status: 'published', size: '5.6 GB', source: '自然资源部',
    description: '全国土地利用现状矢量数据，含耕地、林地、草地、水域、建设用地等分类。',
    format: 'GeoPackage', resolution: '1:50000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-30', tags: ['土地利用', '分类', '耕地', '建设用地'],
    quality: q(94, 88, 92), lineage: lin('自然资源部', ['遥感解译', '野外验证', '矢量化', '属性赋值', '年度更新'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['地形分析', '态势感知', '机动路线规划'],
    audit: { auditor: '张工', auditTime: '2026-03-28', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 7. 地名地址与POI (6 items) ═══════════════
  {
    id: 601, name: '要地志数据库', ingestTime: '2026-04-10', timePhase: '2025',
    range: '全国重点区域', type: '地名地址', status: 'published', size: '120 MB', source: '军事测绘',
    description: '全国重点区域要地志数据库，含军事要地、战略要点的坐标、描述、历史战役记录等。',
    format: 'GeoJSON + 结构化文本', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-04-10', tags: ['要地志', '战略要点', '军事'],
    quality: q(85, 80, 82), lineage: lin('军事测绘', ['资料收集', '实地踏勘', '信息录入', '审核校验'], 'v1.0', '2025-09-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning', 'knowledge'], scenarioTags: ['态势感知', '城市攻防', '地形分析'],
    audit: { auditor: '王工', auditTime: '2026-04-08', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['NER实体识别', '意图理解'], sampleCount: 2000, annotationComplete: 40 }
  },
  {
    id: 602, name: '重要目标（机场/港口/枢纽）', ingestTime: '2026-04-05', timePhase: '2025',
    range: '全国', type: '地名地址', status: 'published', size: '85 MB', source: '多源融合',
    description: '全国重要目标 POI 数据集，含机场、港口、铁路枢纽、政府机关等关键目标。',
    format: 'GeoJSON', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-04-05', tags: ['POI', '机场', '港口', '枢纽'],
    quality: q(90, 85, 88), lineage: lin('多源融合', ['公开POI', '测绘数据', '军事资料', '融合去重', '属性补全'], 'v2.0', '2026-01-20'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning', 'planning'], scenarioTags: ['态势感知', '机动路线规划', '交通研判'],
    audit: { auditor: '张工', auditTime: '2026-04-03', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 603, name: '通信枢纽分布', ingestTime: '2026-03-28', timePhase: '2025',
    range: '全国', type: '地名地址', status: 'draft', size: '45 MB', source: '通信管理局',
    description: '全国通信枢纽 POI（数据中心、基站群、卫星地面站等），附带容量、覆盖范围等属性。',
    format: 'GeoJSON', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-28', tags: ['通信', '枢纽', '数据中心'],
    quality: q(82, 78, 80), lineage: lin('通信管理局', ['数据收集', '坐标赋值', '属性补全', '审核'], 'v1.0', '2025-12-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['城市攻防', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-03-25', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 604, name: '医疗设施分布', ingestTime: '2026-03-15', timePhase: '2025',
    range: '全国', type: '地名地址', status: 'published', size: '60 MB', source: '卫健委',
    description: '全国医疗机构 POI（三甲医院、急救中心、血站等），附带等级、床位数等属性。',
    format: 'GeoJSON', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-15', tags: ['医疗', '医院', '急救'],
    quality: q(92, 88, 90), lineage: lin('卫健委', ['医疗机构名录', '坐标赋值', '属性补全', '年度更新'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['态势感知', '城市攻防'],
    audit: { auditor: '张工', auditTime: '2026-03-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 605, name: '能源设施分布', ingestTime: '2026-03-20', timePhase: '2025',
    range: '全国', type: '地名地址', status: 'draft', size: '50 MB', source: '能源局',
    description: '全国能源设施 POI（电厂、加油站、LNG 接收站等），附带类型、容量等属性。',
    format: 'GeoJSON', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-20', tags: ['能源', '电厂', '加油站'],
    quality: q(85, 80, 82), lineage: lin('能源局', ['设施普查', '坐标赋值', '属性补全'], 'v1.0', '2025-11-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['态势感知', '城市攻防'],
    audit: { auditor: '张工', auditTime: '2026-03-18', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 606, name: '学校与公共设施', ingestTime: '2026-03-10', timePhase: '2025',
    range: '全国', type: '地名地址', status: 'published', size: '75 MB', source: '教育部+住建部',
    description: '全国学校、体育场馆、图书馆等公共设施 POI，附带类型、容纳人数等属性。',
    format: 'GeoJSON', resolution: '点位级', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-10', tags: ['学校', '体育场馆', '公共设施'],
    quality: q(90, 85, 88), lineage: lin('教育部+住建部', ['数据收集', '坐标赋值', '属性补全', '审核'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['态势感知', '城市攻防'],
    audit: { auditor: '张工', auditTime: '2026-03-08', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 8. 战场环境专题 (6 items) ═══════════════
  {
    id: 701, name: '多年平均气候资料', ingestTime: '2026-02-15', timePhase: '1991-2020',
    range: '全国', type: '战场专题', status: 'published', size: '850 MB', source: '气象局',
    description: '全国多年平均气候资料（温度、湿度、风速、能见度、降水），适用于战场气候评估。',
    format: 'NetCDF', resolution: '站点级', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-02-15', tags: ['气候', '温度', '湿度', '风速', '能见度'],
    quality: q(95, 88, 92), lineage: lin('气象局', ['站点数据收集', '质量控制', '空间插值', '气候态计算'], 'v2020', '2026-01-10'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['geo-analysis', 'river-crossing', 'mobility-planning'], scenarioTags: ['渡河保障', '地形分析', '态势感知'],
    audit: { auditor: '王工', auditTime: '2026-02-12', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 702, name: '地质与土壤类型', ingestTime: '2026-02-20', timePhase: '2025',
    range: '全国', type: '战场专题', status: 'published', size: '1.2 GB', source: '地质调查局',
    description: '全国地质与土壤类型矢量数据，含岩性、土壤类型、承载力等属性。',
    format: 'GeoPackage', resolution: '1:250000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-02-20', tags: ['地质', '土壤', '岩性', '承载力'],
    quality: q(90, 85, 88), lineage: lin('地质调查局', ['地质调查', '采样分析', '矢量化', '属性赋值', '年度更新'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['river-crossing', 'mobility-planning', 'geo-analysis'], scenarioTags: ['渡河保障', '机动路线规划', '地形分析'],
    audit: { auditor: '王工', auditTime: '2026-02-18', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 703, name: '电磁环境评估', ingestTime: '2026-03-10', timePhase: '2026Q1',
    range: '重点区域', type: '战场专题', status: 'draft', size: '320 MB', source: '电磁频谱管理',
    description: '重点区域电磁环境评估数据，含信号强度分布、频谱占用、干扰源位置等。',
    format: 'GeoTIFF', resolution: '100m', coordinateSystem: 'WGS 84',
    bbox: [110.0, 30.0, 112.0, 32.0], updateTime: '2026-03-10', tags: ['电磁', '频谱', '信号强度'],
    quality: q(78, 75, 72), lineage: lin('电磁频谱管理', ['频谱监测', '数据处理', '信号分析', '空间化'], 'v1.0', '2026-02-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS']),
    agentBinding: ['geo-analysis'], scenarioTags: ['态势感知', '城市攻防'],
    audit: { auditor: '王工', auditTime: '2026-03-08', status: 'pending' }, finetuneStatus: { used: false }
  },
  {
    id: 704, name: '人口密度栅格', ingestTime: '2026-01-20', timePhase: '2025',
    range: '全国', type: '战场专题', status: 'published', size: '450 MB', source: 'WorldPop+统计局',
    description: '基于 WorldPop 与统计局数据融合的全国 100m 分辨率人口密度栅格。',
    format: 'GeoTIFF', resolution: '100m', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-01-20', tags: ['人口密度', 'WorldPop', '城市'],
    quality: q(88, 82, 85), lineage: lin('WorldPop+统计局', ['WorldPop下载', '统计局数据融合', '空间化', '质量控制'], 'v2025', '2025-12-01'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['城市攻防', '态势感知'],
    audit: { auditor: '张工', auditTime: '2026-01-18', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 705, name: '植被覆盖度', ingestTime: '2026-03-05', timePhase: '2025',
    range: '全国', type: '战场专题', status: 'published', size: '680 MB', source: '遥感反演',
    description: 'MODIS/Landsat 遥感反演的全国植被覆盖度(FVC)栅格，适用于隐蔽性分析与通视计算。',
    format: 'GeoTIFF', resolution: '250m', coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-03-05', tags: ['植被', 'FVC', '隐蔽性', '通视分析'],
    quality: q(90, 85, 88), lineage: lin('遥感反演', ['MODIS/Landsat数据', 'NDVI计算', 'FVC反演', '年度合成'], 'v2025', '2025-12-15'),
    standardizeStatus: std(), tileStatus: tile(true, ['WMS', 'WMTS']),
    agentBinding: ['geo-analysis', 'mobility-planning'], scenarioTags: ['地形分析', '态势感知', '机动路线规划'],
    audit: { auditor: '张工', auditTime: '2026-03-03', status: 'approved' }, finetuneStatus: { used: false }
  },
  {
    id: 706, name: '地震断裂带分布', ingestTime: '2026-02-10', timePhase: '2025',
    range: '全国', type: '战场专题', status: 'published', size: '150 MB', source: '地震局',
    description: '全国主要活动断裂带矢量数据，含断裂带名称、活动性、历史地震记录等属性。',
    format: 'GeoJSON', resolution: '1:1000000', coordinateSystem: 'CGCS 2000',
    bbox: [73.5, 3.8, 135.1, 53.6], updateTime: '2026-02-10', tags: ['地震', '断裂带', '活动性'],
    quality: q(92, 88, 90), lineage: lin('地震局', ['地质调查', '历史地震整理', '矢量化', '属性赋值'], 'v2025', '2025-12-31'),
    standardizeStatus: std(), tileStatus: tile(true, ['WFS', 'WMS']),
    agentBinding: ['geo-analysis', 'river-crossing'], scenarioTags: ['地形分析', '渡河保障'],
    audit: { auditor: '王工', auditTime: '2026-02-08', status: 'approved' }, finetuneStatus: { used: false }
  },

  // ═══════════════ 9. 障碍物与目标识别 (6 items) ═══════════════
  {
    id: 801, name: '城市路障目标检测数据集', ingestTime: '2026-04-20', timePhase: '2025-2026',
    range: '模拟城市', type: '障碍物与目标', status: 'published', size: '2.5 GB', source: '标注团队',
    description: '城市路障目标检测标注数据集（路障、拒马、铁丝网等），COCO JSON 格式。',
    format: 'COCO JSON + JPEG', resolution: '0.1m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-20', tags: ['路障', '目标检测', 'COCO', '城市障碍物'],
    quality: q(90, 88, 85), lineage: lin('标注团队', ['图像采集', '标注', '审核', '格式转换(COCO)'], 'v2.0', '2026-03-10'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: 'VOC XML' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'geo-analysis'], scenarioTags: ['目标识别', '城市攻防', '交通研判'],
    audit: { auditor: '赵工', auditTime: '2026-04-18', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['目标检测'], sampleCount: 5000, annotationComplete: 100, modelVersion: 'YOLOv8-obstacle-v1' }
  },
  {
    id: 802, name: '地雷与爆炸物识别数据集', ingestTime: '2026-04-15', timePhase: '2025-2026',
    range: '模拟战场', type: '障碍物与目标', status: 'published', size: '1.8 GB', source: '标注团队',
    description: '地雷与爆炸物图像识别数据集，含反步兵地雷、反坦克地雷、IED 等标注。',
    format: 'COCO JSON + JPEG', resolution: '0.05m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-15', tags: ['地雷', '爆炸物', 'IED', '目标检测'],
    quality: q(88, 85, 82), lineage: lin('标注团队', ['图像采集', '标注', '审核', '格式转换(COCO)'], 'v1.5', '2026-02-20'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: 'VOC XML' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'mobility-planning'], scenarioTags: ['目标识别', '机动路线规划'],
    audit: { auditor: '赵工', auditTime: '2026-04-12', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['目标检测'], sampleCount: 3000, annotationComplete: 100, modelVersion: 'YOLOv8-mine-v1' }
  },
  {
    id: 803, name: '反坦克壕识别数据集', ingestTime: '2026-04-10', timePhase: '2025',
    range: '模拟战场', type: '障碍物与目标', status: 'published', size: '1.2 GB', source: '标注团队',
    description: '反坦克壕图像识别数据集，含不同角度、光照条件下的标注样本。',
    format: 'COCO JSON + JPEG', resolution: '0.08m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-10', tags: ['反坦克壕', '障碍物', '目标检测'],
    quality: q(85, 82, 80), lineage: lin('标注团队', ['图像采集', '标注', '审核', '格式转换(COCO)'], 'v1.0', '2026-01-15'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: 'VOC XML' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'mobility-planning'], scenarioTags: ['目标识别', '机动路线规划'],
    audit: { auditor: '赵工', auditTime: '2026-04-08', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['目标检测'], sampleCount: 2000, annotationComplete: 100, modelVersion: 'YOLOv8-trench-v1' }
  },
  {
    id: 804, name: '伪装网识别数据集', ingestTime: '2026-04-05', timePhase: '2025',
    range: '模拟战场', type: '障碍物与目标', status: 'draft', size: '950 MB', source: '标注团队',
    description: '伪装网图像识别数据集，含不同背景、角度下的伪装网标注样本。',
    format: 'COCO JSON + JPEG', resolution: '0.1m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-05', tags: ['伪装网', '隐蔽目标', '目标检测'],
    quality: q(80, 78, 75), lineage: lin('标注团队', ['图像采集', '标注', '审核'], 'v0.9', '2026-02-10'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: false },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition'], scenarioTags: ['目标识别', '态势感知'],
    audit: { auditor: '赵工', auditTime: '2026-04-03', status: 'pending', comments: '样本量不足，需扩充' },
    finetuneStatus: { used: false }
  },
  {
    id: 805, name: '桥梁受损识别标注数据', ingestTime: '2026-04-25', timePhase: '2025-2026',
    range: '模拟战场', type: '障碍物与目标', status: 'published', size: '1.5 GB', source: '标注团队+遥感',
    description: '桥梁受损识别标注数据，含完好/轻度/中度/严重/摧毁五级分类标注。',
    format: 'COCO JSON + JPEG', resolution: '0.2m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-25', tags: ['桥梁受损', '战损评估', '分类'],
    quality: q(88, 85, 82), lineage: lin('标注团队+遥感', ['遥感图像获取', '标注', '审核', '格式转换'], 'v1.0', '2026-03-15'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: 'VOC XML' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'river-crossing', 'mobility-planning'], scenarioTags: ['目标识别', '渡河保障', '交通研判'],
    audit: { auditor: '赵工', auditTime: '2026-04-22', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['图像分类', '目标检测'], sampleCount: 4000, annotationComplete: 100, modelVersion: 'BridgeDamage-v1' }
  },
  {
    id: 806, name: '防御工事识别数据集', ingestTime: '2026-04-18', timePhase: '2025',
    range: '模拟战场', type: '障碍物与目标', status: 'draft', size: '2.1 GB', source: '标注团队',
    description: '防御工事图像识别数据集，含碉堡、战壕、掩体、射击孔等目标标注。',
    format: 'COCO JSON + JPEG', resolution: '0.1m', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-04-18', tags: ['防御工事', '碉堡', '战壕', '掩体'],
    quality: q(82, 80, 78), lineage: lin('标注团队', ['图像采集', '标注', '审核', '格式转换'], 'v1.0', '2026-02-20'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: 'VOC XML' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'geo-analysis'], scenarioTags: ['目标识别', '城市攻防', '态势感知'],
    audit: { auditor: '赵工', auditTime: '2026-04-15', status: 'pending', comments: '部分类别标注需复核' },
    finetuneStatus: { used: true, taskTypes: ['目标检测'], sampleCount: 3500, annotationComplete: 80 }
  },

  // ═══════════════ 10. 多模态语料 (5 items) ═══════════════
  {
    id: 901, name: '情报报告文本语料', ingestTime: '2026-04-20', timePhase: '2024-2026',
    range: '通用', type: '多模态语料', status: 'published', size: '350 MB', source: '整编',
    description: '整编后的情报报告文本语料库，含态势报告、侦察报告、敌情通报等。',
    format: 'TXT + JSONL', resolution: 'N/A（文本）', coordinateSystem: 'N/A',
    updateTime: '2026-04-20', tags: ['情报', '报告', '文本', 'NER', '大模型微调'],
    quality: q(85, 82, 80), lineage: lin('整编', ['原始报告收集', '脱敏处理', '格式标准化', '分词标注'], 'v1.0', '2026-03-15'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['knowledge', 'geo-analysis'], scenarioTags: ['态势感知', '预案生成'],
    audit: { auditor: '王工', auditTime: '2026-04-18', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['NER实体识别', '文本分类', '意图理解'], sampleCount: 10000, annotationComplete: 60, modelVersion: 'GeoLLM-NER-v2' }
  },
  {
    id: 902, name: '军事命令与条令语料', ingestTime: '2026-04-15', timePhase: '2024-2026',
    range: '通用', type: '多模态语料', status: 'published', size: '280 MB', source: '整编',
    description: '军事命令、条令、条例文本语料库，含作战命令、行动指令、保障计划等。',
    format: 'TXT + JSONL', resolution: 'N/A（文本）', coordinateSystem: 'N/A',
    updateTime: '2026-04-15', tags: ['命令', '条令', '作战指令', '大模型微调'],
    quality: q(88, 85, 82), lineage: lin('整编', ['条令收集', '脱敏处理', '格式标准化', '分词标注'], 'v1.0', '2026-03-10'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['knowledge', 'geo-analysis'], scenarioTags: ['预案生成', '态势感知'],
    audit: { auditor: '王工', auditTime: '2026-04-12', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['意图理解', '指令解析'], sampleCount: 8000, annotationComplete: 55, modelVersion: 'GeoLLM-Cmd-v1' }
  },
  {
    id: 903, name: '要地志结构化文本', ingestTime: '2026-04-10', timePhase: '2024-2026',
    range: '通用', type: '多模态语料', status: 'published', size: '180 MB', source: '整编',
    description: '要地志结构化文本语料库，含地形要点、战略要地的结构化描述，适用于 RAG 检索增强生成。',
    format: 'JSONL', resolution: 'N/A（文本）', coordinateSystem: 'N/A',
    updateTime: '2026-04-10', tags: ['要地志', '结构化', '知识图谱', 'RAG'],
    quality: q(82, 80, 78), lineage: lin('整编', ['要地志资料收集', '结构化处理', '格式标准化', '质量审核'], 'v1.0', '2026-03-05'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: true, originalFormat: 'DOC' },
    tileStatus: tile(false, []),
    agentBinding: ['knowledge', 'geo-analysis'], scenarioTags: ['态势感知', '地形分析', '预案生成'],
    audit: { auditor: '王工', auditTime: '2026-04-08', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['RAG检索增强', '知识图谱'], sampleCount: 5000, annotationComplete: 45, modelVersion: 'GeoLLM-RAG-v1' }
  },
  {
    id: 904, name: '无人机航拍视频语料', ingestTime: '2026-04-25', timePhase: '2025-2026',
    range: '模拟战场', type: '多模态语料', status: 'draft', size: '15.6 GB', source: '无人机采集',
    description: '无人机航拍视频语料库，含城镇、道路、桥梁、河流等场景，适用于视频理解与目标跟踪。',
    format: 'MP4 + JSON标注', resolution: '1080p', coordinateSystem: 'N/A（视频）',
    updateTime: '2026-04-25', tags: ['无人机', '航拍', '视频', '目标跟踪'],
    quality: q(80, 78, 75), lineage: lin('无人机采集', ['航线规划', '视频采集', '关键帧提取', '标注'], 'v1.0', '2026-03-20'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: false, formatConverted: false },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'geo-analysis'], scenarioTags: ['目标识别', '态势感知'],
    audit: { auditor: '赵工', auditTime: '2026-04-22', status: 'pending', comments: '标注进度滞后' },
    finetuneStatus: { used: true, taskTypes: ['视频理解', '目标跟踪'], sampleCount: 500, annotationComplete: 30 }
  },
  {
    id: 905, name: '目标检测多源标注集', ingestTime: '2026-05-01', timePhase: '2025-2026',
    range: '多区域', type: '多模态语料', status: 'published', size: '8.2 GB', source: '多源融合',
    description: '多源目标检测标注数据集，融合卫星、航空、无人机多平台影像，含车辆、建筑、桥梁等多类别标注。',
    format: 'COCO JSON + JPEG/TIFF', resolution: '混合（0.05-2m）', coordinateSystem: 'N/A（图像坐标）',
    updateTime: '2026-05-01', tags: ['多源', '多平台', '目标检测', '多类别'],
    quality: q(88, 85, 82), lineage: lin('多源融合', ['多平台影像获取', '统一标注规范', '标注', '审核', '格式统一'], 'v2.0', '2026-04-10'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, schemaVersion: 'COCO 1.0', formatConverted: true, originalFormat: '混合' },
    tileStatus: tile(false, []),
    agentBinding: ['image-recognition', 'geo-analysis'], scenarioTags: ['目标识别', '态势感知', '城市攻防'],
    audit: { auditor: '赵工', auditTime: '2026-04-28', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['目标检测', '语义分割'], sampleCount: 20000, annotationComplete: 75, modelVersion: 'GeoDet-v3' }
  },

  // ═══════════════ 11. 历史方案整编 (5 items) ═══════════════
  {
    id: 1001, name: '某渡河工程保障方案（历史）', ingestTime: '2026-03-15', timePhase: '2024',
    range: '某流域', type: '历史方案', status: 'published', size: '25 MB', source: '整编',
    description: '历史渡河工程保障方案整编记录，含渡口选址、浮桥构筑、交通管制、风险评估等全流程。',
    format: 'JSON + DOCX + GeoJSON', resolution: 'N/A（方案文档）', coordinateSystem: 'CGCS 2000',
    bbox: [112.0, 31.0, 113.5, 32.5], updateTime: '2026-03-15', tags: ['渡河', '保障方案', '历史', '整编'],
    quality: q(88, 82, 85), lineage: lin('整编', ['原始方案收集', '结构化提取', '参数标准化', '空间化', '质量审核'], 'v1.0', '2026-02-20'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'knowledge'], scenarioTags: ['渡河保障', '预案生成'],
    audit: { auditor: '王工', auditTime: '2026-03-12', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['方案生成', '参数提取'], sampleCount: 200, annotationComplete: 100, modelVersion: 'GeoLLM-River-v1' }
  },
  {
    id: 1002, name: '某机动路线方案（历史）', ingestTime: '2026-03-10', timePhase: '2024',
    range: '某战区', type: '历史方案', status: 'published', size: '18 MB', source: '整编',
    description: '历史机动路线方案整编记录，含起终点、约束条件、候选路线、风险评估等结构化数据。',
    format: 'JSON + DOCX + GeoJSON', resolution: 'N/A（方案文档）', coordinateSystem: 'CGCS 2000',
    bbox: [110.0, 28.0, 115.0, 33.0], updateTime: '2026-03-10', tags: ['机动路线', '历史方案', '整编'],
    quality: q(85, 80, 82), lineage: lin('整编', ['原始方案收集', '结构化提取', '路线空间化', '参数标准化', '质量审核'], 'v1.0', '2026-02-15'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['mobility-planning', 'planning', 'knowledge'], scenarioTags: ['机动路线规划', '预案生成'],
    audit: { auditor: '张工', auditTime: '2026-03-08', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['路线生成', '约束推理'], sampleCount: 150, annotationComplete: 100, modelVersion: 'GeoLLM-Route-v1' }
  },
  {
    id: 1003, name: '某楼宇夺控方案（历史）', ingestTime: '2026-03-05', timePhase: '2024',
    range: '某城市', type: '历史方案', status: 'draft', size: '32 MB', source: '整编',
    description: '历史楼宇夺控方案整编记录，含建筑信息、兵力部署、进攻路线、火力配置等结构化数据。',
    format: 'JSON + DOCX + glTF', resolution: 'N/A（方案文档）', coordinateSystem: 'CGCS 2000',
    bbox: [116.1, 39.7, 116.5, 40.0], updateTime: '2026-03-05', tags: ['楼宇夺控', '历史方案', '整编'],
    quality: q(82, 78, 80), lineage: lin('整编', ['原始方案收集', '结构化提取', '三维模型关联', '参数标准化'], 'v1.0', '2026-02-10'),
    standardizeStatus: { coordinateTransformed: true, targetCRS: 'CGCS 2000', fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['building-control', 'knowledge'], scenarioTags: ['楼宇夺控', '城市攻防', '预案生成'],
    audit: { auditor: '赵工', auditTime: '2026-03-03', status: 'pending', comments: '部分参数待补充' },
    finetuneStatus: { used: true, taskTypes: ['方案生成', '态势推演'], sampleCount: 100, annotationComplete: 80 }
  },
  {
    id: 1004, name: '某行动预案模板库', ingestTime: '2026-02-28', timePhase: '2023-2025',
    range: '通用', type: '历史方案', status: 'published', size: '45 MB', source: '整编',
    description: '通用行动预案模板库，含渡河、机动、夺控、通信保障等多类型预案模板。',
    format: 'JSON + DOCX', resolution: 'N/A（模板文档）', coordinateSystem: 'N/A',
    updateTime: '2026-02-28', tags: ['预案', '模板', '通用', '整编'],
    quality: q(90, 85, 88), lineage: lin('整编', ['预案收集', '模板化处理', '结构化提取', '参数标准化', '质量审核'], 'v2.0', '2026-01-20'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: true, originalFormat: 'DOC' },
    tileStatus: tile(false, []),
    agentBinding: ['river-crossing', 'mobility-planning', 'building-control', 'knowledge'], scenarioTags: ['渡河保障', '机动路线规划', '楼宇夺控', '预案生成'],
    audit: { auditor: '王工', auditTime: '2026-02-25', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['方案生成', '模板匹配'], sampleCount: 500, annotationComplete: 100, modelVersion: 'GeoLLM-Plan-v2' }
  },
  {
    id: 1005, name: '某任务复盘分析报告', ingestTime: '2026-03-20', timePhase: '2024',
    range: '某战区', type: '历史方案', status: 'published', size: '15 MB', source: '整编',
    description: '历史任务复盘分析报告整编，含任务执行过程、关键节点、经验教训、改进建议等。',
    format: 'JSON + DOCX', resolution: 'N/A（报告文档）', coordinateSystem: 'N/A',
    updateTime: '2026-03-20', tags: ['复盘', '分析报告', '经验教训', '整编'],
    quality: q(85, 80, 82), lineage: lin('整编', ['原始报告收集', '结构化提取', '关键信息标注', '格式标准化'], 'v1.0', '2026-02-25'),
    standardizeStatus: { coordinateTransformed: false, fieldMapped: true, formatConverted: true, originalFormat: 'DOC/PDF' },
    tileStatus: tile(false, []),
    agentBinding: ['knowledge', 'geo-analysis'], scenarioTags: ['预案生成', '态势感知'],
    audit: { auditor: '王工', auditTime: '2026-03-18', status: 'approved' },
    finetuneStatus: { used: true, taskTypes: ['经验提取', '方案优化'], sampleCount: 300, annotationComplete: 100, modelVersion: 'GeoLLM-Lesson-v1' }
  }
];

// ────────────────────────────────────────────────────────────────
// type → category key 映射（用于分类树过滤）
// ────────────────────────────────────────────────────────────────
const TYPE_TO_CATEGORY: Record<string, string[]> = {
  '遥感影像': ['img', 'img-optical', 'img-sar', 'img-aerial', 'img-multi'],
  '数字高程': ['dem', 'dem-dem', 'dem-dsm', 'dem-derived'],
  '倾斜摄影': ['oblique', 'oblique-city', 'oblique-single', 'oblique-3dtiles'],
  '气象水文': ['hydro', 'hydro-rain', 'hydro-river', 'hydro-lake', 'hydro-station'],
  '地下管网': ['pipe', 'pipe-water', 'pipe-other', 'pipe-elec'],
  '矢量基础': ['vec', 'vec-dlg', 'vec-building', 'vec-traffic', 'vec-admin', 'vec-landuse'],
  '地名地址': ['poi', 'poi-strategic', 'poi-target', 'poi-facility'],
  '战场专题': ['battlefield', 'bf-climate', 'bf-geology', 'bf-em', 'bf-pop'],
  '障碍物与目标': ['obstacle', 'obs-urban', 'obs-traffic', 'obs-defense'],
  '多模态语料': ['corpus', 'corpus-text', 'corpus-image', 'corpus-media'],
  '历史方案': ['plan', 'plan-river', 'plan-route', 'plan-building']
};

// ────────────────────────────────────────────────────────────────
// tab → type 映射
// ────────────────────────────────────────────────────────────────
const TAB_TO_TYPE: Record<string, string[]> = {
  '遥感影像': ['遥感影像'],
  '数字高程': ['数字高程'],
  '倾斜摄影': ['倾斜摄影'],
  '气象水文': ['气象水文'],
  '地下管网': ['地下管网'],
  '矢量基础': ['矢量基础'],
  '地名地址': ['地名地址'],
  '战场专题': ['战场专题'],
  '障碍物与目标': ['障碍物与目标'],
  '多模态语料': ['多模态语料'],
  '历史方案': ['历史方案']
};

// ────────────────────────────────────────────────────────────────
// getFilteredData（扩展版，支持 Agent / 场景标签过滤）
// ────────────────────────────────────────────────────────────────
export function getFilteredData(
  type: string,
  category: string | null,
  search: string,
  agent?: string,
  scenario?: string
): CatalogItem[] {
  let filtered = [...catalogData];

  // Tab 过滤
  if (type && type !== '总览') {
    const types = TAB_TO_TYPE[type];
    if (types) {
      filtered = filtered.filter(item => types.includes(item.type));
    }
  }

  // 分类树过滤
  if (category) {
    filtered = filtered.filter(item => {
      const cats = TYPE_TO_CATEGORY[item.type];
      return cats ? cats.includes(category) : false;
    });
  }

  // Agent 过滤
  if (agent) {
    filtered = filtered.filter(item => item.agentBinding?.includes(agent as AgentKey));
  }

  // 场景标签过滤
  if (scenario) {
    filtered = filtered.filter(item => item.scenarioTags?.includes(scenario as ScenarioTag));
  }

  // 关键字搜索（扩展到标签、Agent、场景）
  if (search) {
    const keyword = search.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(keyword) ||
        item.range.toLowerCase().includes(keyword) ||
        item.source.toLowerCase().includes(keyword) ||
        item.tags?.some(t => t.toLowerCase().includes(keyword)) ||
        item.agentBinding?.some(a => agentLabelMap[a]?.toLowerCase().includes(keyword)) ||
        item.scenarioTags?.some(s => s.toLowerCase().includes(keyword))
    );
  }

  return filtered;
}
