<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPluginConfig } from '@/plugins/runtime'

const route = useRoute()
const config = computed(() => getPluginConfig('__PLUGIN_ID__'))
</script>

<template>
  <section class="page-shell">
    <div class="hero-card">
      <div>
        <p class="eyebrow">示例插件</p>
        <h1>{{ config.pageTitle || '__PLUGIN_NAME__' }}</h1>
        <p>这是模板生成的后台页面，可以直接替换成你的真实业务界面。</p>
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span>插件 ID</span>
          <strong>__PLUGIN_ID__</strong>
        </div>
        <div class="meta-item">
          <span>当前路由</span>
          <strong>{{ route.path }}</strong>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-shell {
  display: grid;
  gap: 16px;
}
.hero-card {
  display: grid;
  gap: 20px;
  padding: 24px;
  border-radius: 24px;
  background: var(--mdui-color-surface-container-low, #fff);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--mdui-color-primary, #6750a4);
  font-size: 12px;
  font-weight: 700;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.meta-item {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--mdui-color-surface-container, #f5f5f7);
}
.meta-item span {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}
</style>
