import type { Coordinate } from '@/typings/cesium';

export type RiverPlanKey = 'plan-a' | 'plan-b' | 'plan-c';

/** 底图 key，兼容原有逻辑 */
export type RiverLayerKey = 'imagery';

export type RiverInteractiveTool = 'browse' | 'annotate';

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

/** 军事符号点：square=渡场/作业点，circle=登陆/接引点，triangle=观察哨，label=纯文字注记（如河幅） */
export type RiverPointSymbol = 'square' | 'circle' | 'triangle' | 'label';

export interface RiverPointOverlay {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  color: string;
  symbol?: RiverPointSymbol;
}

// ─────────────────── 渡河工程保障类型 ───────────────────

/** 左侧设置表单 */
export interface CrossingSettingForm {
  taskName: string;
  location: string;
  taskType: string;
  actionTime: string;
  forceScale: string;
  riverWidth: number;
  waterDepthRange: string;
  flowVelocity: string;
  riverbedTerrain: string;
  weatherCondition: string;
  visibilityKm: number;
  strategicIntent: string;
  availableResources: string[];
  timeConstraint: string;
  otherRequirements: string;
}

/** 可用资源属性项（长度/宽度/高度等规格） */
export interface CrossingResourceAttr {
  label: string;
  value: string;
}

/** 可用资源规格信息（方案助手面板展示，并作为渡河计算输入） */
export interface CrossingResourceSpec {
  /** 资源名称，与表单 availableResources 的值一致 */
  name: string;
  /** 型号/类别 */
  model: string;
  icon: string;
  /** 编制/预设数量（用于运力计算） */
  count: number;
  attrs: CrossingResourceAttr[];
}

/** AI 分析步骤 */
export interface AiAnalysisStep {
  key: string;
  label: string;
  status: 'waiting' | 'running' | 'success';
  description?: string;
  tool?: string;
  /** 步骤实际耗时（分析完成后回填，如 "4.8s"） */
  duration?: string;
}

/** 对话消息 */
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: number;
  /** 是否正在流式输出（后端 SSE 实时补全时置为 true） */
  streaming?: boolean;
}

/** 知识库检索结果面板展示项 */
export interface KnowledgeHitDisplay {
  documentName: string;
  documentCategory: string;
  documentFormat: string;
  matchCount: number;
  topSnippets: Array<{
    chunkTitle: string;
    snippet: string;
    score: number;
  }>;
}

/** 底部方案卡片 */
export interface CrossingPlanCard {
  rank: number;
  key: RiverPlanKey;
  label: string;
  title: string;
  isRecommended: boolean;
  stars: number;
  duration: string;
  capacity: string;
  safety: string;
  scenario: string;
  routeDesc: string;
  keyEquipment: string[];
  advantages: string[];
  risks: string[];
  conditions: string[];
}

/** 已淘汰方式的路线数据（供地图渲染与结果栏展示） */
export interface RejectedRouteData {
  id: string;
  name: string;
  icon: string;
  reason: string;
  detail: string[];
  color: string;
  /** 路线坐标 [[lon, lat], ...] */
  positions: readonly (readonly [number, number])[];
  /** 渡场点 */
  mark?: { longitude: number; latitude: number };
}
