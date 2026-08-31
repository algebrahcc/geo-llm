/** 统一数据服务：类型定义（设计文档 5.1） */
declare namespace Api.DataService {
  type Category = 'imagery' | 'terrain' | 'threed' | 'vector' | 'streetview' | 'analysis';
  type Origin = 'internal' | 'external';

  /** 分页查询条件 */
  interface DataServiceQuery {
    current?: number;
    size?: number;
    name?: string;
    category?: Category | string;
    origin?: Origin | string;
    status?: number;
    group?: string;
  }

  interface DataServiceItem {
    id: number;
    name: string;
    category: Category;
    type: string;
    origin: Origin;
    url: string;
    /** 连接参数（JSON 字符串，如 wms 的 {"layers":"xx"}） */
    params?: string;
    /** 空间范围 [minLng,minLat,maxLng,maxLat]（JSON 数组字符串，空表示不限） */
    extent?: string;
    crs?: string;
    minZoom?: number;
    maxZoom?: number;
    /** 是否 Cesium 初始化默认加载（0否/1是） */
    enabled: number;
    sort: number;
    /** 渲染样式（JSON 字符串） */
    style?: string;
    description?: string;
    /** 服务分组（项目/场景维度） */
    group?: string;
    /** 预留：关联数据目录 data_catalog.id */
    catalogId?: number;
    /** 状态（0草稿/1已发布/2已下线） */
    status: number;
    createTime: string;
  }

  type DataServiceForm = Omit<DataServiceItem, 'id' | 'createTime'> & { id?: number };

  /** 连接测试结果 */
  interface DataServiceConnectResult {
    reachable: boolean;
    httpStatus: number;
    latencyMs: number;
  }

  type PageResult<T> = { records: T[]; total: number; current: number; size: number };
}
