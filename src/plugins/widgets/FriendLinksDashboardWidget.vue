<template>
  <mdui-card class="section-card plugin-dashboard-widget">
    <div class="section-card__header section-card__header--wrap">
      <div>
        <div class="eyebrow">插件面板</div>
        <h3>友情链接概览</h3>
        <p class="muted">查看启用链接数量，并快速进入管理页。</p>
      </div>
      <mdui-button variant="text" @click="loadData" :loading="loading">刷新</mdui-button>
    </div>

    <div class="widget-kpi-row">
      <div class="widget-kpi">
        <strong>{{ stats.active }}</strong>
        <span>启用链接</span>
      </div>
      <div class="widget-kpi">
        <strong>{{ config.maxVisibleLinks || '—' }}</strong>
        <span>前台最多显示</span>
      </div>
    </div>

    <div v-if="links.length" class="widget-chip-list">
      <button
        v-for="link in links"
        :key="link.id"
        type="button"
        class="widget-link-chip"
        @click="openLink(link.url)"
      >
        <span class="widget-link-chip__title">{{ link.title }}</span>
        <span class="widget-link-chip__meta">{{ link.url }}</span>
      </button>
    </div>
    <div v-else class="empty-state empty-state--compact">暂无已启用的友情链接</div>

    <div class="widget-action-row">
      <mdui-button variant="filled-tonal" @click="router.push('/admin/friend-links')">管理友情链接</mdui-button>
    </div>
  </mdui-card>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  refreshKey: { type: [String, Number], default: 0 },
})

const router = useRouter()
const loading = ref(false)
const stats = reactive({ active: 0 })
const links = ref([])

async function loadData() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const [{ count, error: countError }, { data, error: listError }] = await Promise.all([
      supabase.from('friend_links').select('id', { head: true, count: 'exact' }).eq('is_active', true),
      supabase
        .from('friend_links')
        .select('id, title, url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(4),
    ])

    if (countError) throw countError
    if (listError) throw listError

    stats.active = count || 0
    links.value = data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function openLink(url) {
  if (!url) return
  window.open(url, props.config?.openInNewTab === false ? '_self' : '_blank', 'noopener,noreferrer')
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

.widget-kpi {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(103, 80, 164, 0.06);
  border: 1px solid rgba(103, 80, 164, 0.08);
}

.widget-kpi strong {
  display: block;
  font-size: 22px;
  color: #18222c;
}

.widget-kpi span {
  display: block;
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.widget-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.widget-link-chip {
  border: 1px solid rgba(24, 34, 44, 0.08);
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  max-width: 100%;
}

.widget-link-chip__title {
  display: block;
  font-weight: 600;
  color: #18222c;
}

.widget-link-chip__meta {
  display: block;
  margin-top: 4px;
  color: #8a9aaa;
  font-size: 12px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-action-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-start;
}

.empty-state--compact {
  padding: 16px 0;
}
</style>
