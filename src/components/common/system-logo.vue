<template>
  <div class="app-logo">
    <svg
      width="100%"
      height="100%"
      version="1.1"
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      role="img"
      aria-label="系统标识"
    >
      <circle cx="500" cy="500" r="420" fill="url(#LinearGradient)" />
      <path
        d="M 500 210 A 380 220 0 1 1 499.9 210"
        fill="none"
        stroke="var(--logo-line-color)"
        stroke-width="28"
        opacity="0.55"
        transform="rotate(-18 500 500)"
      />
      <path
        d="M 500 270 A 280 160 0 1 1 499.9 270"
        fill="none"
        stroke="var(--logo-line-color)"
        stroke-width="18"
        opacity="0.22"
        transform="rotate(28 500 500)"
      />
      <path
        d="M 375 785 L 500 230 L 625 785"
        fill="none"
        stroke="var(--logo-line-color)"
        stroke-width="62"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.92"
      />
      <path
        d="M 440 560 H 560"
        fill="none"
        stroke="var(--logo-line-color)"
        stroke-width="56"
        stroke-linecap="round"
        opacity="0.78"
      />
      <path
        d="M 650 445 L 720 405"
        fill="none"
        stroke="var(--logo-line-color)"
        stroke-width="26"
        stroke-linecap="round"
        opacity="0.75"
      />
      <circle cx="780" cy="380" r="42" fill="var(--logo-node-color)" />
      <circle cx="720" cy="405" r="20" fill="var(--logo-node-color)" opacity="0.95" />
      <defs>
        <linearGradient id="LinearGradient" x1="240" y1="240" x2="760" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="var(--logo-color-700)" />
          <stop offset="1" stop-color="var(--logo-color-400)" />
        </linearGradient>
      </defs>
    </svg>
  </div>
</template>

<style scoped>
.app-logo {
  --logo-line-color: rgb(255 255 255 / 90%);
  --logo-node-color: rgb(255 255 255 / 96%);
  --logo-color-400: rgb(var(--primary-400-color));
  --logo-color-700: rgb(var(--primary-700-color));
}
</style>
