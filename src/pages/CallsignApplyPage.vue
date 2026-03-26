<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">呼号认证</div>
          <h1>申请呼号认证</h1>
          <p class="muted">提交执照或相关证明文件，审核通过后呼号将显示在你的个人主页。</p>
        </div>
      </div>

      <div v-if="latestApp" class="callsign-status-card" :class="`callsign-status--${latestApp.status.toLowerCase()}`">
        <div class="callsign-status-head">
          <mdui-icon :name="statusIcon(latestApp.status)" style="font-size: 20px"></mdui-icon>
          <div>
            <strong>{{ statusLabel(latestApp.status) }}</strong>
            <div style="font-size: 13px; margin-top: 2px">
              申请呼号：<strong>{{ latestApp.callsign }}</strong>
              · {{ formatDate(latestApp.created_at, { withTime: true }) }}
            </div>
          </div>
        </div>
        <div v-if="latestApp.reviewer_note" class="muted" style="font-size: 13px; margin-top: 8px">
          审核备注：{{ latestApp.reviewer_note }}
        </div>
      </div>

      <template v-if="!latestApp || latestApp.status !== 'PENDING'">
        <div class="callsign-notice">
          <mdui-icon name="info--rounded" style="font-size: 16px; color: #6750a4; flex-shrink: 0"></mdui-icon>
          <span>请上传业余无线电操作证书或执照扫描件（PDF / 图片），建议对证件号等敏感信息添加水印或打码处理后再上传。文件大小不超过 10MB。</span>
        </div>

        <div class="form-grid" style="margin-top: 16px">
          <div class="form-control">
            <AppTextField
              id="cs-callsign"
              v-model="form.callsign"
              trim
              label="申请呼号"
              :maxlength="20"
              counter
              placeholder="例如：BD8CWG"
            ></AppTextField>
          </div>
          <div class="form-control">
            <AppTextField
              id="cs-note"
              v-model="form.note"
              trim
              label="备注（可选）"
              :maxlength="200"
              counter
              placeholder="补充说明"
            ></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <label>证明文件</label>
            <div
              class="drop-zone"
              :class="{ 'drop-zone--active': isDragging, 'drop-zone--has-file': !!fileRef }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDrop"
              @click="fileInputRef?.click()"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style="display: none"
                @change="onFileChange"
              />
              <template v-if="!fileRef">
                <div class="drop-zone__icon">📄</div>
                <div class="drop-zone__text">拖拽文件到此处，或点击选择</div>
                <div class="drop-zone__hint">支持 JPG、PNG、WebP、PDF，最大 10MB</div>
              </template>
              <template v-else>
                <div class="drop-zone__icon">✓</div>
                <div class="drop-zone__text">{{ fileRef.name }}</div>
                <div class="drop-zone__hint">{{ formatFileSize(fileRef.size) }} · 点击重新选择</div>
              </template>
            </div>
          </div>
        </div>

        <div class="action-row" style="margin-top: 18px">
          <mdui-button variant="filled" :loading="submitting" @click="submit">提交申请</mdui-button>
          <mdui-button variant="text" @click="router.push('/profile')">返回</mdui-button>
        </div>
      </template>

      <div v-else class="action-row" style="margin-top: 16px">
        <mdui-button variant="text" @click="router.push('/profile')">返回个人主页</mdui-button>
      </div>
    </mdui-card>

    <mdui-card v-if="applications.length > 1" class="section-card">
      <div class="eyebrow" style="margin-bottom: 12px">历史申请</div>
      <div class="list-panel">
        <div v-for="app in applications.slice(1)" :key="app.id" class="list-item-card">
          <div class="list-item-card__head">
            <div>
              <strong>{{ app.callsign }}</strong>
              <div class="muted" style="font-size: 12px">{{ formatDate(app.created_at, { withTime: true }) }}</div>
            </div>
            <span class="status-pill" :class="statusPillClass(app.status)">{{ statusLabel(app.status) }}</span>
          </div>
          <div v-if="app.reviewer_note" class="muted" style="font-size: 12px">备注：{{ app.reviewer_note }}</div>
        </div>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ callsign: '', note: '' })
const fileRef = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)
const submitting = ref(false)
const applications = ref([])
const latestApp = ref(null)

onMounted(async () => {
  await auth.init()
  await loadApplications()
  if (auth.profile?.callsign) form.callsign = auth.profile.callsign
})

async function loadApplications() {
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('callsign_applications')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    applications.value = data || []
    latestApp.value = applications.value[0] || null
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function setFile(file) {
  if (!file) return
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowed.includes(file.type)) {
    showToast('仅支持 JPG、PNG、WebP、PDF 格式')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('文件大小请控制在 10MB 以内')
    return
  }
  fileRef.value = file
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
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function submit() {
  if (!form.callsign) {
    showToast('请填写申请呼号')
    return
  }
  if (!fileRef.value) {
    showToast('请上传证明文件')
    return
  }
  submitting.value = true
  try {
    const supabase = requireSupabase()
    const ext = fileRef.value.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${auth.user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('callsign-docs')
      .upload(path, fileRef.value, { upsert: false, contentType: fileRef.value.type })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('callsign_applications').insert({
      user_id: auth.user.id,
      callsign: form.callsign,
      note: form.note,
      file_bucket: 'callsign-docs',
      file_path: path,
      file_name: fileRef.value.name,
    })
    if (insertError) throw insertError

    showToast('申请已提交，等待管理员审核')
    await loadApplications()
    form.note = ''
    fileRef.value = null
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

function statusLabel(status) {
  return { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[status] || status
}

function statusIcon(status) {
  return {
    PENDING: 'hourglass_empty--rounded',
    APPROVED: 'check_circle--rounded',
    REJECTED: 'cancel--rounded',
  }[status] || 'info--rounded'
}

function statusPillClass(status) {
  return {
    PENDING: 'status-pill--pending',
    APPROVED: 'status-pill--published',
    REJECTED: 'status-pill--rejected',
  }[status] || ''
}
</script>
