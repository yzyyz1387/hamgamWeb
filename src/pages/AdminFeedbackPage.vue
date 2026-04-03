<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">反馈管理</div>
          <h1>用户反馈处理</h1>
          <p class="muted">查看和处理用户提交的反馈</p>
        </div>
        <div class="feedback-tabs">
          <button 
            class="feedback-tab" 
            :class="{ 'feedback-tab--active': activeTab === 'image' }"
            @click="switchTab('image')"
          >
            图片反馈
            <span v-if="imageFeedbackCount > 0" class="tab-badge">{{ imageFeedbackCount }}</span>
          </button>
          <button 
            class="feedback-tab" 
            :class="{ 'feedback-tab--active': activeTab === 'site' }"
            @click="switchTab('site')"
          >
            网站反馈
            <span v-if="siteFeedbackCount > 0" class="tab-badge">{{ siteFeedbackCount }}</span>
          </button>
        </div>
      </div>

      <div class="feedback-toolbar">
        <AppSelect
          v-model="statusFilter"
          placeholder="全部状态"
          :options="currentStatusFilterOptions"
          class="status-filter-select"
        ></AppSelect>
        <span class="metric-pill">{{ filteredFeedbacks.length }} 条记录</span>
      </div>

      <div v-if="loading" class="empty-state">
        <mdui-circular-progress></mdui-circular-progress>
        <div>加载中…</div>
      </div>

      <div v-else-if="filteredFeedbacks.length === 0" class="empty-state">
        <p>暂无{{ statusFilterLabel }}反馈记录</p>
      </div>

      <div v-else class="feedback-list">
        <div
          v-for="fb in filteredFeedbacks"
          :key="fb.id"
          class="feedback-card"
          :class="{ 'feedback-card--expanded': expandedId === fb.id }"
        >
          <div class="feedback-card__head" @click="toggleExpand(fb.id)">
            <span class="status-pill" :class="statusClass(fb.status)">{{ statusLabel(fb.status) }}</span>
            <span class="feedback-type-badge">{{ typeLabel(fb.feedback_type) }}</span>
            <strong class="feedback-card__title" v-if="fb.image_title">《{{ fb.image_title }}》</strong>
            <span class="feedback-card__time">{{ formatTime(fb.created_at) }}</span>
            <span class="feedback-card__reporter">{{ fb.reporter_name || '用户' }}</span>
            <mdui-icon name="expand_more--rounded" class="feedback-expand-icon" :class="{ 'feedback-expand-icon--open': expandedId === fb.id }"></mdui-icon>
          </div>

          <div v-show="expandedId === fb.id" class="feedback-card__body">
            <div class="feedback-body-grid" :class="{ 'feedback-body-grid--full': activeTab === 'site' }">
              <div class="feedback-main-content">
                <div class="feedback-content">
                  <p v-html="renderContent(fb.content)"></p>
                  <p v-if="fb.contact_email" class="feedback-contact">
                    <mdui-icon name="mail--rounded"></mdui-icon> {{ fb.contact_email }}
                  </p>
                </div>

                <div v-if="fb.review_note || fb.admin_note" class="feedback-review-note">
                  <strong>备注：</strong>{{ fb.review_note || fb.admin_note }}
                </div>

                <div class="feedback-actions">
                  <AppSelect
                    v-model="pendingStatus[fb.id]"
                    placeholder="变更状态"
                    :options="currentStatusChangeOptions"
                    class="action-select"
                  ></AppSelect>
                  <mdui-text-field
                    v-model="pendingNote[fb.id]"
                    variant="outlined"
                    placeholder="处理备注（可选）"
                    class="note-input"
                  ></mdui-text-field>
                  <mdui-button variant="filled-tonal" :loading="updatingId === fb.id" @click="updateStatus(fb)">
                    更新状态
                  </mdui-button>
                  <mdui-button v-if="activeTab === 'image'" variant="outlined" @click="toggleImageVisibility(fb)">
                    {{ fb.image_hidden ? '显示图片' : '隐藏图片' }}
                  </mdui-button>
                </div>
              </div>

              <div v-if="activeTab === 'image'" class="feedback-image-preview">
                <img v-if="fb.image_url" :src="fb.image_url" alt="反馈图片" @click="openLightbox(fb.image_url)" />
                <div v-else class="feedback-image-placeholder">
                  <mdui-icon name="image--rounded"></mdui-icon>
                  <span>无图片</span>
                </div>
                <a v-if="fb.image_slug" :href="`/image/${fb.image_slug}`" target="_blank" class="view-image-link">
                  查看详情页
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </mdui-card>

    <VueEasyLightbox
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      @hide="closeLightbox"
    ></VueEasyLightbox>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { safeInsertAuditLog } from '@/lib/audit'
import AppSelect from '@/components/form/AppSelect.vue'
import VueEasyLightbox from 'vue-easy-lightbox'

const props = defineProps({
  tab: { type: String, default: 'image' }
})

const activeTab = ref(props.tab || 'image')
const loading = ref(false)
const feedbacks = ref([])
const expandedId = ref(null)
const statusFilter = ref('')
const updatingId = ref('')
const pendingStatus = reactive({})
const pendingNote = reactive({})

const imageFeedbackCount = ref(0)
const siteFeedbackCount = ref(0)

const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)

const imageStatusLabels = {
  PENDING: '待审核',
  DISMISS: '不计入',
  RESOLVED: '已解决',
  DISCUSS: '需探讨',
  MORE_INFO: '需更多信息',
}

const siteStatusLabels = {
  PENDING: '待处理',
  READ: '已读',
  RESOLVED: '已解决',
  DISMISSED: '已忽略',
}

const imageTypeLabels = {
  violation: '违规内容',
  copyright: '版权问题',
  quality: '质量问题',
  other: '其他',
}

const siteTypeLabels = {
  bug: '问题反馈',
  feature: '功能建议',
  improvement: '体验优化',
  other: '其他',
}

const imageStatusFilterOptions = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'DISMISS', label: '不计入' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'DISCUSS', label: '需探讨' },
  { value: 'MORE_INFO', label: '需更多信息' },
]

const siteStatusFilterOptions = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'READ', label: '已读' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'DISMISSED', label: '已忽略' },
]

const imageStatusChangeOptions = [
  { value: 'RESOLVED', label: '已解决' },
  { value: 'DISMISS', label: '不计入' },
  { value: 'DISCUSS', label: '需探讨' },
  { value: 'MORE_INFO', label: '需更多信息' },
]

const siteStatusChangeOptions = [
  { value: 'READ', label: '已读' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'DISMISSED', label: '已忽略' },
]

const currentStatusFilterOptions = computed(() => 
  activeTab.value === 'image' ? imageStatusFilterOptions : siteStatusFilterOptions
)

const currentStatusChangeOptions = computed(() => 
  activeTab.value === 'image' ? imageStatusChangeOptions : siteStatusChangeOptions
)

const currentStatusLabels = computed(() => 
  activeTab.value === 'image' ? imageStatusLabels : siteStatusLabels
)

const currentTypeLabels = computed(() => 
  activeTab.value === 'image' ? imageTypeLabels : siteTypeLabels
)

function statusLabel(status) { 
  return currentStatusLabels.value[status] || status 
}

function typeLabel(type) { 
  return currentTypeLabels.value[type] || type 
}

function statusClass(status) {
  if (activeTab.value === 'image') {
    return {
      PENDING: 'status-pill--pending',
      DISMISS: 'status-pill--inactive',
      RESOLVED: 'status-pill--published',
      DISCUSS: 'status-pill--reviewer',
      MORE_INFO: 'status-pill--draft',
    }[status] || ''
  } else {
    return {
      PENDING: 'status-pill--pending',
      READ: 'status-pill--draft',
      RESOLVED: 'status-pill--published',
      DISMISSED: 'status-pill--inactive',
    }[status] || ''
  }
}

const statusFilterLabel = computed(() => {
  if (!statusFilter.value) return ''
  return currentStatusLabels.value[statusFilter.value] || ''
})

const filteredFeedbacks = computed(() => {
  if (!statusFilter.value) return feedbacks.value
  return feedbacks.value.filter((f) => f.status === statusFilter.value)
})

function switchTab(tab) {
  activeTab.value = tab
  statusFilter.value = ''
  expandedId.value = null
  loadFeedbacks()
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function openLightbox(url) {
  lightboxImages.value = [url]
  lightboxIndex.value = 0
  lightboxVisible.value = true
}

function closeLightbox() {
  lightboxVisible.value = false
}

function formatTime(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function renderContent(content) {
  if (!content) return ''
  return content.replace(/\[img:([^\]]+)\]/g, (match, slug) => {
    return `<a href="/image/${slug}" target="_blank" class="inline-image-link">[查看图片: ${slug}]</a>`
  }).replace(/\n/g, '<br>')
}

async function loadFeedbacks() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    
    if (activeTab.value === 'image') {
      await loadImageFeedbacks(supabase)
    } else {
      await loadSiteFeedbacks(supabase)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadImageFeedbacks(supabase) {
  const { data, error } = await supabase
    .from('image_feedbacks')
    .select(`*`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  
  const userIds = new Set()
  const imageIds = new Set()
  ;(data || []).forEach((fb) => {
    if (fb.reporter_id) userIds.add(fb.reporter_id)
    if (fb.reviewer_id) userIds.add(fb.reviewer_id)
    if (fb.image_id) imageIds.add(fb.image_id)
  })
  
  let profiles = {}
  let images = {}
  
  if (userIds.size > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', Array.from(userIds))
    
    if (!profileError && profileData) {
      profiles = Object.fromEntries(profileData.map((p) => [p.id, p]))
    }
  }
  
  if (imageIds.size > 0) {
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .select('id, title, slug, status, image_url')
      .in('id', Array.from(imageIds))
    
    if (imageError) {
      console.error('加载图片数据失败:', imageError)
    }
    if (imageData) {
      images = Object.fromEntries(imageData.map((img) => [img.id, img]))
    }
  }
  
  feedbacks.value = (data || []).map((fb) => {
    const img = images[fb.image_id] || {}
    return {
      ...fb,
      reporter_name: profiles[fb.reporter_id]?.nickname || null,
      reviewer_name: profiles[fb.reviewer_id]?.nickname || null,
      image_title: img.title,
      image_slug: img.slug,
      image_url: img.image_url,
      image_hidden: img.status === 'ARCHIVED',
      replies: [],
    }
  })
  
  imageFeedbackCount.value = (data || []).filter(fb => fb.status === 'PENDING').length
}

async function loadSiteFeedbacks(supabase) {
  const { data, error } = await supabase
    .from('site_feedbacks')
    .select(`*`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  
  const userIds = new Set()
  ;(data || []).forEach((fb) => {
    if (fb.user_id) userIds.add(fb.user_id)
    if (fb.handled_by) userIds.add(fb.handled_by)
  })
  
  let profiles = {}
  
  if (userIds.size > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', Array.from(userIds))
    
    if (!profileError && profileData) {
      profiles = Object.fromEntries(profileData.map((p) => [p.id, p]))
    }
  }
  
  feedbacks.value = (data || []).map((fb) => {
    return {
      ...fb,
      reporter_name: profiles[fb.user_id]?.nickname || null,
      handler_name: profiles[fb.handled_by]?.nickname || null,
    }
  })
  
  siteFeedbackCount.value = (data || []).filter(fb => fb.status === 'PENDING').length
}

async function updateStatus(fb) {
  const newStatus = pendingStatus[fb.id]
  const note = pendingNote[fb.id]?.trim()
  
  if (!newStatus) {
    showToast('请选择新状态')
    return
  }

  updatingId.value = fb.id
  
  try {
    const supabase = requireSupabase()
    
    if (activeTab.value === 'image') {
      await updateImageFeedbackStatus(supabase, fb, newStatus, note)
    } else {
      await updateSiteFeedbackStatus(supabase, fb, newStatus, note)
    }

    showToast(`已更新为 ${statusLabel(newStatus)}`)
    delete pendingStatus[fb.id]
    delete pendingNote[fb.id]
    await loadFeedbacks()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    updatingId.value = ''
  }
}

async function updateImageFeedbackStatus(supabase, fb, newStatus, note) {
  const { error } = await supabase.rpc('update_feedback_status', {
    p_feedback_id: fb.id,
    p_new_status: newStatus,
    p_review_note: note || null,
  })

  if (error) throw error

  await safeInsertAuditLog({
    action: 'feedback.updated',
    entityType: 'feedback',
    entityId: fb.id,
    level: 'warn',
    details: {
      old_status: fb.status,
      new_status: newStatus,
      image_id: fb.image_id,
      image_title: fb.image_title,
      review_note: note,
    },
  })

  if (newStatus === 'RESOLVED' && fb.image_id) {
    await supabase
      .from('images')
      .update({ hidden_reason: `通过反馈处理 - ${note || ''}` })
      .eq('id', fb.image_id)
  }

  if (fb.reporter_id) {
    const feedbackUrl = `${window.location.origin}/my-feedback`
    await supabase.rpc('notify_user_feedback_updated', {
      p_user_id: fb.reporter_id,
      p_new_status: newStatus,
      p_image_title: fb.image_title || null,
      p_review_note: note || null,
      p_feedback_url: feedbackUrl,
    })
  }
}

async function updateSiteFeedbackStatus(supabase, fb, newStatus, note) {
  const { error } = await supabase
    .from('site_feedbacks')
    .update({
      status: newStatus,
      admin_note: note || null,
      handled_at: new Date().toISOString(),
    })
    .eq('id', fb.id)

  if (error) throw error

  await safeInsertAuditLog({
    action: 'site_feedback.updated',
    entityType: 'site_feedback',
    entityId: fb.id,
    level: 'warn',
    details: {
      old_status: fb.status,
      new_status: newStatus,
      admin_note: note,
    },
  })
}

async function toggleImageVisibility(fb) {
  if (!fb.image_id) return
  
  try {
    const supabase = requireSupabase()
    const isHidden = !!fb.image_hidden
    
    if (isHidden) {
      await supabase.from('images').update({
        status: 'PUBLISHED',
      }).eq('id', fb.image_id)
      
      await safeInsertAuditLog({
        action: 'image.shown',
        entityType: 'image',
        entityId: fb.image_id,
        level: 'success',
        details: { reason: '通过反馈管理恢复' },
      })
      
      showToast('图片已恢复显示')
    } else {
      await supabase.from('images').update({
        status: 'ARCHIVED',
      }).eq('id', fb.image_id)
      
      await safeInsertAuditLog({
        action: 'image.hidden',
        entityType: 'image',
        entityId: fb.image_id,
        level: 'warn',
        details: { reason: '通过反馈管理隐藏' },
      })
      
      showToast('图片已隐藏')
    }
    
    await loadFeedbacks()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

onMounted(() => {
  loadFeedbacks()
})

watch(() => props.tab, (val) => {
  if (val && val !== activeTab.value) {
    switchTab(val)
  }
})
</script>

<style scoped>
.feedback-tabs {
  display: flex;
  gap: 4px;
  margin-top: 12px;
}

.feedback-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: rgba(15,23,42,0.04);
  border-radius: 8px;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.feedback-tab:hover {
  background: rgba(103,80,164,0.08);
  color: #4c3a7c;
}

.feedback-tab--active {
  background: rgba(103,80,164,0.12);
  color: #4c3a7c;
  font-weight: 600;
}

.tab-badge {
  padding: 2px 6px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.feedback-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
.status-filter-select { min-width: 140px; }
.metric-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(103,80,164,0.08);
  font-size: 12px;
  color: #4c3a7c;
}

.feedback-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.feedback-card {
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 14px;
  background: white;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.feedback-card:hover { box-shadow: 0 4px 12px rgba(15,23,42,0.06); }

.feedback-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  flex-wrap: wrap;
}
.feedback-card__head:hover { background: rgba(15,23,42,0.02); }

.feedback-type-badge {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(103,80,164,0.08);
  font-size: 11px;
  color: #4c3a7c;
}

.feedback-card__title { font-size: 14px; color: #0f172a; }
.feedback-card__time { font-size: 12px; color: #94a3b8; }
.feedback-card__reporter { font-size: 12px; color: #64748b; }
.feedback-expand-icon { transition: transform 0.2s; color: #94a3b8; margin-left: auto; }
.feedback-expand-icon--open { transform: rotate(180deg); }

.feedback-card__body { padding: 16px; border-top: 1px solid rgba(15,23,42,0.05); }

.feedback-body-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.feedback-body-grid--full {
  flex-direction: column;
}

.feedback-main-content { flex: 1; min-width: 200px; }

.feedback-content p { font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 8px; }
.feedback-contact { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6750a4; }

.inline-image-link {
  color: #6750a4;
  text-decoration: none;
}
.inline-image-link:hover { text-decoration: underline; }

.feedback-review-note { margin-top: 10px; padding: 8px 12px; background: rgba(245,158,11,0.06); border-radius: 8px; font-size: 13px; color: #92400e; }

.feedback-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.action-select { min-width: 130px; }
.note-input { flex: 1; min-width: 150px; max-width: 280px; }

.feedback-image-preview {
  width: 160px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feedback-image-preview img {
  width: 160px;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s;
  background: rgba(15,23,42,0.04);
}

.feedback-image-preview img:hover {
  transform: scale(1.02);
}

.feedback-image-placeholder {
  width: 160px;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(15,23,42,0.04);
  border-radius: 10px;
  color: #94a3b8;
  font-size: 12px;
}

.view-image-link {
  font-size: 12px;
  color: #6750a4;
  text-decoration: none;
  font-weight: 500;
  text-align: center;
}
.view-image-link:hover { text-decoration: underline; }

@media (max-width: 600px) {
  .feedback-body-grid { flex-direction: column; }
  .feedback-image-preview { width: 100%; }
  .feedback-image-preview img { width: 100%; height: auto; max-height: 200px; }
}
</style>
