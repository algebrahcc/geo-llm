export type Coordinate = readonly [number, number];

export type RiverPlanKey = 'plan-a' | 'plan-b' | 'plan-c';

export type RiverLayerKey = 'imagery' | 'channel' | 'assembly' | 'risk' | 'mark' | 'route';

export type RiverInteractiveTool = 'browse' | 'annotate';

export interface RiverLayerItem {
  key: RiverLayerKey;
  label: string;
  description: string;
  visible: boolean;
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

// ─────────────────── 渡河保障方案类型 ───────────────────

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

/** AI 分析步骤 */
export interface AiAnalysisStep {
  key: string;
  label: string;
  status: 'waiting' | 'running' | 'success';
  description?: string;
  tool?: string;
}

/** 对话消息 */
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: number;
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
