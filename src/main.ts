import { createApp } from 'vue';
import './plugins/assets';
import { setupVueRootValidator } from 'vite-plugin-vue-transition-root-validator/client';
import { setupAppVersionNotification, setupDayjs, setupIconifyOffline, setupLoading, setupNProgress } from './plugins';
import { setupStore } from './store';
import { setupRouter } from './router';
import App from './App.vue';

/** 加载壳最小可见时长（ms）：低于"感知瞬时"阈值，避免一闪而过 */
const LOADING_MIN_VISIBLE_MS = 400;
/** 与 index.html 中 #app-loading 的 opacity 过渡时长保持一致 */
const LOADING_FADE_MS = 240;

/** 脚本开始执行的时间：壳体在 HTML 解析阶段就已显示，这里用于保证其最小可见时长 */
const bootAt = performance.now();

/**
 * 淡出并移除首屏加载壳
 *
 * 壳体是 `#app` 的兄弟节点，Vue 挂载不会影响它；因此可以等挂载完成后再从容淡出，
 * 避免"硬切"。同时保证最小可见时长，防止快网络下壳体只闪一下（反而更显廉价）。
 */
function dismissLoadingShell() {
  const shell = document.getElementById('app-loading');
  if (!shell) return;

  const remain = Math.max(0, LOADING_MIN_VISIBLE_MS - (performance.now() - bootAt));

  window.setTimeout(() => {
    shell.classList.add('is-leaving');
    window.setTimeout(() => shell.remove(), LOADING_FADE_MS);
  }, remain);
}

async function setupApp() {
  setupLoading();

  setupNProgress();

  setupIconifyOffline();

  setupDayjs();

  const app = createApp(App);

  setupStore(app);

  await setupRouter(app);

  setupAppVersionNotification();

  setupVueRootValidator(app, {
    lang: 'zh'
  });

  app.mount('#app');

  dismissLoadingShell();
}

setupApp();
