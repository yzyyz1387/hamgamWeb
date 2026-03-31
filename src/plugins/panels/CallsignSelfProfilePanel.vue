<template>
  <mdui-card class="section-card plugin-profile-panel">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">呼号系统</div>
        <h2>呼号认证状态</h2>
      </div>
      <mdui-button variant="text" @click="openApply">{{ ctaLabel }}</mdui-button>
    </div>

    <div class="profile-summary-list">
      <div class="profile-summary-item">
        <span>当前呼号</span>
        <strong>{{ profile?.callsign || latestApplication?.callsign || '未认证' }}</strong>
      </div>
      <div class="profile-summary-item">
        <span>最近申请</span>
        <strong>{{ latestApplication?.status ? statusLabel(latestApplication.status) : '暂无记录' }}</strong>
      </div>
      <div class="profile-summary-item">
        <span>最近更新</span>
        <strong>{{ latestApplication?.updated_at ? formatDate(latestApplication.updated_at, { withTime: true }) : (latestApplication?.created_at ? formatDate(latestApplication.created_at, { withTime: true }) : '—') }}</strong>
      </div>
    </div>

    <div v-if="loading" class="empty-state" style="padding: 18px 0">
      <mdui-circular-progress></mdui-circular-progress>
    </div>

    <template v-else>
      <div v-if="latestApplication" class="callsign-panel-status">
        <span class="status-pill" :class="statusClass(latestApplication.status)">{{ statusLabel(latestApplication.status) }}</span>
        <p class="muted" style="margin: 10px 0 0">
          {{ latestApplication.reviewer_note || defaultStatusHint(latestApplication.status) }}
        </p>
      </div>
      <div v-else class="empty-state" style="padding: 14px 0">还没有提交过呼号认证申请。</div>
    </template>
  </mdui-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

const props = defineProps({
  auth: { type: Object, default: null },
  profile: { type: Object, default: null },
})

const router = useRouter()
const loading = ref(false)
const latestApplication = ref(null)

const ctaLabel = computed(() => (props.profile?.callsign ? '更新呼号' : '申请呼号'))

function statusLabel(status) {
  return {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELLED: '已取消',
  }[status] || status || '未知状态'
}

function statusClass(status) {
  return {
    PENDING: 'status-pill--pending',
    APPROVED: 'status-pill--published',
    REJECTED: 'status-pill--rejected',
    CANCELLED: 'status-pill--draft',
  }[status] || 'status-pill--draft'
}

function defaultStatusHint(status) {
  return {
    PENDING: '申请已提交，等待管理员审核。',
    APPROVED: '你的呼号已通过审核，可在资料页展示。',
    REJECTED: '申请未通过，可补充资料后再次提交。',
    CANCELLED: '这条申请已取消。',
  }[status] || '请查看呼号系统获取更多信息。'
}

function openApply() {
  router.push('/callsign-apply')
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
.plugin-profile-panel { height: 100%; }
.callsign-panel-status {
  margin-top: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(103, 80, 164, 0.06);
}
</style>
