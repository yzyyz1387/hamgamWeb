<template>
  <mdui-card class="section-card callsign-notification-panel">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">呼号插件</div>
        <h3>呼号认证状态</h3>
      </div>
      <mdui-button variant="text" @click="router.push('/callsign-apply')">打开申请页</mdui-button>
    </div>

    <div v-if="loading" class="empty-state" style="padding: 16px 0">
      <mdui-circular-progress></mdui-circular-progress>
    </div>
    <div v-else class="callsign-notification-panel__body">
      <div class="callsign-notification-panel__summary">
        <span class="status-pill" :class="statusClass(latestApplication?.status)">{{ statusLabel(latestApplication?.status) }}</span>
        <span class="muted">{{ latestApplication?.callsign || profile?.callsign || '暂无申请记录' }}</span>
      </div>
      <p class="muted callsign-notification-panel__hint">
        {{ latestApplication?.reviewer_note || defaultStatusHint(latestApplication?.status) }}
      </p>
    </div>
  </mdui-card>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

const props = defineProps({
  auth: { type: Object, default: null },
  profile: { type: Object, default: null },
})

const router = useRouter()
const loading = ref(false)
const latestApplication = ref(null)

function statusLabel(status) {
  return {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
  }[status] || '暂无记录'
}

function statusClass(status) {
  return {
    PENDING: 'status-pill--pending',
    APPROVED: 'status-pill--published',
    REJECTED: 'status-pill--rejected',
  }[status] || 'status-pill--draft'
}

function defaultStatusHint(status) {
  return {
    PENDING: '你的呼号认证材料已经提交，等待管理员审核。',
    APPROVED: '你的呼号已经通过审核，会展示在个人资料中。',
    REJECTED: '最近一次申请未通过，可补充材料后再次提交。',
  }[status] || '这里会展示你最近一次呼号申请状态。'
}

async function loadLatestApplication() {
  if (!supabaseEnabled || !props.auth?.user?.id) {
    latestApplication.value = null
    return
  }
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('callsign_applications')
      .select('id, callsign, status, reviewer_note, updated_at, created_at')
      .eq('user_id', props.auth.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    latestApplication.value = data || null
  } catch {
    latestApplication.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadLatestApplication)
watch(() => props.auth?.user?.id, loadLatestApplication)
</script>

<style scoped>
.callsign-notification-panel__body { display: grid; gap: 12px; }
.callsign-notification-panel__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.callsign-notification-panel__hint { margin: 0; }
</style>
