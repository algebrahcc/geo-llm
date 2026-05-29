export interface CatalogItem {
  id: number;
  name: string;
  ingestTime: string;
  timePhase: string;
  range: string;
  type: string;
  status: 'published' | 'draft' | 'offline';
  size: string;
  source: string;
  /** 数据描述 */
  description?: string;
  /** 数据格式，如 GeoTIFF、Shapefile 等 */
  format?: string;
  /** 分辨率，如 30m、0.5m */
  resolution?: string;
  /** 坐标系，如 WGS 84、CGCS 2000 */
  coordinateSystem?: string;
  /** 坐标范围 [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
  /** 更新时间 */
  updateTime?: string;
  /** 标签 */
  tags?: string[];
}

export interface CatalogCategory {
  label: string;
  key: string;
  children?: { label: string; key: string }[];
}

export const catalogCategories: CatalogCategory[] = [
  {
    label: '基础影像',
    key: 'img',
    children: [
      { label: '全球影像', key: 'img-global' },
      { label: '全国影像', key: 'img-china' },
      { label: '区域影像', key: 'img-regional' }
    ]
  },
  {
    label: '数字高程',
    key: 'dem',
    children: [
      { label: 'DEM 30m', key: 'dem-30' },
      { label: 'DEM 90m', key: 'dem-90' },
      { label: 'DSM', key: 'dem-dsm' }
    ]
  },
  {
    label: '倾斜摄影',
    key: 'oblique',
    children: [
      { label: '城市倾斜', key: 'oblique-city' },
      { label: '三维建模', key: 'oblique-3d' }
    ]
  },
  {
    label: '气象水文',
    key: 'hydro',
    children: [
      { label: '降雨数据', key: 'hydro-rain' },
      { label: '河网水系', key: 'hydro-river' },
      { label: '湖泊水库', key: 'hydro-lake' }
    ]
  },
  {
    label: '矢量管网',
    key: 'pipe',
    children: [
      { label: '矢量管网', key: 'pipe-vector' },
      { label: '管线数据', key: 'pipe-line' }
    ]
  }
];

export const catalogTypes = ['总览', '影像数据', '数字高程', '地下管网', '专题数据'];

export const catalogData: CatalogItem[] = [
  {
    id: 1,
    name: '长江流域高清影像',
    ingestTime: '2026-05-22',
    timePhase: '2026Q2',
    range: '长江流域',
    type: '影像',
    status: 'published',
    size: '2.8GB',
    source: '卫星采集',
    description:
      '覆盖长江流域全域的高分辨率卫星影像数据，包含多光谱和全色波段，适用于土地利用分类、植被覆盖度分析及生态环境监测等应用场景。',
    format: 'GeoTIFF',
    resolution: '2m',
    coordinateSystem: 'WGS 84 / UTM Zone 49N',
    bbox: [96.3, 24.5, 122.4, 35.8],
    updateTime: '2026-05-22',
    tags: ['卫星影像', '多光谱', '长江流域', '生态监测']
  },
  {
    id: 2,
    name: '黄河流域 DEM',
    ingestTime: '2026-05-18',
    timePhase: '2026Q2',
    range: '黄河流域',
    type: '高程',
    status: 'published',
    size: '1.2GB',
    source: 'SRTM',
    description:
      '基于 SRTM 雷达数据生成的黄河流域数字高程模型，适用于地形分析、水文模拟、坡度坡向计算等地理信息分析场景。',
    format: 'GeoTIFF',
    resolution: '30m',
    coordinateSystem: 'WGS 84',
    bbox: [95.9, 32.2, 119.1, 42.5],
    updateTime: '2026-05-18',
    tags: ['DEM', '高程', '黄河流域', 'SRTM']
  },
  {
    id: 3,
    name: '北京市倾斜摄影模型',
    ingestTime: '2026-05-15',
    timePhase: '2025Q4',
    range: '北京市',
    type: '倾斜摄影',
    status: 'published',
    size: '15.6GB',
    source: '无人机航拍',
    description:
      '采用五镜头倾斜摄影相机采集的北京市城六区三维实景模型，纹理清晰、结构完整，可用于城市规划、建筑风貌展示及三维空间分析。',
    format: 'OSGB',
    resolution: '0.05m',
    coordinateSystem: 'CGCS 2000 / 3-degree Gauss-Kruger Zone 39',
    bbox: [116.0, 39.6, 116.8, 40.2],
    updateTime: '2026-05-15',
    tags: ['倾斜摄影', '三维模型', '北京', '实景']
  },
  {
    id: 4,
    name: '华东地区降雨分布',
    ingestTime: '2026-05-10',
    timePhase: '2026Q2',
    range: '华东地区',
    type: '气象水文',
    status: 'draft',
    size: '320MB',
    source: '气象局接口',
    description:
      '基于气象局实时接口获取的华东地区逐日降雨量栅格数据，覆盖六省一市，可用于洪涝预警、旱情评估及水资源调度分析。',
    format: 'NetCDF',
    resolution: '1km',
    coordinateSystem: 'WGS 84',
    bbox: [114.8, 23.5, 122.9, 38.3],
    updateTime: '2026-05-10',
    tags: ['气象', '降雨', '华东', '实时数据']
  },
  {
    id: 5,
    name: '某市地下管网矢量数据',
    ingestTime: '2026-05-08',
    timePhase: '2025Q3',
    range: '某市',
    type: '矢量管网',
    status: 'published',
    size: '450MB',
    source: '测绘院',
    description:
      '包含某市主城区供水、排水、燃气、热力四类地下管线的矢量数据，附带管径、材质、埋深等属性信息，可用于市政管网运维与应急抢修指挥。',
    format: 'Shapefile',
    resolution: '1:500',
    coordinateSystem: 'CGCS 2000 / 3-degree Gauss-Kruger Zone 38',
    bbox: [117.8, 34.5, 118.3, 34.9],
    updateTime: '2026-05-08',
    tags: ['矢量', '管网', '地下管线', '市政']
  },
  {
    id: 6,
    name: '西部地区卫星影像',
    ingestTime: '2026-05-05',
    timePhase: '2026Q1',
    range: '西部地区',
    type: '影像',
    status: 'offline',
    size: '5.2GB',
    source: '卫星采集',
    description:
      '覆盖西部干旱半干旱地区的卫星影像数据，含全色与多光谱波段，适用于荒漠化监测、草原退化评估及矿产资源遥感调查。',
    format: 'GeoTIFF',
    resolution: '5m',
    coordinateSystem: 'WGS 84 / UTM Zone 47N',
    bbox: [73.5, 26.4, 108.6, 49.2],
    updateTime: '2026-05-05',
    tags: ['卫星影像', '西部', '荒漠化', '遥感']
  },
  {
    id: 7,
    name: '全国 DEM 30m',
    ingestTime: '2026-04-28',
    timePhase: '2025',
    range: '全国',
    type: '高程',
    status: 'published',
    size: '8.9GB',
    source: 'SRTM',
    description:
      '覆盖全国范围的 30m 分辨率数字高程模型，数据源为 SRTM V3.0，空洞区域已用 ASTER GDEM 填补，适用于全国尺度地形分析与可视化。',
    format: 'GeoTIFF',
    resolution: '30m',
    coordinateSystem: 'WGS 84',
    bbox: [73.5, 3.8, 135.1, 53.6],
    updateTime: '2026-04-28',
    tags: ['DEM', '全国', 'SRTM', '地形']
  },
  {
    id: 8,
    name: '淮河流域水文数据',
    ingestTime: '2026-04-25',
    timePhase: '2026Q1',
    range: '淮河流域',
    type: '气象水文',
    status: 'published',
    size: '180MB',
    source: '水文站监测',
    description:
      '基于淮河流域 200+ 水文站点监测数据整编的逐日流量、水位及水质指标数据集，可用于洪水演进模拟、水资源调度及水环境治理决策支持。',
    format: 'CSV + GeoJSON',
    resolution: '站点级',
    coordinateSystem: 'WGS 84',
    bbox: [111.9, 30.9, 121.0, 36.4],
    updateTime: '2026-04-25',
    tags: ['水文', '流量', '淮河', '监测']
  },
  {
    id: 9,
    name: '长三角专题数据',
    ingestTime: '2026-04-20',
    timePhase: '2025',
    range: '长三角',
    type: '专题数据',
    status: 'draft',
    size: '1.5GB',
    source: '规划院',
    description:
      '长三角一体化示范区专题数据包，涵盖用地现状、交通网络、生态红线、产业布局等 12 个专题图层，服务于区域协同发展规划与决策。',
    format: 'GeoPackage',
    resolution: '1:10000',
    coordinateSystem: 'CGCS 2000',
    bbox: [118.3, 28.8, 122.5, 33.2],
    updateTime: '2026-04-20',
    tags: ['专题', '长三角', '规划', '一体化']
  }
];

export function getFilteredData(type: string, category: string | null, search: string): CatalogItem[] {
  let filtered = [...catalogData];

  if (type && type !== '总览') {
    filtered = filtered.filter(item => {
      switch (type) {
        case '影像数据':
          return item.type === '影像' || item.type === '倾斜摄影';
        case '数字高程':
          return item.type === '高程';
        case '地下管网':
          return item.type === '矢量管网';
        case '专题数据':
          return item.type === '专题数据';
        default:
          return true;
      }
    });
  }

  if (category) {
    filtered = filtered.filter(item => {
      if (category.includes('img')) return item.type === '影像' || item.type === '倾斜摄影';
      if (category.includes('dem')) return item.type === '高程';
      if (category.includes('oblique')) return item.type === '倾斜摄影';
      if (category.includes('hydro')) return item.type === '气象水文';
      if (category.includes('pipe')) return item.type === '矢量管网';
      return false;
    });
  }

  if (search) {
    const keyword = search.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(keyword) ||
        item.range.toLowerCase().includes(keyword) ||
        item.source.toLowerCase().includes(keyword)
    );
  }

  return filtered;
}
