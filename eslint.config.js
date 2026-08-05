import { defineConfig } from '@soybeanjs/eslint-config-vue';

export default defineConfig({
  'vue/component-name-in-template-casing': [
    'warn',
    'PascalCase',
    {
      registeredComponentsOnly: false,
      ignores: ['/^icon-/']
    }
  ],
  'no-underscore-dangle': ['error', { allow: ['__APP_CONFIG__'] }],

  // ─── 以下规则与 Vue 官方推荐或 TS 类型系统冲突，项目统一关闭 ───
  // Vue 官方文档推荐 kebab-case 事件名，父子组件均以 @toggle-xxx 监听，改 camelCase 需同步大量父组件
  'vue/custom-event-name-casing': 'off',
  // 仅用于渲染后端检索结果的内部高亮片段，内容可信
  'vue/no-v-html': 'off',
  // 模板局部变量遮蔽无害
  'vue/no-template-shadow': 'off',
  // 模板 ref 字符串绑定误报
  'vue/no-unused-refs': 'off',
  // 保留 emit 声明供父组件 @监听
  'vue/no-unused-emit-declarations': 'off',
  // 保留 prop 供父组件传入
  'vue/no-unused-properties': 'off',
  // 必传 prop 由 interface 约束，不强制 default（与项目 interface Props 模式一致）
  'vue/require-default-prop': 'off',
  // TS 文件类型由 vue-tsc 负责，DOM 全局类型（如 HTMLInputElement）本就可用
  'no-undef': 'off',
  // 模板/脚本中使用的 DOM 全局类型（如 HTMLInputElement）本应可用，类型检查交给 vue-tsc
  'vue/no-undef-properties': 'off'
});
