import { reactive } from 'vue';
import type {
  BuildingEnvironmentItem,
  BuildingFeatureBinding,
  BuildingFloor,
  BuildingForceCard,
  BuildingMaterial,
  BuildingRoamPoint,
  BuildingRoamRoute,
  BuildingRoom,
  BuildingTask,
  BuildingTilesetSource
} from '@/views/building/modules/types';

const localTilesetUrl = `${import.meta.env.BASE_URL}3dtiles/building-demo/tileset.json`;
const remoteTilesetUrl = window.__APP_CONFIG__?.VITE_BUILDING_TILESET_URL || import.meta.env.VITE_BUILDING_TILESET_URL || '';

export const buildingTilesetSources = reactive<BuildingTilesetSource[]>([
  {
    key: 'local-demo',
    label: '本地样例',
    sourceType: 'local',
    tilesetUrl: localTilesetUrl,
    description: '从 public/3dtiles/building-demo 目录加载 tileset.json。',
    location: '园区北侧指挥楼',
    statusText: '待放置本地 tileset 样例',
    transform: {
      longitude: 121.5082,
      latitude: 25.0376,
      height: 8,
      heading: 0,
      pitch: 0,
      roll: 0,
      scale: 1
    },
    maximumScreenSpaceError: 12
  },
  {
    key: 'remote-live',
    label: '远程数据源',
    sourceType: 'remote',
    tilesetUrl: remoteTilesetUrl,
    description: '通过运行时配置的远程 3D Tiles 地址接入真实 BIM 数据。',
    location: '远程 BIM 服务',
    statusText: remoteTilesetUrl ? '已配置远程地址' : '未配置 VITE_BUILDING_TILESET_URL',
    transform: {
      longitude: 121.5082,
      latitude: 25.0376,
      height: 8,
      heading: 0,
      pitch: 0,
      roll: 0,
      scale: 1
    },
    maximumScreenSpaceError: 10
  }
]);

export const buildingTask = reactive<BuildingTask>({
  id: 'building-task-01',
  code: 'BD-2026-051',
  title: '楼宇夺控推演任务',
  status: '进行中',
  buildingName: '北侧指挥楼',
  operator: '联合作战组',
  updatedAt: '2026-05-24 16:20',
  objective: '完成目标楼体外立面侦察、出入口分析、楼层控制点识别与情景漫游演示。',
  summary: '当前阶段优先验证真实 3D Tiles 模型加载、定位与任务面板联动。',
  floorCount: 4,
  riskCount: 3,
  materialCount: 2,
  sourceKey: 'local-demo'
});

export const buildingForceCards = reactive<BuildingForceCard[]>([
  {
    id: 'force-1',
    label: '突入单元',
    value: '2 组',
    description: '负责一层大厅和北侧楼梯间快速控制。',
    icon: 'mdi:shield-account-outline',
    tone: 'info'
  },
  {
    id: 'force-2',
    label: '侦察支援',
    value: '3 点位',
    description: '覆盖楼体西侧、屋顶与主入口区域。',
    icon: 'mdi:radar',
    tone: 'success'
  },
  {
    id: 'force-3',
    label: '重点风险',
    value: '3 项',
    description: '南侧玻璃幕墙、地下入口、屋顶天井需要重点关注。',
    icon: 'mdi:alert-outline',
    tone: 'warning'
  }
]);

export const buildingEnvironmentItems = reactive<BuildingEnvironmentItem[]>([
  {
    id: 'env-1',
    label: '主入口视野开阔',
    description: '东侧主入口无遮挡，但暴露风险较高，建议以烟幕配合突入。',
    level: 'medium',
    icon: 'mdi:door-open'
  },
  {
    id: 'env-2',
    label: '北侧后勤通道',
    description: '可作为次要进入路径，适合配合侧后方绕行。',
    level: 'low',
    icon: 'mdi:road-variant'
  },
  {
    id: 'env-3',
    label: '屋顶观察位',
    description: '屋顶天井附近存在制高点，适合布设侦察观察位。',
    level: 'high',
    icon: 'mdi:binoculars'
  }
]);

export const buildingFloors = reactive<BuildingFloor[]>([
  {
    id: 'f1',
    label: '一层',
    summary: '大厅、值守室、北侧楼梯间',
    roomIds: ['r1', 'r2', 'r3']
  },
  {
    id: 'f2',
    label: '二层',
    summary: '指挥席位、会议室、东侧连廊',
    roomIds: ['r4', 'r5']
  },
  {
    id: 'f3',
    label: '三层',
    summary: '设备间、观察位、备用通道',
    roomIds: ['r6', 'r7']
  },
  {
    id: 'roof',
    label: '屋顶',
    summary: '天井、屋面设备、观察平台',
    roomIds: ['r8']
  }
]);

export const buildingRooms = reactive<BuildingRoom[]>([
  {
    id: 'r1',
    floorId: 'f1',
    name: '主入口大厅',
    useType: '入口控制',
    summary: '首层主要暴露区，适合作为态势观察与初始突入点。',
    riskLevel: 'high',
    featureId: 'hall-main'
  },
  {
    id: 'r2',
    floorId: 'f1',
    name: '值守室',
    useType: '安保值守',
    summary: '靠近门禁系统，适合作为第一控制节点。',
    riskLevel: 'medium',
    featureId: 'guard-room'
  },
  {
    id: 'r3',
    floorId: 'f1',
    name: '北侧楼梯间',
    useType: '垂直通行',
    summary: '连接所有楼层，控制后可显著降低上行风险。',
    riskLevel: 'medium',
    featureId: 'north-stair'
  },
  {
    id: 'r4',
    floorId: 'f2',
    name: '主会议室',
    useType: '核心目标',
    summary: '任务核心控制区域，建议优先完成封控。',
    riskLevel: 'high',
    featureId: 'meeting-room'
  },
  {
    id: 'r5',
    floorId: 'f2',
    name: '东侧连廊',
    useType: '机动通道',
    summary: '便于串联会议区与楼梯间，适合作为快速转场通道。',
    riskLevel: 'low',
    featureId: 'east-corridor'
  },
  {
    id: 'r6',
    floorId: 'f3',
    name: '设备间',
    useType: '后勤设备',
    summary: '可能影响楼宇断电和门禁控制，需提前识别。',
    riskLevel: 'medium',
    featureId: 'equipment-room'
  },
  {
    id: 'r7',
    floorId: 'f3',
    name: '观察位',
    useType: '制高点',
    summary: '可作为楼外观察位，覆盖主入口和道路区域。',
    riskLevel: 'high',
    featureId: 'observation-room'
  },
  {
    id: 'r8',
    floorId: 'roof',
    name: '屋顶平台',
    useType: '屋面控制',
    summary: '适合部署侦察设备与进行楼外视野确认。',
    riskLevel: 'medium',
    featureId: 'roof-platform'
  }
]);

export const buildingFeatureBindings = reactive<BuildingFeatureBinding[]>([
  { featureId: 'hall-main', floorId: 'f1', roomId: 'r1', label: '主入口大厅' },
  { featureId: 'guard-room', floorId: 'f1', roomId: 'r2', label: '值守室' },
  { featureId: 'north-stair', floorId: 'f1', roomId: 'r3', label: '北侧楼梯间' },
  { featureId: 'meeting-room', floorId: 'f2', roomId: 'r4', label: '主会议室' },
  { featureId: 'east-corridor', floorId: 'f2', roomId: 'r5', label: '东侧连廊' },
  { featureId: 'equipment-room', floorId: 'f3', roomId: 'r6', label: '设备间' },
  { featureId: 'observation-room', floorId: 'f3', roomId: 'r7', label: '观察位' },
  { featureId: 'roof-platform', floorId: 'roof', roomId: 'r8', label: '屋顶平台' }
]);

export const buildingRoamRoutes = reactive<BuildingRoamRoute[]>([
  {
    id: 'route-main',
    name: '主入口突入路线',
    summary: '从主入口大厅切入，经北侧楼梯间控制二层目标区。',
    pointIds: ['p1', 'p2', 'p3']
  },
  {
    id: 'route-side',
    name: '北侧侧后进入路线',
    summary: '利用后勤通道与侧后方机动，降低正面暴露。',
    pointIds: ['p4', 'p5']
  }
]);

export const buildingRoamPoints = reactive<BuildingRoamPoint[]>([
  {
    id: 'p1',
    routeId: 'route-main',
    title: '锁定主入口大厅',
    description: '确认主入口大厅视野、门禁位置与掩体分布。',
    roomId: 'r1',
    duration: '18s'
  },
  {
    id: 'p2',
    routeId: 'route-main',
    title: '接管北侧楼梯间',
    description: '完成垂直交通要点控制，保障二层快速推进。',
    roomId: 'r3',
    duration: '12s'
  },
  {
    id: 'p3',
    routeId: 'route-main',
    title: '封控主会议室',
    description: '抵达二层核心目标区并展开封控。',
    roomId: 'r4',
    duration: '16s'
  },
  {
    id: 'p4',
    routeId: 'route-side',
    title: '利用北侧后勤通道靠近',
    description: '避开主入口视线，从北侧接近楼体。',
    roomId: 'r3',
    duration: '20s'
  },
  {
    id: 'p5',
    routeId: 'route-side',
    title: '转入东侧连廊',
    description: '进入二层后，经东侧连廊进入目标区域外围。',
    roomId: 'r5',
    duration: '15s'
  }
]);

export const buildingMaterials = reactive<BuildingMaterial[]>([
  {
    id: 'm1',
    title: '主入口大厅观察截图',
    roomId: 'r1',
    pointId: 'p1',
    summary: '记录主入口大厅门禁、柱体掩护和窗口暴露情况。',
    createdAt: '2026-05-24 15:40'
  },
  {
    id: 'm2',
    title: '主会议室封控要点',
    roomId: 'r4',
    pointId: 'p3',
    summary: '提炼会议室入口、出风井与东侧连廊交汇位置的控制建议。',
    createdAt: '2026-05-24 15:58'
  }
]);
