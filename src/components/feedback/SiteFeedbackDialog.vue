<template>
  <mdui-dialog :open="visible" @closed="$emit('update:visible', false)" style="--dialog-width: 560px">
    <div class="site-feedback-dialog">
      <div class="site-feedback-dialog__header">
        <div class="eyebrow">网站反馈</div>
        <h3>提交意见或建议</h3>
        <p class="muted">帮助我们改进网站，感谢你的反馈！</p>
      </div>

      <div v-if="submitting" class="site-feedback-loading">
        <mdui-circular-progress></mdui-circular-progress>
        <span>正在提交…</span>
      </div>

      <template v-else>
        <div class="site-feedback-form">
          <div class="form-control">
            <label class="form-label">反馈类型 <span class="required">*</span></label>
            <div class="feedback-type-grid">
              <button
                v-for="typeOption in typeOptions"
                :key="typeOption.value"
                type="button"
                class="feedback-type-btn"
                :class="{ 'feedback-type-btn--active': form.type === typeOption.value }"
                @click="form.type = typeOption.value"
              >
                <mdui-icon :name="typeOption.icon" style="font-size:18px"></mdui-icon>
                <span>{{ typeOption.label }}</span>
              </button>
            </div>
          </div>

          <div class="form-control">
            <label class="form-label">详细说明 <span class="required">*</span></label>
            <textarea
              v-model="form.content"
              class="site-feedback-textarea"
              placeholder="请描述你的问题或建议..."
              rows="6"
              maxlength="2000"
            ></textarea>
            <div class="textarea-footer">
              <span class="char-hint" :class="{ 'char-hint--ok': form.content.trim().length >= minLen, 'char-hint--err': form.content.trim().length > 0 && form.content.trim().length < minLen }">
                {{ form.content.trim().length >= minLen ? '✓' : form.content.trim().length > 0 ? `还需 ${minLen - form.content.trim().length} 字` : '' }}
              </span>
              <span class="char-count">{{ form.content.length }}/2000</span>
            </div>
          </div>

          <div class="form-control">
            <label class="form-label">附加图片（可选）</label>
            <div class="insert-image-row">
              <mdui-button variant="outlined" @click="showInsertImageDialog = true">
                <mdui-icon slot="icon" name="image--rounded"></mdui-icon>
                插入本站图片
              </mdui-button>
              <span class="insert-hint">可插入本站图片作为示例</span>
            </div>
            <div v-if="insertedImages.length > 0" class="inserted-images-list">
              <div v-for="(img, idx) in insertedImages" :key="img.slug" class="inserted-image-item">
                <img :src="img.image_url" :alt="img.title" />
                <span class="inserted-image-title">{{ img.title }}</span>
                <button type="button" class="inserted-image-remove" @click="removeImage(idx)">
                  <mdui-icon name="close--rounded"></mdui-icon>
                </button>
              </div>
            </div>
          </div>

          <div class="form-control" v-if="userEmail">
            <label class="form-label">联系邮箱</label>
            <div class="email-display">
              <mdui-icon name="mail--rounded"></mdui-icon>
              <span>{{ userEmail }}</span>
              <span class="email-note">（使用登录账号邮箱）</span>
            </div>
          </div>
        </div>

        <p v-if="errorMsg" class="site-feedback-error"><mdui-icon name="error--rounded"></mdui-icon>{{ errorMsg }}</p>
        <p v-if="successMsg" class="site-feedback-success"><mdui-icon name="check_circle--rounded"></mdui-icon>{{ successMsg }}</p>
      </template>
    </div>

    <mdui-button slot="action" variant="text" @click="$emit('update:visible', false)" :disabled="submitting">取消</mdui-button>
    <mdui-button
      slot="action"
      variant="filled"
      :loading="submitting"
      :disabled="!canSubmit"
      @click="handleSubmit"
    >提交反馈</mdui-button>

    <mdui-dialog :open="showInsertImageDialog" @closed="showInsertImageDialog = false">
      <div class="dialog-content">
        <h3>插入本站图片</h3>
        <p class="muted" style="margin-bottom: 12px">粘贴从右键菜单复制的图片地址</p>
        <div class="form-control">
          <input
            v-model="insertImageUrl"
            type="text"
            class="insert-input"
            placeholder="输入图片链接..."
          />
        </div>
        <div v-if="insertPreviewImage" class="insert-preview">
          <img :src="insertPreviewImage.image_url" :alt="insertPreviewImage.title" />
          <span>{{ insertPreviewImage.title }}</span>
        </div>
        <div v-else-if="insertError" class="insert-error">{{ insertError }}</div>
      </div>
      <mdui-button slot="action" @click="showInsertImageDialog = false">取消</mdui-button>
      <mdui-button slot="action" variant="filled" :disabled="!insertPreviewImage" @click="confirmInsertImage">确认插入</mdui-button>
    </mdui-dialog>
  </mdui-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { safeInsertAuditLog } from '@/lib/audit'
import { useGalleryStore } from '@/stores/gallery'

const props = defineProps({
  visible: Boolean,
})

const emit = defineEmits(['update:visible', 'submitted'])

const galleryStore = useGalleryStore()
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const userEmail = ref('')
const minLen = ref(10)

const showInsertImageDialog = ref(false)
const insertImageUrl = ref('')
const insertPreviewImage = ref(null)
const insertError = ref('')
const insertedImages = ref([])

const typeOptions = [
  { value: 'bug', label: '问题反馈', icon: 'bug_report--rounded' },
  { value: 'feature', label: '功能建议', icon: 'lightbulb--rounded' },
  { value: 'improvement', label: '体验优化', icon: 'trending_up--rounded' },
  { value: 'other', label: '其他', icon: 'chat_bubble--rounded' },
]

const form = reactive({
  type: '',
  content: '',
})

const canSubmit = computed(() => {
  return form.type
    && form.content.trim().length >= minLen.value
    && !submitting.value
    && !successMsg.value
})

watch(() => props.visible, (val) => {
  if (val) {
    form.type = ''
    form.content = ''
    errorMsg.value = ''
    successMsg.value = ''
    insertedImages.value = []
    loadUserEmail()
  }
})

watch(insertImageUrl, async (url) => {
  insertPreviewImage.value = null
  insertError.value = ''
  if (!url) return
  const slugMatch = url.match(/\/image\/([^\/\?]+)/)
  if (!slugMatch) {
    insertError.value = '请输入有效的图片地址'
    return
  }
  const slug = slugMatch[1]
  try {
    const found = await galleryStore.fetchImageBySlug(slug)
    if (found) {
      if (insertedImages.value.some(img => img.slug === slug)) {
        insertError.value = '该图片已添加'
        return
      }
      insertPreviewImage.value = found
    } else {
      insertError.value = '没有找到这张图片'
    }
  } catch {
    insertError.value = '查询图片失败'
  }
})

async function loadUserEmail() {
  try {
    const supabase = requireSupabase()
    const { data } = await supabase.auth.getUser()
    userEmail.value = data.user?.email || ''
  } catch {
    userEmail.value = ''
  }
}

function confirmInsertImage() {
  if (!insertPreviewImage.value) return
  insertedImages.value.push(insertPreviewImage.value)
  showInsertImageDialog.value = false
  insertImageUrl.value = ''
  insertPreviewImage.value = null
}

function removeImage(idx) {
  insertedImages.value.splice(idx, 1)
}

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  errorMsg.value = ''

  try {
    const supabase = requireSupabase()
    const userResponse = await supabase.auth.getUser()
    const userId = userResponse.data.user?.id
    
    if (!userId) throw new Error('请先登录后再提交反馈')

    let finalContent = form.content.trim()
    if (insertedImages.value.length > 0) {
      const imageRefs = insertedImages.value.map(img => `[img:${img.slug}]`).join(' ')
      finalContent = `${finalContent}\n\n附加图片：${imageRefs}`
    }

    const { error } = await supabase.from('site_feedbacks').insert({
      user_id: userId,
      feedback_type: form.type,
      content: finalContent,
      contact_email: userEmail.value || null,
      status: 'PENDING',
    })

    if (error) throw error

    await safeInsertAuditLog({
      action: 'site_feedback.created',
      entityType: 'site_feedback',
      entityId: null,
      level: 'info',
      details: {
        feedback_type: form.type,
        content_length: finalContent.length,
        has_images: insertedImages.value.length > 0,
      },
    })

    const feedbackUrl = `${window.location.origin}/admin/site-feedback`
    await supabase.rpc('notify_admins_site_feedback', {
      p_feedback_type: form.type,
      p_feedback_url: feedbackUrl,
    })

    successMsg.value = '反馈已提交，感谢你的支持！我们会认真对待每一条反馈。'
    
    setTimeout(() => {
      emit('submitted')
      emit('update:visible', false)
    }, 1500)

  } catch (error) {
    errorMsg.value = error?.message || '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.site-feedback-dialog__header { margin-bottom: 16px; }
.site-feedback-form { display: flex; flex-direction: column; gap: 14px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
.required { color: #dc2626; }

.feedback-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.feedback-type-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 10px;
  background: rgba(255,255,255,0.8);
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.feedback-type-btn:hover { border-color: rgba(103,80,164,0.4); background: rgba(103,80,164,0.04); }
.feedback-type-btn--active { border-color: rgba(103,80,164,0.6); background: rgba(103,80,164,0.08); color: #4c3a7c; font-weight: 600; }

.site-feedback-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  outline: none;
  transition: border-color 0.15s;
}
.site-feedback-textarea:focus { border-color: rgba(103,80,164,0.5); }

.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.char-hint { font-size: 12px; font-weight: 600; }
.char-hint--ok { color: #22c55e; }
.char-hint--err { color: #f59e0b; }
.char-count { font-size: 12px; color: #94a3b8; }

.insert-image-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.insert-hint { font-size: 12px; color: #94a3b8; }

.inserted-images-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.inserted-image-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(15,23,42,0.04);
  border-radius: 8px;
  font-size: 12px;
}

.inserted-image-item img {
  width: 32px;
  height: 24px;
  object-fit: cover;
  border-radius: 4px;
}

.inserted-image-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #475569;
}

.inserted-image-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 50%;
  padding: 0;
}
.inserted-image-remove:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

.email-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(15,23,42,0.03);
  border-radius: 8px;
  font-size: 13px;
  color: #475569;
}
.email-note { color: #94a3b8; font-size: 12px; margin-left: auto; }

.site-feedback-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: #64748b; }
.site-feedback-error { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(220,38,38,0.06); border-radius: 10px; color: #dc2626; font-size: 13px; }
.site-feedback-success { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(22,163,74,0.06); border-radius: 10px; color: #166534; font-size: 13px; }

.insert-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  outline: none;
}
.insert-input:focus { border-color: rgba(103,80,164,0.5); }

.insert-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(22,163,74,0.06);
  border-radius: 8px;
}
.insert-preview img {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}
.insert-preview span {
  font-size: 13px;
  color: #166534;
  font-weight: 500;
}

.insert-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(239,68,68,0.06);
  border-radius: 6px;
  font-size: 13px;
  color: #dc2626;
}
</style>
