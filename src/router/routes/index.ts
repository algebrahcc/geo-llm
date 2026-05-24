import type { RouteRecordRaw } from 'vue-router';
import type { CustomRoute, ElegantConstRoute, ElegantRoute } from '@elegant-router/types';
import BaseLayout from '@/layouts/base-layout/index.vue';
import { generatedRoutes } from '../elegant/routes';
import { layouts, views } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';

const customRoutes: CustomRoute[] = [
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
    name: 'globe-fullscreen',
    path: '/globe-fullscreen',
    component: 'layout.blank$view.globe',
    meta: {
      title: 'Web球',
      hideInMenu: true
    }
  }
];

function createAgentElegantRoute() {
  return {
    name: 'agent',
    path: '/agent',
    meta: {
      title: 'AI Agent',
      order: 8,
      icon: 'mdi:robot'
    },
    children: [
      {
        name: 'agent_workbench',
        path: '/agent/workbench',
        meta: {
          title: '工作台',
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
          iconFontSize: 18
        }
      },
      {
        name: 'agent_test',
        path: '/agent/test',
        meta: {
          title: '测试',
          icon: 'mdi:flask-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'agent_task_detail',
        path: '/agent/task-detail',
        meta: {
          title: '任务详情',
          hideInMenu: true,
          activeMenu: 'agent_workbench'
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
    redirect: { name: 'agent_workbench' },
    meta: {
      title: 'AI Agent',
      order: 8,
      icon: 'mdi:robot'
    },
    children: [
      {
        name: 'agent_workbench',
        path: 'workbench',
        component: () => import('@/views/agent/index.vue'),
        meta: {
          title: '工作台',
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
          iconFontSize: 18
        }
      },
      {
        name: 'agent_test',
        path: 'test',
        component: () => import('@/views/agent/modules/agent-test-page.vue'),
        meta: {
          title: '测试',
          icon: 'mdi:flask-outline',
          iconFontSize: 18
        }
      },
      {
        name: 'agent_task_detail',
        path: 'task-detail',
        component: () => import('@/views/agent/modules/agent-task-detail-page.vue'),
        meta: {
          title: '任务详情',
          hideInMenu: true,
          activeMenu: 'agent_workbench'
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
      title: '知识库',
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
      title: '知识库',
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
    createKnowledgeElegantRoute() as unknown as ElegantRoute,
    createAgentElegantRoute() as unknown as ElegantRoute,
    ...generatedRoutes.filter(item => item.name !== 'knowledge' && item.name !== 'agent')
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
    routes.filter(route => route.name !== 'knowledge' && route.name !== 'agent'),
    layouts,
    views
  );

  return [...vueRoutes, createKnowledgeVueRoute(), createAgentVueRoute()];
}
