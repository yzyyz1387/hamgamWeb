<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">用户管理</div>
          <h1>角色、认证、启停状态</h1>
        </div>
        <div style="min-width:240px">
          <AppTextField
            v-model="searchKeyword"
            label="搜索用户"
            placeholder="昵称、邮箱或呼号…"
            icon="search--rounded"
            clearable
            trim
          ></AppTextField>
        </div>
      </div>
    </mdui-card>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在读取用户列表…</div>
    </div>

    <div v-else-if="filteredUsers.length" class="ulist">
      <mdui-card v-for="user in filteredUsers" :key="user.id" class="section-card ucard">

        <!-- 顶部：头像 + 基本信息 + 状态 chip + 保存按钮 -->
        <div class="ucard__head">
          <div class="ucard__identity">
            <div class="ucard__avatar">
              <img v-if="user.avatar_url" :src="user.avatar_url" alt="avatar" />
              <span v-else>{{ (user.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="ucard__info">
              <span class="ucard__name">{{ user.nickname }}</span>
              <span class="ucard__meta">{{ user.email }} · {{ formatDate(user.created_at) }}</span>
            </div>
          </div>
          <div class="ucard__actions">
            <span class="status-pill status-pill--sm" :class="user.is_active ? 'status-pill--published' : 'status-pill--inactive'">
              {{ user.is_active ? '启用' : '停用' }}
            </span>
            <span class="status-pill status-pill--sm" :class="roleClass(user.role)">{{ roleLabel(user.role) }}</span>
            <mdui-button variant="filled" size="small" :loading="savingMap[user.id]" @click="saveUser(user)">保存</mdui-button>
          </div>
        </div>

        <div v-if="getRowActions(user).length" class="ucard__plugin-actions">
          <mdui-button
            v-for="action in getRowActions(user)"
            :key="action.id"
            :variant="action.variant || 'text'"
            :size="action.size || 'small'"
            @click="runRowAction(action, user)"
          >
            {{ action.label }}
          </mdui-button>
        </div>

        <!-- 编辑行：角色 + 状态 + 团队开关 -->
        <div v-if="getListFields(user).length" class="ucard__plugin-fields">
          <component
            :is="field.component"
            v-for="field in getListFields(user)"
            :key="field.id"
            :row="user"
            :profile="user"
            :auth="auth"
            :config="field.config"
            :plugin="field"
            class="ucard__plugin-field-item"
          />
        </div>

        <!-- 编辑行：角色 + 状态 + 团队开关 -->
        <div class="ucard__edit-row">
          <div class="ucard__select">
            <AppSelect v-model="user.role" label="角色" :options="roleOptions"></AppSelect>
          </div>
          <div class="ucard__select">
            <AppSelect v-model="user.activeDraft" label="状态" :options="activeOptions"></AppSelect>
          </div>
          <label class="ucard__toggle">
            <input type="checkbox" v-model="user.show_in_team_page" />
            <span>团队页面</span>
          </label>
        </div>

        <!-- 认证徽标：折叠展开 -->
        <div class="ucard__certs">
          <!-- 已有认证时显示 chip 流 -->
          <div v-if="user.certs_draft.length" class="ucard__cert-chips">
            <span
              v-for="(cert, idx) in user.certs_draft"
              :key="idx"
              class="ucard__cert-chip"
            >
              <mdui-icon :name="certIconName(cert.icon)" style="font-size:12px"></mdui-icon>
              {{ cert.label }}
              <button type="button" class="ucard__cert-del" @click="removeCert(user, idx)">×</button>
            </span>
          </div>

          <!-- 展开编辑区 -->
          <div v-if="user._certOpen" class="ucard__cert-editor">
            <div v-for="(cert, idx) in user.certs_draft" :key="idx" class="ucard__cert-row">
              <AppTextField v-model="cert.label" label="名称" :maxlength="40" trim style="flex:1"></AppTextField>
              <AppSelect v-model="cert.icon" label="图标" :options="certIconOptions" style="width:130px"></AppSelect>
            </div>
          </div>

          <div class="ucard__cert-btns">
            <button type="button" class="cert-add-btn" @click="addCert(user)">+ 添加认证</button>
            <button
              v-if="user.certs_draft.length"
              type="button"
              class="cert-add-btn"
              @click="user._certOpen = !user._certOpen"
            >{{ user._certOpen ? '收起编辑' : '编辑认证' }}</button>
          </div>
        </div>

      </mdui-card>
    </div>

    <div v-else class="empty-state">没有匹配的用户。</div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, copyText } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import AppSelect from '@/components/AppSelect.vue'
import AppTextField from '@/components/AppTextField.vue'
import { getAdminListFields, getAdminTableRowActions, emitPluginEvent, invokePluginAction } from '@/plugins/runtime'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const users = ref([])
const loading = ref(false)
const searchKeyword = ref('')
const savingMap = reactive({})

const roleOptions = [
  { label: '普通用户', value: 'USER' },
  { label: '审核员', value: 'REVIEWER' },
  { label: '超级管理员', value: 'SUPER_ADMIN' },
]
const activeOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
]
const certIconOptions = [
  { label: '已认证', value: 'beenhere', icon: 'beenhere--rounded' },
  { label: '人物', value: 'face_retouching_natural', icon: 'face_retouching_natural--rounded' },
  { label: '蜂巢', value: 'hive', icon: 'hive--rounded' },
  { label: '学术', value: 'school', icon: 'school--rounded' },
  { label: '自然', value: 'yard', icon: 'yard--rounded' },
  { label: '荣誉', value: 'award_star', icon: 'award_star--rounded' },
]

const filteredUsers = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return users.value
  return users.value.filter((item) =>
    [item.nickname, item.email, item.callsign]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(keyword)),
  )
})

onMounted(loadUsers)

function parseCerts(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      typeof item === 'string'
        ? { label: item, icon: 'award_star' }
        : { label: item.label || '', icon: item.icon || 'award_star' },
    )
  }
  return []
}

function certIconName(icon) {
  const map = {
    award_star: 'award_star--rounded', beenhere: 'beenhere--rounded',
    face_retouching_natural: 'face_retouching_natural--rounded', hive: 'hive--rounded',
    school: 'school--rounded', yard: 'yard--rounded',
  }
  return map[icon] || 'beenhere--rounded'
}


function getListFields(user) {
  return getAdminListFields({
    target: 'admin-users',
    auth,
    row: user,
    profile: user,
    route: { path: '/admin/users' },
    router,
  })
}

function getRowActions(user) {
  return getAdminTableRowActions({
    target: 'admin-users',
    auth,
    row: user,
    profile: user,
    route: { path: '/admin/users' },
    router,
  })
}

async function runRowAction(action, user) {
  if (typeof action?.onClick !== 'function') return
  try {
    await invokePluginAction(action, {
      auth,
      row: user,
      profile: user,
      router,
      copyText,
      showToast,
    })
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}
async function loadUsers() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    users.value = (data || []).map((item) => ({
      ...item,
      activeDraft: item.is_active ? 'ACTIVE' : 'INACTIVE',
      certs_draft: parseCerts(item.certifications),
      _certOpen: false,
    }))
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function addCert(user) {
  user.certs_draft.push({ label: '', icon: 'award_star' })
  user._certOpen = true
}

function removeCert(user, idx) {
  user.certs_draft.splice(idx, 1)
}

async function saveUser(user) {
  savingMap[user.id] = true
  try {
    const supabase = requireSupabase()
    const certifications = user.certs_draft
      .filter((item) => item.label.trim())
      .map((item) => ({ label: item.label.trim(), icon: item.icon }))
    const { error } = await supabase.rpc('admin_update_user', {
      p_target_user_id: user.id,
      p_role: user.role,
      p_certifications: certifications,
      p_is_active: user.activeDraft === 'ACTIVE',
      p_show_in_team_page: user.show_in_team_page,
    })
    if (error) throw error
    user.is_active = user.activeDraft === 'ACTIVE'
    user._certOpen = false
    showToast('用户信息已更新')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    savingMap[user.id] = false
  }
}

function roleLabel(role) {
  return { SUPER_ADMIN: '超级管理员', REVIEWER: '审核员', USER: '普通用户' }[role] || role
}
function roleClass(role) {
  return `status-pill--${{ SUPER_ADMIN: 'rejected', REVIEWER: 'reviewer', USER: 'pending' }[role] || 'pending'}`
}
</script>


<style scoped>
.ucard__plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 2px;
}
.ucard__plugin-fields {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.ucard__plugin-field-item {
  min-width: 0;
}

</style>
