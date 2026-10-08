import type { RouteRecordRaw } from 'vue-router';
import type { CustomRoute, ElegantConstRoute, ElegantRoute } from '@elegant-router/types';
import BaseLayout from '@/layouts/base-layout/index.vue';
import { generatedRoutes } from '../elegant/routes';
import { layouts, views } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';

const customRoutes = [
  {
    name: 'screen-fullscreen',
    path: '/screen-fullscreen',
    component: 'layout.blank$view.screen',
    meta: {
      title: '统计大屏',
      hideInMenu: true
    }
  },
  {
    name: 'planning-fullscreen',
    path: '/planning-fullscreen',
    component: 'layout.blank$view.planning',
    meta: {
      title: '机动路线规划',
      hideInMenu: true
    }
  },
  {
    name: 'river-fullscreen',
    path: '/river-fullscreen',
    component: 'layout.blank$view.river',
    meta: {
      title: '渡河工程保障',
      hideInMenu: true
    }
  }
] as unknown as CustomRoute[];

/**
 * 典型场景分组：渡河工程保障 / 机动路线规划 / 城市街景。
 *
 * 子项显式写 order：菜单排序不依赖数组顺序，日后增删项不会引起位置漂移。
 */
function createScenarioElegantRoute() {
  return {
    name: 'scenario',
    path: '/scenario',
    redirect: '/scenario/river',
    meta: {
      title: '典型场景',
      order: 5,
      icon: 'mdi:map-marker-radius'
    },
    children: [
      {
        name: 'scenario_river',
        path: '/scenario/river',
        // 多级子路由不支持 "layout.$view" 组合写法（组合拆包仅限单级路由），全屏地图页直接挂视图即可
        component: 'view.river',
        meta: {
          title: '渡河工程保障',
          icon: 'mdi:ferry',
          order: 1
        }
      },
      {
        name: 'scenario_planning',
        path: '/scenario/planning',
        component: 'view.planning',
        meta: {
          title: '机动路线规划',
          icon: 'mdi:routes',
          order: 2
        }
      },
      {
        // 城市街景：球上呈现街景点与街景路线，点开即是全景浮窗
        name: 'scenario_streetview',
        path: '/scenario/streetview',
        component: 'view.streetview',
        meta: {
          title: '城市街景',
          // MDI 图标集中没有名为 street-view 的图标（只有 google-street-view），用后者否则菜单图标空缺
          icon: 'mdi:google-street-view',
          order: 3
        }
      },
      {
        // 地下空间：本地三维模型清单 + 剖切浏览（剖开楼板看内部结构）
        name: 'scenario_underground',
        path: '/scenario/underground',
        component: 'view.underground',
        meta: {
          title: '地下空间',
          icon: 'mdi:cube-scan',
          order: 4
        }
      },
      {
        // 环境研判：框选区域 → 规则算通过性/关键节点/断堵卡/通路适宜等级 → 模型归纳质疑 → 复核归档
        name: 'scenario_situation',
        path: '/scenario/situation',
        component: 'view.situation',
        meta: {
          title: '环境研判',
          icon: 'mdi:map-search-outline',
          order: 5
        }
      }
    ]
  } as unknown as ElegantRoute;
}

function createAgentElegantRoute() {
  return {
    name: 'agent',
    path: '/agent',
    meta: {
      title: '智能体',
      order: 8,
      icon: 'mdi:robot'
    },
    children: [
      {
        name: 'agent_index',
        path: '/agent',
        meta: {
          title: '应用列表',
          icon: 'mdi:view-grid-plus-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'agent_config',
        path: '/agent/config',
        meta: {
          title: '配置',
          icon: 'mdi:tune-variant',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_test',
        path: '/agent/test',
        meta: {
          title: '测试',
          icon: 'mdi:flask-outline',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_tools',
        path: '/agent/tools',
        meta: {
          title: '工具 / MCP',
          icon: 'mdi:puzzle-outline',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_monitor',
        path: '/agent/monitor',
        meta: {
          title: '运行监控',
          icon: 'mdi:chart-line',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      }
    ]
  } satisfies ElegantConstRoute;
}

function createAgentVueRoute(): RouteRecordRaw {
  return {
    name: 'agent',
    path: '/agent',
    component: BaseLayout,
    redirect: { name: 'agent_index' },
    meta: {
      title: 'AI Agent',
      order: 8,
      icon: 'mdi:robot'
    },
    children: [
      {
        name: 'agent_index',
        path: '',
        component: () => import('@/views/agent/index.vue'),
        meta: {
          title: '应用列表',
          icon: 'mdi:view-grid-plus-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'agent_config',
        path: 'config',
        component: () => import('@/views/agent/modules/agent-config-page.vue'),
        meta: {
          title: '配置',
          icon: 'mdi:tune-variant',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_test',
        path: 'test',
        component: () => import('@/views/agent/modules/agent-test-page.vue'),
        meta: {
          title: '测试',
          icon: 'mdi:flask-outline',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_tools',
        path: 'tools',
        component: () => import('@/views/agent/modules/agent-tools-page.vue'),
        meta: {
          title: '工具 / MCP',
          icon: 'mdi:puzzle-outline',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      },
      {
        name: 'agent_monitor',
        path: 'monitor',
        component: () => import('@/views/agent/modules/agent-monitor-page.vue'),
        meta: {
          title: '运行监控',
          icon: 'mdi:chart-line',
          iconFontSize: 18,
          activeMenu: 'agent'
        }
      }
    ]
  };
}

function createKnowledgeElegantRoute() {
  return {
    name: 'knowledge',
    path: '/knowledge',
    meta: {
      title: '地理环境知识库',
      order: 7,
      icon: 'mdi:book-open-variant'
    },
    children: [
      {
        name: 'knowledge_overview',
        path: '/knowledge/overview',
        meta: {
          title: '知识总览',
          icon: 'mdi:book-open-page-variant-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_collections',
        path: '/knowledge/collections',
        meta: {
          title: '集合管理',
          icon: 'mdi:folder-multiple-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_retrieval',
        path: '/knowledge/retrieval',
        meta: {
          title: '检索测试',
          icon: 'mdi:magnify-scan',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_detail',
        path: '/knowledge/detail',
        meta: {
          title: '文档详情',
          hideInMenu: true,
          activeMenu: 'knowledge_overview'
        }
      },
      {
        name: 'knowledge_import',
        path: '/knowledge/import',
        meta: {
          title: '导入知识',
          hideInMenu: true,
          activeMenu: 'knowledge_overview'
        }
      }
    ]
  } satisfies ElegantConstRoute;
}

function createKnowledgeVueRoute(): RouteRecordRaw {
  return {
    name: 'knowledge',
    path: '/knowledge',
    component: BaseLayout,
    redirect: { name: 'knowledge_overview' },
    meta: {
      title: '地理环境知识库',
      order: 7,
      icon: 'mdi:book-open-variant'
    },
    children: [
      {
        name: 'knowledge_overview',
        path: 'overview',
        component: () => import('@/views/knowledge/index.vue'),
        meta: {
          title: '知识总览',
          icon: 'mdi:book-open-page-variant-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_collections',
        path: 'collections',
        component: () => import('@/views/knowledge/collections.vue'),
        meta: {
          title: '集合管理',
          icon: 'mdi:folder-multiple-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_retrieval',
        path: 'retrieval',
        component: () => import('@/views/knowledge/retrieval.vue'),
        meta: {
          title: '检索测试',
          icon: 'mdi:magnify-scan',
          iconFontSize: 18
        }
      },
      {
        name: 'knowledge_detail',
        path: 'detail',
        component: () => import('@/views/knowledge/detail.vue'),
        meta: {
          title: '文档详情',
          hideInMenu: true,
          activeMenu: 'knowledge_overview'
        }
      },
      {
        name: 'knowledge_import',
        path: 'import',
        component: () => import('@/views/knowledge/import.vue'),
        meta: {
          title: '导入知识',
          hideInMenu: true,
          activeMenu: 'knowledge_overview'
        }
      }
    ]
  };
}

/** create routes when the auth route mode is static */
export function createStaticRoutes() {
  const constantRoutes: ElegantRoute[] = [];

  const authRoutes: ElegantRoute[] = [];

  [
    ...customRoutes,
    createScenarioElegantRoute() as unknown as ElegantRoute,
    createKnowledgeElegantRoute() as unknown as ElegantRoute,
    createAgentElegantRoute() as unknown as ElegantRoute,
    // 剔除已由分组接管的顶层生成路由：river / planning / streetview / underground / situation 在「典型场景」下，
    // knowledge / agent 各有自建分组 —— 否则它们会各自多出一个顶层菜单项
    ...generatedRoutes.filter(
      item => !['knowledge', 'agent', 'river', 'planning', 'streetview', 'underground', 'situation'].includes(item.name)
    )
  ].forEach(item => {
    if (item.meta?.constant) {
      constantRoutes.push(item);
    } else {
      authRoutes.push(item);
    }
  });

  return {
    constantRoutes,
    authRoutes
  };
}

/**
 * Get auth vue routes
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  const vueRoutes = transformElegantRoutesToVueRoutes(
    routes.filter(route => !['knowledge', 'agent'].includes(route.name)),
    layouts,
    views
  );

  return [...vueRoutes, createKnowledgeVueRoute(), createAgentVueRoute()];
}
