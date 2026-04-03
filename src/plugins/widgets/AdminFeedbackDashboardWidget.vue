<template>
  <div class="feedback-widget">
    <div v-if="loading" class="feedback-widget__loading">
      <mdui-circular-progress style="font-size:18px"></mdui-circular-progress>
    </div>
    <template v-else>
      <div class="feedback-widget__stats">
        <div class="stat-item">
          <span class="stat-value stat-value--warning">{{ stats.pending || 0 }}</span>
          <span class="stat-label">待审核</span>
        </div>
        <div class="stat-item">
          <span class="stat-value stat-value--info">{{ stats.discuss || 0 }}</span>
          <span class="stat-label">需探讨</span>
        </div>
        <div class="stat-item">
          <span class="stat-value stat-value--muted">{{ stats.dismiss || 0 }}</span>
          <span class="stat-label">不计入</span>
        </div>
        <div class="stat-item">
          <span class="stat-value stat-value--success">{{ stats.resolved || 0 }}</span>
          <span class="stat-label">已解决</span>
        </div>
      </div>
      <mdui-button v-if="config" variant="filled-tonal" full-width @click="$router.push('/admin/feedback')">
        管理反馈
      </mdui-button>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'

const props = defineProps({ config: Object })
const loading = ref(true)
const stats = reactive({ pending: 0, discuss: 0, dismiss: 0, resolved: 0 })

async function loadStats() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('image_feedbacks')
      .select('status')
    if (!error && data) {
      for (const row of data) {
        if (row.status === 'PENDING') stats.pending++
        else if (row.status === 'DISCUSS') stats.discuss++
        else if (row.status === 'DISMISS') stats.dismiss++
        else if (row.status === 'RESOLVED') stats.resolved++
      }
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<style scoped>
.feedback-widget__loading { display: flex; justify-content: center; padding: 16px; }
.feedback-widget__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat-item { text-align: center; padding: 6px 4px; }
.stat-value { display: block; font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat-value--warning { color: #f59e0b; }
.stat-value--info { color: #3b82f6; }
.stat-value--muted { color: #94a3b8; }
.stat-value--success { color: #22c55e; }
.stat-label { display: block; font-size: 11px; color: #64748b; margin-top: 2px; }

@media (max-width: 480px) {
  .feedback-widget__stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
