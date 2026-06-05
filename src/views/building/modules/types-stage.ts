export type BuildingStageLayerKey = 'imagery' | 'model' | 'rooms' | 'route-points';

export type BuildingStageToolKey =
  | 'task'
  | 'ai'
  | 'focus-building'
  | 'layers'
  | 'reset'
  | 'zoom-in'
  | 'zoom-out'
  | 'pitch'
  | 'rotate'
  | 'measure-distance'
  | 'measure-area'
  | 'clear-markers';

export type BuildingInteractiveTool = 'browse' | 'focus-building' | 'pick-room' | 'measure-distance' | 'measure-area';

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
