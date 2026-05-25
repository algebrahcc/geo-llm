export type BuildingStageLayerKey = 'imagery' | 'tileset' | 'rooms' | 'route-points';

export type BuildingStageToolKey = 'task' | 'focus-building' | 'layers' | 'reset' | 'zoom-in' | 'zoom-out';

export type BuildingInteractiveTool = 'browse' | 'focus-building' | 'pick-room';

export interface BuildingToolbarItem {
  key: BuildingStageToolKey;
  label: string;
  icon: string;
}

export interface BuildingLayerItem {
  key: BuildingStageLayerKey;
  label: string;
  description: string;
  visible: boolean;
}

export interface BuildingStageStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
  activeTool: string;
  sourceLabel: string;
  loadStatus: string;
}
