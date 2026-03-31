# __PLUGIN_NAME__

这是一个插件模板目录，用来快速复制出一个新的内部插件。

## 目录说明

- `index.js`：插件声明、配置、扩展点入口
- `ExamplePluginPage.vue`：后台独立页面
- `ExampleDashboardWidget.vue`：后台总览卡片
- `ExampleProfilePanel.vue`：个人页资料面板

## 创建后要改的内容

1. `__PLUGIN_ID__` 改成实际插件 ID
2. `__PLUGIN_NAME__` 改成实际显示名称
3. 把路由、菜单、扩展点 ID 改成唯一值
4. 视情况调整 `defaultConfig` 和 `configSchema`
5. 在 `src/plugins/runtime.js` 中注册你的插件
