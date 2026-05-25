export type Coordinate = readonly [number, number];

export type PlanningRouteKey = 'route-a' | 'route-b' | 'route-c';

export type PlanningLayerKey = 'imagery' | 'selected-route' | 'candidate-route' | 'risk' | 'obstacle' | 'markers';

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

export interface PlanningToolbarItem {
  key: PlanningToolKey;
  label: string;
  icon: string;
}

export interface PlanningLayerItem {
  key: PlanningLayerKey;
  label: string;
  description: string;
  visible: boolean;
}

export interface PlanningOption {
  label: string;
  value: string;
}

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

export interface PlanningRouteMetric {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'error';
}

export interface PlanningRiskItem {
  title: string;
  detail: string;
}

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

export interface PlanningStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
  activeTool: string;
  currentRoute: string;
  planningState: string;
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
