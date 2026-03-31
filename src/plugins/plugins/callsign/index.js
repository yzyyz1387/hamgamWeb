import { definePlugin } from '@/plugins/definePlugin'
import CallsignApplyPage from '@/pages/CallsignApplyPage.vue'
import AdminCallsignPage from '@/pages/AdminCallsignPage.vue'
import CallsignDashboardWidget from '@/plugins/widgets/CallsignDashboardWidget.vue'
import CallsignSelfProfilePanel from '@/plugins/panels/CallsignSelfProfilePanel.vue'
import CallsignPublicProfilePanel from '@/plugins/panels/CallsignPublicProfilePanel.vue'
import CallsignUserListExtra from '@/plugins/extras/CallsignUserListExtra.vue'
import CallsignAdminUserFields from '@/plugins/extras/CallsignAdminUserFields.vue'
import CallsignAdminApplicationFields from '@/plugins/extras/CallsignAdminApplicationFields.vue'
import CallsignNotificationPanel from '@/plugins/panels/CallsignNotificationPanel.vue'
import { createDirectNotificationTemplate } from '@/plugins/templates/notificationTemplates'
import { createCopyFieldReviewAction, createSelectionSummaryReviewAction } from '@/plugins/templates/reviewActionTemplates'

export default definePlugin({
  id: 'callsign-review',
  name: '呼号系统',
  version: '1.9.1',
  description: '提供呼号申请页面和后台审核能力。',
  schemaVersion: '1.0.0',
  migrationStrategy: 'host-schema',
  migrationIds: [],
  migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
  capabilities: ['callsign.review'],
  defaultConfig: {
    maxUploadSizeMB: 10,
    autoUppercaseCallsign: true,
    customNotice: '请上传业余无线电操作证书或执照扫描件（PDF / 图片），建议对证件号等敏感信息添加水印或打码处理后再上传。文件大小不超过 10MB。',
    showDashboardWidget: true,
    showSelfProfilePanel: true,
    showPublicProfilePanel: true,
    showUserListItemExtra: true,
    showAdminUserActions: true,
    showAdminListFields: true,
    showTopbarAction: true,
    showNotificationPanel: true,
    showAdminQuickActions: true,
  },
  lifecycle: {
    async install({ api }) {
      await api.audit({
        action: 'plugin.callsign.install',
        details: { plugin: 'callsign-review' },
        level: 'info',
      })
    },
    async enable({ api }) {
      await api.audit({
        action: 'plugin.callsign.enable',
        details: { plugin: 'callsign-review' },
        level: 'success',
      })
    },
    async disable({ api }) {
      await api.audit({
        action: 'plugin.callsign.disable',
        details: { plugin: 'callsign-review' },
        level: 'warn',
      })
    },
  },
  configSchema: [
    {
      key: 'maxUploadSizeMB',
      type: 'number',
      label: '上传大小上限（MB）',
      min: 1,
      max: 50,
      helper: '申请页允许上传的证明文件大小上限。',
    },
    {
      key: 'autoUppercaseCallsign',
      type: 'boolean',
      label: '自动转为大写呼号',
      helper: '开启后，用户输入的呼号会在提交前自动转换为大写。',
    },
    {
      key: 'customNotice',
      type: 'textarea',
      label: '申请页提示文案',
      rows: 3,
      minRows: 3,
      maxRows: 6,
      helper: '展示在用户申请呼号页面顶部的说明文字。',
    },
    {
      key: 'showDashboardWidget',
      type: 'boolean',
      label: '在后台总览显示插件面板',
      helper: '关闭后，不在后台总览显示呼号审核概览卡片。',
    },
    {
      key: 'showSelfProfilePanel',
      type: 'boolean',
      label: '在个人主页显示呼号面板',
      helper: '关闭后，个人资料页不再显示呼号认证状态面板。',
    },
    {
      key: 'showPublicProfilePanel',
      type: 'boolean',
      label: '在公开用户页显示无线电档案面板',
      helper: '关闭后，公开用户页不再显示呼号档案补充面板。',
    },
    {
      key: 'showUserListItemExtra',
      type: 'boolean',
      label: '在用户列表项显示扩展信息',
      helper: '关闭后，团队页等用户卡片不再显示插件补充徽标。',
    },
    {
      key: 'showAdminUserActions',
      type: 'boolean',
      label: '在后台用户行显示快捷动作',
      helper: '关闭后，用户管理页不再显示呼号快捷动作。',
    },
    {
      key: 'showAdminListFields',
      type: 'boolean',
      label: '在后台列表显示插件字段',
      helper: '关闭后，后台用户管理和呼号审核列表不再显示无线电补充字段。',
    },
    {
      key: 'showTopbarAction',
      type: 'boolean',
      label: '在顶栏显示呼号入口',
      helper: '关闭后，顶栏不再显示呼号申请快捷入口。',
    },
    {
      key: 'showNotificationPanel',
      type: 'boolean',
      label: '在通知中心显示呼号状态面板',
      helper: '关闭后，通知中心不再显示呼号最近申请概览。',
    },
    {
      key: 'showAdminQuickActions',
      type: 'boolean',
      label: '在后台顶部快捷区显示插件入口',
      helper: '关闭后，后台总览和审核页不再显示呼号快捷入口。',
    },
  ],


  adminQuickActions: [
    {
      id: 'callsign-quick-dashboard',
      label: '呼号审核队列',
      description: '快速打开呼号申请审核列表',
      target: 'admin-dashboard',
      icon: 'settings_input_antenna--rounded',
      tone: 'secondary',
      order: 320,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      badge: ({ stats }) => stats?.pendingCallsigns || null,
      onClick: ({ router }) => router.push('/admin/callsign'),
    },
    {
      id: 'callsign-quick-admin-page',
      label: '申请页预览',
      description: '核对前台呼号申请表和提示文案',
      target: 'admin-callsign',
      icon: 'visibility--rounded',
      tone: 'secondary',
      order: 330,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      onClick: ({ router }) => router.push('/callsign-apply'),
    },
  ],
  topbarActions: [
    {
      id: 'callsign-topbar-entry',
      label: '呼号认证',
      icon: 'settings_input_antenna--rounded',
      order: 210,
      meta: { requiresAuth: true },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showTopbarAction !== false,
      onClick: ({ router }) => router.push('/callsign-apply'),
    },
  ],
  notificationTemplates: [
    createDirectNotificationTemplate({
      id: 'callsign-template-approved',
      title: '呼号审核通过',
      description: '快速通知用户呼号申请已通过。',
      order: 210,
      tags: ['呼号', '通过'],
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN'], capabilities: ['callsign.review'] },
      values: {
        title: '呼号审核通过',
        content: '你的呼号申请已审核通过，个人资料页会同步显示新的呼号信息。',
      },
    }),
    createDirectNotificationTemplate({
      id: 'callsign-template-rejected',
      title: '呼号补件提醒',
      description: '提醒用户根据审核意见补充材料后重新提交。',
      order: 220,
      tone: 'secondary',
      tags: ['呼号', '补件'],
      meta: { requiresAuth: true, roles: ['SUPER_ADMIN'], capabilities: ['callsign.review'] },
      values: {
        title: '呼号申请需要补充材料',
        content: '你的呼号申请需要补充或修正材料，请打开呼号申请页查看审核备注后重新提交。',
      },
    }),
  ],

  notificationCenterPanels: [
    {
      id: 'callsign-notification-panel',
      title: '呼号状态',
      order: 210,
      span: 'md',
      component: CallsignNotificationPanel,
      meta: { requiresAuth: true },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showNotificationPanel !== false,
    },
  ],
  profilePanels: [
    {
      id: 'callsign-self-status',
      title: '呼号认证状态',
      target: 'self',
      order: 210,
      span: 'md',
      component: CallsignSelfProfilePanel,
      meta: { requiresAuth: true },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showSelfProfilePanel !== false,
    },
    {
      id: 'callsign-public-identity',
      title: '无线电档案',
      target: 'public',
      order: 220,
      span: 'md',
      component: CallsignPublicProfilePanel,
      meta: {},
      when: ({ config, profile }) =>
        config.showPublicProfilePanel !== false
        && Boolean(
          profile?.callsign
          || profile?.grid_locator
          || (Array.isArray(profile?.certifications) && profile.certifications.length),
        ),
    },
  ],
  userListItemExtras: [
    {
      id: 'callsign-user-list-extra',
      title: '用户列表补充信息',
      order: 310,
      component: CallsignUserListExtra,
      meta: {},
      when: ({ config, profile }) => config.showUserListItemExtra !== false && Boolean(profile?.grid_locator || profile?.uid),
    },
  ],
  adminListFields: [
    {
      id: 'callsign-admin-user-fields',
      title: '后台用户无线电字段',
      target: 'admin-users',
      order: 360,
      component: CallsignAdminUserFields,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['user.manage'],
      },
      when: ({ config, row, profile }) => config.showAdminListFields !== false && Boolean(row?.uid || row?.callsign || profile?.grid_locator),
    },
    {
      id: 'callsign-admin-application-fields',
      title: '呼号审核补充字段',
      target: 'admin-callsign',
      order: 370,
      component: CallsignAdminApplicationFields,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config, row, profile }) => config.showAdminListFields !== false && Boolean(profile?.uid || profile?.grid_locator || row?.file_name),
    },
  ],
  reviewBulkActions: [
    createCopyFieldReviewAction({
      id: 'callsign-bulk-copy-callsigns',
      label: '复制选中呼号',
      target: 'admin-callsign',
      order: 340,
      appearance: 'primary',
      group: 'copy',
      summary: '批量整理呼号结果',
      field: (item) => item.callsign,
      copiedLabel: '呼号',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
    }),
    createCopyFieldReviewAction({
      id: 'callsign-bulk-copy-uids',
      label: '复制选中 UID',
      target: 'admin-callsign',
      order: 350,
      appearance: 'secondary',
      icon: 'badge--rounded',
      menuOnly: true,
      group: 'copy',
      field: (item) => item.profiles?.uid,
      copiedLabel: 'UID',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
    }),
    createSelectionSummaryReviewAction({
      id: 'callsign-bulk-selection-summary',
      label: '查看选择概况',
      target: 'admin-callsign',
      order: 360,
      menuOnly: true,
      appearance: 'neutral',
      icon: 'summarize--rounded',
      group: 'inspect',
      extractor: (item) => item.callsign || item.profiles?.uid,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
    }),
  ],
  adminTableRowActions: [
    {
      id: 'callsign-admin-open-public-profile',
      label: '查看用户页',
      target: 'admin-users',
      variant: 'text',
      size: 'small',
      order: 320,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['user.manage'],
      },
      when: ({ config, row }) => config.showAdminUserActions !== false && Boolean(row?.uid),
      onClick: ({ row, router }) => {
        if (row?.uid) router.push(`/user/${row.uid}`)
      },
    },
    {
      id: 'callsign-admin-copy-callsign',
      label: '复制呼号',
      target: 'admin-users',
      variant: 'text',
      size: 'small',
      order: 330,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config, row }) => config.showAdminUserActions !== false && Boolean(row?.callsign),
      onClick: async ({ row, copyText, showToast }) => {
        if (!row?.callsign) return
        await copyText(row.callsign)
        showToast('已复制呼号。', 'success')
      },
    },
    {
      id: 'callsign-admin-review-open-public-profile',
      label: '查看用户页',
      target: 'admin-callsign',
      variant: 'text',
      size: 'small',
      order: 340,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config, row }) => config.showAdminUserActions !== false && Boolean(row?.profiles?.uid || row?.user_uid),
      onClick: ({ row, router }) => {
        const uid = row?.profiles?.uid || row?.user_uid
        if (uid) router.push(`/user/${uid}`)
      },
    },
    {
      id: 'callsign-admin-review-copy-callsign',
      label: '复制呼号',
      target: 'admin-callsign',
      variant: 'text',
      size: 'small',
      order: 350,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config, row }) => config.showAdminUserActions !== false && Boolean(row?.callsign),
      onClick: async ({ row, copyText, showToast }) => {
        if (!row?.callsign) return
        await copyText(row.callsign)
        showToast('已复制呼号。', 'success')
      },
    },
  ],
  dashboardWidgets: [
    {
      id: 'callsign-overview',
      title: '呼号审核概览',
      order: 220,
      span: 'lg',
      component: CallsignDashboardWidget,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      when: ({ config }) => config.showDashboardWidget !== false,
    },
  ],
  routes: [
    {
      path: '/callsign-apply',
      name: 'callsign-apply',
      component: CallsignApplyPage,
      meta: { requiresAuth: true },
      order: 100,
    },
    {
      path: '/admin/callsign',
      name: 'admin-callsign',
      component: AdminCallsignPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      order: 420,
    },
  ],
  menus: [
    {
      id: 'admin-callsign',
      location: 'admin',
      title: '呼号审核',
      to: '/admin/callsign',
      order: 420,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['callsign.review'],
      },
      badge: ({ adminStore }) => adminStore.pendingCallsigns || null,
    },
  ],
})
