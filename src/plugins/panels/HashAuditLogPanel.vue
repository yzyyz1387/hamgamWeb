<template>
  <div class="hash-audit-panel">
    <div class="hash-audit-panel__header">
      <span>哈希工具</span>
      <mdui-button variant="text" @click="router.push('/admin/hash-processor')">打开工具</mdui-button>
    </div>
    <div class="hash-audit-panel__grid">
      <div>
        <span>目标表</span>
        <strong>{{ config?.defaultTargetTable || 'images' }}</strong>
      </div>
      <div>
        <span>批次</span>
        <strong>{{ config?.defaultBatchSize || 10 }}</strong>
      </div>
      <div>
        <span>最近运行</span>
        <strong>{{ latestRunLabel }}</strong>
      </div>
      <div>
        <span>结果</span>
        <strong>{{ latestRunStatus }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { requireSupabase } from '@/lib/supabase'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
})

const router = useRouter()
const latestLog = ref(null)

const latestRunLabel = computed(() => latestLog.value?.created_at ? formatDate(latestLog.value.created_at, { withTime: true }) : '暂无')
const latestRunStatus = computed(() => {
  if (!latestLog.value?.details) return '未运行'
  const details = latestLog.value.details
  return `成功 ${details.processed || 0} / 失败 ${details.failed || 0}`
})

onMounted(async () => {
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('audit_logs')
      .select('created_at, details')
      .eq('action', 'hash.batch_processed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestLog.value = data || null
  } catch {
    latestLog.value = null
  }
})
</script>

<style scoped>
.hash-audit-panel {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.08);
  color: #dbeafe;
}
.hash-audit-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.hash-audit-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.hash-audit-panel__grid span { display: block; font-size: 12px; color: #bfdbfe; }
.hash-audit-panel__grid strong { font-size: 14px; color: #eff6ff; }
</style>
