export type Coordinate = readonly [number, number];

// ──── 页面模式 ────
export type PlanningPageMode = 'route' | 'mission';

// ──── 路线 Key ────
export type PlanningRouteKey = 'route-a' | 'route-b' | 'route-c';

// ──── 方案 Key ────
export type PlanningPlanKey = 'plan-a' | 'plan-b' | 'plan-c' | 'plan-d';

// ──── 图层 Key ────
export type PlanningLayerKey = 'imagery' | 'selected-route' | 'candidate-route' | 'risk' | 'obstacle' | 'markers' | 'waypoints';

export type PlanningInteractiveTool = 'browse' | 'pick-start' | 'pick-end';

// ──── 图层项 ────
export interface PlanningLayerItem {
  key: PlanningLayerKey;
  label: string;
  icon: string;
  visible: boolean;
  description?: string;
}

// ──── 路线规划点 ────
export interface PlanningPickedPoint {
  type: 'start' | 'end';
  longitude: number;
  latitude: number;
}

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

export interface PlanningWaypoint {
  id: string;
  name: string;
  longitude: number | null;
  latitude: number | null;
}

// ──── 途经点（含序号，用于机动任务） ────
export interface PlanningMissionWaypoint extends PlanningWaypoint {
  order: number;
}

// ──── 路线路段 ────
export interface PlanningRouteSegment {
  id: string;
  index: number;
  section: string;
  roadName: string;
  distance: number;
  duration: string;
  roadCondition: string;
}

// ──── 路线场景 ────
export interface PlanningRouteScene {
  route: PlanningLineOverlay;
  risks: PlanningPolygonOverlay[];
  obstacles: PlanningPointOverlay[];
}

// ──── 路线摘要 ────
export interface PlanningRouteSummary {
  key: string;
  label: string;
  title: string;
  subtitle: string;
  summary: string;
  metrics: Array<{ label: string; value: string; tone: string }>;
  highlights: string[];
  risks: Array<{ title: string; detail: string }>;
}

// ──── 视角预设 ────
export interface PlanningPreset {
  longitude: number;
  latitude: number;
  height: number;
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

// ──── 对话消息 ────
export interface PlanningChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

// ──── 分析步骤 ────
export interface PlanningAnalysisStep {
  id: string;
  label: string;
  icon: string;
  status: 'pending' | 'running' | 'completed';
}

// ──── 路线设置表单 ────
export interface PlanningRouteSettingsForm {
  taskName: string;
  startName: string;
  startLongitude: number;
  startLatitude: number;
  endName: string;
  endLongitude: number;
  endLatitude: number;
  waypoints: Array<{ id: string; name: string; longitude: number; latitude: number }>;
  routePreference: string;
  forceScale: string;
  advanceArea: string;
  roadGrades: string[];
  vehicleFormation: string;
  waypointName?: string;
  timeWeight?: number;
  distanceWeight?: number;
  riskWeight?: number;
  advanceAreas?: string[];
  roadGrade?: string;
  difficultyLevels?: string[];
  taskType?: string;
  fleetScale?: string;
  vehicleModel?: string;
  arrivalDeadline?: string;
  missionName?: string;
}

// ──── 保障设置表单 ────
export interface PlanningSupportSettingsForm {
  taskName: string;
  supportType: string;
  forceScale: string;
  totalPersonnel: number;
  totalVehicles: number;
  fuelType: string;
  fuelConsumption: string;
  fuelReserveDays: number;
  plannedRoute: string;
  supportRequirement: string;
  timeConstraint?: string;
  departTime?: string;
  arriveTime?: string;
  durationLimit?: string;
  constraints?: string[];
  avgFuelConsumption?: number;
  fuelAmount?: number;
  supportLevel?: string | number;
  needRepair?: boolean;
  needRushRepair?: boolean;
  otherNeeds?: string;
  missionCause?: string;
  missionDesc?: string;
  personnelCount?: number;
  vehicleCount?: number;
  deadline?: string;
  vehicleType?: string;
  missionName?: string;
}

// ──── 路线结果卡片 ────
export interface PlanningRouteResultCard {
  key: string;
  title: string;
  subtitle: string;
  tag: string;
  tagType: 'success' | 'info' | 'warning';
  isRecommended: boolean;
  duration: string;
  distance: string;
  score: number;
  highlights: string[];
  mainPath?: string;
}

// ──── 保障结果卡片 ────
export interface PlanningSupportResultCard {
  key: string;
  title: string;
  subtitle: string;
  tag: string;
  tagType: 'success' | 'info' | 'warning' | 'error';
  isRecommended: boolean;
  rating: number;
  score: number;
  duration: string;
  distance: string;
  highlights: string[];
}

// ──── 任务表单 ────
export interface PlanningTaskForm {
  taskName: string;
  description: string;
  startName: string;
  startLongitude: number | null;
  startLatitude: number | null;
  endName: string;
  endLongitude: number | null;
  endLatitude: number | null;
  waypoints: PlanningWaypoint[];
  routePreference: string;
  constraints: string[];
}

// ──── 机动任务表单 ────
export interface PlanningMissionForm {
  startName: string;
  startLongitude: number | null;
  startLatitude: number | null;
  endName: string;
  endLongitude: number | null;
  endLatitude: number | null;
  waypoints: PlanningMissionWaypoint[];
  priorityCondition: string;
  roadTypePreferences: string[];
  terrainPreference: string;
  avoidanceConditions: string[];
  vehicleType: string;
  vehicleCount: number;
  formationType: string;
}

// ──── 机动任务结果汇总 ────
export interface PlanningMissionResultSummary {
  totalPlans: number;
  bestPlan: string;
  bestScore: number;
}

// ──── 方案结果项 ────
export interface PlanningPlanResult {
  key: string;
  label: string;
  description?: string;
  score: number;
  tag?: string;
  tagType?: 'success' | 'info' | 'warning' | 'error';
  metrics?: Array<{ label: string; value: string; unit?: string }>;
  routeDescription?: string;
  mainRoads?: string;
  isRecommended?: boolean;
}

// ──── 方案选项 ────
export interface PlanningOption {
  key?: string;
  label: string;
  icon?: string;
  value?: string;
  disabled?: boolean;
}
