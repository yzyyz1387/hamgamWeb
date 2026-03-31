<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">投稿管理</div>
          <h1>我的投稿</h1>
          <p class="muted">查看和管理你提交的所有图片投稿。</p>
        </div>
        <div class="submission-filter-row">
          <AppTextField
            v-model="submissionSearch"
            placeholder="搜索投稿..."
            style="min-width: 200px"
            trim
          >
            <mdui-icon slot="icon" name="search--rounded"></mdui-icon>
          </AppTextField>
          <AppSelect
            v-model="submissionStatusFilter"
            label="状态筛选"
            :options="submissionStatusOptions"
            style="min-width: 180px"
          ></AppSelect>
          <mdui-button variant="filled" @click="router.push('/submit')">新建投稿</mdui-button>
        </div>
      </div>

      <div v-if="loadingSubmissions" class="empty-state">
        <mdui-circular-progress></mdui-circular-progress>
        <div>正在加载投稿列表…</div>
      </div>

      <div v-else-if="filteredSubmissions.length" class="submission-grid">
        <div v-for="item in filteredSubmissions" :key="item.id" class="submission-card">
          <div class="submission-card__thumb" @click="openPreview(item)">
            <img v-if="item.previewUrl" :src="item.previewUrl" alt="预览" />
            <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
          </div>
          <div class="submission-card__body">
            <div class="submission-card__title">{{ item.title }}</div>
            <div class="submission-card__meta">
              <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
              <span>{{ formatDate(item.created_at) }}</span>
            </div>
            <p v-if="item.description" class="submission-card__desc">{{ item.description }}</p>
            <div v-if="item.reviewer_note" class="submission-card__note">
              <strong>审核备注：</strong><span v-html="renderReviewerNote(item.reviewer_note)"></span>
            </div>
            <div v-if="item.status === 'REJECTED'" class="submission-card__actions">
              <mdui-button variant="outlined" size="small" @click="editSubmission(item)">重新编辑</mdui-button>
              <mdui-button variant="text" size="small" style="color: #b91c1c" @click="deleteSubmission(item)">删除</mdui-button>
            </div>
            <div v-if="item.status === 'PUBLISHED' && item.published_image_slug" class="submission-card__actions">
              <mdui-button variant="outlined" size="small" @click="goToImage(item.published_image_slug)">查看发布页</mdui-button>
              <mdui-button variant="text" size="small" @click="editPublishedImage(item)">编辑图片</mdui-button>
            </div>
            <div v-if="item.status === 'IMAGE_DELETED'" class="submission-card__deleted-notice">
              <mdui-icon name="delete--rounded" style="font-size:16px;vertical-align:middle;margin-right:4px"></mdui-icon>
              图片已被管理员删除
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <mdui-icon name="inbox--rounded" style="font-size: 48px; color: #c0c8d0; margin-bottom: 12px"></mdui-icon>
        <p>还没有投稿记录</p>
        <mdui-button variant="filled-tonal" @click="router.push('/submit')">立即投稿</mdui-button>
      </div>
    </mdui-card>

    <mdui-dialog :open="deleteConfirmDialog.open" @closed="deleteConfirmDialog.open = false">
      <div class="dialog-content">
        <h3>确认删除</h3>
        <p style="font-size:14px;color:#5f6b76;margin-top:8px">
          确定要删除投稿「<strong>{{ deleteConfirmDialog.title }}</strong>」吗？此操作不可恢复。
        </p>
      </div>
      <mdui-button slot="action" @click="deleteConfirmDialog.open = false">取消</mdui-button>
      <mdui-button slot="action" variant="filled" style="--mdui-comp-button-filled-container-color: #dc2626" :loading="deleteConfirmDialog.loading" @click="confirmDeleteSubmission">确认删除</mdui-button>
    </mdui-dialog>

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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import AppSelect from '@/components/form/AppSelect.vue'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { createSubmissionPreview } from '@/lib/engagement'
import { useAuthStore } from '@/stores/auth'
import { useGalleryStore } from '@/stores/gallery'
import VueEasyLightbox from 'vue-easy-lightbox'

const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const submissions = ref([])
const submissionSearch = ref('')
const submissionStatusFilter = ref('ALL')
const loadingSubmissions = ref(false)
const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)


const submissionStatusOptions = [
  { label: '全部状态', value: 'ALL' },
  { label: '待审核', value: 'PENDING' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已删除', value: 'IMAGE_DELETED' },
]


const deleteConfirmDialog = reactive({ open: false, title: '', id: '', storagePath: '', loading: false })

const filteredSubmissions = computed(() => {
  let items = submissions.value
  if (submissionStatusFilter.value !== 'ALL') {
    items = items.filter(s => s.status === submissionStatusFilter.value)
  }
  if (submissionSearch.value.trim()) {
    const q = submissionSearch.value.toLowerCase()
    items = items.filter(s => 
      s.title?.toLowerCase().includes(q) || 
      s.description?.toLowerCase().includes(q)
    )
  }
  return items
})

onMounted(async () => {
  await auth.init()
  await loadMySubmissions()
})

async function loadMySubmissions() {
  loadingSubmissions.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        published_image:images!published_image_id(slug)
      `)
      .eq('uploader_id', auth.user.id)
      .is('metadata->edit_for_image_id', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    submissions.value = await Promise.all((data || []).map(async item => {
      try {
        item.previewUrl = await createSubmissionPreview(item.storage_path, 200)
      } catch {
        item.previewUrl = null
      }
      item.published_image_slug = item.published_image?.slug || null
      return item
    }))
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loadingSubmissions.value = false
  }
}

async function openPreview(item) {
  try {
    const url = await createSubmissionPreview(item.storage_path)
    if (url) {
      lightboxImages.value = [url]
      lightboxIndex.value = 0
      lightboxVisible.value = true
    }
  } catch (error) { showToast(getErrorMessage(error)) }
}

function goToImage(slug) {
  if (slug) router.push(`/image/${slug}?edit=true`)
}

function editPublishedImage(item) {
  if (item.published_image_slug) {
    router.push(`/image/${item.published_image_slug}?edit=true`)
  }
}

function editSubmission(item) {
  router.push({ path: '/submit', query: { edit: item.id } })
}

function renderReviewerNote(note) {
  if (!note) return ''
  let html = note.replace(/\n/g, '<br/>')
  html = html.replace(/\[img:([a-zA-Z0-9-]+)\]/g, (match, slug) => {
    const img = galleryStore.images.find(i => i.slug === slug)
    if (img) {
      return `<img class="reviewer-note-image" src="${img.image_url}" alt="${img.title}" style="max-width:100%;max-height:200px;border-radius:8px;margin:4px 0;cursor:zoom-in" onclick="window.open('${img.image_url}', '_blank')" />`
    }
    return `<span style="color:#8a9aaa;font-size:12px">[图片:${slug}]</span>`
  })
  return html
}

function deleteSubmission(item) {
  deleteConfirmDialog.title = item.title
  deleteConfirmDialog.id = item.id
  deleteConfirmDialog.storagePath = item.storage_path
  deleteConfirmDialog.open = true
}

async function confirmDeleteSubmission() {
  deleteConfirmDialog.loading = true
  try {
    const supabase = requireSupabase()
    const userId = auth.user?.id
    
    if (!userId) {
      showToast('请先登录')
      return
    }
    
    if (deleteConfirmDialog.storagePath) {
      const { error: storageError } = await supabase.storage.from('submission-images').remove([deleteConfirmDialog.storagePath])
      if (storageError) console.warn('Failed to delete storage file:', storageError)
    }
    
    const { error, data } = await supabase
      .from('submissions')
      .delete()
      .eq('id', deleteConfirmDialog.id)
      .eq('uploader_id', userId)
      .select('id')
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      showToast('删除失败：未找到该投稿或无权限删除')
      return
    }
    
    showToast('投稿已删除')
    deleteConfirmDialog.open = false
    submissions.value = submissions.value.filter(s => s.id !== deleteConfirmDialog.id)
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    deleteConfirmDialog.loading = false
  }
}

function statusLabel(status) {
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回', IMAGE_DELETED: '已删除' }[status] || status
}

function statusClass(status) {
  return `status-pill--${{ PENDING: 'pending', PUBLISHED: 'published', REJECTED: 'rejected', WITHDRAWN: 'inactive', IMAGE_DELETED: 'deleted' }[status] || 'pending'}`
}
</script>

<style scoped>
.submission-filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.submission-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.submission-card {
  border-radius: 18px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.03);
  border: 1px solid rgba(24, 34, 44, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.08);
}

.submission-card__thumb {
  height: 160px;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.submission-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.submission-card__thumb:hover img {
  transform: scale(1.05);
}

.submission-card__body {
  padding: 14px;
}

.submission-card__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8a9aaa;
}

.submission-card__desc {
  font-size: 13px;
  color: #5f6b76;
  margin: 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.submission-card__note {
  font-size: 12px;
  color: #b91c1c;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
}

.submission-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.submission-card__deleted-notice {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(107, 114, 128, 0.08);
  border-radius: 8px;
}
</style>
