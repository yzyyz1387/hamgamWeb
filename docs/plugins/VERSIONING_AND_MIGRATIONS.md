# 插件版本兼容与迁移策略

这份文档专门说明插件版本号、API 兼容、宿主兼容范围，以及数据迁移应该怎么处理。

## 一、四个版本字段的含义

### 1. `version`
插件自身业务版本。

什么时候改：

- 插件功能新增
- 配置项变化
- 行为变化
- UI 改动

### 2. `apiVersion`
插件所面向的插件 API 版本。

什么时候改：

- 插件依赖了新的 `api.*` 能力
- 宿主废弃了旧 API

### 3. `hostVersionRange`
插件允许接入的宿主版本范围。

推荐写法：

- `^1.1.0`：兼容 1.x 且最低要求 1.1.0
- `~1.1.0`：只兼容 1.1.x
- `1.1.0`：只兼容单一版本

### 4. `schemaVersion`
插件依赖的数据结构版本。

它描述的是：

- 这个插件当前假定的数据模型版本是多少
- 升级时是否需要额外数据迁移

---

## 二、迁移策略字段

每个插件都应明确声明这些字段：

```js
schemaVersion: '1.0.0',
migrationStrategy: 'host-schema',
migrationIds: [],
migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
migrationScript: '',
```

### `migrationStrategy` 允许值

#### 1. `host-schema`
插件数据模型完全跟随宿主 `supabase/schema.sql`。

适合：

- 没有插件专属表结构
- 新库初始化即可满足
- 升级只要执行最新 `schema.sql`

#### 2. `host-migrations`
插件升级依赖宿主 `supabase/migrations/*.sql` 中的特定迁移文件。

适合：

- 已上线项目需要渐进升级
- 不能只靠重建 schema
- 需要对已有数据做补丁迁移

此时必须提供：

- `migrationIds`

#### 3. `scripted`
插件升级需要额外脚本执行。

适合：

- 迁移涉及外部文件、存储桶、历史数据清洗
- SQL 不足以完成迁移

此时建议提供：

- `migrationScript`
- `migrationNotes`

---

## 三、当前项目推荐约定

### 规则 1
如果插件没有专属数据库结构变化，统一使用：

- `migrationStrategy: 'host-schema'`

### 规则 2
只有当插件确实依赖了具体迁移文件时，才写：

- `migrationStrategy: 'host-migrations'`
- `migrationIds: [...]`

### 规则 3
`migrationIds` 填文件名，不填自由文本。

例如：

```js
migrationIds: [
  '20260330_plugin_runtime.sql',
  '20260331_plugin_lifecycle_columns.sql',
]
```

### 规则 4
升级说明写在 `migrationNotes`，不要把说明塞进脚本名或 commit message 里。

---

## 四、什么时候应该 bump 哪个版本

### 只改 UI / 文案
- bump `version`
- 不改 `schemaVersion`

### 新增配置项
- bump `version`
- 一般不改 `schemaVersion`

### 新增数据库字段/函数/表
- bump `version`
- bump `schemaVersion`
- 明确 `migrationStrategy`

### 依赖新的插件 API
- bump `version`
- bump `apiVersion`
- 视情况提高 `hostVersionRange`

### 宿主升级导致旧插件不再兼容
- 维持插件 `version` 不变也可以
- 但要提高 `hostVersionRange`

---

## 五、执行升级时怎么判断

插件中心现在会显示：

- 宿主版本
- 插件 API
- 宿主要求范围
- schemaVersion
- 迁移策略
- 迁移文件列表
- 推荐执行命令

你应该按这个顺序判断：

1. 先看 `hostVersionRange` 是否兼容当前宿主
2. 再看 `schemaVersion` 是否变化
3. 再看 `migrationStrategy`
4. 最后决定执行 `schema.sql` / `migrations` / `script`

---

## 六、当前项目中的建议

### 友情链接插件
- `migrationStrategy: 'host-schema'`

### 呼号插件
- `migrationStrategy: 'host-schema'`

### 哈希插件
- `migrationStrategy: 'host-schema'`

也就是说，当前这三个插件都没有“插件专属迁移文件”负担，跟随宿主 schema 即可。

---

## 七、配套检查

建议每次升级前至少执行：

```bash
npm run test:plugins
npm run plugins:policy
```

如果宿主数据库不是新建库，再额外检查：

- `supabase/migrations/` 是否已按顺序执行
- 插件中心中的“版本兼容与迁移”面板是否显示正常
