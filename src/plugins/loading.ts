// @unocss-include
import { getColorPalette, getRgb } from '@sa/color';
import { DARK_CLASS } from '@/constants/app';
import { localStg } from '@/utils/storage';
import { toggleHtmlClass } from '@/utils/common';

export function setupLoading() {
  const themeColor = localStg.get('themeColor') || '#646cff';
  const darkMode = localStg.get('darkMode') || false;
  const palette = getColorPalette(themeColor);

  const { r, g, b } = getRgb(themeColor);

  const primaryColor = `--primary-color: ${r} ${g} ${b}`;

  const svgCssVars = Array.from(palette.entries())
    .map(([key, value]) => `--logo-color-${key}: ${value}`)
    .join(';');

  const cssVars = `${primaryColor}; ${svgCssVars}`;

  if (darkMode) {
    toggleHtmlClass(DARK_CLASS).add();
  }

  const loadingClasses = [
    'left-0 top-0',
    'left-0 bottom-0 animate-delay-500',
    'right-0 top-0 animate-delay-1000',
    'right-0 bottom-0 animate-delay-1500'
  ];

  const dot = loadingClasses
    .map(item => {
      return `<div class="absolute w-16px h-16px bg-primary rounded-8px animate-pulse ${item}"></div>`;
    })
    .join('\n');

  const loading = `
<div class="fixed-center flex-col bg-layout" style="${cssVars}">
  <div class="w-128px h-128px">
    ${getLogoSvg()}
  </div>
  <div class="w-56px h-56px my-36px">
    <div class="relative h-full animate-spin">
      ${dot}
    </div>
  </div>
  <h2 class="text-28px font-500 text-primary">地理环境信息辅助决策系统</h2>
</div>`;

  const app = document.getElementById('app');

  if (app) {
    app.innerHTML = loading;
  }
}

function getLogoSvg() {
  const logoSvg = `<svg width="100%" height="100%" version="1.1" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <circle cx="500" cy="500" r="420" fill="url(#LinearGradient)" />
  <path
    d="M 500 210 A 380 220 0 1 1 499.9 210"
    fill="none"
    stroke="rgb(255 255 255 / 90%)"
    stroke-width="28"
    opacity="0.55"
    transform="rotate(-18 500 500)"
  />
  <path
    d="M 500 270 A 280 160 0 1 1 499.9 270"
    fill="none"
    stroke="rgb(255 255 255 / 90%)"
    stroke-width="18"
    opacity="0.22"
    transform="rotate(28 500 500)"
  />
  <path
    d="M 375 785 L 500 230 L 625 785"
    fill="none"
    stroke="rgb(255 255 255 / 90%)"
    stroke-width="62"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.92"
  />
  <path
    d="M 440 560 H 560"
    fill="none"
    stroke="rgb(255 255 255 / 90%)"
    stroke-width="56"
    stroke-linecap="round"
    opacity="0.78"
  />
  <path
    d="M 650 445 L 720 405"
    fill="none"
    stroke="rgb(255 255 255 / 90%)"
    stroke-width="26"
    stroke-linecap="round"
    opacity="0.75"
  />
  <circle cx="780" cy="380" r="42" fill="rgb(255 255 255 / 96%)" />
  <circle cx="720" cy="405" r="20" fill="rgb(255 255 255 / 96%)" opacity="0.95" />
  <defs>
    <linearGradient id="LinearGradient" x1="240" y1="240" x2="760" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="var(--logo-color-700)" />
      <stop offset="1" stop-color="var(--logo-color-400)" />
    </linearGradient>
  </defs>
</svg>`;

  return logoSvg;
}
