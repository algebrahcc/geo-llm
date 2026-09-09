/**
 * 浮动面板通用事件契约
 *
 * 背景：此前「折叠 / 关闭」这对事件在 5+ 个面板里各写一遍字符串，
 * 且命名分裂为 kebab-case（`toggle-collapse`）与 camelCase（`toggleCollapse`）两种。
 * 拼写或命名不一致时编译期无感、运行期静默失效（典型症状：事件发出但父组件没反应）。
 *
 * 约定：
 * - 一律 kebab-case，与模板中 `@toggle-collapse` 的监听写法保持一致
 * - 面板组件通过 `defineEmits<PanelEmits & { ...自身事件 }>()` 交叉合并
 * - 事件名只在本文档定义，组件不重复书写字符串
 */

/** 面板外壳的通用事件（折叠 / 关闭） */
export interface PanelEmits {
  /** 折叠或展开面板 */
  'toggle-collapse': [];
  /** 关闭面板 */
  close: [];
}

/** 结果类面板通用事件（在折叠/关闭之上追加选中能力） */
export interface SelectablePanelEmits<T extends string = string> extends PanelEmits {
  /** 选中某项 */
  select: [key: T];
}
