<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">投稿通道</div>
          <h1>上传图片并进入审核流</h1>
          <p class="muted">
            图片上传后进入待审核状态，审核通过后将自动发布到公开图集，审核结果会通过站内通知告知。
          </p>
        </div>
        <div class="submit-tabs">
          <button 
            type="button" 
            class="submit-tab" 
            :class="{ 'submit-tab--active': activeTab === 'new' }"
            @click="activeTab = 'new'"
          >新建投稿</button>
          <button 
            type="button" 
            class="submit-tab" 
            :class="{ 'submit-tab--active': activeTab === 'history' }"
            @click="activeTab = 'history'; loadMySubmissions()"
          >我的投稿</button>
        </div>
      </div>

      <div v-if="activeTab === 'new'" class="submit-items-list">
        <div v-for="(item, index) in submitItems" :key="index" class="submit-item">
          <div class="submit-item__header">
            <span class="submit-item__number">图片 {{ index + 1 }}</span>
            <button
              v-if="submitItems.length > 1"
              type="button"
              class="submit-item__remove"
              @click="removeItem(index)"
            >
              ✕
            </button>
          </div>

          <div class="submit-item__info-row">
            <div class="form-control submit-item__field submit-item__field--title">
              <AppTextField
                :id="`submit-title-${index}`"
                v-model="item.title"
                trim
                label="标题"
                :maxlength="120"
                counter
                placeholder="例如：CQ WPX 比赛现场"
              ></AppTextField>
            </div>
            <div class="form-control submit-item__field submit-item__field--contributor">
              <AppTextField
                :id="`submit-contributor-${index}`"
                v-model="item.contributor_name"
                trim
                label="贡献者署名"
                :maxlength="80"
                counter
                placeholder="默认使用昵称或呼号"
              ></AppTextField>
            </div>
          </div>

          <div class="form-control submit-item__desc">
            <AppTextField
              :id="`submit-description-${index}`"
              v-model="item.description"
              trim
              label="描述（可选）"
              :maxlength="1000"
              counter
              rows="3"
              autosize
              placeholder="补充说明图片拍摄地点、设备、时间或故事。"
            ></AppTextField>
          </div>

          <div class="submit-item__image-area">
            <input
              :ref="el => fileInputRefs[index] = el"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style="display: none"
              @change="onFileChange($event, index)"
            />
            
            <div 
              v-if="!item.file && !item.editId" 
              class="submit-item__drop-zone" 
              :class="{ 'submit-item__drop-zone--dragover': isDragging && dragOverIndex === index }"
              @click="triggerFileInput(index)"
              @dragover="onDragOver($event, index)"
              @dragleave="onDragLeave($event, index)"
              @drop="onDrop($event, index)"
            >
              <mdui-icon name="image--rounded" class="submit-item__drop-icon"></mdui-icon>
              <div class="submit-item__drop-text">点击或拖拽图片到此处</div>
              <div class="submit-item__drop-hint">JPG、PNG、WebP、GIF，最大 20MB</div>
            </div>
            
            <div v-else class="submit-item__preview" @click="triggerFileInput(index)">
              <img :src="item.previewUrl" alt="预览" />
              <div class="submit-item__preview-info">
                <span class="submit-item__preview-name">{{ item.file?.name || item.original_filename || '已上传图片' }}</span>
                <span v-if="item.file" class="submit-item__preview-size">{{ formatFileSize(item.file.size) }}</span>
                <span v-else-if="item.file_size" class="submit-item__preview-size">{{ formatFileSize(item.file_size) }}</span>
              </div>
              <div class="submit-item__preview-change">点击更换</div>
            </div>
          </div>
        </div>

        <button type="button" class="submit-add-btn" @click="addItem">
          <span class="submit-add-btn__icon">+</span>
          <span class="submit-add-btn__text">添加更多图片</span>
        </button>
      </div>

      <div v-if="activeTab === 'new'" class="action-row" style="margin-top: 24px">
        <mdui-button variant="filled" :loading="submitting" :disabled="!hasValidItems" @click="submit">
          提交审核 ({{ validItemsCount }} 张)
        </mdui-button>
        <mdui-button variant="text" @click="router.push('/profile')">返回我的主页</mdui-button>
      </div>

      <div v-if="activeTab === 'history'" class="submission-history">
        <div v-if="loadingHistory" class="empty-state">
          <mdui-circular-progress></mdui-circular-progress>
          <div>正在加载投稿历史…</div>
        </div>

        <div v-else-if="mySubmissions.length === 0" class="empty-state">
          暂无投稿记录
        </div>

        <div v-else class="submission-history-list">
          <div v-for="item in mySubmissions" :key="item.id" class="submission-history-item">
            <div class="submission-history-item__thumb">
              <img v-if="item.previewUrl" :src="item.previewUrl" alt="预览" />
              <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
            </div>
            <div class="submission-history-item__content">
              <div class="submission-history-item__title">{{ item.title }}</div>
              <div class="submission-history-item__meta">
                <span class="status-pill" :class="`status-pill--${item.status.toLowerCase()}`">{{ statusLabel(item.status) }}</span>
                <span>{{ formatDate(item.created_at) }}</span>
              </div>
              <div v-if="item.reviewer_note" class="submission-history-item__note">
                审核备注：{{ item.reviewer_note }}
              </div>
              <div v-if="item.status === 'REJECTED'" class="submission-history-item__actions">
                <mdui-button variant="outlined" @click="editSubmission(item)">重新编辑</mdui-button>
                <mdui-button variant="text" style="color: #b91c1c" @click="deleteSubmission(item)">删除</mdui-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import { siteConfig } from '@/config/site'
import { getErrorMessage } from '@/lib/errors'
import { sanitizeFilename, formatDate } from '@/lib/format'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { createSubmissionPreview } from '@/lib/engagement'
import { computePHash, binaryToHex, computeMD5 } from '@/lib/phash'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const fileInputRefs = shallowRef([])
const activeTab = ref('new')
const mySubmissions = ref([])
const loadingHistory = ref(false)
const isDragging = ref(false)
const dragOverIndex = ref(-1)

const submitItems = ref([
  createEmptyItem()
])

const submitting = ref(false)

function createEmptyItem() {
  return {
    title: '',
    description: '',
    contributor_name: '',
    file: null,
    previewUrl: '',
    editId: null,
    editStoragePath: null,
    editStorageBucket: null,
  }
}

const hasValidItems = computed(() => {
  return submitItems.value.some(item => item.title.trim() && (item.file || item.editId))
})

const validItemsCount = computed(() => {
  return submitItems.value.filter(item => item.title.trim() && (item.file || item.editId)).length
})

onMounted(async () => {
  await auth.init()
  const defaultContributor = auth.profile?.callsign || auth.profile?.nickname || auth.displayName || ''
  submitItems.value.forEach(item => {
    if (!item.contributor_name) {
      item.contributor_name = defaultContributor
    }
  })
  
  const editId = route.query.edit
  if (editId) {
    await loadSubmissionForEdit(editId)
  }
})

async function loadSubmissionForEdit(submissionId) {
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()
    
    if (error) throw error
    if (!data) {
      showToast('未找到投稿记录')
      return
    }
    
    let previewUrl = ''
    try {
      previewUrl = await createSubmissionPreview(data.storage_path, 400)
    } catch {
      previewUrl = ''
    }
    
    submitItems.value = [{
      title: data.title,
      description: data.description || '',
      contributor_name: data.contributor_name || '',
      file: null,
      previewUrl,
      editId: data.id,
      editStoragePath: data.storage_path,
      editStorageBucket: data.storage_bucket,
      original_filename: data.original_filename,
      mime_type: data.mime_type,
      file_size: data.file_size,
    }]
    
    showToast('已加载投稿内容，修改后请重新提交')
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function triggerFileInput(index) {
  fileInputRefs.value[index]?.click()
}

function onFileChange(event, index) {
  const file = event.target.files?.[0]
  if (!file) return
  
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    showToast('仅支持 JPG、PNG、WebP、GIF 格式')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('图片大小请控制在 20MB 以内')
    return
  }
  
  const item = submitItems.value[index]
  if (item.previewUrl && !item.editId) {
    URL.revokeObjectURL(item.previewUrl)
  }
  item.file = file
  item.previewUrl = URL.createObjectURL(file)
  
  if (!item.title.trim()) {
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    item.title = nameWithoutExt.slice(0, 120)
  }
}

function onDragOver(event, index) {
  event.preventDefault()
  isDragging.value = true
  dragOverIndex.value = index
}

function onDragLeave(event, index) {
  event.preventDefault()
  if (dragOverIndex.value === index) {
    isDragging.value = false
    dragOverIndex.value = -1
  }
}

function onDrop(event, index) {
  event.preventDefault()
  isDragging.value = false
  dragOverIndex.value = -1
  
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    showToast('仅支持 JPG、PNG、WebP、GIF 格式')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('图片大小请控制在 20MB 以内')
    return
  }
  
  const item = submitItems.value[index]
  if (item.previewUrl && !item.editId) {
    URL.revokeObjectURL(item.previewUrl)
  }
  item.file = file
  item.previewUrl = URL.createObjectURL(file)
  
  if (!item.title.trim()) {
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    item.title = nameWithoutExt.slice(0, 120)
  }
}

function addItem() {
  const newItem = createEmptyItem()
  const defaultContributor = auth.profile?.callsign || auth.profile?.nickname || auth.displayName || ''
  newItem.contributor_name = defaultContributor
  submitItems.value.push(newItem)
}

function removeItem(index) {
  const item = submitItems.value[index]
  if (item.previewUrl && !item.editId) {
    URL.revokeObjectURL(item.previewUrl)
  }
  submitItems.value.splice(index, 1)
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function submit() {
  const validItems = submitItems.value.filter(item => item.title.trim() && (item.file || item.editId))
  
  if (validItems.length === 0) {
    showToast('请至少添加一张图片并填写标题')
    return
  }
  
  if (submitting.value) return
  submitting.value = true
  
  let successCount = 0
  let failCount = 0
  
  try {
    const supabase = requireSupabase()
    const datePart = new Date().toISOString().slice(0, 10)
    
    for (const item of validItems) {
      try {
        let storageBucket = item.editStorageBucket || siteConfig.submissionBucket
        let storagePath = item.editStoragePath
        let mimeType = item.mime_type
        let fileSize = item.file_size
        let originalFilename = item.original_filename
        
        if (item.file) {
          storageBucket = siteConfig.submissionBucket
          storagePath = `${auth.user.id}/${datePart}/${Date.now()}-${sanitizeFilename(item.file.name)}`
          mimeType = item.file.type || 'image/*'
          fileSize = item.file.size
          originalFilename = item.file.name
          
          const { error: uploadError } = await supabase.storage
            .from(siteConfig.submissionBucket)
            .upload(storagePath, item.file, {
              upsert: false,
              contentType: mimeType,
            })
          
          if (uploadError) throw uploadError
        }
        
        let phashHex = null
        let md5Hash = null
        if (item.file) {
          try {
            const [phashBinary, md5Result] = await Promise.all([
              computePHash(item.file),
              computeMD5(item.file)
            ])
            phashHex = binaryToHex(phashBinary)
            md5Hash = md5Result
          } catch {
            // phash/md5 calculation failed, continue without it
          }
        }
        
        const insertData = {
          title: item.title,
          description: item.description,
          contributor_name: item.contributor_name,
          original_filename: originalFilename,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          mime_type: mimeType,
          file_size: fileSize || 0,
          uploader_id: auth.user.id,
          uploader_display_name: auth.displayName,
          phash: phashHex,
          file_md5: md5Hash,
          metadata: item.editId ? {
            edit_for_submission_id: item.editId,
          } : {},
        }
        
        if (item.editId) {
          const updateData = {
            title: item.title,
            description: item.description,
            contributor_name: item.contributor_name,
            status: 'PENDING',
            reviewer_note: null,
            reviewer_id: null,
            reviewed_at: null,
          }
          
          if (item.file) {
            Object.assign(updateData, {
              original_filename: originalFilename,
              storage_bucket: storageBucket,
              storage_path: storagePath,
              mime_type: mimeType,
              file_size: fileSize || 0,
              phash: phashHex,
              file_md5: md5Hash,
            })
          }
          
          const { error: updateError } = await supabase
            .from('submissions')
            .update(updateData)
            .eq('id', item.editId)
          
          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase.from('submissions').insert(insertData)
          if (insertError) throw insertError
        }
        
        successCount++
      } catch (error) {
        failCount++
        console.error(`Failed to submit ${item.title}:`, error)
      }
    }
    
    if (successCount > 0) {
      if (failCount > 0) {
        showToast(`成功提交 ${successCount} 张，${failCount} 张失败`)
      } else {
        showToast(`已提交 ${successCount} 张图片，等待审核`)
      }
      router.push('/profile')
    } else {
      showToast('提交失败，请重试')
    }
    } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function loadMySubmissions() {
  if (!auth.user) return
  loadingHistory.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('uploader_id', auth.user.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    mySubmissions.value = await Promise.all((data || []).map(async item => {
      try {
        item.previewUrl = await createSubmissionPreview(item.storage_path, 200)
      } catch {
        item.previewUrl = null
      }
      return item
    }))
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loadingHistory.value = false
  }
}

function statusLabel(status) {
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回' }[status] || status
}

async function editSubmission(item) {
  router.push(`/submit?edit=${item.id}`)
}

async function deleteSubmission(item) {
  if (!confirm(`确定要删除投稿「${item.title}」吗？此操作不可恢复。}`)) return
  
  try {
    const supabase = requireSupabase()
    
    if (item.storage_path) {
      await supabase.storage.from(siteConfig.submissionBucket).remove([item.storage_path])
    }
    
    const { error } = await supabase.from('submissions').delete().eq('id', item.id)
    if (error) throw error
    
    showToast('投稿已删除')
    await loadMySubmissions()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}
</script>

<style scoped>
.submit-items-list {
  display: grid;
  gap: 20px;
}

.submit-item {
  padding: 18px;
  border-radius: 22px;
  background: rgba(17, 24, 39, 0.03);
  border: 1px solid rgba(24, 34, 44, 0.06);
}

.submit-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.submit-item__number {
  font-size: 13px;
  font-weight: 700;
  color: #6750a4;
}

.submit-item__remove {
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 14px;
  transition: background 0.15s;
}

.submit-item__remove:hover {
  background: rgba(239, 68, 68, 0.2);
}

.submit-item__info-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.submit-item__field {
  margin-bottom: 0;
}

.submit-item__desc {
  margin-bottom: 12px;
}

.submit-item__image-area {
  margin-top: 4px;
}

.submit-item__drop-zone {
  border: 2px dashed rgba(103, 80, 164, 0.3);
  border-radius: 18px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
  background: rgba(103, 80, 164, 0.02);
}

.submit-item__drop-zone:hover {
  border-color: rgba(103, 80, 164, 0.6);
  background: rgba(103, 80, 164, 0.05);
}

.submit-item__drop-zone--dragover {
  border-color: #6750a4;
  background: rgba(103, 80, 164, 0.1);
  transform: scale(1.01);
}

.submit-item__drop-icon {
  font-size: 48px;
  color: #6750a4;
  margin-bottom: 12px;
}

.submit-item__drop-text {
  font-weight: 600;
  font-size: 14px;
  color: #37424c;
}

.submit-item__drop-hint {
  color: #8a9aaa;
  font-size: 12px;
  margin-top: 4px;
}

.submit-item__preview {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(24, 34, 44, 0.08);
  cursor: pointer;
  transition: background 0.15s;
}

.submit-item__preview:hover {
  background: rgba(255, 255, 255, 0.95);
}

.submit-item__preview img {
  width: 100px;
  height: 70px;
  object-fit: cover;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.04);
}

.submit-item__preview-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.submit-item__preview-name {
  font-size: 13px;
  font-weight: 600;
  color: #18222c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submit-item__preview-size {
  font-size: 11px;
  color: #8a9aaa;
}

.submit-item__preview-change {
  font-size: 11px;
  color: #6750a4;
  font-weight: 600;
}

.submit-add-btn {
  width: 100%;
  padding: 16px;
  border: 2px dashed rgba(103, 80, 164, 0.25);
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: border-color 0.2s, background 0.2s;
}

.submit-add-btn:hover {
  border-color: rgba(103, 80, 164, 0.5);
  background: rgba(103, 80, 164, 0.04);
}

.submit-add-btn__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 400;
}

.submit-add-btn__text {
  font-size: 14px;
  font-weight: 600;
  color: #6750a4;
}

@media (max-width: 720px) {
  .submit-item__info-row {
    grid-template-columns: 1fr;
  }
  
  .submit-item__preview {
    grid-template-columns: 80px 1fr;
  }
  
  .submit-item__preview img {
    width: 80px;
    height: 56px;
  }
}

.submit-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.submit-tab {
  padding: 8px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #8a9aaa;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}

.submit-tab--active {
  background: rgba(103, 80, 164, 0.08);
  color: #6750a4;
}

.submission-history {
  margin-top: 16px;
}

.submission-history-list {
  display: grid;
  gap: 16px;
}

.submission-history-item {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 16px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(17, 24, 39, 0.03);
  border: 1px solid rgba(24, 34, 44, 0.06);
}

.submission-history-item__thumb {
  width: 80px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

.submission-history-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.submission-history-item__content {
  min-width: 0;
}

.submission-history-item__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.submission-history-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8a9aaa;
}

.submission-history-item__note {
  font-size: 12px;
  color: #b91c1c;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
}

.submission-history-item__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
