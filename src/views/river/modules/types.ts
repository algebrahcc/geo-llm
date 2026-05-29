export type Coordinate = readonly [number, number];

export type RiverPlanKey = 'plan-a' | 'plan-b' | 'plan-c';

export type RiverLayerKey = 'imagery' | 'channel' | 'assembly' | 'risk' | 'mark' | 'route';

export type RiverToolKey =
  | 'task'
  | 'analysis'
  | 'annotate'
  | 'locate'
  | 'layers'
  | 'reset'
  | 'pitch'
  | 'rotate'
  | 'zoom-in'
  | 'zoom-out';

export type RiverInteractiveTool = 'browse' | 'annotate';

/** 页面模式：渡河工程方案(智能筛选) | 渡河资源评估 */
export type RiverPageMode = 'filter' | 'evaluate';

// ─────────────────── 旧版保留类型 ───────────────────

export interface RiverToolbarItem {
  key: RiverToolKey;
  label: string;
  icon: string;
}

export interface RiverLayerItem {
  key: RiverLayerKey;
  label: string;
  description: string;
  visible: boolean;
}

export interface RiverTaskForm {
  taskName: string;
  taskType: string;
  taskRange: string;
  troopScale: string;
  vehicleCount: string;
  mainEquipment: string;
  timeRequirement: string;
}

export interface RiverFlowStep {
  key: string;
  label: string;
  description: string;
  status: 'waiting' | 'running' | 'success';
}

export interface RiverPlanMetric {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'error';
}

export interface RiverRiskItem {
  title: string;
  detail: string;
}

export interface RiverMaterialItem {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface RiverPlanSummary {
  key: RiverPlanKey;
  label: string;
  title: string;
  summary: string;
  metrics: readonly RiverPlanMetric[];
  actions: readonly string[];
  risks: readonly RiverRiskItem[];
  materials: readonly RiverMaterialItem[];
}

export interface RiverStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
  activeTool: string;
  currentPlan: string;
}

export interface RiverLineOverlay {
  id: string;
  name: string;
  color: string;
  positions: readonly Coordinate[];
  width?: number;
}

export interface RiverPolygonOverlay {
  id: string;
  name: string;
  color: string;
  positions: readonly Coordinate[];
}

export interface RiverPointOverlay {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  color: string;
}

// ─────────────────── 渡河资源评估模式类型 ───────────────────

/** 推荐等级 */
export type PortGrade = '推荐' | '较优' | '一般' | '不推荐';

/** 渡口类型 */
export type PortType = '天然渡口' | '可建设渡口' | '不推荐渡口';

/** 渡口评估项 */
export interface PortAssessment {
  id: string;
  name: string;
  type: PortType;
  grade: PortGrade;
  score: number;
  passAbility: number;
  concealment: number;
  protection: number;
  terrain: number;
  logistics: number;
  longitude: number;
  latitude: number;
}

/** 评估指标权重 */
export interface EvaluateWeights {
  passAbility: number;
  concealment: number;
  protection: number;
  terrain: number;
  logistics: number;
}

/** 资源类型枚举 */
export type ResourceCategory =
  | '天然渡口'
  | '可建设渡口'
  | '工程装备'
  | '舟桥器材'
  | '浮游器材'
  | '冲击舟'
  | '运输车辆'
  | '岸滩';

/** 关键资源统计项 */
export interface ResourceStatItem {
  category: string;
  count: number;
  unit: string;
  icon: string;
}

/** 评估条件表单 */
export interface EvaluateForm {
  region: string;
  riverSection: string;
  evaluateTime: number;
  taskCapacity: string;
  taskDays: number;
  vehicleCount: number;
  weights: EvaluateWeights;
  resourceTypes: ResourceCategory[];
}

// ─────────────────── 智能筛选模式类型 ───────────────────

/** 筛选条件表单 */
export interface FilterForm {
  taskName: string;
  taskType: string;
  expectedTime: string;
  duration: string;
  vehicleType: string;
  direction: string;
  priority: string;
  depthRadius: number;
  velocityRange: number;
  widthMin: number;
  widthMax: number;
  bankSlope: number;
  bankGeomorphology: string[];
  availableResource: string;
  avoidFloodArea: boolean;
  otherRequirements: string;
}

/** 候选港口筛选结果 */
export interface PortFilterResult {
  id: string;
  name: string;
  score: number;
  depth: number;
  width: number;
  velocity: number;
  feasibility: '可行' | '较优' | '一般' | '不可行';
  longitude: number;
  latitude: number;
}

/** 筛选步骤状态 */
export type FilterStepStatus = 'success' | 'running' | 'waiting';

/** 筛选步骤 */
export interface FilterStep {
  key: string;
  label: string;
  status: FilterStepStatus;
}

/** 工程方案卡片 */
export interface EngineeringPlan {
  rank: number;
  label: string;
  isRecommended: boolean;
  portName: string;
  engineeringType: string;
  equipmentType: string;
  requiredTime: string;
  estimatedTime: string;
  equipmentList: string;
  supportAbility: string;
  concealment: string;
  score: number;
}

// ─────────────────── 融合数据类型 ───────────────────

/** 河水信息 */
export interface RiverWaterInfo {
  flowRate: string;
  avgVelocity: string;
  bankWaterLevel: string;
}

/** 地形地貌 */
export interface TerrainInfo {
  terrainType: string;
  slopeRange: string;
  vegetationCoverage: string;
}

/** 遥感影像 */
export interface RemoteSensingInfo {
  latestImage: string;
  resolution: string;
  intelligenceLevel: string;
}

/** 文本情报 */
export interface TextIntelInfo {
  reportCount: number;
  intelligenceLevel: string;
}

/** 融合数据概要 */
export interface FusionDataSummary {
  waterInfo: RiverWaterInfo;
  terrainInfo: TerrainInfo;
  remoteSensing: RemoteSensingInfo;
  textIntel: TextIntelInfo;
}
