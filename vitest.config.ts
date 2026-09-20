import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 测试基座（RFC-0001 第 1 步）
 *
 * 刻意与 vite.config.ts 分离：后者会加载 Vue / UnoCSS / Cesium 等构建插件，
 * 而场景内核的边界测试全部是纯逻辑，只需要 node 环境与 `@` 别名。
 * 分开配置带来两个好处：测试启动快、不引入 WebGL / DOM 依赖。
 *
 * 只有 `src/**\/*.spec.ts` 会被收集；组件测试（如需）后续再单独开一份配置。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false,
    restoreMocks: true
  }
});
