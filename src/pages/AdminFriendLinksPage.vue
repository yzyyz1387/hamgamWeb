<template>
  <section class="page">
    <div class="admin-grid admin-grid--dashboard-stack">
      <mdui-card class="section-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">友情链接</div>
            <h1>{{ form.id ? '编辑链接' : '添加链接' }}</h1>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-control">
            <AppTextField v-model="form.title" label="名称" :maxlength="60" counter trim></AppTextField>
          </div>
          <div class="form-control">
            <AppTextField v-model="form.sort_order" label="排序（数字越小越靠前）" type="number" :min="0" number></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <AppTextField v-model="form.url" label="链接地址" placeholder="https://example.com" clearable trim></AppTextField>
          </div>
          <div class="form-control" style="grid-column: 1 / -1">
            <AppTextField v-model="form.description" label="简介（可选）" :maxlength="120" counter trim></AppTextField>
          </div>
        </div>
        <div class="md-form-check-row">
          <AppCheckbox v-model="form.is_active" label="启用"></AppCheckbox>
        </div>
        <div class="action-row" style="margin-top: 16px">
          <mdui-button variant="filled" :loading="saving" @click="save">保存</mdui-button>
          <mdui-button variant="text" @click="resetForm">清空</mdui-button>
        </div>
      </mdui-card>

      <mdui-card class="section-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">链接列表</div>
            <h2>{{ links.length }} 条</h2>
          </div>
        </div>
        <div v-if="loading" class="empty-state">
          <mdui-circular-progress></mdui-circular-progress>
        </div>
        <div v-else-if="links.length" class="list-panel">
          <article v-for="item in links" :key="item.id" class="list-item-card">
            <div class="list-item-card__head">
              <div>
                <strong>{{ item.title }}</strong>
                <div class="muted" style="font-size: 12px">{{ item.url }}</div>
              </div>
              <div class="chip-row">
                <span class="status-pill" :class="item.is_active ? 'status-pill--published' : 'status-pill--inactive'">
                  {{ item.is_active ? '启用' : '停用' }}
                </span>
                <mdui-button variant="text" @click="editLink(item)">编辑</mdui-button>
                <mdui-button variant="text" @click="removeLink(item)">删除</mdui-button>
              </div>
            </div>
            <p v-if="item.description" class="muted" style="font-size: 13px">{{ item.description }}</p>
          </article>
        </div>
        <div v-else class="empty-state">还没有友情链接。</div>
      </mdui-card>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import AppCheckbox from '@/components/AppCheckbox.vue'
import AppTextField from '@/components/AppTextField.vue'

const links = ref([])
const loading = ref(false)
const saving = ref(false)

const blankForm = () => ({ id: '', title: '', url: '', description: '', sort_order: 100, is_active: true })
const form = reactive(blankForm())

onMounted(loadLinks)

async function loadLinks() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('friend_links')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    links.value = data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function editLink(item) {
  Object.assign(form, {
    id: item.id,
    title: item.title,
    url: item.url,
    description: item.description || '',
    sort_order: item.sort_order,
    is_active: item.is_active,
  })
}

async function save() {
  if (!form.title || !form.url) {
    showToast('名称和链接不能为空')
    return
  }
  saving.value = true
  try {
    const supabase = requireSupabase()
    const payload = {
      title: form.title,
      url: form.url,
      description: form.description,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('friend_links').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('friend_links').insert(payload))
    }
    if (error) throw error
    showToast('已保存')
    resetForm()
    await loadLinks()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeLink(item) {
  if (!window.confirm(`确认删除「${item.title}」？`)) return
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.from('friend_links').delete().eq('id', item.id)
    if (error) throw error
    showToast('已删除')
    await loadLinks()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function resetForm() {
  Object.assign(form, blankForm())
}
</script>
