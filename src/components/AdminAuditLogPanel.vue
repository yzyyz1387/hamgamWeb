<template>
  <div class="audit-panel section-card">
    <div class="audit-panel__header">
      <div class="eyebrow">审计日志</div>
      <button class="audit-refresh-btn" :disabled="loading" @click="load">
        <mdui-icon name="refresh--rounded" :class="{ 'spin': loading }"></mdui-icon>
      </button>
    </div>

    <div class="audit-console">
      <div v-if="loading && !logs.length" class="audit-console__empty">
        <mdui-circular-progress style="font-size:18px"></mdui-circular-progress>
        <span>加载中…</span>
      </div>
      <div v-else-if="!logs.length" class="audit-console__empty">暂无日志</div>

      <div v-for="entry in logs" :key="entry.id" class="audit-line" :class="`audit-line--${entry.level}`">
        <span class="audit-time">[{{ formatTime(entry.time) }}]</span>
        <span class="audit-action" :class="`audit-action--${entry.level}`">{{ entry.action }}</span>
        <span class="audit-sep"> </span>

        <!-- 操作者 -->
        <button v-if="entry.actor?.uid" class="audit-user audit-user--actor" @click="goUser(entry.actor.uid)">
          {{ entry.actor.label }}
        </button>
        <span v-else-if="entry.actor" class="audit-user audit-user--actor">{{ entry.actor.label }}</span>

        <span class="audit-desc"> {{ entry.description }}</span>

        <!-- 被操作对象 -->
        <template v-if="entry.subject">
          <span class="audit-sep"> </span>
          <button v-if="entry.subject.uid" class="audit-user audit-user--subject" @click="goUser(entry.subject.uid)">
            {{ entry.subject.label }}
          </button>
          <span v-else class="audit-user audit-user--subject">{{ entry.subject.label }}</span>
        </template>

        <!-- 图片标题（可点击） -->
        <template v-if="entry.imageSlug">
          <span class="audit-sep"> </span>
          <button class="audit-image-link" @click="goImage(entry.imageSlug)">
            《{{ entry.imageTitle || entry.imageSlug }}》
          </button>
        </template>

        <!-- 额外信息 -->
        <span v-if="entry.extra" class="audit-extra"> · {{ entry.extra }}</span>
      </div>
    </div>

    <div v-if="hasMore" class="audit-panel__footer">
      <button class="audit-load-more" :disabled="loading" @click="loadMore">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { extractUuidsFromLogs, formatAuditLog } from '@/lib/auditLog'
import { toUserProfilePath } from '@/lib/uid'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'

const router = useRouter()
const PAGE = 30

const logs = ref([])
const loading = ref(false)
const hasMore = ref(false)
const offset = ref(0)
const nickMap = ref(new Map())

onMounted(load)

async function fetchNicknames(uuids) {
  if (!uuids.length) return
  const missing = uuids.filter((id) => !nickMap.value.has(id))
  if (!missing.length) return
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, uid')
      .in('id', missing)
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
    logs.value = rows.map((r) => formatAuditLog(r, nickMap.value))
    hasMore.value = rows.length > PAGE
    if (hasMore.value) logs.value.pop()
    offset.value = logs.value.length
  } catch (error) {
    showToast(getErrorMessage(error))
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
    const newEntries = rows.slice(0, PAGE).map((r) => formatAuditLog(r, nickMap.value))
    logs.value.push(...newEntries)
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
