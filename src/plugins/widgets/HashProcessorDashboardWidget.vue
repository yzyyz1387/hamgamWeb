<template>
  <mdui-card class="section-card plugin-dashboard-widget">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">插件面板</div>
        <h3>哈希工具快捷面板</h3>
        <p class="muted">查看当前默认策略，并直接打开处理页。</p>
      </div>
    </div>

    <div class="hash-summary-grid">
      <div class="hash-summary-item">
        <span>默认目标表</span>
        <strong>{{ targetTableLabel }}</strong>
      </div>
      <div class="hash-summary-item">
        <span>默认批次</span>
        <strong>{{ config.defaultBatchSize || 10 }}</strong>
      </div>
      <div class="hash-summary-item">
        <span>投稿表处理</span>
        <strong>{{ config.allowSubmissionsTable === false ? '关闭' : '开启' }}</strong>
      </div>
      <div class="hash-summary-item">
        <span>详情页按钮</span>
        <strong>{{ config.enableImageDetailActions === false ? '关闭' : '开启' }}</strong>
      </div>
    </div>

    <div class="widget-action-row">
      <mdui-button variant="filled-tonal" @click="router.push('/admin/hash-processor')">打开工具页</mdui-button>
      <mdui-button variant="text" @click="router.push('/admin/plugins/hash-processor')">调整插件配置</mdui-button>
    </div>
  </mdui-card>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
})

const router = useRouter()

const targetTableLabel = computed(() => props.config.defaultTargetTable === 'submissions' ? 'submissions' : 'images')
</script>

<style scoped>
.plugin-dashboard-widget {
  height: 100%;
}

.hash-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.hash-summary-item {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.hash-summary-item span {
  display: block;
  font-size: 12px;
  color: #6b7280;
}

.hash-summary-item strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  color: #18222c;
}

.widget-action-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 540px) {
  .hash-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
