console.log(`插件注册中心

1. 可用插件：已经编译进宿主的插件目录
2. 已安装：允许进入运行时装配流程
3. 已启用：会实际注入菜单、路由和扩展点
4. 卸载：从装配流程中移除，但仍保留在可用列表中

数据库字段见：supabase/schema.sql
兼容旧库时可执行：supabase/migrations/20260331_plugin_registry_center.sql
详细说明见：docs/plugins/REGISTRY_CENTER.md`)
