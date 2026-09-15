import { getRgb } from '@sa/color';
import { DARK_CLASS } from '@/constants/app';
import { localStg } from '@/utils/storage';
import { toggleHtmlClass } from '@/utils/common';

/**
 * 首屏加载壳的主题注入
 *
 * 壳体（`#app-loading`）本身是 `index.html` 里的静态标记，样式内联、零额外请求，
 * 因此 JS 到达前就能显示。这里只做两件事：
 * 1. 把用户主题色写进壳体，供细扫光进度条使用（与路由进度条同源，观感一致）；
 * 2. 按缓存同步深浅标记，避免壳体与随后的应用首屏不一致。
 *
 * 标识的渐变不走主题色，而是用固定的品牌色（与 `system-logo.vue` 一致），
 * 因此直接在 `index.html` 里用 CSS 定义，无需 JS 参与。
 *
 * 注意：变量写在壳体元素上而不是 `:root` —— 挂在根节点会以行内样式压过
 * 运行时生成的主题变量（#theme-vars），导致之后更换主题色失效。
 *
 * 壳体的移除与淡出见 `src/main.ts`。
 */
export function setupLoading() {
  const darkMode = localStg.get('darkMode') || false;

  if (darkMode) {
    toggleHtmlClass(DARK_CLASS).add();
  }

  const shell = document.getElementById('app-loading');
  if (!shell) return;

  const { r, g, b } = getRgb(localStg.get('themeColor') || '#646cff');

  shell.style.setProperty('--primary-color', `${r} ${g} ${b}`);
}
