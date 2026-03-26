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

      <div class="form-grid">
        <div class="form-control">
          <AppTextField
            id="submit-title"
            v-model="form.title"
            trim
            label="标题"
            :maxlength="120"
            counter
            placeholder="例如：CQ WPX 比赛现场"
          ></AppTextField>
        </div>
        <div class="form-control">
          <AppTextField
            id="submit-contributor"
            v-model="form.contributor_name"
            trim
            label="贡献者署名"
            :maxlength="80"
            counter
            placeholder="默认使用你的昵称或已认证呼号"
          ></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="submit-description"
            v-model="form.description"
            trim
            label="描述"
            :maxlength="1000"
            counter
            rows="5"
            autosize
            placeholder="补充说明图片拍摄地点、设备、时间或故事。"
          ></AppTextField>
        </div>

        <div class="form-control" style="grid-column: 1 / -1">
          <label>图片文件</label>
          <div
            class="drop-zone"
            :class="{ 'drop-zone--active': isDragging, 'drop-zone--has-file': !!fileRef }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="triggerFileInput"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style="display: none"
              @change="onFileChange"
            />
            <template v-if="!fileRef">
              <div class="drop-zone__icon">🖼</div>
              <div class="drop-zone__text">拖拽图片到此处，或点击选择文件</div>
              <div class="drop-zone__hint">支持 JPG、PNG、WebP、GIF，最大 20MB</div>
            </template>
            <template v-else>
              <div class="drop-zone__icon">✓</div>
              <div class="drop-zone__text">{{ fileRef.name }}</div>
              <div class="drop-zone__hint">{{ formatFileSize(fileRef.size) }} · 点击重新选择</div>
            </template>
          </div>
        </div>
      </div>

      <div v-if="previewUrl" class="file-preview" style="margin-top: 18px">
        <img :src="previewUrl" alt="preview" />
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" :loading="submitting" @click="submit">提交审核</mdui-button>
        <mdui-button variant="text" @click="router.push('/profile')">返回我的主页</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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

const form = reactive({ title: '', description: '', contributor_name: '' })
const fileRef = ref(null)
const fileInputRef = ref(null)
const previewUrl = ref('')
const submitting = ref(false)
const isDragging = ref(false)

onMounted(async () => {
  await auth.init()
  form.contributor_name = auth.profile?.callsign || auth.profile?.nickname || auth.displayName
})

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function triggerFileInput() {
  fileInputRef.value?.click()
}

function setFile(file) {
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
  fileRef.value = file
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
}

function onFileChange(event) {
  setFile(event.target.files?.[0])
}

function onDrop(event) {
  isDragging.value = false
  setFile(event.dataTransfer?.files?.[0])
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function submit() {
  if (!form.title.trim()) {
    showToast('请填写标题')
    return
  }
  if (form.title.trim().length < 2) {
    showToast('标题至少需要 2 个字符')
    return
  }
  if (!fileRef.value) {
    showToast('请选择图片文件')
    return
  }
  if (submitting.value) return  // 防止重复提交
  submitting.value = true
  try {
    const supabase = requireSupabase()
    const datePart = new Date().toISOString().slice(0, 10)
    const path = `${auth.user.id}/${datePart}/${Date.now()}-${sanitizeFilename(fileRef.value.name)}`

    const { error: uploadError } = await supabase.storage
      .from(siteConfig.submissionBucket)
      .upload(path, fileRef.value, {
        upsert: false,
        contentType: fileRef.value.type || 'image/*',
      })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('submissions').insert({
      title: form.title,
      description: form.description,
      contributor_name: form.contributor_name,
      original_filename: fileRef.value.name,
      storage_bucket: siteConfig.submissionBucket,
      storage_path: path,
      mime_type: fileRef.value.type || null,
      file_size: fileRef.value.size || 0,
      uploader_id: auth.user.id,
      uploader_display_name: auth.displayName,
    })
    if (insertError) throw insertError

    showToast('投稿已提交，等待审核')
    router.push('/profile')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>
