<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">呼号审核</div>
          <h1>处理呼号认证申请</h1>
        </div>
        <div class="form-control admin-filter-field">
          <AppSelect v-model="filterStatus" label="筛选状态" :options="statusOptions" @change="loadApps"></AppSelect>
        </div>
      </div>
    </mdui-card>

    <AdminQuickActionStrip v-if="pageQuickActions.length" :actions="pageQuickActions" @run="runQuickAction" />

    <mdui-card v-if="apps.length" class="section-card bulk-toolbar-card">
      <PluginReviewActionBar
        :actions="bulkActions"
        :selected-count="selectedApps.length"
        :all-selected="allAppsSelected"
        @toggle-select-all="toggleSelectAllApps"
        @clear="clearAppSelection"
        @run="runBulkAction"
      />
    </mdui-card>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
    </div>

    <div v-else-if="apps.length" class="list-panel">
      <mdui-card v-for="app in apps" :key="app.id" class="section-card">
        <div class="list-item-card__head">
          <label class="bulk-select-pill" @click.stop>
            <input type="checkbox" :checked="isAppSelected(app.id)" @change="toggleAppSelection(app.id)" />
            <span>选择</span>
          </label>
          <div class="user-badge">
            <div class="user-badge__avatar">
              <img v-if="app.profiles?.avatar_url" :src="app.profiles.avatar_url" alt="avatar" />
              <span v-else>{{ (app.profiles?.nickname || 'U').slice(0,1).toUpperCase() }}</span>
            </div>
            <div>
              <strong>{{ app.profiles?.nickname }}</strong>
              <div class="muted" style="font-size:12px">{{ app.profiles?.email }}</div>
            </div>
          </div>
          <span class="status-pill" :class="statusPillClass(app.status)">{{ statusLabel(app.status) }}</span>
        </div>

        <div class="callsign-app-info">
          <div><span class="muted">申请呼号：</span><strong>{{ app.callsign }}</strong></div>
          <div><span class="muted">提交时间：</span>{{ formatDate(app.created_at, { withTime: true }) }}</div>
          <div v-if="app.note"><span class="muted">备注：</span>{{ app.note }}</div>
          <div><span class="muted">文件：</span>{{ app.file_name }}</div>
        </div>

        <div class="action-row" style="margin:12px 0 8px">
          <mdui-button variant="filled-tonal" :loading="previewLoadingId === app.id" @click="previewFile(app)">
            查看证明文件
          </mdui-button>
          <template v-for="action in getRowActions(app)" :key="action.id">
            <mdui-button :variant="action.variant || 'text'" :size="action.size || 'small'" @click="runRowAction(action, app)">
              {{ action.label }}
            </mdui-button>
          </template>
        </div>

        <div v-if="getListFields(app).length" class="callsign-plugin-fields">
          <component
            :is="field.component"
            v-for="field in getListFields(app)"
            :key="field.id"
            :row="app"
            :profile="app.profiles"
            :auth="auth"
            :config="field.config"
            :plugin="field"
            class="callsign-plugin-fields__item"
          />
        </div>

        <div v-if="previewUrls[app.id]" style="margin-bottom:12px">
          <template v-if="app.file_name.endsWith('.pdf')">
            <a :href="previewUrls[app.id]" target="_blank" rel="noopener" class="muted" style="font-size:13px">
              点击在新标签页打开 PDF
            </a>
          </template>
          <template v-else>
            <img 
              :src="previewUrls[app.id]" 
              alt="证明文件" 
              style="max-width:100%;max-height:400px;border-radius:12px;object-fit:contain;cursor:zoom-in" 
              @click="openLightbox(previewUrls[app.id])"
            />
          </template>
        </div>

        <template v-if="app.status === 'PENDING'">
          <div class="form-control" style="margin-bottom:10px">
            <AppTextField v-model="reviewNotes[app.id]" trim label="审核备注（可选）" maxlength="200" counter></AppTextField>
          </div>
          <div class="action-row">
            <mdui-button variant="filled" :loading="actionId === app.id + '_approve'" @click="review(app, 'APPROVED')">
              通过并更新呼号
            </mdui-button>
            <mdui-button variant="filled-tonal" :loading="actionId === app.id + '_reject'" @click="review(app, 'REJECTED')">
              驳回
            </mdui-button>
          </div>
        </template>
        <div v-else class="muted" style="font-size:13px">
          {{ app.reviewer_note ? `审核备注：${app.reviewer_note}` : '' }}
          {{ app.reviewed_at ? `· ${formatDate(app.reviewed_at, { withTime: true })}` : '' }}
        </div>
      </mdui-card>
    </div>

    <div v-else class="empty-state">当前筛选条件下没有申请。</div>

    <VueEasyLightbox
      teleport="body"
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
    />
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { formatDate, copyText } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useLightbox } from '@/composables/useLightbox'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import AdminQuickActionStrip from '@/components/admin/AdminQuickActionStrip.vue'
import PluginReviewActionBar from '@/components/admin/PluginReviewActionBar.vue'
import VueEasyLightbox from 'vue-easy-lightbox'
import { computed, onMounted, reactive, ref } from 'vue'
import { getAdminListFields, getAdminQuickActions, getAdminTableRowActions, emitPluginEvent, getReviewBulkActions, invokePluginAction, invokePluginBulkAction } from '@/plugins/runtime'
import { useAuthStore } from '@/stores/auth'

const { lightboxVisible, lightboxImages, lightboxIndex, openLightbox } = useLightbox()
const router = useRouter()
const auth = useAuthStore()

const statusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
]

const apps = ref([])
const loading = ref(false)
const filterStatus = ref('PENDING')
const reviewNotes = reactive({})
const previewUrls = reactive({})
const previewLoadingId = ref('')
const actionId = ref('')
const selectedAppIds = ref([])

const selectedApps = computed(() => apps.value.filter((item) => selectedAppIds.value.includes(item.id)))
const allAppsSelected = computed(() => apps.value.length > 0 && selectedApps.value.length === apps.value.length)
const bulkActions = computed(() => getReviewBulkActions({
  target: 'admin-callsign',
  auth,
  router,
  route: { path: '/admin/callsign' },
  rows: selectedApps.value,
  selectedItems: selectedApps.value,
}).filter((action) => action.requiresSelection === false || selectedApps.value.length > 0))

const coreQuickActions = computed(() => [
  {
    id: 'callsign-refresh',
    label: '刷新申请',
    description: '重新加载当前呼号申请列表',
    icon: 'refresh--rounded',
    tone: 'secondary',
    onClick: () => loadApps(),
  },
  {
    id: 'callsign-dashboard',
    label: '返回总览',
    description: '回到后台工作台',
    icon: 'space_dashboard--rounded',
    tone: 'neutral',
    to: '/admin',
  },
  {
    id: 'callsign-apply-page',
    label: '打开申请页',
    description: '核对前台申请表与提示文案',
    icon: 'open_in_new--rounded',
    tone: 'secondary',
    to: '/callsign-apply',
  },
])

const pluginQuickActions = computed(() => getAdminQuickActions({
  target: 'admin-callsign',
  auth,
  router,
  route: { path: '/admin/callsign' },
  rows: selectedApps.value,
  selectedItems: selectedApps.value,
}))

const pageQuickActions = computed(() => [...coreQuickActions.value, ...pluginQuickActions.value].sort((a, b) => (a.order || 0) - (b.order || 0)))

onMounted(loadApps)

async function loadApps() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    let query = supabase
      .from('callsign_applications')
      .select('*, profiles!callsign_applications_user_id_fkey(nickname, email, avatar_url, uid, grid_locator, callsign, certifications)')
      .order('created_at', { ascending: false })
    if (filterStatus.value !== 'ALL') query = query.eq('status', filterStatus.value)
    const { data, error } = await query
    if (error) throw error
    apps.value = data || []
    const visible = new Set(apps.value.map((item) => item.id))
    selectedAppIds.value = selectedAppIds.value.filter((id) => visible.has(id))
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}


function getListFields(app) {
  return getAdminListFields({
    target: 'admin-callsign',
    auth,
    row: app,
    profile: app?.profiles,
    route: { path: '/admin/callsign' },
    router,
  })
}

function getRowActions(app) {
  return getAdminTableRowActions({
    target: 'admin-callsign',
    auth,
    row: app,
    profile: app?.profiles,
    route: { path: '/admin/callsign' },
    router,
  })
}

async function runRowAction(action, app) {
  if (typeof action?.onClick !== 'function') return
  try {
    await invokePluginAction(action, {
      auth,
      row: app,
      profile: app?.profiles,
      router,
      copyText,
      showToast,
    })
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function isAppSelected(appId) {
  return selectedAppIds.value.includes(appId)
}

function toggleAppSelection(appId) {
  if (!appId) return
  if (isAppSelected(appId)) {
    selectedAppIds.value = selectedAppIds.value.filter((id) => id !== appId)
    return
  }
  selectedAppIds.value = [...selectedAppIds.value, appId]
}

function toggleSelectAllApps() {
  if (allAppsSelected.value) {
    selectedAppIds.value = []
    return
  }
  selectedAppIds.value = apps.value.map((item) => item.id)
}

function clearAppSelection() {
  selectedAppIds.value = []
}

async function runQuickAction(action) {
  if (!action) return
  if (action.pluginId) {
    try {
      await invokePluginAction(action, {
        auth,
        router,
        rows: selectedApps.value,
        selectedItems: selectedApps.value,
        showToast,
      })
    } catch (error) {
      showToast(getErrorMessage(error))
    }
    return
  }
  if (typeof action.onClick === 'function') {
    await action.onClick({ auth, router, rows: selectedApps.value, selectedItems: selectedApps.value })
    return
  }
  if (action.to) router.push(action.to)
}

async function runBulkAction(action) {
  if (!selectedApps.value.length) return
  try {
    await invokePluginBulkAction(action, {
      auth,
      router,
      copyText,
      showToast,
      rows: selectedApps.value,
      selectedItems: selectedApps.value,
      target: 'admin-callsign',
    })
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

async function previewFile(app) {
  previewLoadingId.value = app.id
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.storage
      .from(app.file_bucket)
      .createSignedUrl(app.file_path, 300)
    if (error) throw error
    previewUrls[app.id] = data.signedUrl
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    previewLoadingId.value = ''
  }
}

async function review(app, status) {
  actionId.value = `${app.id}_${status === 'APPROVED' ? 'approve' : 'reject'}`
  try {
    const supabase = requireSupabase()
    const reviewerNote = reviewNotes[app.id] || null
    const { error } = await supabase.rpc('admin_review_callsign_application', {
      p_application_id: app.id,
      p_status: status,
      p_reviewer_note: reviewerNote,
    })
    if (error) throw error

    await emitPluginEvent('callsign.reviewed', { application: app, status, reviewerNote, target: 'admin-callsign' })
    showToast(status === 'APPROVED' ? '已通过并更新呼号' : '已驳回')
    await loadApps()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    actionId.value = ''
  }
}

function statusLabel(status) {
  return { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[status] || status
}
function statusPillClass(status) {
  return { PENDING: 'status-pill--pending', APPROVED: 'status-pill--published', REJECTED: 'status-pill--rejected' }[status] || ''
}
</script>


<style scoped>
.bulk-toolbar-card { margin-bottom: 16px; }
.bulk-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.bulk-toolbar__meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.bulk-toolbar__actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.bulk-select-pill { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#5f6368; }
.bulk-select-pill input { width:16px; height:16px; }
.callsign-plugin-fields {
  display: grid;
  gap: 12px;
  margin: 0 0 12px;
}

.callsign-plugin-fields__item {
  min-width: 0;
}
</style>
