<template>
  <div class="audit-panel section-card">
    <div class="audit-panel__header">
      <div>
        <div class="eyebrow">审计日志</div>
        <h2>系统日志</h2>
      </div>
      <div class="audit-toolbar-actions">
        <label class="audit-live-chip">
          <input v-model="liveMode" type="checkbox" />
          <span>{{ liveMode ? '实时刷新中' : '暂停自动刷新' }}</span>
        </label>
        <button class="audit-refresh-btn" :disabled="loading" @click="refreshLatest">
          <mdui-icon name="refresh--rounded" :class="{ spin: loading }"></mdui-icon>
        </button>
      </div>
    </div>

    <div class="audit-filters">
      <input v-model="searchKeyword" type="text" class="audit-filter-input" placeholder="搜索动作、对象或说明…" />
      <AppSelect
        v-model="levelFilter"
        placeholder="全部级别"
        :options="levelFilterOptions"
        class="audit-filter-select"
      ></AppSelect>
      <div class="audit-metric-pill">显示 {{ filteredLogs.length }} / {{ logs.length }}</div>
    </div>

    <div v-if="auditLogPanels.length" class="audit-plugin-grid">
      <component
        :is="panel.component"
        v-for="panel in auditLogPanels"
        :key="panel.id"
        :config="panel.config"
        :plugin="panel"
        :logs="logs"
        class="audit-plugin-grid__item"
      />
    </div>

    <div class="audit-console" ref="consoleRef">
      <div v-if="loading && !logs.length" class="audit-console__empty">
        <mdui-circular-progress style="font-size:18px"></mdui-circular-progress>
        <span>加载中…</span>
      </div>
      <div v-else-if="!filteredLogs.length" class="audit-console__empty">暂无日志</div>

      <button v-if="hasMore" class="audit-load-older" :disabled="loading" @click="loadMore">
        {{ loading ? '加载中…' : '加载更早记录' }}
      </button>

      <div class="audit-console__stream">
      <div v-for="entry in filteredLogs" :key="entry.id" class="audit-line" :class="`audit-line--${entry.level}`">
        <span class="audit-time">[{{ formatTime(entry.time) }}]</span>
        <span class="audit-action" :class="`audit-action--${entry.level}`">{{ entry.action }}</span>
        <span class="audit-desc">{{ entry.description }}</span>
        <button v-if="entry.actor?.uid" class="audit-user audit-user--actor" @click="goUser(entry.actor.uid)">{{ entry.actor.label }}</button>
        <span v-else-if="entry.actor" class="audit-user audit-user--actor">{{ entry.actor.label }}</span>
        <template v-if="entry.subject">
          <span class="audit-arrow">→</span>
          <button v-if="entry.subject.uid" class="audit-user audit-user--subject" @click="goUser(entry.subject.uid)">{{ entry.subject.label }}</button>
          <span v-else class="audit-user audit-user--subject">{{ entry.subject.label }}</span>
        </template>
        <button v-if="entry.imageSlug" class="audit-image-link" @click="goImage(entry.imageSlug)">《{{ entry.imageTitle || entry.imageSlug }}》</button>
        <span v-if="entry.extra" class="audit-extra">{{ entry.extra }}</span>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { extractUuidsFromLogs, formatAuditLog } from '@/lib/auditLog'
import { toUserProfilePath } from '@/lib/uid'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { getAuditLogPanels } from '@/plugins/runtime'
import { useAuthStore } from '@/stores/auth'
import AppSelect from '@/components/form/AppSelect.vue'

const router = useRouter()
const auth = useAuthStore()
const PAGE = 30
const LIVE_INTERVAL = 15000

const logs = ref([])
const loading = ref(false)
const hasMore = ref(false)
const offset = ref(0)
const nickMap = ref(new Map())
const levelFilter = ref('ALL')
const levelFilterOptions = [
  { label: '全部级别', value: 'ALL' },
  { label: '信息', value: 'info' },
  { label: '成功', value: 'success' },
  { label: '警告', value: 'warn' },
  { label: '错误', value: 'error' },
]
const searchKeyword = ref('')
const liveMode = ref(true)
const consoleRef = ref(null)
let liveTimer = null

const filteredLogs = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return logs.value.filter((entry) => {
    if (levelFilter.value !== 'ALL' && entry.level !== levelFilter.value) return false
    if (!keyword) return true
    return [entry.action, entry.description, entry.extra, entry.actor?.label, entry.subject?.label]
      .filter(Boolean)
      .some((part) => String(part).toLowerCase().includes(keyword))
  })
})

const auditLogPanels = computed(() =>
  getAuditLogPanels({
    auth,
    logs: logs.value,
    route: { path: '/admin/dashboard#audit' },
  }),
)

onMounted(async () => {
  await load()
  startLiveTimer()
})

onUnmounted(() => {
  stopLiveTimer()
})

function startLiveTimer() {
  stopLiveTimer()
  liveTimer = window.setInterval(() => {
    if (liveMode.value && !loading.value) {
      refreshLatest({ silent: true })
    }
  }, LIVE_INTERVAL)
}

function stopLiveTimer() {
  if (liveTimer) {
    window.clearInterval(liveTimer)
    liveTimer = null
  }
}

async function fetchNicknames(uuids) {
  if (!uuids.length) return
  const missing = uuids.filter((id) => !nickMap.value.has(id))
  if (!missing.length) return
  try {
    const supabase = requireSupabase()
    const { data } = await supabase.from('profiles').select('id, nickname, uid').in('id', missing)
    for (const row of data || []) {
      nickMap.value.set(row.id, { nickname: row.nickname, uid: row.uid })
    }
  } catch {}
}

async function load() {
  loading.value = true
  offset.value = 0
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, PAGE)
    if (error) throw error
    const rows = data || []
    await fetchNicknames(extractUuidsFromLogs(rows))
    logs.value = rows.slice(0, PAGE).reverse().map((r) => formatAuditLog(r, nickMap.value))
    hasMore.value = rows.length > PAGE
    offset.value = logs.value.length
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function refreshLatest(options = {}) {
  const { silent = false } = options
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE)
    if (error) throw error
    const rows = data || []
    await fetchNicknames(extractUuidsFromLogs(rows))
    const entries = rows.reverse().map((r) => formatAuditLog(r, nickMap.value))
    const existing = new Set(logs.value.map((item) => item.id))
    const freshEntries = entries.filter((item) => !existing.has(item.id))
    if (freshEntries.length) {
      logs.value = [...logs.value, ...freshEntries]
      if (!silent) {
        showToast(`已更新 ${freshEntries.length} 条最新日志`)
      }
    } else if (!silent) {
      showToast('当前没有新的日志。')
    }
  } catch (error) {
    if (!silent) showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset.value, offset.value + PAGE)
    if (error) throw error
    const rows = data || []
    await fetchNicknames(extractUuidsFromLogs(rows))
    const newEntries = rows.slice(0, PAGE).reverse().map((r) => formatAuditLog(r, nickMap.value))
    logs.value = [...newEntries, ...logs.value]
    hasMore.value = rows.length > PAGE
    offset.value += newEntries.length
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function goUser(uid) {
  const path = toUserProfilePath(uid)
  if (path) router.push(path)
}

function goImage(slug) {
  if (slug) router.push(`/image/${slug}`)
}
</script>

<style scoped>
.audit-panel { display: grid; gap: 14px; }
.audit-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.audit-toolbar-actions { display: flex; align-items: center; gap: 10px; }
.audit-live-chip {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 999px; background: rgba(103, 80, 164, 0.08); color: #4c1d95; font-size: 13px;
}
.audit-live-chip input { accent-color: #6750a4; }
.audit-filters {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
.audit-filter-input,
.audit-filter-select {
  min-height: 40px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.25);
  background: rgba(255,255,255,0.86); padding: 0 12px; color: #1e293b;
}
.audit-filter-input { min-width: 220px; flex: 1; }
.audit-metric-pill {
  padding: 8px 12px; border-radius: 999px; background: rgba(15,23,42,0.06); color: #475569; font-size: 13px;
}
.audit-plugin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap: 12px; }
.audit-console {
  border-radius: 20px;
  background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
  padding: 14px 16px;
  color: #e2e8f0;
  box-shadow: inset 0 0 0 1px rgba(148,163,184,0.12);
  max-height: 480px;
  overflow: auto;
}
.audit-console__empty { display: flex; align-items: center; gap: 10px; color: #94a3b8; min-height: 160px; justify-content: center; }
.audit-load-older {
  width: 100%; margin-bottom: 12px; min-height: 38px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.18);
  background: rgba(15,23,42,0.82); color: #cbd5e1;
}
.audit-console__stream {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.audit-line {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px;
  line-height: 1.55;
}
.audit-time { color: #93c5fd; }
.audit-action { font-weight: 700; color: #f8fafc; }
.audit-action--success { color: #86efac; }
.audit-action--warn { color: #fde68a; }
.audit-action--error { color: #fca5a5; }
.audit-desc { color: #e2e8f0; }
.audit-arrow { color: #64748b; }
.audit-user, .audit-image-link {
  border: none; background: transparent; padding: 0; color: #c4b5fd; cursor: pointer; font: inherit;
}
.audit-extra { color: #94a3b8; }

@media (max-width: 768px) {
  .audit-panel__header { flex-direction: column; align-items: flex-start; }
  .audit-filter-input { min-width: 100%; }
}
</style>
