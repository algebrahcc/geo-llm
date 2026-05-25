export type BuildingTaskStatus = '进行中' | '待命' | '已完成';
export type BuildingRiskLevel = 'high' | 'medium' | 'low';
export type BuildingForceTone = 'info' | 'success' | 'warning';
export type BuildingTilesetSourceType = 'local' | 'remote';

export interface BuildingTilesetTransform {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
}

export interface BuildingTilesetSource {
  key: string;
  label: string;
  sourceType: BuildingTilesetSourceType;
  tilesetUrl: string;
  description: string;
  location: string;
  statusText: string;
  transform: BuildingTilesetTransform;
  maximumScreenSpaceError?: number;
}

export interface BuildingFeatureBinding {
  featureId: string;
  floorId: string;
  roomId?: string;
  label: string;
}

export interface BuildingTask {
  id: string;
  code: string;
  title: string;
  status: BuildingTaskStatus;
  buildingName: string;
  operator: string;
  updatedAt: string;
  objective: string;
  summary: string;
  floorCount: number;
  riskCount: number;
  materialCount: number;
  sourceKey: string;
}

export interface BuildingForceCard {
  id: string;
  label: string;
  value: string;
  description: string;
  icon: string;
  tone: BuildingForceTone;
}

export interface BuildingEnvironmentItem {
  id: string;
  label: string;
  description: string;
  level: BuildingRiskLevel;
  icon: string;
}

export interface BuildingFloor {
  id: string;
  label: string;
  summary: string;
  roomIds: string[];
}

export interface BuildingRoom {
  id: string;
  floorId: string;
  name: string;
  useType: string;
  summary: string;
  riskLevel: BuildingRiskLevel;
  featureId?: string;
}

export interface BuildingRoamPoint {
  id: string;
  routeId: string;
  title: string;
  description: string;
  roomId?: string;
  duration: string;
}

export interface BuildingRoamRoute {
  id: string;
  name: string;
  summary: string;
  pointIds: string[];
}

export interface BuildingMaterial {
  id: string;
  title: string;
  roomId?: string;
  pointId?: string;
  summary: string;
  createdAt: string;
  imageUrl?: string;
}

export interface BuildingTilesetLoadState {
  sourceKey: string;
  sourceLabel: string;
  loading: boolean;
  loaded: boolean;
  error: string;
}
