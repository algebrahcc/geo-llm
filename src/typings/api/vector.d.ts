declare namespace Api {
  namespace Vector {
    /** 通用分页结果（复用） */
    interface PageResult<T> {
      list: T[];
      total: number;
    }

    /** 通用 ID 响应 */
    interface IdResp {
      id: number;
    }

    /** 矢量图层列表项 */
    interface VectorItem {
      id: string;
      vectorName: string;
      crs: string;
      sourceType: string;
      vectorTable: string;
      sourcePath: string;
      importStatus: number;
      featureCount: string;
      errorMessage: string;
      createTime: string;
    }

    /** 矢量图层详情 */
    interface VectorDetail extends VectorItem {
      updateTime: string;
    }

    /** 矢量图层查询参数 */
    interface VectorQuery {
      vectorName?: string;
      sourceType?: string;
      importStatus?: number;
      page?: number;
      size?: number;
      sort?: string[];
    }

    /** 矢量图层新增/编辑表单 */
    interface VectorForm {
      vectorName: string;
    }

    /** 服务端路径导入请求 */
    interface ImportFromPathReq {
      type: 'GeoJSON' | 'Shapefile';
      filePath: string;
    }
  }
}
