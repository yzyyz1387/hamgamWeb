# HamGam Web Refactor

这是对 `hamgamWeb-main` 的 Vue 重构升级版，目标是：

- 保留原站核心体验：**主页乱序 / 最近更新切换 / 随机一张**。
- 将旧的静态 JSON + LeanCloud 互动模式升级为 **Vue 3 + Vite + MDUI 2 + Supabase**。
- 增加 **用户体系、投稿审核、评论、emoji 反应、通知中心、条幅公告、弹窗公告**。
- 兼容旧分享链接：旧站 `#/<图片文件名>` 可通过 `images.legacy_url` 跳到新的图片详情页。

## 1. 技术栈

- 前端：Vue 3、Vite、Pinia、Vue Router、MDUI 2
- 后端：Supabase（Auth、Postgres、Storage、Edge Functions）
- 安全：RLS、私有投稿桶、前端仅使用 Publishable Key、评论纯文本存储、系统预设头像

## 2. 已实现功能

### 用户侧

- 首页图墙：乱序 / 最近更新切换、搜索标题/描述/贡献者
- 随机一张页：保留旧站“再来一张”能力
- 图片详情页：左图右评论布局
- emoji 反应：支持同图多个 emoji；首页显示前几个，详情页和随机页显示完整反应
- 注册 / 登录 / 修改资料 / 修改密码 / 系统预设头像
- 投稿上传：进入审核流，先上传到私有桶 `submission-images`
- 通知中心：支持未读/已读与全部已读

### 管理侧

- 审核台：审核投稿并发布到正式图库
- 用户管理：超级管理员修改角色、认证信息、启停状态
- 公告管理：条幅公告 + 弹窗公告
- 站内通知：按角色或全站广播
- 审计日志：关键后台动作记入 `audit_logs`

## 3. 目录结构

```text
.
├─ src/
│  ├─ components/
│  ├─ pages/
│  ├─ stores/
│  ├─ lib/
│  └─ config/site.js
├─ supabase/
│  ├─ schema.sql
│  └─ functions/
│     └─ moderate-submission/
├─ scripts/
│  └─ migrate-legacy.mjs
└─ .env.example
```

## 4. 环境变量

前端 `.env` / `.env.local`：

```bash
VITE_SITE_NAME=HamGam
VITE_SITE_DESCRIPTION=HamGam 图集，基于 Vue 3 + MDUI + Supabase
VITE_SITE_ICP=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PUBLIC_GALLERY_BUCKET=gallery-images
VITE_PRIVATE_SUBMISSION_BUCKET=submission-images
VITE_ENABLE_SIGNUP=true
VITE_DEFAULT_REACTION_SET=❤️,👍,😂,😭,🔥,👀,😮,🤔,🥰,👏
```

迁移脚本和 Edge Function 额外需要：

```bash
SUPABASE_SERVICE_ROLE_KEY=
LEGACY_SOURCE=/absolute/path/to/hamgam-main-or-zip
```

## 5. 安装与开发

```bash
npm install
npm run dev
npm run build
```

项目使用 Hash Router，静态部署通常不需要额外 rewrite。

头像已改为系统内置预设，不依赖单独头像存储桶。

## 6. Supabase 初始化步骤

### 6.1 执行数据库 SQL

把 `supabase/schema.sql` 整体复制到 Supabase SQL Editor 执行。

它会创建：

- `profiles`
- `images`
- `submissions`
- `comments`
- `image_reactions`
- `notifications`
- `announcements`
- `audit_logs`
- Storage bucket 与 RLS 策略（正式图库 + 投稿原图）
- Auth 同步触发器、互动统计触发器、管理员 RPC、通知 RPC

### 6.2 创建首个超级管理员

先注册一个普通账号，再执行：

```sql
update public.profiles
set role = 'SUPER_ADMIN'
where email = 'your-admin@example.com';
```

### 6.3 部署审核 Edge Function

```bash
supabase functions deploy moderate-submission
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
```

### 6.4 配置 Auth

建议至少配置：

- Site URL：正式前端地址
- Redirect URLs：正式地址与本地开发地址
- 开启邮箱确认
- 开启验证码 / Bot Protection
- 设置密码强度要求和邮件模板

## 7. 旧数据来源与迁移结论

旧数据要以 `hamgam-main` 为准，不是前端工程本身。

真正需要迁移的是：

- `hamgam-main/pic_res.json`：图库索引主数据
- `hamgam-main/img/`：图片文件目录
- `hamgam-main/pic_res.md`：人工校对参考文件

其中：

- `pic_res.json` 记录数：**170**
- `img/` 内图片数：**173**

也就是说，旧系统可以直接迁移的是 **图片主数据**；评论、emoji、通知、审核流、用户体系没有成型旧库，需在新 Supabase 架构中从零承接。

### 7.1 旧 JSON 字段映射

`pic_res.json` 的单条结构类似：

```json
{
  "不给你了": {
    "url": "不给你了.jpg",
    "dec": "有对象？不给你传日志了",
    "contributor": "BD8CWG",
    "update": "2024-06-04"
  }
}
```

迁移映射关系：

- 顶层 key -> `images.title`
- `url` -> `images.legacy_url`
- `dec` -> `images.description`
- `contributor` -> `images.contributor_name`
- `update` -> `images.legacy_updated_at` / `images.published_at`
- 对应图片文件 -> 上传至 `gallery-images`

### 7.2 已确认的旧数据异常

迁移脚本已内置这 3 个文件名兼容修正：

1. `恋爱版DMS.jpg` -> 实际文件 `恋爱版DMS .jpg`
2. `暑假去哪儿.jpg` -> 实际文件 `暑假去那儿.jpg`
3. `Itx.png` -> 实际文件 `ltx.png`

另外，`img/` 里有 3 个文件没有被 `pic_res.json` 索引：

- `喝酒.png`
- `冲冲国奖.jpg`
- `你这个主题不是眼瞎吗.jpg`

默认策略：

- 以 `pic_res.json` 为准导入正式图库
- 上述 3 个孤儿文件默认 **不导入**
- 如需补录，请在迁移后手工上传或单独补数据

## 8. 迁移脚本用法

`scripts/migrate-legacy.mjs` 现已支持两种输入：

- 已解压目录：`/path/to/hamgam-main`
- 直接传 zip：`/path/to/hamgam-main.zip`

脚本会自动：

- 查找 `pic_res.json` 与 `img/`
- 自动兼容旧文件名差异
- 上传图片到 `gallery-images/legacy/...`
- 按 `legacy_url` upsert 到 `images`
- 输出 `legacy-migration-report.json`
- 报告孤儿文件与文件名不一致项

### 8.1 先试跑

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key \
LEGACY_SOURCE=/absolute/path/to/hamgam-main.zip \
npm run migrate:legacy -- --dry-run
```

### 8.2 正式迁移

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key \
LEGACY_SOURCE=/absolute/path/to/hamgam-main.zip \
npm run migrate:legacy
```

也可以直接传已经解压的目录：

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key \
LEGACY_SOURCE=/absolute/path/to/hamgam-main \
npm run migrate:legacy
```

### 8.3 迁移后的核对 SQL

```sql
select count(*) from public.images;

select title, legacy_url, storage_path, published_at
from public.images
order by coalesce(legacy_updated_at, published_at) desc
limit 20;
```

## 9. 数据模型要点

### `profiles`

- 一对一绑定 `auth.users`
- 角色：`SUPER_ADMIN / REVIEWER / USER`
- 认证标签用数组存储
- 普通用户只能修改自己的非敏感资料

### `images`

- 公开图库主表
- `legacy_url` 用于兼容旧链接
- `reaction_summary` / `reaction_total_count` / `comments_count` 由触发器维护

### `submissions`

- 投稿审核流主表
- 审核通过后由 Edge Function 生成对应 `images` 记录

### `comments`

- 保存作者昵称/头像/认证快照，避免公开查询完整 profile
- 内容按纯文本存储

### `image_reactions`

- 唯一键 `(image_id, user_id, emoji)`
- 同一用户可对同图打多个不同 emoji

### `notifications`

- 审核结果、评论提醒、后台广播都进入这里

### `announcements`

- `BANNER`：首页顶部条幅公告
- `POPUP`：首页弹窗公告

## 10. 安全建议

1. 前端只使用 `VITE_SUPABASE_PUBLISHABLE_KEY`
2. `SUPABASE_SERVICE_ROLE_KEY` 只能用于迁移脚本和 Edge Function
3. 投稿桶与正式图库桶必须分离
4. 开启邮箱确认、验证码、密码强度策略
5. 评论保持纯文本，不直接信任用户 HTML
6. 管理操作全部记审计日志
7. RLS 不要随意关闭

## 11. 建议的上线顺序

1. 执行 SQL
2. 注册首个管理员账号并提权
3. 部署 Edge Function
4. 本地 `--dry-run` 检查旧数据
5. 正式迁移图库
6. 联调投稿、审核、评论、emoji、通知
7. 正式部署前端

