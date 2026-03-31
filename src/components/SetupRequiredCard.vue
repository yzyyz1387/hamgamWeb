<template>
  <mdui-card class="setup-card section-card">
    <div class="section-card__header">
      <div>
        <h3>Supabase 尚未配置</h3>
        <p>请先填写 .env，并执行 README 中的 SQL、Storage、Edge Function 和数据迁移步骤。</p>
      </div>
      <mdui-chip>待配置</mdui-chip>
    </div>
    <div class="setup-card__grid">
      <div>
        <strong>前端环境变量</strong>
        <pre>VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY</pre>
      </div>
      <div>
        <strong>后端初始化</strong>
        <pre>1. 执行 supabase/schema.sql
2. 部署 moderate-submission
3. 运行 migrate-legacy.mjs</pre>
      </div>
    </div>
  </mdui-card>
</template>
