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
      <!--
        标识：数字地球。
        圆球 + 一条经线 + 一条赤道 —— 只用三笔经纬网概括 GIS/数字地球，不做填充，
        也不使用节点连线那类通用科技符号。外圈略粗、内部经纬略细，保证缩到 16px
        时轮廓仍然清楚。
        配色遵循 Calcite（Esri）：品牌色只作强调色、不铺背景；深色不取反，把同一个蓝调亮。
      -->
      <circle cx="24" cy="24" r="15" fill="none" stroke="var(--logo-color)" stroke-width="3.2" />
      <ellipse cx="24" cy="24" rx="7" ry="15" fill="none" stroke="var(--logo-color)" stroke-width="2.4" />
      <path d="M 9.8 24 H 38.2" fill="none" stroke="var(--logo-color)" stroke-width="2.4" />
    </svg>
  </div>
</template>

<style scoped>
/*
 * 标识只用单色描边，不铺背景色块（品牌色当背景是 Calcite 明确反对的做法）。
 * 深色不作简单取反，而是把同一个蓝调亮一档，保证深底上的可读性。
 */
.app-logo {
  --logo-color: #2547c7;
}
html.dark .app-logo {
  --logo-color: #5b93ff;
}
</style>
