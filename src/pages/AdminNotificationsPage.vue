<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">系统通知</div>
          <h1>向全站或指定角色推送消息</h1>
          <p class="muted">消息会进入用户的站内通知流，支持按角色定向推送。</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-control">
          <AppSelect v-model="form.targetRole" label="目标角色" :options="roleOptions"></AppSelect>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField v-model="form.title" label="标题" :maxlength="120" counter trim></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            v-model="form.content"
            label="内容"
            :maxlength="2000"
            :rows="5"
            autosize
            counter
            trim
          ></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            v-model="form.link"
            label="跳转链接（可选）"
            placeholder="例如：/submit 或 https://example.com"
            clearable
            trim
          ></AppTextField>
        </div>
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" :loading="sending" @click="send">发送通知</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import AppSelect from '@/components/AppSelect.vue'
import AppTextField from '@/components/AppTextField.vue'

const form = reactive({
  targetRole: 'ALL',
  title: '',
  content: '',
  link: '',
})
const sending = ref(false)
const roleOptions = [
  { label: '全体用户', value: 'ALL' },
  { label: '普通用户', value: 'USER' },
  { label: '审核员', value: 'REVIEWER' },
  { label: '超级管理员', value: 'SUPER_ADMIN' },
]

async function send() {
  if (!form.title || !form.content) {
    showToast('标题和内容不能为空')
    return
  }
  sending.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('broadcast_system_notification', {
      p_title: form.title,
      p_content: form.content,
      p_link: form.link || null,
      p_target_roles: form.targetRole === 'ALL' ? null : [form.targetRole],
      p_type: 'ANNOUNCEMENT',
    })
    if (error) throw error
    showToast(`已发送 ${data || 0} 条通知`)
    form.title = ''
    form.content = ''
    form.link = ''
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    sending.value = false
  }
}
</script>
