declare namespace Api {
  namespace AiConfig {
    interface Overview {
      difyUrl: string;
      chatApiKeyEnabled: boolean;
      workflowApiKeyEnabled: boolean;
      datasetApiKeyEnabled: boolean;
      chatApiKeyDisplay: string;
      workflowApiKeyDisplay: string;
      datasetApiKeyDisplay: string;
      consoleUrl?: string;
      consoleApiTokenEnabled?: boolean;
      consoleApiTokenDisplay?: string;
      consoleCsrfTokenEnabled?: boolean;
    }

    interface ConnectivityResult {
      success: boolean;
      message: string;
      effectiveBaseUrl: string;
      useGlobalApiKey: boolean;
      useGlobalBaseUrl: boolean;
    }

    interface AppTestReq {
      id?: number;
      type?: Api.DifyApp.AppType;
      apiKey?: string;
      clearApiKey?: boolean;
      baseUrl?: string;
      clearBaseUrl?: boolean;
    }

    interface DatasetTestReq {
      id?: number;
      apiKey?: string;
      clearApiKey?: boolean;
      baseUrl?: string;
      clearBaseUrl?: boolean;
    }

    interface AppImportReq {
      apiKey: string;
      baseUrl?: string;
      sort?: number;
      status?: Api.DifyApp.AppStatus;
    }

    interface AppImportResult {
      id: number;
      created: boolean;
      name: string;
      mode?: string;
      type: Api.DifyApp.AppType;
      message: string;
    }

    interface RemoteApp {
      appId: string;
      name: string;
      description?: string;
      mode: string;
      type?: Api.DifyApp.AppType;
      imported: boolean;
      localId?: number;
      importable: boolean;
      importableReason?: string;
      apiKeyReady: boolean;
    }

    interface AppSyncItem {
      appId: string;
      name: string;
      action: 'created' | 'updated' | 'skipped' | 'failed';
      localId?: number;
      detail?: string;
      apiKeyReady?: boolean;
    }

    interface AppSyncResult {
      total: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
      items: AppSyncItem[];
    }
  }
}
