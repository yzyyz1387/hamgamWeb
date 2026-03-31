<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getPluginConfig } from '@/plugins/runtime'

const router = useRouter()
const config = computed(() => getPluginConfig('__PLUGIN_ID__'))

function openPage() {
  router.push('/admin/__PLUGIN_ID__')
}
</script>

<template>
  <section class="widget-card">
    <div class="widget-head">
      <div>
        <p class="label">模板 widget</p>
        <h3>__PLUGIN_NAME__</h3>
      </div>
      <mdui-button variant="text" @click="openPage">打开</mdui-button>
    </div>
    <p class="desc">这里可以放统计、快捷入口、状态摘要等信息。</p>
    <div class="pill-row">
      <span class="pill">pageTitle: {{ config.pageTitle || '__PLUGIN_NAME__' }}</span>
      <span class="pill">已启用</span>
    </div>
  </section>
</template>

<style scoped>
.widget-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  background: var(--mdui-color-surface-container-low, #fff);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}
.widget-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.label {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--mdui-color-primary, #6750a4);
  font-weight: 700;
}
.desc {
  margin: 0;
  color: #6b7280;
}
.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pill {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--mdui-color-surface-container, #f5f5f7);
  font-size: 12px;
}
</style>
