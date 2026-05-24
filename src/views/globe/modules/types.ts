export type GlobeLayerKey = 'imagery' | 'road' | 'pipeline' | 'mark' | 'route';

export type GlobeToolKey =
  | 'analysis'
  | 'locate'
  | 'measure-distance'
  | 'measure-area'
  | 'annotate'
  | 'clear'
  | 'layers'
  | 'reset'
  | 'pitch'
  | 'rotate'
  | 'zoom-in'
  | 'zoom-out';

export type GlobeInteractiveTool = 'browse' | 'measure-distance' | 'measure-area' | 'annotate';

export interface GlobeToolbarItem {
  key: GlobeToolKey;
  label: string;
  icon: string;
}

export interface GlobeLayerItem {
  key: GlobeLayerKey;
  label: string;
  description: string;
  visible: boolean;
}

export interface GlobeStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
  activeTool: string;
}

export interface GlobeLogEntry {
  id: number;
  text: string;
  status: 'running' | 'success';
  time: string;
}
