<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">投稿审核</div>
          <h1>统一处理上传图片</h1>
          <p class="muted">审核通过后，图片将自动转存到公开图集并对外展示。</p>
        </div>
        <div class="form-control admin-filter-field">
          <AppSelect id="submission-filter" v-model="filterStatus" label="筛选状态" :options="statusOptions" @change="loadSubmissions"></AppSelect>
        </div>
      </div>
    </mdui-card>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在加载投稿列表…</div>
    </div>

    <div v-else-if="submissions.length" class="submission-list">
      <mdui-card v-for="item in submissions" :key="item.id" class="section-card submission-card">
        <div class="submission-card__layout">
          <div class="submission-thumb" @click="openLightbox(item)">
            <template v-if="previewMap[item.id]">
              <img :src="previewMap[item.id]" alt="缩略图" />
            </template>
            <template v-else>
              <div class="submission-thumb__placeholder">
                <mdui-circular-progress v-if="previewLoadingId === item.id" style="font-size:24px"></mdui-circular-progress>
                <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
                <span v-if="previewLoadingId !== item.id" style="font-size:11px;color:#8a9aaa;margin-top:4px">点击预览</span>
              </div>
            </template>
          </div>

          <div class="submission-card__content">
            <div class="submission-card__head">
              <div>
                <strong style="font-size:16px">{{ item.title }}</strong>
                <div class="submission-meta">
                  <span>{{ item.uploader_display_name }}</span>
                  <span class="image-meta-sep">·</span>
                  <span>{{ formatDate(item.created_at, { withTime: true }) }}</span>
                  <span v-if="item.contributor_name && item.contributor_name !== item.uploader_display_name" class="image-meta-sep">·</span>
                  <span v-if="item.contributor_name && item.contributor_name !== item.uploader_display_name">
                    贡献者：{{ item.contributor_name }}
                  </span>
                </div>
              </div>
              <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            </div>

            <p v-if="item.description" class="muted" style="font-size:13px;margin:6px 0">{{ item.description }}</p>

            <div class="submission-file-info">
              <mdui-icon name="insert_drive_file--rounded" style="font-size:14px;color:#8a9aaa"></mdui-icon>
              <span>{{ item.original_filename }}</span>
              <span v-if="item.file_size" class="image-meta-sep">·</span>
              <span v-if="item.file_size">{{ formatFileSize(item.file_size) }}</span>
            </div>

            <div v-if="item.reviewer_note" class="muted" style="font-size:12px;margin-top:4px">
              审核备注：{{ item.reviewer_note }}
            </div>

            <template v-if="item.status === 'PENDING'">
              <div class="form-control" style="margin-top:12px">
                <AppTextField
                  :id="`note-${item.id}`"
                  v-model="reviewNotes[item.id]"
                  trim
                  label="审核备注（可选）"
                  maxlength="500"
                  counter
                  rows="3"
                  autosize
                ></AppTextField>
              </div>
              <div class="action-row" style="margin-top:10px">
                <mdui-button
                  variant="filled"
                  :disabled="actionBusyId === item.id"
                  :loading="actionBusyId === item.id && actionType === 'publish'"
                  @click="moderate(item, 'publish')"
                >通过并发布</mdui-button>
                <mdui-button
                  variant="filled-tonal"
                  :disabled="actionBusyId === item.id"
                  :loading="actionBusyId === item.id && actionType === 'reject'"
                  @click="moderate(item, 'reject')"
                >驳回</mdui-button>
              </div>
            </template>
          </div>
        </div>
      </mdui-card>
    </div>

    <div v-else class="empty-state">当前筛选条件下没有投稿。</div>
  </section>

  <VueEasyLightbox
    :visible="lightboxVisible"
    :imgs="lightboxImg ? [lightboxImg] : []"
    :index="0"
    @hide="lightboxVisible = false"
  />
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { formatDate } from '@/lib/format'
import { createSubmissionPreview } from '@/lib/engagement'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useGalleryStore } from '@/stores/gallery'
import VueEasyLightbox from 'vue-easy-lightbox'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'

const statusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '待审核', value: 'PENDING' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已驳回', value: 'REJECTED' },
]

const galleryStore = useGalleryStore()

const submissions = ref([])
const loading = ref(false)
const filterStatus = ref('ALL')
const previewMap = reactive({})
const reviewNotes = reactive({})
const actionBusyId = ref('')
const actionType = ref('')
const previewLoadingId = ref('')
const lightboxVisible = ref(false)
const lightboxImg = ref('')

onMounted(loadSubmissions)

async function loadSubmissions() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    let query = supabase.from('submissions').select('*').order('created_at', { ascending: false })
    if (filterStatus.value !== 'ALL') query = query.eq('status', filterStatus.value)
    const { data, error } = await query
    if (error) throw error
    submissions.value = data || []
    for (const item of submissions.value) {
      if (!previewMap[item.id]) loadThumb(item)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadThumb(item) {
  if (previewMap[item.id] || previewLoadingId.value === item.id) return
  previewLoadingId.value = item.id
  try {
    previewMap[item.id] = await createSubmissionPreview(item.storage_path, 600)
  } catch {
    // ignore preview errors
  } finally {
    previewLoadingId.value = ''
  }
}

async function openLightbox(item) {
  if (!previewMap[item.id]) await loadThumb(item)
  if (previewMap[item.id]) {
    lightboxImg.value = previewMap[item.id]
    lightboxVisible.value = true
  }
}

async function moderate(item, action) {
  actionBusyId.value = item.id
  actionType.value = action
  try {
    const supabase = requireSupabase()
    // 确保 session 已加载，Edge Function 需要 Authorization header
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { showToast('请先登录'); return }
    const { data, error } = await supabase.functions.invoke('moderate-submission', {
      body: { submissionId: item.id, action, note: reviewNotes[item.id] || '' },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (error) throw error
    showToast(action === 'publish' ? '投稿已通过并发布' : '投稿已驳回')
    await Promise.all([loadSubmissions(), galleryStore.loadImages(true)])
    return data
  } catch (error) {
    const message = getErrorMessage(error)
    if (message.includes('CORS') || message.includes('fetch') || message.includes('ERR_FAILED')) {
      showToast('审核服务暂不可用，请确认 Edge Function 已部署并配置 SERVICE_ROLE_KEY')
    } else {
      showToast(message)
    }
  } finally {
    actionBusyId.value = ''
    actionType.value = ''
  }
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusLabel(status) {
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回' }[status] || status
}
function statusClass(status) {
  return `status-pill--${{ PENDING: 'pending', PUBLISHED: 'published', REJECTED: 'rejected', WITHDRAWN: 'inactive' }[status] || 'pending'}`
}
</script>
