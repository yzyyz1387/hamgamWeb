<template>
  <div class="feedback-profile-panel">
    <div class="feedback-panel__header">
      <mdui-icon name="flag--rounded"></mdui-icon>
      <span>我的反馈</span>
    </div>
    <div v-if="loading" class="feedback-panel__loading">
      <mdui-circular-progress style="font-size: 16px"></mdui-circular-progress>
    </div>
    <div v-else class="feedback-panel__stats">
      <div class="stat-item">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">提交</span>
      </div>
      <div class="stat-item">
        <span class="stat-value stat-value--warning">{{ stats.pending }}</span>
        <span class="stat-label">待审核</span>
      </div>
      <div class="stat-item">
        <span class="stat-value stat-value--success">{{ stats.resolved }}</span>
        <span class="stat-label">已解决</span>
      </div>
    </div>
    <mdui-button variant="filled-tonal" full-width @click="$router.push('/my-feedback')">
      查看全部反馈
    </mdui-button>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'

const loading = ref(true)
const stats = reactive({ total: 0, pending: 0, resolved: 0 })

async function loadStats() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('image_feedbacks')
      .select('status')
      .eq('reporter_id', userId)
    
    if (!error && data) {
      stats.total = data.length
      stats.pending = data.filter(f => f.status === 'PENDING').length
      stats.resolved = data.filter(f => f.status === 'RESOLVED').length
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
.feedback-profile-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feedback-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #334155;
}

.feedback-panel__loading {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.feedback-panel__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  text-align: center;
  padding: 8px;
  background: rgba(15,23,42,0.03);
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #334155;
}

.stat-value--warning { color: #f59e0b; }
.stat-value--success { color: #22c55e; }

.stat-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
</style>
