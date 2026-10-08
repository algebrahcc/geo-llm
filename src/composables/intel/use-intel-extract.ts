import { computed, ref } from 'vue';
import { fetchDataServiceCreate } from '@/service/api/dataservice';
import { saveIntelDetection } from '@/service/api/intel';

/**
 * 情报识别成果的保存与出图编排
 *
 * 为什么单独抽 composable：数据目录分析弹窗已近 1200 行，情报保存涉及「落库 → 取图层地址 →
 * 登记数据服务」三步，塞回弹窗会继续膨胀；这里做成与 UI 无关的编排层，便于单测与复用。
 *
 * 出图链路：情报图层地址是 `/service/intel/detection/{id}/geojson`（以 `/` 开头），
 * 前端 `resolveServiceUrl` 会把它拼成后端地址，因此登记为「内部服务 + vector/geojson」
 * 后即可被场景页按统一数据服务机制加载，无需为情报再写一套加载器。
 */
export function useIntelExtract() {
  const saving = ref(false);
  const registering = ref(false);
  /** 最近一次保存成功的情报 */
  const savedIntel = ref<Api.Intel.IntelItem | null>(null);
  /** 保存失败原因（供界面直接展示） */
  const saveError = ref('');
  /** 登记成功后的数据服务 id（为空表示尚未登记） */
  const serviceId = ref<number | null>(null);

  const saved = computed(() => savedIntel.value !== null);

  /** 保存识别结果；成功返回情报记录，失败返回 null 并写入 saveError */
  async function saveIntel(payload: Api.Intel.SavePayload): Promise<Api.Intel.IntelItem | null> {
    saving.value = true;
    saveError.value = '';
    try {
      const res = await saveIntelDetection(payload);
      if (res.error) {
        saveError.value = errorText(res.error);
        return null;
      }
      savedIntel.value = res.data ?? null;
      // 换了情报就要重新登记服务，避免把旧服务的 id 显示在新情报上
      serviceId.value = null;
      return savedIntel.value;
    } finally {
      saving.value = false;
    }
  }

  /**
   * 把情报登记为数据服务（一键生成情报图层）
   *
   * enabled 固定为 0：登记后由用户在「数据管理 → 数据服务」显式启用，
   * 与既有三维模型/矢量服务的懒加载约定一致，避免保存一张图就改变球上的初始图层。
   */
  async function registerAsService(): Promise<{ ok: boolean; message: string }> {
    const intel = savedIntel.value;
    if (!intel) {
      return { ok: false, message: '请先保存情报' };
    }
    if (serviceId.value) {
      return { ok: true, message: '该情报已登记为数据服务' };
    }
    registering.value = true;
    try {
      const res = await fetchDataServiceCreate({
        name: `情报图层 · ${intel.name}`,
        category: 'vector',
        type: 'geojson',
        origin: 'internal',
        url: intel.geojsonUrl,
        params: JSON.stringify({ intelId: intel.id, model: intel.model }),
        description: `${intel.summary ?? ''}（目标 ${intel.detectionCount} 个，来自情报 #${intel.id}）`,
        group: '情报成果',
        enabled: 0,
        sort: 100,
        status: 1
      });
      if (res.error) {
        return { ok: false, message: errorText(res.error) };
      }
      const created = res.data as { id?: number } | undefined;
      serviceId.value = created?.id ?? 0;
      return { ok: true, message: '已登记为数据服务，可在「数据管理 → 数据服务」启用' };
    } finally {
      registering.value = false;
    }
  }

  /** 重新检测前清空上一次的情报状态 */
  function reset(): void {
    savedIntel.value = null;
    saveError.value = '';
    serviceId.value = null;
  }

  return {
    saving,
    registering,
    saved,
    savedIntel,
    saveError,
    serviceId,
    saveIntel,
    registerAsService,
    reset
  };
}

/** 请求错误对象 → 可展示文案（request 层返回 { msg } 或 { message }） */
function errorText(error: unknown): string {
  const detail = error as { msg?: string; message?: string } | undefined;
  return detail?.msg || detail?.message || '请求失败，请稍后重试';
}
