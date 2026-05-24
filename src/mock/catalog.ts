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
    source: '卫星采集'
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
    source: 'SRTM'
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
    source: '无人机航拍'
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
    source: '气象局接口'
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
    source: '测绘院'
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
    source: '卫星采集'
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
    source: 'SRTM'
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
    source: '水文站监测'
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
    source: '规划院'
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
