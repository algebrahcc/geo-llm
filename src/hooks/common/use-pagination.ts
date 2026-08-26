import { onMounted, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * 列表分页通用逻辑
 *
 * 封装系统页面反复出现的胶水代码：loading/tableData/total 三个状态，
 * loadData() 拉取、onPageChange/onPageSizeChange 翻页（切换每页条数时重置到第 1 页）。
 * api 层约定为 createFlatRequest 实例：返回 { data, error }，data 为 { list, total }。
 *
 * 用法：
 * ```ts
 * const query = reactive<Api.System.UserQuery>({ page: 1, size: 10 });
 * const { loading, tableData, total, loadData, onPageChange, onPageSizeChange } = usePagination({
 *   query,
 *   fetchPage: fetchUserPage
 * });
 * ```
 */

/** 分页查询参数的公共形状（各命名空间 Query 类型均含 page/size） */
export interface PageQuery {
  page: number;
  size: number;
}

/** 分页响应数据的公共形状（各命名空间 PageResult 均含 list/total） */
export interface PaginationData<T> {
  list?: T[];
  total?: number;
}

export interface UsePaginationOptions<T, Q extends PageQuery> {
  /** 响应式查询参数，翻页时直接改写其 page/size */
  query: Q;
  /** 分页查询函数，返回 createFlatRequest 的 { data, error } */
  fetchPage: (query: Q) => Promise<{ data: PaginationData<T> | null; error: unknown }>;
  /** 是否在 onMounted 时自动加载，默认 true */
  immediate?: boolean;
}

export function usePagination<T, Q extends PageQuery>(
  options: UsePaginationOptions<T, Q>
): {
  loading: Ref<boolean>;
  tableData: Ref<T[]>;
  total: Ref<number>;
  loadData: () => Promise<void>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
} {
  const { query, fetchPage, immediate } = options;

  const loading = ref(false);
  const tableData: Ref<T[]> = ref([]);
  const total = ref(0);

  async function loadData() {
    loading.value = true;
    try {
      const { data, error } = await fetchPage(query);
      if (!error && data) {
        tableData.value = data.list || [];
        total.value = data.total || 0;
      }
    } finally {
      loading.value = false;
    }
  }

  /** 页码变化：直接刷新当前页 */
  function onPageChange(page: number) {
    query.page = page;
    loadData();
  }

  /** 每页条数变化：跳回第 1 页再刷新 */
  function onPageSizeChange(size: number) {
    query.size = size;
    query.page = 1;
    loadData();
  }

  onMounted(() => {
    if (immediate !== false) {
      loadData();
    }
  });

  return { loading, tableData, total, loadData, onPageChange, onPageSizeChange };
}
