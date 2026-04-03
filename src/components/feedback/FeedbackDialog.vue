<template>
  <mdui-dialog :open="visible" @closed="$emit('update:visible', false)" style="--dialog-width: 520px">
    <div class="feedback-dialog">
      <div class="feedback-dialog__header">
        <div class="eyebrow">图片反馈</div>
        <h3>举报 / 反馈图片问题</h3>
        <p class="muted" v-if="imageTitle">针对《{{ imageTitle }}》提交反馈</p>
      </div>

      <div v-if="submitting" class="feedback-loading">
        <mdui-circular-progress></mdui-circular-progress>
        <span>正在提交…</span>
      </div>

      <template v-else>
        <div class="feedback-form">
          <div class="form-control">
            <label class="form-label">反馈类型</label>
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
              class="feedback-textarea"
              placeholder="请输入反馈内容..."
              rows="5"
              maxlength="1000"
            ></textarea>
            <div class="textarea-footer">
              <span class="char-hint" :class="{ 'char-hint--ok': form.content.trim().length >= minLen, 'char-hint--err': form.content.trim().length > 0 && form.content.trim().length < minLen }">
                {{ form.content.trim().length >= minLen ? '✓' : form.content.trim().length > 0 ? `还需 ${minLen - form.content.trim().length} 字` : '' }}
              </span>
              <span class="char-count">{{ form.content.length }}/1000</span>
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

        <p v-if="errorMsg" class="feedback-error"><mdui-icon name="error--rounded"></mdui-icon>{{ errorMsg }}</p>
        <p v-if="successMsg" class="feedback-success"><mdui-icon name="check_circle--rounded"></mdui-icon>{{ successMsg }}</p>
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
  </mdui-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { safeInsertAuditLog } from '@/lib/audit'

const props = defineProps({
  visible: Boolean,
  imageId: { type: String, required: true },
  imageTitle: { type: String, default: '' },
})

const emit = defineEmits(['update:visible', 'submitted'])

const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const userEmail = ref('')
const minLen = ref(10)

const typeOptions = [
  { value: 'violation', label: '违规内容', icon: 'block--rounded' },
  { value: 'copyright', label: '版权问题', icon: 'copyright--rounded' },
  { value: 'quality', label: '质量问题', icon: 'warning--rounded' },
  { value: 'other', label: '其他', icon: 'chat_bubble--rounded' },
]

const form = reactive({
  type: '',
  content: '',
})

const canSubmit = computed(() => {
  return props.imageId
    && form.type
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
    loadUserEmail()
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

async function handleSubmit() {
  if (!canSubmit.value) return
  
  if (!props.imageId || props.imageId === '') {
    errorMsg.value = '缺少图片标识，请刷新页面后重试。'
    return
  }

  submitting.value = true
  errorMsg.value = ''

  try {
    const supabase = requireSupabase()
    const userResponse = await supabase.auth.getUser()
    const userId = userResponse.data.user?.id
    
    if (!userId) throw new Error('请先登录后再提交反馈')

    const { error } = await supabase.from('image_feedbacks').insert({
      image_id: props.imageId,
      reporter_id: userId,
      feedback_type: form.type,
      content: form.content.trim(),
      contact_email: userEmail.value || null,
      status: 'PENDING',
    })

    if (error) throw error

    await safeInsertAuditLog({
      action: 'feedback.created',
      entityType: 'feedback',
      entityId: props.imageId,
      level: 'info',
      details: {
        feedback_type: form.type,
        image_id: props.imageId,
        image_title: props.imageTitle,
      },
    })

    const feedbackUrl = `${window.location.origin}/admin/feedback`
    await supabase.rpc('notify_admins_feedback', {
      p_image_title: props.imageTitle || null,
      p_feedback_url: feedbackUrl,
    })

    successMsg.value = '反馈已提交，感谢你的反馈！管理员会尽快处理。'
    
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
.feedback-dialog__header { margin-bottom: 16px; }
.feedback-form { display: flex; flex-direction: column; gap: 14px; }
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

.feedback-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  resize: vertical;
  min-height: 90px;
  outline: none;
  transition: border-color 0.15s;
}
.feedback-textarea:focus { border-color: rgba(103,80,164,0.5); }

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

.feedback-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: #64748b; }
.feedback-error { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(220,38,38,0.06); border-radius: 10px; color: #dc2626; font-size: 13px; }
.feedback-success { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(22,163,74,0.06); border-radius: 10px; color: #166534; font-size: 13px; }
</style>
