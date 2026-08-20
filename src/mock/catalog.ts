// ────────────────────────────────────────────────────────────────
// Geo-LLM 数据目录 - 元数据扩展类型定义
// ────────────────────────────────────────────────────────────────
// 说明：
//   数据目录模块已真实化（对接后端 /service/catalog/**）。
//   原 mock 的列表数据(catalogData)、分类树(catalogCategories)等已转为 SQL 入库，
//   本文件仅保留前端仍依赖的类型定义与智能体标签映射（agent 绑定本期不进表）。
//   分析弹窗的 getMockGeoJSON 定义在 views/catalog/index.vue 内，不在本文件。

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
// CatalogItem (主接口 — 向后兼容原有字段 + 真实后端适配字段)
// ────────────────────────────────────────────────────────────────
export interface CatalogItem {
  id: string;
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
  /* ─── 真实后端适配字段（fetchCatalogPage 映射而来，雪花 ID 为字符串）─── */
  categoryId?: string;
  typeId?: string;
  /* ─── 扩展字段（保留类型以兼容详情/分析展示，后端暂不返回）─── */
  quality?: DataQuality;
  lineage?: Lineage;
  standardizeStatus?: StandardizeStatus;
  tileStatus?: TileStatus;
  agentBinding?: AgentKey[];
  scenarioTags?: ScenarioTag[];
  audit?: AuditStatus;
  finetuneStatus?: FinetuneStatus;
}
