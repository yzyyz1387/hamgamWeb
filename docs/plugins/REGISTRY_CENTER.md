# 插件注册中心

这一层的目标不是“远程热插拔平台”，而是把当前宿主内部的插件目录、安装状态、启停状态、配置与运行时装配入口全部收口成一个统一中心。

## 当前结论

当前项目采用的是：

- 编译期内置插件目录
- 运行时安装 / 卸载 / 启停
- 统一注册表状态
- 统一插件中心操作入口

也就是说，现在已经不是“runtime.js 里一个 installedPlugins 常量 + 启停开关”，而是：

- 可用插件目录（catalog）
- 已安装插件（installed）
- 已启用插件（enabled）
- 注册中心元数据（registrationStatus / installSource / registeredAt / uninstalledAt）
- 生命周期状态（status / installedAt / enabledAt / disabledAt / lastError）

## 目录

- `src/plugins/registry.js`：插件目录中心
- `src/plugins/runtime.js`：运行时装配与注册状态管理
- `src/pages/AdminPluginsPage.vue`：插件注册中心页面
- `supabase/migrations/20260331_plugin_registry_center.sql`：注册中心字段迁移

## 状态模型

### catalog

宿主已编译进来的可用插件目录。

### installed

插件已安装，允许进入运行时注册与装配流程。

### enabled

插件已启用，会实际注入：

- 路由
- 菜单
- 扩展点

### uninstalled

插件仍存在于“可用插件目录”中，但不会参与运行时装配。

## 数据字段

`public.plugins` 现在承担插件注册表职责，关键字段：

- `installed`
- `registration_status`
- `install_source`
- `registered_at`
- `uninstalled_at`
- `enabled`
- `installed_version`
- `api_version`
- `host_version_range`
- `status`
- `last_error`

`public.plugin_settings` 继续承载插件配置。

## 推荐操作顺序

### 安装一个内置插件

1. 在插件中心点击“安装插件”
2. 注册中心会写入安装状态
3. 触发生命周期 `install`
4. 如需立即运行，再触发 `enable`

### 卸载一个插件

1. 如当前启用，先执行 `disable`
2. 执行 `uninstall`
3. 标记为 `uninstalled`
4. 从路由 / 菜单 / 扩展点装配流程中移除

## 注意事项

- 现在仍然不是远程插件热插拔
- 新增一个全新插件，仍然需要把源码编进宿主并重新构建
- 但对“已经存在于 catalog 中的插件”，现在已经支持安装 / 卸载 / 启停 / 重装的一体化管理
