import { definePlugin } from '@/plugins/definePlugin'
import AdminHashProcessorPage from '@/pages/AdminHashProcessorPage.vue'
import HashProcessorDashboardWidget from '@/plugins/widgets/HashProcessorDashboardWidget.vue'
import HashQuickProfilePanel from '@/plugins/panels/HashQuickProfilePanel.vue'
import HashImageCardExtra from '@/plugins/extras/HashImageCardExtra.vue'
import HashSubmissionReviewPanel from '@/plugins/panels/HashSubmissionReviewPanel.vue'
import HashAuditLogPanel from '@/plugins/panels/HashAuditLogPanel.vue'
import { showToast } from '@/lib/toast'
import { createBroadcastNotificationTemplate } from '@/plugins/templates/notificationTemplates'
import { createCopyFieldReviewAction, createSelectionSummaryReviewAction } from '@/plugins/templates/reviewActionTemplates'

export default definePlugin({
  id: 'hash-processor',
  name: '哈希处理器',
  version: '2.0.1',
  description: '为后台提供 pHash/MD5 工具页。',
  schemaVersion: '1.0.0',
  migrationStrategy: 'host-schema',
  migrationIds: [],
  migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
  capabilities: ['tools.hash-processor'],
  defaultConfig: {
    defaultTargetTable: 'images',
    defaultBatchSize: 10,
    allowSubmissionsTable: true,
    enableImageDetailActions: true,
    showDashboardWidget: true,
    showSelfProfilePanel: true,
    showImageListCardExtra: true,
    showSubmissionReviewPanel: true,
    showTopbarAction: true,
    showAuditLogPanel: true,
    showReviewBulkActions: true,
    showAdminQuickActions: true,
  },
  configSchema: [
    {
      key: 'defaultTargetTable',
      type: 'select',
      label: '默认目标表',
      options: [
        { label: 'images 表（已发布图片）', value: 'images' },
        { label: 'submissions 表（投稿）', value: 'submissions' },
      ],
      helper: '进入工具页时默认选中的目标表。',
    },
    {
      key: 'defaultBatchSize',
      type: 'number',
      label: '默认批次大小',
      min: 1,
      max: 100,
      helper: '进入工具页时默认填入的单批处理数量。',
    },
    {
      key: 'allowSubmissionsTable',
      type: 'boolean',
      label: '允许处理 submissions 表',
      helper: '关闭后工具页只允许处理 images 表。',
    },
    {
      key: 'enableImageDetailActions',
      type: 'boolean',
      label: '启用图片详情页扩展按钮',
      helper: '开启后，超级管理员可在图片详情页看到哈希相关快捷操作。',
    },
    {
      key: 'showDashboardWidget',
      type: 'boolean',
      label: '在后台总览显示插件面板',
      helper: '关闭后，不在后台总览显示哈希工具快捷面板。',
    },
    {
      key: 'showSelfProfilePanel',
      type: 'boolean',
      label: '在个人主页显示快捷面板',
      helper: '关闭后，个人资料页不再显示哈希工具快捷区。',
    },
    {
      key: 'showImageListCardExtra',
      type: 'boolean',
      label: '在图片列表卡片显示快捷扩展',
      helper: '关闭后，首页、搜索页等图片卡片上不再显示哈希快捷区。',
    },
    {
      key: 'showSubmissionReviewPanel',
      type: 'boolean',
      label: '在投稿审核侧栏显示哈希面板',
      helper: '关闭后，投稿审核弹窗侧栏不再显示哈希状态面板。',
    },
    {
      key: 'showTopbarAction',
      type: 'boolean',
      label: '在顶栏显示哈希入口',
      helper: '关闭后，顶栏不再显示哈希工具快捷入口。',
    },
    {
      key: 'showAuditLogPanel',
      type: 'boolean',
      label: '在审计日志显示工具面板',
      helper: '关闭后，审计日志卡片不再显示哈希工具快捷区。',
    },
    {
      key: 'showReviewBulkActions',
      type: 'boolean',
      label: '启用审核列表批量动作',
      helper: '关闭后，投稿审核页不再显示插件提供的批量动作。',
    },
    {
      key: 'showAdminQuickActions',
      type: 'boolean',
      label: '在后台顶部快捷区显示插件入口',
      helper: '关闭后，后台总览和投稿审核页不再显示插件快捷入口。',
    },
  ],

  lifecycle: {
    async install({ api }) {
      await api.audit({
        action: 'plugin.hash.install',
        details: { plugin: 'hash-processor' },
        level: 'info',
      })
    },
    async enable({ api }) {
      await api.audit({
        action: 'plugin.hash.enable',
        details: { plugin: 'hash-processor' },
        level: 'success',
      })
    },
    async disable({ api }) {
      await api.audit({
        action: 'plugin.hash.disable',
        details: { plugin: 'hash-processor' },
        level: 'warn',
      })
    },
  },


  adminQuickActions: [
    {
      id: 'hash-quick-dashboard',
      label: '哈希工具',
      description: '打开插件示例工具页',
      target: 'admin-dashboard',
      icon: 'data_object--rounded',
      tone: 'secondary',
      order: 420,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      onClick: ({ router }) => router.push('/admin/hash-processor'),
    },
    {
      id: 'hash-quick-submissions',
      label: '插件中心',
      description: '直接回到插件配置页',
      target: 'admin-submissions',
      icon: 'extension--rounded',
      tone: 'neutral',
      order: 610,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      onClick: ({ router }) => router.push('/admin/plugins/hash-processor'),
    },
  ],
  topbarActions: [
    {
      id: 'hash-topbar-entry',
      label: '哈希工具',
      icon: 'data_object--rounded',
      order: 260,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config }) => config.showTopbarAction !== false,
      onClick: ({ router }) => router.push('/admin/hash-processor'),
    },
  ],
  notificationTemplates: [
    createBroadcastNotificationTemplate({
      id: 'hash-template-maintenance',
      title: '图片处理维护通知',
      description: '向全站发送图片处理或维护提醒。',
      order: 260,
      tags: ['维护', '广播'],
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      values: {
        title: '图片处理任务通知',
        content: '系统正在进行图片哈希与去重维护，期间个别图片处理结果可能稍有延迟。',
      },
    }),
  ],

  auditLogPanels: [
    {
      id: 'hash-audit-overview',
      title: '哈希工具审计面板',
      order: 410,
      span: 'md',
      component: HashAuditLogPanel,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config }) => config.showAuditLogPanel !== false,
    },
  ],
  profilePanels: [
    {
      id: 'hash-quick-profile',
      title: '哈希工具快捷区',
      target: 'self',
      order: 260,
      span: 'md',
      component: HashQuickProfilePanel,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showSelfProfilePanel !== false,
    },
  ],
  reviewBulkActions: [
    createCopyFieldReviewAction({
      id: 'hash-bulk-copy-submission-ids',
      label: '复制投稿 ID',
      target: 'admin-submissions',
      order: 520,
      appearance: 'secondary',
      icon: 'content_copy--rounded',
      group: 'copy',
      field: 'id',
      copiedLabel: '投稿 ID',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, selectedItems }) => config.showReviewBulkActions !== false && Array.isArray(selectedItems) && selectedItems.length > 0,
    }),
    createCopyFieldReviewAction({
      id: 'hash-bulk-copy-submission-titles',
      label: '复制投稿标题',
      target: 'admin-submissions',
      order: 530,
      appearance: 'neutral',
      icon: 'title--rounded',
      menuOnly: true,
      variant: 'text',
      group: 'copy',
      field: 'title',
      copiedLabel: '投稿标题',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, selectedItems }) => config.showReviewBulkActions !== false && Array.isArray(selectedItems) && selectedItems.length > 0,
    }),
    createSelectionSummaryReviewAction({
      id: 'hash-bulk-selection-summary',
      label: '查看选择概况',
      target: 'admin-submissions',
      order: 540,
      appearance: 'neutral',
      icon: 'rule_folder--rounded',
      menuOnly: true,
      extractor: 'title',
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, selectedItems }) => config.showReviewBulkActions !== false && Array.isArray(selectedItems) && selectedItems.length > 0,
    }),
  ],
  imageListCardExtras: [
    {
      id: 'hash-image-card-extra',
      title: '图片卡片哈希快捷区',
      order: 320,
      component: HashImageCardExtra,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, image }) => config.showImageListCardExtra !== false && Boolean(image?.id),
    },
  ],
  submissionReviewSidebarPanels: [
    {
      id: 'hash-review-sidebar-panel',
      title: '哈希状态',
      order: 380,
      component: HashSubmissionReviewPanel,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config, submission }) => config.showSubmissionReviewPanel !== false && Boolean(submission?.id),
    },
  ],
  eventHooks: [
    {
      id: 'hash-publish-warning',
      event: 'submission.published',
      order: 100,
      handler: ({ submission }) => {
        if (!submission) return
        if (!submission.phash || !submission.file_md5) {
          showToast('提醒：该投稿发布时缺少部分哈希信息，建议在哈希处理器中补算。')
        }
      },
    },
    {
      id: 'hash-edit-warning',
      event: 'image.edit_approved',
      order: 110,
      handler: ({ submission }) => {
        const changedFile = Boolean(submission?.metadata?.has_new_file)
        if (changedFile && (!submission?.phash || !submission?.file_md5)) {
          showToast('提醒：这次图片改稿包含新文件，但缺少完整哈希信息，建议补算。')
        }
      },
    },
  ],
  dashboardWidgets: [
    {
      id: 'hash-processor-panel',
      title: '哈希工具快捷面板',
      order: 230,
      span: 'md',
      component: HashProcessorDashboardWidget,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ config }) => config.showDashboardWidget !== false,
    },
  ],
  imageDetailActions: [
    {
      id: 'open-hash-processor',
      label: '哈希工具',
      variant: 'filled-tonal',
      order: 410,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ image, config }) => Boolean(image?.id) && config.enableImageDetailActions !== false,
      onClick: ({ router }) => {
        router.push('/admin/hash-processor')
      },
    },
    {
      id: 'copy-image-hash',
      label: '复制哈希',
      variant: 'outlined',
      order: 420,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      when: ({ image, config }) => {
        if (config.enableImageDetailActions === false) return false
        return Boolean(image?.phash || image?.file_md5)
      },
      onClick: async ({ image, copyText, showToast }) => {
        const lines = []
        if (image?.phash) lines.push(`pHash: ${image.phash}`)
        if (image?.file_md5) lines.push(`MD5: ${image.file_md5}`)
        if (!lines.length) {
          showToast('当前图片还没有可复制的哈希信息。')
          return
        }
        await copyText(lines.join('\n'))
        showToast('已复制图片哈希信息。', 'success')
      },
    },
  ],
  routes: [
    {
      path: '/admin/hash-processor',
      name: 'admin-hash-processor',
      component: AdminHashProcessorPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
      order: 430,
    },
  ],
  menus: [
    {
      id: 'admin-hash-processor',
      location: 'admin',
      title: '哈希处理器',
      to: '/admin/hash-processor',
      order: 430,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['tools.hash-processor'],
      },
    },
  ],
})
