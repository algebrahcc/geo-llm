declare namespace Api {
  namespace KbDatasetConfig {
    type Status = 1 | 2;

    interface Item {
      id: number;
      name: string;
      difyDatasetId?: string;
      apiKey?: string;
      hasApiKey?: boolean;
      useGlobalApiKey?: boolean;
      baseUrl?: string;
      useGlobalBaseUrl?: boolean;
      description?: string;
      sort?: number;
      status: Status;
      createTime?: string;
      updateTime?: string;
    }

    interface Req {
      name: string;
      difyDatasetId?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      baseUrl?: string;
      clearBaseUrl?: boolean;
      description?: string;
      sort?: number;
      status?: Status;
    }

    interface DifyDatasetOption {
      id: string;
      name: string;
      description?: string;
      documentCount?: number;
    }
  }
}
