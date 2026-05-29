/** Default theme settings */
export const themeSettings: App.Theme.ThemeSetting = {
  themeScheme: 'dark',
  grayscale: false,
  colourWeakness: false,
  recommendColor: false,
  themeColor: '#2B6BFF',
  themeRadius: 8,
  otherColor: {
    info: '#2B6BFF',
    success: '#2EE59D',
    warning: '#FBBF24',
    error: '#FB7185'
  },
  isInfoFollowPrimary: true,
  layout: {
    mode: 'horizontal',
    scrollMode: 'content'
  },
  page: {
    animate: true,
    animateMode: 'fade-slide'
  },
  header: {
    height: 56,
    breadcrumb: {
      visible: true,
      showIcon: true
    },
    multilingual: {
      visible: true
    },
    globalSearch: {
      visible: true
    }
  },
  tab: {
    visible: false,
    cache: true,
    height: 44,
    mode: 'chrome',
    closeTabByMiddleClick: false
  },
  fixedHeaderAndTab: true,
  sider: {
    inverted: false,
    width: 280,
    collapsedWidth: 64,
    mixWidth: 90,
    mixCollapsedWidth: 64,
    mixChildMenuWidth: 200,
    autoSelectFirstMenu: false
  },
  footer: {
    visible: false,
    fixed: false,
    height: 48,
    right: true
  },
  watermark: {
    visible: false,
    text: 'Geo-LLM',
    enableUserName: false,
    enableTime: false,
    timeFormat: 'YYYY-MM-DD HH:mm'
  },
  tokens: {
    light: {
      colors: {
        container: 'rgb(255, 255, 255)',
        layout: 'rgb(247, 250, 252)',
        inverted: 'rgb(0, 20, 40)',
        'base-text': 'rgb(31, 31, 31)'
      },
      boxShadow: {
        header: '0 1px 2px rgb(0, 21, 41, 0.08)',
        sider: '2px 0 8px 0 rgb(29, 35, 41, 0.05)',
        tab: '0 1px 2px rgb(0, 21, 41, 0.08)'
      }
    },
    dark: {
      colors: {
        container: 'rgb(6, 20, 38)',
        layout: 'rgb(4, 16, 28)',
        inverted: 'rgb(6, 20, 38)',
        'base-text': 'rgb(228, 242, 255)'
      },
      boxShadow: {
        header: '0 1px 0 rgba(36, 112, 196, 0.18)',
        sider: '2px 0 8px 0 rgb(0, 0, 0, 0.22)',
        tab: '0 1px 2px rgb(0, 0, 0, 0.25)'
      }
    }
  }
};

/**
 * Override theme settings
 *
 * If publish new version, use `overrideThemeSettings` to override certain theme settings
 */
export const overrideThemeSettings: Partial<App.Theme.ThemeSetting> = {};
