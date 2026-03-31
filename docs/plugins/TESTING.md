# 插件测试 / 回归机制

当前项目的插件回归机制分为两层：

## 1. 手工回归清单

位置：`docs/plugins/REGRESSION_CHECKLIST.md`

适用于：

- 宿主页面改版
- 运行时重构
- 生命周期逻辑修改
- 模板系统修改
- 权限 / 角色规则修改

## 2. 最小自动化测试骨架

位置：`tests/plugins/`

当前提供的是一套**可移植的契约测试骨架**，需要你把项目当前运行时接到 adapter 上。

### 第一步：复制 adapter 示例

复制：

```txt
tests/plugins/runtime-adapter.example.js
```

为：

```txt
tests/plugins/runtime-adapter.local.js
```

### 第二步：把当前运行时方法接进去

最少建议接这些：

- `getInstalledPlugins()`
- `getAdminQuickActions(context)`
- `getReviewBulkActions(context)`
- `getNotificationTemplates(context)`
- `applyNotificationTemplateValues(template, vars)`

### 第三步：运行测试

```bash
npm run test:plugins
```

### 当前测试覆盖的内容

- 插件运行时返回值结构是否稳定
- 后台快捷动作是否符合统一字段
- 审核动作是否符合统一字段
- 通知模板是否符合统一字段
- 模板变量替换是否可用

### 建议后续继续补的测试

- 生命周期状态合并
- 插件启停后路由同步
- 插件配置覆盖与默认值合并
- 多插件同时启用时的扩展点顺序
