# 插件开发文档

这份文档面向项目内部开发者，用来说明当前插件系统的目录约定、生命周期、稳定 API、扩展点清单，以及如何从模板快速创建一个新插件。

## 一、先看结论

当前插件系统已经具备这些基础能力：

- 插件注册、启停、配置持久化
- 插件菜单、路由、后台快捷区
- 后台总览 widgets
- 个人页 / 公开资料页扩展面板
- 图片详情动作、图片列表卡片扩展
- 用户列表项扩展
- 后台行级动作、字段扩展、审核侧栏扩展
- 审核批量动作
- 顶栏入口、通知中心扩展、审计日志扩展
- 插件生命周期、稳定 API、事件总线

当前建议的插件开发方式是：

1. 从模板脚手架创建一个新插件目录
2. 只通过 `definePlugin()` 和稳定 API 接入宿主
3. 不要在插件里直接依赖宿主的内部 store、页面私有方法和临时工具函数

---

## 二、目录结构

```txt
src/
  plugins/
    api.js                  # 稳定 API
    definePlugin.js         # 插件声明入口
    eventBus.js             # 运行时事件总线
    runtime.js              # 插件运行时与注册中心
    plugins/
      friend-links/
      callsign/
      hash-processor/
    templates/
      example-plugin/       # 新插件模板
  components/
    admin/
      AdminQuickActionStrip.vue
      PluginReviewActionBar.vue
  pages/
    AdminPluginsPage.vue    # 插件中心
scripts/
  scaffold-plugin.mjs       # 根据模板创建新插件
supabase/
  schema.sql
PLUGIN_SYSTEM.md
```

---

## 三、快速创建一个插件

### 方式 A：用脚手架生成

```bash
npm run plugin:scaffold demo-tools "演示工具"
```

会生成：

```txt
src/plugins/plugins/demo-tools/
  index.js
  DemoToolsPage.vue
  DemoToolsDashboardWidget.vue
  DemoToolsProfilePanel.vue
  README.md
```

### 方式 B：直接复制模板目录

复制：

```txt
src/plugins/templates/example-plugin
```

到：

```txt
src/plugins/plugins/<your-plugin-id>
```

然后修改：

- 插件 `id`
- 插件名称、描述、版本
- 路由与菜单
- 配置项
- 需要接入的扩展点

---

## 四、一个插件最小结构

```js
import { definePlugin } from '@/plugins/definePlugin'
import ExamplePluginPage from './ExamplePluginPage.vue'

export default definePlugin({
  id: 'example-plugin',
  name: '示例插件',
  version: '1.0.0',
  description: '用于演示插件接入方式。',
  capabilities: ['example.manage'],
  defaultConfig: {
    enabledInAdmin: true,
  },
  configSchema: [
    {
      key: 'enabledInAdmin',
      type: 'boolean',
      label: '在后台启用',
      helper: '控制后台入口与扩展点是否显示。',
    },
  ],
  routes: [
    {
      path: '/admin/example-plugin',
      name: 'admin-example-plugin',
      component: ExamplePluginPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['example.manage'],
      },
    },
  ],
  menus: [
    {
      id: 'admin-example-plugin',
      location: 'admin',
      title: '示例插件',
      to: '/admin/example-plugin',
      order: 500,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['example.manage'],
      },
    },
  ],
})
```

---

## 五、插件生命周期

插件运行时当前支持这些生命周期节点：

- `install(api)`
- `enable(api)`
- `disable(api)`
- `upgrade(api)`
- `uninstall(api)`

声明方式：

```js
lifecycle: {
  async install(api) {
    await api.logger.info('插件安装完成')
  },
  async enable(api) {
    api.toast('插件已启用', 'success')
  },
  async disable(api) {
    await api.logger.warn('插件已停用')
  },
}
```

### 生命周期字段说明

运行时会把这些信息同步到 `public.plugins` 或本地回退状态中：

- `installed_version`
- `api_version`
- `host_version_range`
- `status`
- `installed_at`
- `enabled_at`
- `disabled_at`
- `last_error`

### 推荐约定

- `install`：注册初始资源、记录首次安装日志
- `upgrade`：做配置兼容、版本升级提示
- `enable`：做轻量初始化，不做重 IO
- `disable`：只做收尾，不删除数据
- `uninstall`：只有确认会彻底移除插件时才使用

---

## 六、稳定 API

插件代码应优先使用 `api`，而不是直接依赖宿主内部实现。

### 基础信息

- `api.version`
- `api.host.version`
- `api.pluginId`
- `api.pluginName`
- `api.pluginVersion`
- `api.host.supports(range)`

### 配置与服务

- `api.getConfig()`
- `api.getSetting(key, fallback)`
- `api.services.get(name)`
- `api.services.has(name)`
- `api.services.list()`

### 常用交互

- `api.navigate(to)`
- `api.openExternal(url)`
- `api.toast(message, type)`
- `api.notify(message, type)`
- `api.copy(text)`

### 事件与日志

- `api.emit(event, payload)`
- `api.on(event, handler)`
- `api.off(event, handler)`
- `api.audit(entry)`
- `api.logger.info(message, details)`
- `api.logger.warn(message, details)`
- `api.logger.error(message, details)`

### 审核批量动作 API

- `api.review.selection()`
- `api.review.count()`
- `api.review.values(extractor)`
- `api.review.ids()`
- `api.review.titles()`
- `api.review.copyField(extractor, label, options)`

### 上下文对象

不同扩展点里可用的上下文字段不同，常见包括：

- `api.route`
- `api.auth`
- `api.image`
- `api.profile`
- `api.submission`
- `api.application`
- `api.row`
- `api.selectedItems`
- `api.details`

---

## 七、配置 schema 规范

`configSchema` 用来告诉插件中心如何渲染配置表单。

### 当前支持字段

- `key`
- `type`
- `label`
- `helper`
- `placeholder`
- `min`
- `max`
- `step`
- `options`

### 推荐类型

- `boolean`
- `text`
- `textarea`
- `number`
- `select`

示例：

```js
configSchema: [
  {
    key: 'showDashboardWidget',
    type: 'boolean',
    label: '显示后台总览面板',
    helper: '关闭后不在后台总览显示该插件卡片。',
  },
  {
    key: 'batchSize',
    type: 'number',
    label: '默认批次大小',
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: 'targetTable',
    type: 'select',
    label: '默认目标表',
    options: [
      { label: 'images', value: 'images' },
      { label: 'submissions', value: 'submissions' },
    ],
  },
]
```

### 配置设计建议

- 一个配置项只解决一个明确行为
- 用 `defaultConfig` 提供可运行默认值
- 不要把复杂业务对象整体塞进单个 JSON 字段
- 管理型插件优先暴露开关、限制值、显示文案这三类配置

---

## 八、扩展点清单

### 导航与入口

- `routes`
- `menus`
- `topbarActions`
- `adminQuickActions`

### 页面与面板

- `dashboardWidgets`
- `profilePanels`
- `notificationCenterPanels`
- `auditLogPanels`
- `submissionReviewSidebarPanels`

### 列表与卡片

- `imageDetailActions`
- `imageListCardExtras`
- `userListItemExtras`
- `adminTableRowActions`
- `adminListFields`

### 审核流

- `reviewBulkActions`
- `notificationTemplates`

### 事件

- `eventHooks`

---

## 九、常用扩展点示例

### 1. 后台总览 widget

```js
import ExampleDashboardWidget from './ExampleDashboardWidget.vue'

dashboardWidgets: [
  {
    id: 'example-dashboard-widget',
    title: '示例统计',
    order: 400,
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
]
```

### 2. 个人页 / 公开资料页面板

```js
import ExampleProfilePanel from './ExampleProfilePanel.vue'

profilePanels: [
  {
    id: 'example-profile-panel',
    title: '扩展资料',
    target: 'self',
    order: 400,
    span: 'md',
    component: ExampleProfilePanel,
  },
]
```

### 3. 审核批量动作

```js
import { createCopyFieldReviewAction } from '@/plugins/templates/reviewActionTemplates'

reviewBulkActions: [
  createCopyFieldReviewAction({
    id: 'example-copy-ids',
    label: '复制选中 ID',
    target: 'admin-submissions',
    appearance: 'secondary',
    icon: 'content_copy',
    field: 'id',
    copiedLabel: 'ID',
  }),
]
```

### 4. 顶栏入口

```js
topbarActions: [
  {
    id: 'example-topbar-link',
    label: '示例工具',
    icon: 'extension',
    order: 400,
    meta: {
      requiresAuth: true,
      roles: ['SUPER_ADMIN'],
    },
    onClick(api) {
      return api.navigate('/admin/example-plugin')
    },
  },
]
```

### 5. 通知模板

```js
import { createBroadcastNotificationTemplate } from '@/plugins/templates/notificationTemplates'

notificationTemplates: [
  createBroadcastNotificationTemplate({
    id: 'example-notification-template',
    title: '提醒处理事项',
    description: '快速插入一条标准通知。',
    tags: ['公告'],
    values: {
      title: '请处理待办事项',
      content: '这是一条由插件提供的通知模板。',
    },
  }),
]
```

---

## 十、如何在运行时注册新插件

创建插件目录后，还需要把插件接入 `src/plugins/runtime.js`。

```js
import demoToolsPlugin from '@/plugins/plugins/demo-tools'

const installedPlugins = [
  friendLinksPlugin,
  callsignPlugin,
  hashProcessorPlugin,
  demoToolsPlugin,
]
```

如果不把插件加入 `installedPlugins`，运行时不会加载它。

---

## 十一、命名约定

### 插件 ID

建议使用 kebab-case：

- `friend-links`
- `callsign-review`
- `demo-tools`

### 组件名

建议使用 PascalCase：

- `DemoToolsPage.vue`
- `DemoToolsDashboardWidget.vue`
- `DemoToolsProfilePanel.vue`

### 扩展点 ID

建议加上插件前缀，避免冲突：

- `demo-tools-dashboard-widget`
- `demo-tools-profile-panel`
- `demo-tools-copy-ids`

---

## 十二、开发顺序建议

开发一个新插件时，建议按这个顺序走：

1. 先确定插件 ID、能力边界、要接入的扩展点
2. 先做 `routes` 和 `menus`
3. 再做 `defaultConfig` 和 `configSchema`
4. 再做具体扩展点组件
5. 最后再补生命周期、事件钩子和批量动作

这样可以避免一开始就把插件做得过重。

---

## 十三、调试建议

### 常见检查项

- 插件是否已加入 `installedPlugins`
- `id` 是否唯一
- `meta.roles / meta.capabilities` 是否把自己挡住了
- `when(api)` 是否返回 `false`
- 配置项 key 是否与 `defaultConfig` 一致
- 路由名是否冲突
- 插件页里是否已经启用该插件

### 审核动作调试

- 先检查 `target` 是否正确，如 `admin-submissions`
- 再检查 `requiresSelection` 与当前页面选择器是否匹配
- 最后检查 `onClick(api)` 是否只使用了稳定 API

### 日志建议

优先用：

- `api.logger.info()`
- `api.logger.warn()`
- `api.logger.error()`

不要在最终插件里保留大量裸 `console.log()`。

---

## 十四、版本与兼容性建议

插件声明里可以设置：

- `version`
- `apiVersion`
- `hostVersionRange`

推荐做法：

- 一般跟随宿主小版本更新：`^1.1.0`
- 只有插件依赖宿主新增 API 时，再提高最低宿主版本

---

## 十五、数据库与迁移建议

当前阶段仍以宿主统一迁移为主：

- 需要新增数据库表 / 字段 / 函数时
- 优先写进 `supabase/schema.sql`
- 已上线库则补对应 migration

暂不建议每个插件自己维护独立远程安装迁移。

---

## 十六、模板文件

请直接参考：

```txt
src/plugins/templates/example-plugin/
```

它包含：

- 最小插件声明
- 后台页面组件
- 后台总览 widget
- 个人页面板
- README 样例

如果你只是要快速新建一个内部插件，优先从这个模板起步。


## 十三、模板系统

### 通知模板工厂

位置：`src/plugins/templates/notificationTemplates.js`

可直接复用：

- `createBroadcastNotificationTemplate()`
- `createRoleNotificationTemplate()`
- `createDirectNotificationTemplate()`
- `applyNotificationTemplateValues()`

支持的额外字段：

- `category`
- `icon`
- `tone`
- `tags`
- `variables`

### 审核动作模板工厂

位置：`src/plugins/templates/reviewActionTemplates.js`

可直接复用：

- `createCopyFieldReviewAction()`
- `createSelectionSummaryReviewAction()`

支持的额外字段：

- `group`
- `summary`
- `templateKind`

建议优先使用模板工厂，而不是每次手写 `onClick`。


## 十七、版本兼容与迁移策略

请同时阅读：`docs/plugins/VERSIONING_AND_MIGRATIONS.md`。

新插件模板和插件中心现在都已经支持：

- `version`
- `apiVersion`
- `hostVersionRange`
- `schemaVersion`
- `migrationStrategy`
- `migrationIds`

推荐默认值：

```js
schemaVersion: '1.0.0',
migrationStrategy: 'host-schema',
migrationIds: [],
migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
```
