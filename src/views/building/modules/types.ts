export type BuildingTaskStatus = '进行中' | '待命' | '已完成';
export type BuildingRiskLevel = 'high' | 'medium' | 'low';
export type BuildingForceTone = 'info' | 'success' | 'warning';

// ──── 建筑详细信息 ────
export interface BuildingDetailInfo {
  name: string;
  buildingType: string;
  area: number; // m²
  aboveGroundFloors: number;
  belowGroundFloors: number;
  totalArea: number; // m²
  structureType: string;
  builtYear: number;
  usageStatus: string;
  remarks: string;
}

// ──── 入口信息 ────
export interface BuildingEntrance {
  id: string;
  name: string;
  type: string;
  orientation: string;
  width: number; // m
  height: number; // m
  doorType: string;
  protectionLevel: string;
  suspiciousFeatures: string;
  imageUrl?: string;
  isPrimary: boolean;
}

// ──── BIM楼层 ────
export interface BuildingBIMFloor {
  id: string;
  label: string;
  floorNumber: number;
  color: string; // 图例颜色
}

export const BIMLegendItems = [
  { key: 'stair', label: '楼梯间', color: '#2ee59d' },
  { key: 'elevator', label: '电梯井', color: '#5ea4ff' },
  { key: 'corridor', label: '走廊', color: '#ffcf5c' },
  { key: 'room', label: '房间', color: '#e8e8e8' },
  { key: 'bathroom', label: '卫生间', color: '#fb7185' },
  { key: 'equipment', label: '设备间', color: '#f97316' }
] as const;

export type BIMLegendKey = (typeof BIMLegendItems)[number]['key'];

// ──── 环境信息项（扩展版）────
export interface BuildingEnvironmentItem {
  id: string;
  label: string;
  value: string;
  icon: string;
  level?: BuildingRiskLevel;
  description?: string;
}

// ──── 街景漫游点 (重构版) ────
export interface BuildingRoamPoint {
  id: string;
  title: string;
  entranceInfo: string;
  distance: string;
  imageUrl: string;
  longitude: number;
  latitude: number;
  routeId?: string;
  description?: string;
  duration?: string;
}

// ──── GLB 模型源（替代3D Tiles）────
export interface BuildingModelSource {
  key: string;
  label: string;
  modelUrl: string;
  description: string;
  location: string;
  transform: {
    longitude: number;
    latitude: number;
    height: number;
    heading: number;
    pitch: number;
    roll: number;
    scale: number;
  };
}

export interface BuildingModelLoadState {
  sourceKey: string;
  sourceLabel: string;
  loading: boolean;
  loaded: boolean;
  error: string;
}

// ──── 保留原有类型 ────
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
