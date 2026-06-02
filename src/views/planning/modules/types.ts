export type Coordinate = readonly [number, number];

// ──── 页面模式 ────
export type PlanningPageMode = 'route' | 'mission';

// ──── 路线 Key ────
export type PlanningRouteKey = 'route-a' | 'route-b' | 'route-c';

// ──── 方案 Key ────
export type PlanningPlanKey = 'plan-a' | 'plan-b' | 'plan-c' | 'plan-d';

// ──── 图层 Key ────
export type PlanningLayerKey = 'imagery' | 'selected-route' | 'candidate-route' | 'risk' | 'obstacle' | 'markers' | 'waypoints';

// ──── 工具 Key ────
export type PlanningToolKey =
  | 'task'
  | 'pick-start'
  | 'pick-end'
  | 'clear'
  | 'layers'
  | 'result'
  | 'reset'
  | 'zoom-in'
  | 'zoom-out'
  | 'shot';

export type PlanningInteractiveTool = 'browse' | 'pick-start' | 'pick-end';

// ──── 工具栏项 ────
export interface PlanningToolbarItem {
  key: PlanningToolKey;
  label: string;
  icon: string;
}

// ──── 图层项 ────
export interface PlanningLayerItem {
  key: PlanningLayerKey;
  label: string;
  description: string;
  visible: boolean;
}

// ──── 通用选项 ────
export interface PlanningOption {
  label: string;
  value: string;
}

// ──── 途经点 ────
export interface PlanningWaypoint {
  id: string;
  name: string;
  longitude: number | null;
  latitude: number | null;
  order: number;
}

// ──── 路线规划表单（原路线规划模式，保留兼容） ────
export interface PlanningTaskForm {
  taskName: string;
  startName: string;
  endName: string;
  startLongitude: number | null;
  startLatitude: number | null;
  endLongitude: number | null;
  endLatitude: number | null;
  routePreference: string;
  constraints: string[];
}

// ──── 机动方案表单（原，保留兼容） ────
export interface PlanningMissionForm {
  startName: string;
  startLongitude: number | null;
  startLatitude: number | null;
  endName: string;
  endLongitude: number | null;
  endLatitude: number | null;
  waypoints: PlanningWaypoint[];
  priorityCondition: string;
  roadTypePreferences: string[];
  terrainPreference: string;
  avoidanceConditions: string[];
  vehicleType: string;
  vehicleCount: number;
  formationType: string;
}

// ──── 机动规划设置表单（新 - Tab1 左侧面板） ────
export interface PlanningRouteSettingsForm {
  startName: string;
  startLongitude: number | null;
  startLatitude: number | null;
  waypointName: string;
  endName: string;
  endLongitude: number | null;
  endLatitude: number | null;
  // 规划偏好
  routePreference: string;
  timeWeight: number;
  distanceWeight: number;
  riskWeight: number;
  // 推进区域
  advanceAreas: string[];
  // 道路与通行条件
  roadGrade: string;
  difficultyLevels: string[];
  // 任务车辆编组信息
  taskType: string;
  fleetScale: string;
  vehicleModel: string;
  arrivalDeadline: string;
}

// ──── 机动保障设置表单（新 - Tab2 左侧面板） ────
export interface PlanningSupportSettingsForm {
  // 机动任务信息
  missionName: string;
  missionCause: string;
  missionDesc: string;
  personnelCount: number;
  vehicleCount: number;
  deadline: string;
  // 车辆与油料信息
  vehicleType: string;
  avgFuelConsumption: number;
  fuelType: string;
  fuelAmount: number;
  // 保障需求
  supportLevel: number;
  needRepair: boolean;
  needRushRepair: boolean;
  otherNeeds: string;
  // 时间与约束
  departTime: string;
  arriveTime: string;
  durationLimit: string;
  constraints: string[];
}

// ──── 机动规划方案卡片（新 - Tab1 底部） ────
export interface PlanningRouteResultCard {
  key: string;
  title: string;
  subtitle: string;
  tag: string;
  tagType: 'success' | 'info' | 'warning';
  score: number;
  duration: string;
  distance: string;
  highlights: string[];
  mainPath: string;
  isRecommended: boolean;
}

// ──── 机动保障方案卡片（新 - Tab2 底部） ────
export interface PlanningSupportResultCard {
  key: string;
  title: string;
  subtitle: string;
  rating: number;
  score: number;
  duration: string;
  distance: string;
  tag: string;
  tagType: 'success' | 'info' | 'warning' | 'error';
  highlights: string[];
  isRecommended: boolean;
}

// ──── AI对话消息 ────
export interface PlanningChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

// ──── 路线摘要指标 ────
export interface PlanningRouteMetric {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'error';
}

// ──── 风险项 ────
export interface PlanningRiskItem {
  title: string;
  detail: string;
}

// ──── 路线摘要（路线规划模式） ────
export interface PlanningRouteSummary {
  key: PlanningRouteKey;
  label: string;
  title: string;
  subtitle: string;
  summary: string;
  metrics: readonly PlanningRouteMetric[];
  highlights: readonly string[];
  risks: readonly PlanningRiskItem[];
}

// ──── 方案结果指标 ────
export interface PlanningPlanMetric {
  label: string;
  value: string;
  unit: string;
}

// ──── 方案卡片数据 ────
export interface PlanningPlanResult {
  key: PlanningPlanKey;
  label: string;
  tag: string;
  tagType: 'success' | 'info' | 'warning';
  score: number;
  metrics: readonly PlanningPlanMetric[];
  routeDescription: string;
  mainRoads: string;
  isRecommended: boolean;
}

// ──── 分析步骤状态 ────
export type PlanningStepStatus = 'completed' | 'running' | 'pending';

// ──── 分析步骤 ────
export interface PlanningAnalysisStep {
  id: string;
  label: string;
  icon: string;
  status: PlanningStepStatus;
}

// ──── 路段详情 ────
export interface PlanningRouteSegment {
  id: string;
  index: number;
  section: string;
  roadName: string;
  distance: number;
  duration: string;
  roadCondition: string;
}

// ──── 方案结果汇总 ────
export interface PlanningMissionResultSummary {
  totalPlans: number;
  bestPlan: string;
  bestScore: number;
}

// ──── 状态信息 ────
export interface PlanningStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
  activeTool: string;
  currentRoute: string;
  planningState: string;
}

// ──── 地图覆盖物 ────
export interface PlanningLineOverlay {
  id: string;
  name: string;
  color: string;
  positions: readonly Coordinate[];
  width?: number;
}

export interface PlanningPolygonOverlay {
  id: string;
  name: string;
  color: string;
  positions: readonly Coordinate[];
}

export interface PlanningPointOverlay {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  color: string;
}

export interface PlanningRouteScene {
  route: PlanningLineOverlay;
  risks: readonly PlanningPolygonOverlay[];
  obstacles: readonly PlanningPointOverlay[];
}

export interface PlanningPickedPoint {
  type: 'start' | 'end';
  longitude: number;
  latitude: number;
}

export interface PlanningPreset {
  longitude: number;
  latitude: number;
  height: number;
}
