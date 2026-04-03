<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">我的反馈</div>
          <h1>提交的反馈记录</h1>
          <p class="muted">查看和跟踪你提交的反馈</p>
        </div>
        <div class="feedback-tabs">
          <button 
            class="feedback-tab" 
            :class="{ 'feedback-tab--active': activeTab === 'image' }"
            @click="switchTab('image')"
          >
            图片反馈
            <span v-if="imageFeedbackCount > 0" class="tab-count">{{ imageFeedbackCount }}</span>
          </button>
          <button 
            class="feedback-tab" 
            :class="{ 'feedback-tab--active': activeTab === 'site' }"
            @click="switchTab('site')"
          >
            网站反馈
            <span v-if="siteFeedbackCount > 0" class="tab-count">{{ siteFeedbackCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">
        <mdui-circular-progress></mdui-circular-progress>
        <div>加载中…</div>
      </div>

      <div v-else-if="userFeedbacks.length === 0" class="empty-state">
        <p>你还没有提交过{{ activeTab === 'image' ? '图片' : '网站' }}反馈</p>
        <mdui-button variant="filled-tonal" @click="router.push('/')">去浏览</mdui-button>
      </div>

      <div v-else class="user-feedback-list">
        <div
          v-for="fb in userFeedbacks"
          :key="fb.id"
          class="user-feedback-card"
        >
          <div class="user-feedback-card__head">
            <span class="status-pill" :class="statusClass(fb.status)">{{ statusLabel(fb.status) }}</span>
            <span class="feedback-type-badge">{{ typeLabel(fb.feedback_type) }}</span>
            <strong class="user-feedback-card__title" v-if="fb.image_title">《{{ fb.image_title }}》</strong>
            <span class="user-feedback-card__time">{{ formatTime(fb.created_at) }}</span>
          </div>

          <div class="user-feedback-card__body">
            <div class="feedback-body-grid" :class="{ 'feedback-body-grid--full': activeTab === 'site' }">
              <div class="feedback-main-content">
                <p class="user-feedback-content" v-html="renderContent(fb.content)"></p>
                
                <div v-if="fb.review_note || fb.admin_note" class="feedback-review-note">
                  <strong>处理备注：</strong>{{ fb.review_note || fb.admin_note }}
                </div>

                <div v-if="activeTab === 'image' && fb.status === 'MORE_INFO'" class="user-feedback-actions">
                  <mdui-text-field
                    v-model="supplement[fb.id]"
                    variant="outlined"
                    placeholder="补充更多信息…"
                    class="supplement-input"
                  ></mdui-text-field>
                  <mdui-button variant="filled-tonal" :disabled="!supplement[fb.id]?.trim()" @click="submitSupplement(fb)">
                    补充
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
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { safeInsertAuditLog } from '@/lib/audit'
import VueEasyLightbox from 'vue-easy-lightbox'

const router = useRouter()

const activeTab = ref('image')
const loading = ref(false)
const userFeedbacks = ref([])
const supplement = reactive({})
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

function statusLabel(status) { 
  const labels = activeTab.value === 'image' ? imageStatusLabels : siteStatusLabels
  return labels[status] || status 
}

function typeLabel(type) { 
  const labels = activeTab.value === 'image' ? imageTypeLabels : siteTypeLabels
  return labels[type] || type 
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

function openLightbox(url) {
  lightboxImages.value = [url]
  lightboxIndex.value = 0
  lightboxVisible.value = true
}

function closeLightbox() {
  lightboxVisible.value = false
}

function switchTab(tab) {
  activeTab.value = tab
  loadMyFeedbacks()
}

async function loadMyFeedbacks() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    
    if (!userId) {
      router.push('/login')
      return
    }
    
    if (activeTab.value === 'image') {
      await loadImageFeedbacks(supabase, userId)
    } else {
      await loadSiteFeedbacks(supabase, userId)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadImageFeedbacks(supabase, userId) {
  const { data, error } = await supabase
    .from('image_feedbacks')
    .select('*')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  const imageIds = (data || []).map((fb) => fb.image_id).filter(Boolean)
  let images = {}
  
  if (imageIds.length > 0) {
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .select('id, title, slug, image_url')
      .in('id', imageIds)
    
    if (imageError) {
      console.error('加载图片数据失败:', imageError)
    }
    if (imageData) {
      images = Object.fromEntries(imageData.map((img) => [img.id, img]))
    }
  }
  
  userFeedbacks.value = (data || []).map((fb) => {
    const img = images[fb.image_id] || {}
    return {
      ...fb,
      image_title: img.title,
      image_slug: img.slug,
      image_url: img.image_url,
    }
  })
  
  imageFeedbackCount.value = (data || []).length
}

async function loadSiteFeedbacks(supabase, userId) {
  const { data, error } = await supabase
    .from('site_feedbacks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  userFeedbacks.value = data || []
  siteFeedbackCount.value = (data || []).length
}

async function submitSupplement(fb) {
  const text = supplement[fb.id]?.trim()
  if (!text) return
  
  try {
    const supabase = requireSupabase()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    
    const { error } = await supabase.from('feedback_replies').insert({
      feedback_id: fb.id,
      author_id: userId,
      content: text,
    })
    
    if (error) throw error
    
    await safeInsertAuditLog({
      action: 'feedback.replied',
      entityType: 'feedback',
      entityId: fb.id,
      level: 'info',
      details: { feedback_id: fb.id, image_id: fb.image_id },
    })
    
    showToast('补充信息已提交')
    delete supplement[fb.id]
    await loadMyFeedbacks()
    
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

onMounted(loadMyFeedbacks)
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

.tab-count {
  padding: 2px 6px;
  background: rgba(103,80,164,0.15);
  color: #4c3a7c;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.user-feedback-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.user-feedback-card {
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 14px;
  background: white;
  overflow: hidden;
}
.user-feedback-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(15,23,42,0.05);
}
.user-feedback-card__title { font-size: 14px; color: #0f172a; }
.user-feedback-card__time { font-size: 12px; color: #94a3b8; margin-left: auto; }

.user-feedback-card__body { padding: 16px; }

.feedback-body-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.feedback-body-grid--full {
  flex-direction: column;
}

.feedback-main-content { flex: 1; min-width: 200px; }

.user-feedback-content { font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 10px; }

.inline-image-link {
  color: #6750a4;
  text-decoration: none;
}
.inline-image-link:hover { text-decoration: underline; }

.feedback-review-note { margin-bottom: 10px; padding: 8px 12px; background: rgba(59,130,246,0.06); border-radius: 8px; font-size: 13px; color: #1e40af; }

.user-feedback-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.supplement-input { flex: 1; min-width: 150px; max-width: 300px; }

.feedback-type-badge {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(103,80,164,0.08);
  font-size: 11px;
  color: #4c3a7c;
}

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
