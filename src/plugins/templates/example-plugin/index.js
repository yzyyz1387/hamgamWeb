import { definePlugin } from '@/plugins/definePlugin'
import ExamplePluginPage from './ExamplePluginPage.vue'
import ExampleDashboardWidget from './ExampleDashboardWidget.vue'
import ExampleProfilePanel from './ExampleProfilePanel.vue'
import { createBroadcastNotificationTemplate } from '@/plugins/templates/notificationTemplates'
import { createCopyFieldReviewAction } from '@/plugins/templates/reviewActionTemplates'

export default definePlugin({
  id: '__PLUGIN_ID__',
  name: '__PLUGIN_NAME__',
  version: '1.0.0',
  description: '请把这里改成插件描述。',
  schemaVersion: '1.0.0',
  migrationStrategy: 'host-schema',
  migrationIds: [],
  migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
  capabilities: ['__PLUGIN_ID__.manage'],
  hostVersionRange: '^1.1.0',
  defaultConfig: {
    showDashboardWidget: true,
    showProfilePanel: true,
    pageTitle: '__PLUGIN_NAME__',
  },
  configSchema: [
    {
      key: 'showDashboardWidget',
      type: 'boolean',
      label: '显示后台总览卡片',
      helper: '控制总览页是否显示该插件的 widget。',
    },
    {
      key: 'showProfilePanel',
      type: 'boolean',
      label: '显示个人页面板',
      helper: '控制资料页是否显示扩展资料卡。',
    },
    {
      key: 'pageTitle',
      type: 'text',
      label: '页面标题',
      placeholder: '请输入后台页面标题',
    },
  ],
  routes: [
    {
      path: '/admin/__PLUGIN_ID__',
      name: 'admin-__PLUGIN_ID__',
      component: ExamplePluginPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['__PLUGIN_ID__.manage'],
      },
    },
  ],
  menus: [
    {
      id: 'admin-__PLUGIN_ID__',
      location: 'admin',
      title: '__PLUGIN_NAME__',
      to: '/admin/__PLUGIN_ID__',
      order: 500,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['__PLUGIN_ID__.manage'],
      },
    },
  ],
  lifecycle: {
    async install({ api }) {
      await api.logger.info('插件已安装')
    },
    async enable({ api }) {
      api.toast(`${api.pluginName} 已启用。`, 'success')
    },
    async disable({ api }) {
      await api.logger.warn('插件已停用')
    },
  },
  dashboardWidgets: [
    {
      id: '__PLUGIN_ID__-dashboard-widget',
      title: '__PLUGIN_NAME__',
      order: 500,
      span: 'md',
      component: ExampleDashboardWidget,
      when(api) {
        return api.getSetting('showDashboardWidget', true)
      },
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
      },
    },
  ],
  profilePanels: [
    {
      id: '__PLUGIN_ID__-profile-panel',
      title: '__PLUGIN_NAME__',
      target: 'self',
      order: 500,
      span: 'md',
      component: ExampleProfilePanel,
      when(api) {
        return api.getSetting('showProfilePanel', true)
      },
      meta: {
        requiresAuth: true,
      },
    },
  ],
  adminQuickActions: [
    {
      id: '__PLUGIN_ID__-quick-action',
      label: '__PLUGIN_NAME__',
      description: '打开插件后台页',
      icon: 'extension',
      target: 'admin-dashboard',
      tone: 'secondary',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
      },
      onClick(api) {
        return api.navigate('/admin/__PLUGIN_ID__')
      },
    },
  ],
  notificationTemplates: [
    createBroadcastNotificationTemplate({
      id: '__PLUGIN_ID__-broadcast-template',
      title: '__PLUGIN_NAME__ 通知模板',
      description: '快速插入插件自带通知文案。',
      tags: ['插件', '模板'],
      values: {
        title: '__PLUGIN_NAME__ 维护提醒',
        content: '这里填写 __PLUGIN_NAME__ 的标准通知内容。',
      },
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
      },
    }),
  ],
  reviewBulkActions: [
    createCopyFieldReviewAction({
      id: '__PLUGIN_ID__-copy-ids',
      label: '复制选中 ID',
      target: 'admin-submissions',
      appearance: 'secondary',
      icon: 'content_copy',
      field: 'id',
      copiedLabel: 'ID',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
      },
    }),
  ],
  eventHooks: [
    {
      id: '__PLUGIN_ID__-submission-published',
      event: 'submission.published',
      async handler(api) {
        await api.logger.info('收到 submission.published 事件')
      },
    },
  ],
})
