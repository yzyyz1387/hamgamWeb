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
      </div>

      <div class="submit-items-list">
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
            
            <div v-if="!item.file" class="submit-item__drop-zone" @click="triggerFileInput(index)">
              <div class="submit-item__drop-icon">🖼</div>
              <div class="submit-item__drop-text">点击选择图片</div>
              <div class="submit-item__drop-hint">JPG、PNG、WebP、GIF，最大 20MB</div>
            </div>
            
            <div v-else class="submit-item__preview" @click="triggerFileInput(index)">
              <img :src="item.previewUrl" alt="预览" />
              <div class="submit-item__preview-info">
                <span class="submit-item__preview-name">{{ item.file.name }}</span>
                <span class="submit-item__preview-size">{{ formatFileSize(item.file.size) }}</span>
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

      <div class="action-row" style="margin-top: 24px">
        <mdui-button variant="filled" :loading="submitting" :disabled="!hasValidItems" @click="submit">
          提交审核 ({{ validItemsCount }} 张)
        </mdui-button>
        <mdui-button variant="text" @click="router.push('/profile')">返回我的主页</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import { siteConfig } from '@/config/site'
import { getErrorMessage } from '@/lib/errors'
import { sanitizeFilename } from '@/lib/format'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const fileInputRefs = shallowRef([])

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
    previewUrl: ''
  }
}

const hasValidItems = computed(() => {
  return submitItems.value.some(item => item.title.trim() && item.file)
})

const validItemsCount = computed(() => {
  return submitItems.value.filter(item => item.title.trim() && item.file).length
})

onMounted(async () => {
  await auth.init()
  const defaultContributor = auth.profile?.callsign || auth.profile?.nickname || auth.displayName || ''
  submitItems.value.forEach(item => {
    item.contributor_name = defaultContributor
  })
})

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
  if (item.previewUrl) {
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
  if (item.previewUrl) {
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
  const validItems = submitItems.value.filter(item => item.title.trim() && item.file)
  
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
        const path = `${auth.user.id}/${datePart}/${Date.now()}-${sanitizeFilename(item.file.name)}`
        
        const { error: uploadError } = await supabase.storage
          .from(siteConfig.submissionBucket)
          .upload(path, item.file, {
            upsert: false,
            contentType: item.file.type || 'image/*',
          })
        
        if (uploadError) throw uploadError
        
        const { error: insertError } = await supabase.from('submissions').insert({
          title: item.title,
          description: item.description,
          contributor_name: item.contributor_name,
          original_filename: item.file.name,
          storage_bucket: siteConfig.submissionBucket,
          storage_path: path,
          mime_type: item.file.type || null,
          file_size: item.file.size || 0,
          uploader_id: auth.user.id,
          uploader_display_name: auth.displayName,
        })
        
        if (insertError) throw insertError
        
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
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: rgba(103, 80, 164, 0.02);
}

.submit-item__drop-zone:hover {
  border-color: rgba(103, 80, 164, 0.6);
  background: rgba(103, 80, 164, 0.05);
}

.submit-item__drop-icon {
  font-size: 32px;
  margin-bottom: 8px;
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
</style>
