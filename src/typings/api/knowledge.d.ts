declare namespace Api {
  /**
   * namespace Knowledge
   *
   * 知识库（基于 Dify dataset / document）联调接口
   * 后端统一返回 R 信封，前端取 data 字段（见 src/service/request/real.ts 的 transform）
   */
  namespace Knowledge {
    /** 文档列表项（对应后端 KbDocumentResp，Dify 原生文档元数据） */
    interface Document {
      id?: number | null;
      name: string;
      docType: string;
      source: string;
      status: string;
      difyDatasetId: string;
      difyDocumentId: string;
      metaJson: string;
      docMetadata?: DocumentMetadata[];
      enabledFlag?: number;
      createTime?: string;
      updateTime?: string;
    }

    interface DocumentSegment {
      id: string;
      order: number;
      title: string;
      content: string;
      keywords: string[];
      length: number;
      status: string;
      hitCount?: number | null;
      confidence?: number | null;
      enabled?: boolean;
    }

    /** 文档元数据项（来自 Dify doc_metadata） */
    interface DocumentMetadata {
      id?: string;
      name?: string;
      type?: string;
      value?: string;
    }

    interface DocumentReference {
      id: string;
      name: string;
      type: string;
      description: string;
    }

    interface DocumentDetail extends Document {
      datasetName?: string;
      datasetDescription?: string;
      summary?: string;
      version?: string;
      language?: string;
      reviewer?: string;
      notes?: string;
      indexMode?: string;
      lastUsedAt?: string;
      batch?: string;
      dataSourceType?: string;
      indexingTechnique?: string;
      processMode?: string;
      wordCount?: number | null;
      tokenCount?: number | null;
      segmentCount?: number | null;
      completedSegments?: number | null;
      errorMessage?: string;
      tags?: string[];
      processLogs?: string[];
      segments?: DocumentSegment[];
      docMetadata?: DocumentMetadata[];
      references?: DocumentReference[];
    }

    /** 知识库元数据字段定义（来自 Dify GET /datasets/{id}/metadata） */
    interface DatasetMetadata {
      id: string;
      type: string;
      name: string;
      useCount?: number;
    }

    /** 切片列表（分页，来自 Dify GET /datasets/{id}/documents/{docId}/segments） */
    interface SegmentList {
      data: DocumentSegment[];
      total: number;
    }

    /** 文档列表（List<KbDocumentResp> 被 R 包裹后放在 data） */
    type DocumentList = Document[];

    /** 文档上传响应（IdResp） */
    interface UploadResp {
      id: number;
    }

    /** 检索请求（对应后端 KbSearchReq） */
    interface SearchReq {
      query: string;
      datasetId?: string;
      docId?: string;
      topN?: number;
      /** Dify 检索方式：full_text_search / semantic_search / hybrid_search */
      searchMethod?: string;
    }

    /** 检索命中文档片段（对应后端 KbSearchHit，id 取自 Dify，为字符串） */
    interface SearchHit {
      chunkId: string;
      docId: string;
      difyDocId: string;
      docName: string;
      content: string;
      score: number;
      source: string;
    }

    /** 检索图谱节点（对应后端 KbGraphHit） */
    interface GraphHit {
      entityId: number;
      name: string;
      type: string;
      docId: number;
      difyDocId: string;
      relations: GraphRelation[];
    }

    /** 检索图谱关系（对应后端 KbGraphRelation） */
    interface GraphRelation {
      from: number;
      to: number;
      type: string;
    }

    /** 检索响应（对应后端 KbSearchResp） */
    interface SearchResp {
      hits: SearchHit[];
      graph: GraphHit[];
    }

    /** Dify 数据集（dataset）原生 JSON，字段随 Dify 版本变化，用索引访问 */
    type Dataset = Record<string, unknown>;
  }
}
