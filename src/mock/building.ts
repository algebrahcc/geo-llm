import { reactive } from 'vue';
import type {
  BuildingDetailInfo,
  BuildingEntrance,
  BuildingBIMFloor,
  BuildingEnvironmentItem,
  BuildingRoamPoint,
  BuildingRoamRoute,
  BuildingModelSource,
  BuildingFeatureBinding,
  BuildingFloor,
  BuildingForceCard,
  BuildingMaterial,
  BuildingRoom,
  BuildingTask
} from '@/views/building/modules/types';

// ═══════════════════════════════════════════════
// GLB 模型数据源（替代3D Tiles）
// ═══════════════════════════════════════════════

const glbModelUrl = `${import.meta.env.BASE_URL}low_poly_-_soviet__apartment_building_8k.glb`;

export const buildingModelSources = reactive<BuildingModelSource[]>([
  {
    key: 'glb-apartment',
    label: '苏联公寓楼',
    modelUrl: glbModelUrl,
    description: '典型苏式预制板公寓楼，5层，多单元居民住宅。',
    location: '第聂伯大街与共青团员路交汇处',
    transform: {
      longitude: 121.5082,
      latitude: 25.0376,
      height: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      scale: 20
    }
  }
]);

// ═══════════════════════════════════════════════
// 任务模拟信息
// ═══════════════════════════════════════════════

export const buildingTask = reactive<BuildingTask>({
  id: 'building-task-01',
  code: 'MZ0240520001',
  title: '居民楼夺控推演任务',
  status: '进行中',
  buildingName: '第聂伯公寓',
  operator: '陈卓',
  updatedAt: '2024-05-20 14:30:00',
  objective: '完成目标楼体"第聂伯公寓"的全面侦察分析，识别敌方据点分布、制定逐层清剿方案并评估平民风险。',
  summary:
    '模拟在城区环境中，对"第聂伯公寓"进行楼宇夺控。该建筑为典型苏式预制板住宅楼，共5层，3个单元6个入口，楼内结构规整但通道狭窄，需逐层逐户清剿。',
  floorCount: 5,
  riskCount: 3,
  materialCount: 2,
  sourceKey: 'glb-apartment'
});

export const buildingForceCards = reactive<BuildingForceCard[]>([
  {
    id: 'force-1',
    label: '清剿单元',
    value: '3 组',
    description: '各负责一个单元，自下而上逐层搜索控制。',
    icon: 'mdi:shield-account-outline',
    tone: 'info'
  },
  {
    id: 'force-2',
    label: '外围封控',
    value: '4 点位',
    description: '封锁所有出入口，阻止目标逃脱与外援介入。',
    icon: 'mdi:radar',
    tone: 'success'
  },
  {
    id: 'force-3',
    label: '重点风险',
    value: '3 项',
    description: '楼内通道狭窄、住户情况不明、可能有简易爆炸装置。',
    icon: 'mdi:alert-outline',
    tone: 'warning'
  }
]);

// ═══════════════════════════════════════════════
// 环境信息（12项）
// ═══════════════════════════════════════════════

export const buildingEnvironmentItems = reactive<BuildingEnvironmentItem[]>([
  { id: 'env-weather', label: '天气状况', value: '阴', icon: 'mdi:weather-cloudy', level: 'low' },
  { id: 'env-temp', label: '温度', value: '12°C', icon: 'mdi:thermometer' },
  { id: 'env-wind', label: '风向风速', value: '北风 2级', icon: 'mdi:weather-windy' },
  { id: 'env-visibility', label: '能见度', value: '18 km', icon: 'mdi:eye' },
  { id: 'env-noise', label: '噪声条件', value: '夜间', icon: 'mdi:weather-night', level: 'medium' },
  { id: 'env-sound-db', label: '环境噪声', value: '42 dB', icon: 'mdi:waveform' },
  { id: 'env-terrain', label: '地形地貌', value: '老旧城区', icon: 'mdi:city-variant' },
  { id: 'env-buildings', label: '周边建筑', value: '同类型住宅楼密集', icon: 'mdi:domain' },
  { id: 'env-roads', label: '道路类型', value: '双车道、巷弄', icon: 'mdi:road-variant' },
  { id: 'env-media', label: '可利用掩体', value: '车辆、围墙、绿化带', icon: 'mdi:map-marker-path' },
  { id: 'env-comm', label: '通信条件', value: '良好', icon: 'mdi:signal-cellular-3', level: 'low' },
  { id: 'env-power', label: '电力供应', value: '局部断电', icon: 'mdi:power-plug-off', level: 'high' }
]);

// ═══════════════════════════════════════════════
// 建筑详细信息
// ═══════════════════════════════════════════════

export const buildingDetail = reactive<BuildingDetailInfo>({
  name: '第聂伯公寓',
  buildingType: '居民住宅楼',
  area: 420,
  aboveGroundFloors: 5,
  belowGroundFloors: 1,
  totalArea: 2100,
  structureType: '预制板装配式结构',
  builtYear: 1972,
  usageStatus: '居民居住中（30户）',
  remarks: '敌占据3-5层，可能挟持有居民，需优先疏散后再强攻'
});

// ═══════════════════════════════════════════════
// BIM 楼层结构
// ═══════════════════════════════════════════════

export const buildingBIMFloors = reactive<BuildingBIMFloor[]>([
  { id: 'f5', label: '5F', floorNumber: 5, color: '#fb7185' },
  { id: 'f4', label: '4F', floorNumber: 4, color: '#fb7185' },
  { id: 'f3', label: '3F', floorNumber: 3, color: '#ffcf5c' },
  { id: 'f2', label: '2F', floorNumber: 2, color: '#e8e8e8' },
  { id: 'f1', label: '1F', floorNumber: 1, color: '#e8e8e8' },
  { id: 'f-1', label: 'B1', floorNumber: -1, color: '#5ea4ff' }
]);

// ═══════════════════════════════════════════════
// 主要入口信息
// ═══════════════════════════════════════════════

export const buildingEntrances = reactive<BuildingEntrance[]>([
  {
    id: 'entrance-main',
    name: '一单元入口',
    type: '主入口',
    orientation: '南',
    width: 2.2,
    height: 2.6,
    doorType: '金属防盗门',
    protectionLevel: '中等',
    suspiciousFeatures: '门上贴有告示，疑似布设报警装置',
    isPrimary: true,
    imageUrl: ''
  },
  {
    id: 'entrance-side-east',
    name: '二单元入口',
    type: '次入口',
    orientation: '东',
    width: 2.2,
    height: 2.6,
    doorType: '木制门',
    protectionLevel: '低',
    suspiciousFeatures: '门锁已损坏，可直接进入',
    isPrimary: false
  },
  {
    id: 'entrance-back',
    name: '后侧消防通道',
    type: '应急出口',
    orientation: '北',
    width: 1.8,
    height: 2.4,
    doorType: '铁栅栏门',
    protectionLevel: '高',
    suspiciousFeatures: '内部挂有铁链加固',
    isPrimary: false
  }
]);

// activePrimaryEntrance 已移至 src/views/building/modules/use-building.ts
// mock 文件只负责提供静态数据，不混入响应式计算逻辑

// ═══════════════════════════════════════════════
// 街景漫游点
// ═══════════════════════════════════════════════

export const buildingRoamPoints = reactive<BuildingRoamPoint[]>([
  {
    id: 'roam-01',
    title: '南侧观察位',
    entranceInfo: '正对一单元入口\n距离：25m',
    distance: '25m',
    imageUrl: '',
    longitude: 121.5082,
    latitude: 25.0372,
    routeId: '',
    description: '',
    duration: ''
  },
  {
    id: 'roam-02',
    title: '东侧巷口',
    entranceInfo: '二单元侧翼\n距离：35m',
    distance: '35m',
    imageUrl: '',
    longitude: 121.5088,
    latitude: 25.0376,
    routeId: '',
    description: '',
    duration: ''
  },
  {
    id: 'roam-03',
    title: '北侧围墙',
    entranceInfo: '消防通道外\n距离：40m',
    distance: '40m',
    imageUrl: '',
    longitude: 121.5082,
    latitude: 25.0382,
    routeId: '',
    description: '',
    duration: ''
  },
  {
    id: 'roam-04',
    title: '西侧路口',
    entranceInfo: '可观察全楼西立面\n距离：50m',
    distance: '50m',
    imageUrl: '',
    longitude: 121.5076,
    latitude: 25.0376,
    routeId: '',
    description: '',
    duration: ''
  },
  {
    id: 'roam-05',
    title: '对面楼顶',
    entranceInfo: '制高点俯瞰\n距离：60m',
    distance: '60m',
    imageUrl: '',
    longitude: 121.5082,
    latitude: 25.0368,
    routeId: '',
    description: '',
    duration: ''
  },
  {
    id: 'roam-06',
    title: '小区入口',
    entranceInfo: '车辆可接近区域\n距离：80m',
    distance: '80m',
    imageUrl: '',
    longitude: 121.5074,
    latitude: 25.0374,
    routeId: '',
    description: '',
    duration: ''
  }
]);

// ═══════════════════════════════════════════════
// 漫游路线
// ═══════════════════════════════════════════════

export const buildingRoamRoutes = reactive<BuildingRoamRoute[]>([
  {
    id: 'route-default',
    name: '外围侦察路线',
    summary: '沿公寓楼四周观察，获取全楼外部态势',
    pointIds: ['roam-01', 'roam-02', 'roam-03', 'roam-04', 'roam-05', 'roam-06']
  }
]);

// ═══════════════════════════════════════════════
// 保留原有数据结构（兼容）
// ═══════════════════════════════════════════════

const localTilesetUrl = `${import.meta.env.BASE_URL}3dtiles/building-demo/tileset.json`;
const remoteTilesetUrl =
  window.__APP_CONFIG__?.VITE_BUILDING_TILESET_URL || import.meta.env.VITE_BUILDING_TILESET_URL || '';

export const buildingTilesetSources = [
  {
    key: 'local-demo',
    label: '本地样例',
    sourceType: 'local' as const,
    tilesetUrl: localTilesetUrl,
    description: '从 public/3dtiles/building-demo 目录加载 tileset.json。',
    location: '园区北侧指挥楼',
    statusText: '待放置本地 tileset 样例',
    transform: { longitude: 121.5082, latitude: 25.0376, height: 8, heading: 0, pitch: 0, roll: 0, scale: 1 },
    maximumScreenSpaceError: 12
  },
  {
    key: 'remote-live',
    label: '远程数据源',
    sourceType: 'remote' as const,
    tilesetUrl: remoteTilesetUrl,
    description: '通过运行时配置的远程 3D Tiles 地址接入真实 BIM 数据。',
    location: '远程 BIM 服务',
    statusText: remoteTilesetUrl ? '已配置远程地址' : '未配置 VITE_BUILDING_TILESET_URL',
    transform: { longitude: 121.5082, latitude: 25.0376, height: 8, heading: 0, pitch: 0, roll: 0, scale: 1 },
    maximumScreenSpaceError: 10
  }
];

export const buildingFloors = reactive<BuildingFloor[]>([
  { id: 'f1', label: '一层', summary: '单元门厅、楼梯间、底商杂物间', roomIds: ['r1', 'r2', 'r3'] },
  { id: 'f2', label: '二层', summary: '居民住房，走廊通道狭窄', roomIds: ['r4', 'r5'] },
  { id: 'f3', label: '三层', summary: '敌占层始，可能有简易哨位', roomIds: ['r6', 'r7'] },
  { id: 'f4', label: '四层', summary: '敌核心据守层，窗口设火力位', roomIds: ['r8'] },
  { id: 'f5', label: '五层', summary: '顶层据点，可控制屋顶通道', roomIds: ['r9'] },
  { id: 'roof', label: '屋顶', summary: '通风井、屋面设备、制高点观察', roomIds: ['r10'] }
]);

export const buildingRooms = reactive<BuildingRoom[]>([
  {
    id: 'r1',
    floorId: 'f1',
    name: '一单元门厅',
    useType: '入口通道',
    summary: '入口狭窄约2m，电表箱可作掩体，楼梯入口在右侧。',
    riskLevel: 'medium',
    featureId: 'unit1-hall'
  },
  {
    id: 'r2',
    floorId: 'f1',
    name: '楼梯间',
    useType: '垂直通道',
    summary: '预制板楼梯，控制后可切断楼上退路。',
    riskLevel: 'high',
    featureId: 'stairwell'
  },
  {
    id: 'r3',
    floorId: 'f1',
    name: '底商杂物间',
    useType: '储藏空间',
    summary: '堆放旧家具杂物，需仔细搜索。',
    riskLevel: 'low',
    featureId: 'storage'
  },
  {
    id: 'r4',
    floorId: 'f2',
    name: '201住户',
    useType: '居民住所',
    summary: '两室一厅布局，需逐屋检查是否有滞留居民。',
    riskLevel: 'low',
    featureId: 'apt201'
  },
  {
    id: 'r5',
    floorId: 'f2',
    name: '202住户',
    useType: '居民住所',
    summary: '门已敞开，内部有翻动痕迹，疑似已被搜查。',
    riskLevel: 'medium',
    featureId: 'apt202'
  },
  {
    id: 'r6',
    floorId: 'f3',
    name: '301住户',
    useType: '敌占区域',
    summary: '窗口有沙袋加固，可能设为前哨观察点。',
    riskLevel: 'high',
    featureId: 'apt301'
  },
  {
    id: 'r7',
    floorId: 'f3',
    name: '302住户',
    useType: '敌占区域',
    summary: '房门加固，需破门进入，对抗强度高。',
    riskLevel: 'high',
    featureId: 'apt302'
  },
  {
    id: 'r8',
    floorId: 'f4',
    name: '4F-全层',
    useType: '核心据守层',
    summary: '敌主要火力配置区，窗台有机枪射击孔。',
    riskLevel: 'high',
    featureId: 'apt4th'
  },
  {
    id: 'r9',
    floorId: 'f5',
    name: '5F-阁楼',
    useType: '顶层据点',
    summary: '可通往屋顶，预估有狙击位和通讯设备。',
    riskLevel: 'high',
    featureId: 'apt5th'
  },
  {
    id: 'r10',
    floorId: 'roof',
    name: '屋顶平台',
    useType: '制高控制',
    summary: '开阔屋顶，需警惕对面建筑威胁。',
    riskLevel: 'medium',
    featureId: 'roof'
  }
]);

export const buildingFeatureBindings = reactive<BuildingFeatureBinding[]>([
  { featureId: 'unit1-hall', floorId: 'f1', roomId: 'r1', label: '一单元门厅' },
  { featureId: 'stairwell', floorId: 'f1', roomId: 'r2', label: '楼梯间' },
  { featureId: 'storage', floorId: 'f1', roomId: 'r3', label: '杂物间' },
  { featureId: 'apt201', floorId: 'f2', roomId: 'r4', label: '201住户' },
  { featureId: 'apt202', floorId: 'f2', roomId: 'r5', label: '202住户' },
  { featureId: 'apt301', floorId: 'f3', roomId: 'r6', label: '301住户' },
  { featureId: 'apt302', floorId: 'f3', roomId: 'r7', label: '302住户' },
  { featureId: 'apt4th', floorId: 'f4', roomId: 'r8', label: '四层区域' },
  { featureId: 'apt5th', floorId: 'f5', roomId: 'r9', label: '五层阁楼' },
  { featureId: 'roof', floorId: 'roof', roomId: 'r10', label: '屋顶平台' }
]);

export const buildingMaterials = reactive<BuildingMaterial[]>([
  {
    id: 'm1',
    title: '一单元门厅侦察截图',
    roomId: 'r1',
    pointId: 'p1',
    summary: '门厅宽约2m，电表箱可作掩护，楼梯入口在右侧。',
    createdAt: '2026-05-24 15:40'
  },
  {
    id: 'm2',
    title: '301窗口火力点记录',
    roomId: 'r6',
    pointId: 'p3',
    summary: '三层窗口沙袋加固，向东覆盖小区道路，需从西侧盲区接近。',
    createdAt: '2026-05-24 15:58'
  }
]);
