/**
 * 数据目录模块类型定义（对接后端 /service/catalog/**）
 */
declare namespace Api {
  namespace Catalog {
    /** 分页结果（后端 IPage 结构：records/total/current/size） */
    interface PageResult<T> {
      records: T[];
      total: number;
      current: number;
      size: number;
    }

    /** ID 响应 */
    interface IdResp {
      id: number;
    }

    /** 数据目录列表项（id 为雪花 ID 字符串，避免 JS Number 精度丢失） */
    interface CatalogItem {
      id: string;
      name: string;
      categoryId: string | null;
      categoryName: string | null;
      /** 大类名称（分类树一级节点，由后端推导） */
      typeName: string | null;
      format: string | null;
      crs: string | null;
      bbox: string | null;
      objectKey: string | null;
      url: string | null;
      thumbnail: string | null;
      size: number | null;
      source: string | null;
      status: number;
      extendJson: string | null;
      createTime: string;
      createUserString: string;
    }

    /** 数据目录查询参数 */
    interface CatalogQuery {
      name?: string;
      categoryId?: string;
      /** 大类（分类树一级节点 id） */
      typeId?: string;
      status?: number;
      page?: number;
      size?: number;
    }

    /** 直传 URL 请求 */
    interface PresignReq {
      fileName: string;
      categoryId: string;
      fileSize?: number;
      contentType?: string;
    }

    /** 上传会话（presign 统一返回） */
    interface UploadSession {
      /** PUT：单次直传；MPU：分片上传；LOCAL：服务端中转 */
      method: 'PUT' | 'MPU' | 'LOCAL';
      url: string | null;
      objectKey: string;
      uploadId: string | null;
      partSize: number;
    }

    /** 单分片直传结果 */
    interface PartPresign {
      method: 'PUT';
      url: string;
      objectKey: string;
    }

    /** 分片信息 */
    interface PartInfo {
      partNumber: number;
      etag: string;
    }

    /** 存储对象元信息 */
    interface ObjectInfo {
      key: string;
      exists: boolean;
      size: number | null;
      contentType: string | null;
      etag: string | null;
    }

    /** 上传完成登记请求（multipart：metadata + file） */
    interface RegisterReq {
      name: string;
      categoryId: string;
      objectKey: string;
      format?: string;
      crs?: string;
      bbox?: string;
      thumbnail?: string;
      size?: number;
      source?: string;
      extendJson?: string;
    }

    /** 分类树节点（id 为雪花 ID 字符串） */
    interface CategoryNode {
      id: string;
      code: string;
      parentId: string | null;
      name: string;
      sort: number | null;
      /** 数据量（含子孙节点） */
      count: number;
      children: CategoryNode[];
    }

    /** 分类新增/修改请求 */
    interface CategoryForm {
      code: string;
      parentId?: string | null;
      name: string;
      sort?: number;
    }
  }
}
