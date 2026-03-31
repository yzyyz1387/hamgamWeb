# 插件开发速查表

## 1. 创建插件

```bash
npm run plugin:scaffold demo-tools "演示工具"
```

## 2. 接入运行时

在 `src/plugins/runtime.js` 里导入并加入 `installedPlugins`。

## 3. 最小必填项

- `id`
- `name`
- `version`
- `description`

## 4. 常用可选项

- `defaultConfig`
- `configSchema`
- `routes`
- `menus`
- `dashboardWidgets`
- `profilePanels`
- `reviewBulkActions`
- `notificationTemplates`
- `adminQuickActions`

## 5. 不建议做的事

- 不要直接 import 宿主内部私有方法
- 不要把复杂业务对象整块塞进一个配置字段
- 不要用与别的插件冲突的扩展点 ID
- 不要跳过 `meta` 权限声明

## 6. 调试顺序

1. 插件中心里确认插件已启用
2. 检查扩展点 `when(api)`
3. 检查 `meta.roles` / `meta.capabilities`
4. 检查运行时是否已经导入该插件
5. 用 `api.logger.info()` 看日志


## 7. 模板工厂

优先复用：

- `src/plugins/templates/notificationTemplates.js`
- `src/plugins/templates/reviewActionTemplates.js`

常用工厂：

- `createBroadcastNotificationTemplate()`
- `createDirectNotificationTemplate()`
- `createCopyFieldReviewAction()`
- `createSelectionSummaryReviewAction()`


## 8. 版本与迁移

详细策略见：`docs/plugins/VERSIONING_AND_MIGRATIONS.md`

每个插件至少要声明：

- `version`
- `apiVersion`
- `hostVersionRange`
- `schemaVersion`
- `migrationStrategy`
- `migrationIds`
