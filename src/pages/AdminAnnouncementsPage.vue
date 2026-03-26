<template>
  <section class="page">
    <div class="admin-grid">
      <mdui-card class="section-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">公告编辑器</div>
            <h1>{{ form.id ? '编辑公告' : '新建公告' }}</h1>
            <p class="muted">支持主页条幅公告和弹窗公告，内容会自动过滤不安全的 HTML。</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-control">
            <AppSelect v-model="form.kind" label="类型" :options="kindOptions"></AppSelect>
          </div>
          <div class="form-control">
            <AppTextField v-model="form.priority" number type="number" label="优先级" min="0" max="999"></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <AppTextField v-model="form.title" trim label="标题" maxlength="120" counter></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <AppTextField v-model="form.content" trim label="内容" maxlength="4000" counter rows="6" autosize></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <AppTextField
              v-model="form.link"
              trim
              label="跳转链接（可选）"
              placeholder="支持站内路径或 https 链接"
            ></AppTextField>
          </div>
          <div class="form-control">
            <AppTextField v-model="form.starts_at" type="datetime-local" label="开始时间"></AppTextField>
          </div>
          <div class="form-control">
            <AppTextField v-model="form.ends_at" type="datetime-local" label="结束时间"></AppTextField>
          </div>
        </div>

        <div class="chip-row form-checkbox-row" style="margin-top: 16px">
          <AppCheckbox v-model="form.is_active">启用</AppCheckbox>
          <AppCheckbox v-model="form.dismissible">可关闭</AppCheckbox>
        </div>

        <div class="action-row" style="margin-top: 18px">
          <mdui-button variant="filled" :loading="saving" @click="saveAnnouncement">保存公告</mdui-button>
          <mdui-button variant="text" @click="resetForm">清空表单</mdui-button>
        </div>
      </mdui-card>

      <mdui-card class="section-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">公告列表</div>
            <h2>{{ announcements.length }} 条公告</h2>
          </div>
        </div>

        <div v-if="loading" class="empty-state">
          <mdui-circular-progress></mdui-circular-progress>
          <div>正在加载公告…</div>
        </div>

        <div v-else-if="announcements.length" class="list-panel">
          <article v-for="item in announcements" :key="item.id" class="list-item-card">
            <div class="list-item-card__head">
              <div>
                <strong>{{ item.title }}</strong>
                <div class="muted">{{ item.kind === 'BANNER' ? '条幅公告' : '弹窗公告' }} · {{ formatDate(item.starts_at, { withTime: true }) }}</div>
              </div>
              <div class="chip-row">
                <span class="status-pill" :class="item.is_active ? 'status-pill--published' : 'status-pill--inactive'">
                  {{ item.is_active ? '启用中' : '已停用' }}
                </span>
                <mdui-button variant="text" @click="editAnnouncement(item)">编辑</mdui-button>
                <mdui-button variant="text" @click="removeAnnouncement(item)">删除</mdui-button>
              </div>
            </div>
            <p class="muted">{{ item.content }}</p>
          </article>
        </div>

        <div v-else class="empty-state">还没有公告。</div>
      </mdui-card>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import AppTextField from '@/components/form/AppTextField.vue'
import AppSelect from '@/components/form/AppSelect.vue'
import AppCheckbox from '@/components/form/AppCheckbox.vue'

const loading = ref(false)
const saving = ref(false)
const announcements = ref([])

const kindOptions = [
  { label: '条幅公告', value: 'BANNER' },
  { label: '弹窗公告', value: 'POPUP' },
]

const blankForm = () => ({
  id: '',
  kind: 'BANNER',
  title: '',
  content: '',
  link: '',
  starts_at: toDateTimeLocal(new Date().toISOString()),
  ends_at: '',
  dismissible: true,
  is_active: true,
  priority: 100,
})

const form = reactive(blankForm())

onMounted(loadAnnouncements)

async function loadAnnouncements() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    announcements.value = data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function editAnnouncement(item) {
  Object.assign(form, {
    id: item.id,
    kind: item.kind,
    title: item.title,
    content: item.content,
    link: item.link || '',
    starts_at: toDateTimeLocal(item.starts_at),
    ends_at: toDateTimeLocal(item.ends_at),
    dismissible: item.dismissible,
    is_active: item.is_active,
    priority: item.priority,
  })
}

async function saveAnnouncement() {
  if (!form.title || !form.content) {
    showToast('标题和内容不能为空')
    return
  }
  saving.value = true
  try {
    const supabase = requireSupabase()
    const payload = {
      kind: form.kind,
      title: form.title,
      content: form.content,
      link: form.link || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      dismissible: Boolean(form.dismissible),
      is_active: Boolean(form.is_active),
      priority: Number(form.priority || 0),
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('announcements').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('announcements').insert(payload))
    }
    if (error) throw error
    showToast('公告已保存')
    resetForm()
    await loadAnnouncements()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeAnnouncement(item) {
  if (!window.confirm(`确认删除公告《${item.title}》吗？`)) return
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.from('announcements').delete().eq('id', item.id)
    if (error) throw error
    showToast('公告已删除')
    await loadAnnouncements()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function resetForm() {
  Object.assign(form, blankForm())
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}
</script>
