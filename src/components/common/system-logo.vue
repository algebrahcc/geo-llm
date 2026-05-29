<template>
  <div class="app-logo">
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="系统标识"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--logo-color-start)" />
          <stop offset="100%" stop-color="var(--logo-color-end)" />
        </linearGradient>
        <linearGradient id="logo-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
        </linearGradient>
      </defs>

      <!-- 背景圆角矩形 -->
      <rect x="2" y="2" width="44" height="44" rx="12" ry="12" fill="url(#logo-bg)" />

      <!-- 地球外圈 -->
      <circle cx="24" cy="24" r="14" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.6" />

      <!-- 经线 - 竖向椭圆 -->
      <ellipse cx="24" cy="24" rx="6" ry="14" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1" />
      <!-- 经线 - 侧向椭圆 -->
      <ellipse cx="24" cy="24" rx="11" ry="14" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" />

      <!-- 纬线 -->
      <ellipse cx="24" cy="16" rx="12" ry="3.5" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" />
      <line x1="10" y1="24" x2="38" y2="24" stroke="rgba(255,255,255,0.5)" stroke-width="0.9" />
      <ellipse cx="24" cy="32" rx="12" ry="3.5" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" />

      <!-- AI 神经网络节点 -->
      <circle cx="24" cy="24" r="2.2" fill="rgba(255,255,255,0.95)" />
      <circle cx="15" cy="16" r="1.6" fill="rgba(255,255,255,0.8)" />
      <circle cx="33" cy="16" r="1.6" fill="rgba(255,255,255,0.8)" />
      <circle cx="15" cy="32" r="1.6" fill="rgba(255,255,255,0.8)" />
      <circle cx="33" cy="32" r="1.6" fill="rgba(255,255,255,0.8)" />
      <circle cx="24" cy="12" r="1.3" fill="rgba(255,255,255,0.65)" />
      <circle cx="24" cy="36" r="1.3" fill="rgba(255,255,255,0.65)" />

      <!-- 神经网络连线 -->
      <line x1="24" y1="24" x2="15" y2="16" stroke="rgba(255,255,255,0.35)" stroke-width="0.9" />
      <line x1="24" y1="24" x2="33" y2="16" stroke="rgba(255,255,255,0.35)" stroke-width="0.9" />
      <line x1="24" y1="24" x2="15" y2="32" stroke="rgba(255,255,255,0.35)" stroke-width="0.9" />
      <line x1="24" y1="24" x2="33" y2="32" stroke="rgba(255,255,255,0.35)" stroke-width="0.9" />
      <line x1="24" y1="24" x2="24" y2="12" stroke="rgba(255,255,255,0.25)" stroke-width="0.7" />
      <line x1="24" y1="24" x2="24" y2="36" stroke="rgba(255,255,255,0.25)" stroke-width="0.7" />

      <!-- 外部连接 - 数据流 -->
      <line x1="15" y1="16" x2="24" y2="12" stroke="rgba(255,255,255,0.2)" stroke-width="0.7" />
      <line x1="33" y1="16" x2="24" y2="12" stroke="rgba(255,255,255,0.2)" stroke-width="0.7" />
      <line x1="15" y1="32" x2="24" y2="36" stroke="rgba(255,255,255,0.2)" stroke-width="0.7" />
      <line x1="33" y1="32" x2="24" y2="36" stroke="rgba(255,255,255,0.2)" stroke-width="0.7" />

      <!-- 光晕点缀 -->
      <circle cx="24" cy="24" r="4" fill="rgba(255,255,255,0.08)" />
    </svg>
  </div>
</template>

<style scoped>
.app-logo {
  --logo-color-start: #29b6ff;
  --logo-color-end: #00d4aa;
}
html.dark .app-logo {
  --logo-color-start: #1a8fd4;
  --logo-color-end: #00b892;
}
</style>
