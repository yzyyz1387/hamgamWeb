<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">图片管理</div>
          <h1>隐藏 / 显示 / 删除图库图片</h1>
          <p class="muted">仅超级管理员可操作。支持按状态、日期、上传者、贡献者等条件筛选，点击缩略图可灯箱预览。</p>
        </div>
        <div class="admin-toolbar-group admin-toolbar-group--dense">
          <div class="form-control admin-filter-field admin-filter-field--sm">
            <AppSelect id="admin-image-status" v-model="filterStatus" label="状态" :options="statusOptions"></AppSelect>
          </div>
          <div class="form-control admin-filter-field admin-filter-field--sm">
            <AppSelect id="admin-image-date-preset" v-model="datePreset" label="日期范围" :options="datePresetOptions"></AppSelect>
          </div>
          <div class="form-control admin-filter-field admin-filter-field--sm">
            <AppSelect id="admin-image-sort" v-model="sortMode" label="排序" :options="sortOptions"></AppSelect>
          </div>
        </div>
      </div>

      <div class="admin-image-filter-grid">
        <div class="form-control">
          <AppTextField id="admin-image-search" v-model="keyword" trim type="search" label="搜索图片" placeholder="标题、描述、slug"></AppTextField>
        </div>
        <div class="form-control">
          <AppTextField id="admin-image-uploader" v-model="uploaderKeyword" trim label="上传者" placeholder="按上传者昵称筛选"></AppTextField>
        </div>
        <div class="form-control">
          <AppTextField id="admin-image-contributor" v-model="contributorKeyword" trim label="贡献者" placeholder="按署名 / 呼号筛选"></AppTextField>
        </div>
        <div class="form-control">
          <AppTextField id="admin-image-date-from" v-model="dateFrom" type="date" label="开始日期"></AppTextField>
        </div>
        <div class="form-control">
          <AppTextField id="admin-image-date-to" v-model="dateTo" type="date" label="结束日期"></AppTextField>
        </div>
        <div class="admin-image-filter-actions">
          <mdui-button variant="filled-tonal" @click="resetFilters">重置筛选</mdui-button>
          <div class="admin-image-filter-result muted">当前 {{ filteredImages.length }} / {{ images.length }} 张</div>
        </div>
      </div>
    </mdui-card>

    <div class="stats-grid admin-image-stats admin-image-stats--compact">
      <div class="stat-card stat-card--compact">
        <strong>{{ summary.total }}</strong>
        <span>图片总数</span>
      </div>
      <div class="stat-card stat-card--compact">
        <strong>{{ summary.published }}</strong>
        <span>前台显示</span>
      </div>
      <div class="stat-card stat-card--compact">
        <strong>{{ summary.archived }}</strong>
        <span>已隐藏</span>
      </div>
      <div class="stat-card stat-card--compact">
        <strong>{{ filteredImages.length }}</strong>
        <span>筛选结果</span>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在加载图片列表…</div>
    </div>

    <div v-else-if="filteredImages.length" class="admin-image-grid">
      <div
        v-for="item in filteredImages"
        :key="item.id"
        class="admin-image-grid-item"
        :data-image-slug="item.slug"
        :data-image-id="item.id"
      >
        <div class="admin-image-grid-item__thumb" @click="openLightbox(item)">
          <img :src="item.image_url" :alt="item.title" loading="lazy" :data-image-slug="item.slug" :data-image-id="item.id" />
        </div>
        <div class="admin-image-grid-item__body">
          <div class="admin-image-grid-item__title">{{ item.title }}</div>
          <div class="admin-image-grid-item__meta">
            <span>{{ item.contributor_name || '未署名' }}</span>
            <span class="image-meta-sep">·</span>
            <span>{{ formatDate(item.published_at || item.created_at, { withTime: true }) }}</span>
            <span class="admin-image-grid-item__status" :class="item.status === 'PUBLISHED' ? 'status-pill--published' : 'status-pill--inactive'">
              {{ item.status === 'PUBLISHED' ? '显示中' : '已隐藏' }}
            </span>
          </div>
          <div class="admin-image-grid-item__actions">
            <mdui-button variant="text" @click="openLightbox(item)">查看</mdui-button>
            <mdui-button
              v-if="item.status === 'PUBLISHED' && item.slug"
              variant="text"
              @click="openDetail(item)"
            >详情</mdui-button>
            <mdui-button
              :variant="item.status === 'PUBLISHED' ? 'filled-tonal' : 'filled'"
              :loading="actionBusyId === item.id && actionType === 'toggle'"
              :disabled="!!actionBusyId && actionBusyId !== item.id"
              @click="toggleVisibility(item)"
            >{{ item.status === 'PUBLISHED' ? '隐藏' : '显示' }}</mdui-button>
            <mdui-button
              variant="text"
              class="btn-danger"
              :loading="actionBusyId === item.id && actionType === 'delete'"
              :disabled="!!actionBusyId && actionBusyId !== item.id"
              @click="openDeleteDialog(item)"
            >删除</mdui-button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">当前筛选条件下没有图片。</div>

    <VueEasyLightbox
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
    />

    <mdui-dialog
      :open="deleteDialogOpen"
      :close-on-esc="true"
      :close-on-overlay-click="false"
      @closed="handleDeleteDialogClosed"
    >
      <div class="dialog-content dialog-content--danger">
        <h3>确认删除图片</h3>
        <p v-if="pendingDeleteItem">你将删除《{{ pendingDeleteItem.title }}》。此操作不可恢复。</p>
        <p>请输入 <strong>我确认删除</strong> 后才可执行。</p>
        <div class="form-control" style="margin-top:12px">
          <AppTextField
            id="image-delete-confirm"
            v-model="deleteConfirmText"
            trim
            label="确认短语"
            placeholder="请输入：我确认删除"
          ></AppTextField>
        </div>
      </div>
      <mdui-button slot="action" @click="deleteDialogOpen = false">取消</mdui-button>
      <mdui-button
        slot="action"
        variant="filled"
        class="btn-danger"
        :disabled="deleteConfirmText !== DELETE_PHRASE || !pendingDeleteItem"
        :loading="actionBusyId === pendingDeleteItem?.id && actionType === 'delete'"
        @click="confirmDelete"
      >确认删除</mdui-button>
    </mdui-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import VueEasyLightbox from 'vue-easy-lightbox'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { normalizeImageRecord } from '@/lib/image'
import { safeInsertAuditLog } from '@/lib/audit'
import { useGalleryStore } from '@/stores/gallery'

const router = useRouter()
const galleryStore = useGalleryStore()
const DELETE_PHRASE = '我确认删除'

const statusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '显示中', value: 'PUBLISHED' },
  { label: '已隐藏', value: 'ARCHIVED' },
]

const datePresetOptions = [
  { label: '全部时间', value: 'ALL' },
  { label: '今天', value: 'TODAY' },
  { label: '近 7 天', value: '7D' },
  { label: '近 30 天', value: '30D' },
  { label: '近 90 天', value: '90D' },
]

const sortOptions = [
  { label: '最新优先', value: 'NEWEST' },
  { label: '最早优先', value: 'OLDEST' },
  { label: '标题 A-Z', value: 'TITLE_ASC' },
]

const images = ref([])
const loading = ref(false)
const actionBusyId = ref('')
const actionType = ref('')
const filterStatus = ref('ALL')
const datePreset = ref('ALL')
const sortMode = ref('NEWEST')
const keyword = ref('')
const uploaderKeyword = ref('')
const contributorKeyword = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const deleteDialogOpen = ref(false)
const pendingDeleteItem = ref(null)
const deleteConfirmText = ref('')
const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)
const summary = reactive({ total: 0, published: 0, archived: 0 })

const filteredImages = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  const uploaderQ = uploaderKeyword.value.trim().toLowerCase()
  const contributorQ = contributorKeyword.value.trim().toLowerCase()
  const fromTs = dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`).getTime() : null
  const toTs = dateTo.value ? new Date(`${dateTo.value}T23:59:59`).getTime() : null
  const presetFromTs = getPresetStartTimestamp(datePreset.value)

  const result = images.value.filter((item) => {
    if (filterStatus.value !== 'ALL' && item.status !== filterStatus.value) return false
    const itemTs = getImageTimestamp(item)
    if (q) {
      const matched = [item.title, item.description, item.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
      if (!matched) return false
    }
    if (uploaderQ && !String(item.uploader_display_name || '').toLowerCase().includes(uploaderQ)) {
      return false
    }
    if (contributorQ && !String(item.contributor_name || '').toLowerCase().includes(contributorQ)) {
      return false
    }
    if (fromTs && (!itemTs || itemTs < fromTs)) return false
    if (toTs && (!itemTs || itemTs > toTs)) return false
    if (presetFromTs && (!itemTs || itemTs < presetFromTs)) return false
    return true
  })

  if (sortMode.value === 'OLDEST') {
    return [...result].sort((a, b) => getImageTimestamp(a) - getImageTimestamp(b))
  }
  if (sortMode.value === 'TITLE_ASC') {
    return [...result].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'))
  }
  return [...result].sort((a, b) => getImageTimestamp(b) - getImageTimestamp(a))
})

onMounted(loadImages)

async function loadImages() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const query = supabase.from('images').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(500)
    const [imagesRes, totalRes, publishedRes, archivedRes] = await Promise.all([
      query,
      supabase.from('images').select('id', { head: true, count: 'exact' }),
      supabase.from('images').select('id', { head: true, count: 'exact' }).eq('status', 'PUBLISHED'),
      supabase.from('images').select('id', { head: true, count: 'exact' }).eq('status', 'ARCHIVED'),
    ])
    if (imagesRes.error) throw imagesRes.error
    if (totalRes.error) throw totalRes.error
    if (publishedRes.error) throw publishedRes.error
    if (archivedRes.error) throw archivedRes.error
    images.value = (imagesRes.data || []).map(normalizeImageRecord).filter(Boolean)
    summary.total = totalRes.count || 0
    summary.published = publishedRes.count || 0
    summary.archived = archivedRes.count || 0
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function getImageTimestamp(item) {
  const raw = item?.published_at || item?.created_at || item?.updated_at || item?.sort_at
  const ts = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(ts) ? ts : 0
}

function getPresetStartTimestamp(preset) {
  if (!preset || preset === 'ALL') return null
  const now = new Date()
  if (preset === 'TODAY') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  const days = { '7D': 7, '30D': 30, '90D': 90 }[preset]
  if (!days) return null
  return now.getTime() - days * 24 * 60 * 60 * 1000
}

function resetFilters() {
  filterStatus.value = 'ALL'
  datePreset.value = 'ALL'
  sortMode.value = 'NEWEST'
  keyword.value = ''
  uploaderKeyword.value = ''
  contributorKeyword.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  loadImages()
}

function openLightbox(item) {
  if (!item?.image_url) return
  lightboxImages.value = [item.image_url]
  lightboxIndex.value = 0
  lightboxVisible.value = true
}

function openDetail(item) {
  if (item?.status === 'PUBLISHED' && item?.slug) {
    router.push(`/image/${item.slug}`)
  }
}

async function toggleVisibility(item) {
  const nextStatus = item.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED'
  actionBusyId.value = item.id
  actionType.value = 'toggle'
  try {
    const supabase = requireSupabase()
    const payload = {
      status: nextStatus,
      published_at: nextStatus === 'PUBLISHED' ? new Date().toISOString() : item.published_at,
    }
    const { data, error } = await supabase
      .from('images')
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single()
    if (error) throw error
    const normalized = normalizeImageRecord(data)
    const idx = images.value.findIndex((entry) => entry.id === item.id)
    if (idx >= 0) images.value.splice(idx, 1, normalized)
    await galleryStore.loadImages(true).catch(() => {})
    await safeInsertAuditLog({
      action: nextStatus === 'PUBLISHED' ? 'image.shown' : 'image.hidden',
      entityType: 'image',
      entityId: item.id,
      details: {
        title: item.title,
        slug: item.slug,
        from_status: item.status,
        to_status: nextStatus,
      },
    })
    summary.published += nextStatus === 'PUBLISHED' ? 1 : -1
    summary.archived += nextStatus === 'ARCHIVED' ? 1 : -1
    showToast(nextStatus === 'PUBLISHED' ? '图片已恢复显示' : '图片已隐藏')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    actionBusyId.value = ''
    actionType.value = ''
  }
}

function openDeleteDialog(item) {
  pendingDeleteItem.value = item
  deleteConfirmText.value = ''
  deleteDialogOpen.value = true
}

function handleDeleteDialogClosed() {
  if (!deleteDialogOpen.value) {
    pendingDeleteItem.value = null
    deleteConfirmText.value = ''
  }
}

async function confirmDelete() {
  const item = pendingDeleteItem.value
  if (!item || deleteConfirmText.value !== DELETE_PHRASE) return
  actionBusyId.value = item.id
  actionType.value = 'delete'
  try {
    const supabase = requireSupabase()
    if (item.storage_bucket && item.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(item.storage_bucket)
        .remove([item.storage_path])
      if (storageError && !isIgnorableStorageRemoveError(storageError)) throw storageError
    }

    const { error } = await supabase.from('images').delete().eq('id', item.id)
    if (error) throw error

    images.value = images.value.filter((entry) => entry.id !== item.id)
    summary.total = Math.max(0, summary.total - 1)
    if (item.status === 'PUBLISHED') {
      summary.published = Math.max(0, summary.published - 1)
    } else {
      summary.archived = Math.max(0, summary.archived - 1)
    }
    await galleryStore.loadImages(true).catch(() => {})
    await safeInsertAuditLog({
      action: 'image.deleted',
      entityType: 'image',
      entityId: item.id,
      details: {
        title: item.title,
        slug: item.slug,
        storage_bucket: item.storage_bucket,
        storage_path: item.storage_path,
        status: item.status,
      },
    })
    deleteDialogOpen.value = false
    pendingDeleteItem.value = null
    deleteConfirmText.value = ''
    showToast('图片已删除')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    actionBusyId.value = ''
    actionType.value = ''
  }
}

function isIgnorableStorageRemoveError(error) {
  const message = error?.message || ''
  return /not found|does not exist|No such object/i.test(message)
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>
