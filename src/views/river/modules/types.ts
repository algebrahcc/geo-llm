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
