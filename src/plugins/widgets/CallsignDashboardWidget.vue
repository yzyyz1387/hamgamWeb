<template>
  <mdui-card class="section-card plugin-dashboard-widget">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">插件面板</div>
        <h3>呼号审核概览</h3>
        <p class="muted">集中查看待审申请与最近提交。</p>
      </div>
      <mdui-button variant="text" @click="loadData" :loading="loading">刷新</mdui-button>
    </div>

    <div class="widget-kpi-row widget-kpi-row--three">
      <div class="widget-kpi widget-kpi--warn">
        <strong>{{ stats.pending }}</strong>
        <span>待审核</span>
      </div>
      <div class="widget-kpi">
        <strong>{{ stats.reviewed }}</strong>
        <span>已处理</span>
      </div>
      <div class="widget-kpi">
        <strong>{{ config.maxUploadSizeMB || 10 }}MB</strong>
        <span>上传上限</span>
      </div>
    </div>

    <div v-if="recentApps.length" class="widget-list">
      <div v-for="item in recentApps" :key="item.id" class="widget-list-item">
        <div>
          <strong>{{ item.callsign }}</strong>
          <div class="muted">{{ timeAgo(item.created_at) }}</div>
        </div>
        <span class="status-pill" :class="item.status === 'PENDING' ? 'status-pill--pending' : 'status-pill--published'">
          {{ item.status === 'PENDING' ? '待审' : '已处理' }}
        </span>
      </div>
    </div>
    <div v-else class="empty-state empty-state--compact">暂无呼号申请记录</div>

    <div class="widget-action-row">
      <mdui-button variant="filled-tonal" @click="router.push('/admin/callsign')">进入审核页</mdui-button>
      <mdui-button variant="text" @click="router.push('/callsign-apply')">打开申请页</mdui-button>
    </div>
  </mdui-card>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { timeAgo } from '@/lib/format'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  refreshKey: { type: [String, Number], default: 0 },
})

const router = useRouter()
const loading = ref(false)
const stats = reactive({ pending: 0, reviewed: 0 })
const recentApps = ref([])

async function loadData() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const [{ count: pending, error: pendingError }, { count: reviewed, error: reviewedError }, { data, error: listError }] = await Promise.all([
      supabase.from('callsign_applications').select('id', { head: true, count: 'exact' }).eq('status', 'PENDING'),
      supabase.from('callsign_applications').select('id', { head: true, count: 'exact' }).neq('status', 'PENDING'),
      supabase
        .from('callsign_applications')
        .select('id, callsign, status, created_at')
        .order('created_at', { ascending: false })
        .limit(4),
    ])

    if (pendingError) throw pendingError
    if (reviewedError) throw reviewedError
    if (listError) throw listError

    stats.pending = pending || 0
    stats.reviewed = reviewed || 0
    recentApps.value = data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

watch(() => props.refreshKey, () => {
  loadData()
})

onMounted(loadData)
</script>

<style scoped>
.plugin-dashboard-widget {
  height: 100%;
}

.widget-kpi-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.widget-kpi-row--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.widget-kpi {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.04);
}

.widget-kpi--warn {
  background: rgba(245, 158, 11, 0.12);
}

.widget-kpi strong {
  display: block;
  font-size: 20px;
  color: #18222c;
}

.widget-kpi span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.widget-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.widget-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(24, 34, 44, 0.08);
}

.widget-action-row {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.empty-state--compact {
  padding: 16px 0;
}

@media (max-width: 540px) {
  .widget-kpi-row--three {
    grid-template-columns: 1fr;
  }
}
</style>
