<template>
  <mdui-card class="section-card plugin-profile-panel">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">哈希工具</div>
        <h2>快捷区</h2>
      </div>
      <mdui-button variant="text" @click="router.push('/admin/hash-processor')">打开工具</mdui-button>
    </div>

    <div class="profile-summary-list">
      <div class="profile-summary-item">
        <span>默认目标表</span>
        <strong>{{ config?.defaultTargetTable || 'images' }}</strong>
      </div>
      <div class="profile-summary-item">
        <span>默认批次</span>
        <strong>{{ config?.defaultBatchSize || 10 }}</strong>
      </div>
      <div class="profile-summary-item">
        <span>详情页按钮</span>
        <strong>{{ config?.enableImageDetailActions === false ? '关闭' : '开启' }}</strong>
      </div>
    </div>

    <div class="action-row" style="margin-top: 14px">
      <mdui-button variant="filled-tonal" @click="router.push('/admin/hash-processor')">处理哈希</mdui-button>
      <mdui-button variant="text" @click="router.push('/admin/plugins/hash-processor')">插件配置</mdui-button>
    </div>
  </mdui-card>
</template>

<script setup>
import { useRouter } from 'vue-router'

defineProps({
  config: { type: Object, default: () => ({}) },
})

const router = useRouter()
</script>

<style scoped>
.plugin-profile-panel { height: 100%; }
</style>
