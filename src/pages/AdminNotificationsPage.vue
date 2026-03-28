<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">通知管理</div>
          <h1>发送通知</h1>
          <p class="muted">向指定用户或按用户组发送通知。</p>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 20px">
        <div class="form-control">
          <AppSelect
            id="notification-type"
            v-model="notificationType"
            label="通知类型"
            :options="typeOptions"
          ></AppSelect>
        </div>

        <div v-if="notificationType === 'user'" class="form-control">
          <AppTextField
            v-model="searchQuery"
            label="搜索用户"
            placeholder="输入邮箱、昵称或呼号搜索"
            trim
            @input="searchUsers"
          >
            <mdui-icon slot="icon" name="search--rounded"></mdui-icon>
          </AppTextField>
        </div>

        <div v-if="notificationType === 'user' && searchResults.length" class="user-search-results">
          <div 
            v-for="user in searchResults" 
            :key="user.id" 
            class="user-search-item"
            @click="addUserToSelection(user)"
          >
            <div class="user-search-item__avatar">
              <img v-if="user.avatar_url" :src="user.avatar_url" alt="avatar" />
              <span v-else>{{ (user.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="user-search-item__info">
              <div class="user-search-item__name">{{ user.nickname }}</div>
              <div class="user-search-item__meta">
                <span v-if="user.callsign">{{ user.callsign }}</span>
                <span v-if="user.email">{{ user.email }}</span>
                <span>H{{ String(user.uid).padStart(3, '0') }}</span>
              </div>
            </div>
            <mdui-icon name="add_circle--rounded" style="color: #6750a4; font-size: 24px"></mdui-icon>
          </div>
        </div>

        <div v-if="notificationType === 'user' && selectedUsers.length" class="selected-users-section">
          <div class="selected-users-header">
            <strong>已选择 {{ selectedUsers.length }} 位用户</strong>
          </div>
          <div class="selected-users-list">
            <div 
              v-for="user in selectedUsers" 
              :key="user.id" 
              class="selected-user-chip"
            >
              <div class="selected-user-chip__avatar">
                <img v-if="user.avatar_url" :src="user.avatar_url" alt="avatar" />
                <span v-else>{{ (user.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
              </div>
              <span class="selected-user-chip__name">{{ user.nickname }}</span>
              <button type="button" class="selected-user-chip__remove" @click="removeUserFromSelection(user.id)">
                <mdui-icon name="close--rounded" style="font-size: 16px"></mdui-icon>
              </button>
            </div>
          </div>
        </div>

        <div v-if="notificationType === 'all'" class="broadcast-info">
          <mdui-icon name="group--rounded" style="font-size: 20px; color: #6750a4"></mdui-icon>
          <span>通知将发送给所有用户</span>
        </div>

        <div v-if="notificationType === 'REVIEWER'" class="broadcast-info">
          <mdui-icon name="admin_panel_settings--rounded" style="font-size: 20px; color: #6750a4"></mdui-icon>
          <span>通知将发送给所有审核员</span>
        </div>

        <div v-if="notificationType === 'USER'" class="broadcast-info">
          <mdui-icon name="person--rounded" style="font-size: 20px; color: #6750a4"></mdui-icon>
          <span>通知将发送给所有普通用户</span>
        </div>

        <div class="form-control" style="margin-top: 16px">
          <AppTextField
            v-model="notificationTitle"
            label="通知标题"
            placeholder="请输入通知标题"
            :maxlength="100"
            counter
            trim
          ></AppTextField>
        </div>

        <div class="form-control" style="margin-top: 12px">
          <AppTextField
            v-model="notificationContent"
            label="通知内容"
            placeholder="请输入通知内容"
            :maxlength="1000"
            :rows="4"
            autosize
            counter
            trim
          ></AppTextField>
        </div>

        <div class="action-row" style="margin-top: 20px">
          <mdui-button 
            variant="filled" 
            :loading="sending" 
            :disabled="!canSend"
            @click="sendNotification"
          >
            {{ notificationType === 'user' ? `发送给 ${selectedUsers.length} 位用户` : '批量发送' }}
          </mdui-button>
          <mdui-button variant="text" @click="resetForm">重置</mdui-button>
        </div>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppTextField from '@/components/form/AppTextField.vue'
import AppSelect from '@/components/form/AppSelect.vue'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { safeInsertAuditLog } from '@/lib/audit'

const auth = useAuthStore()

const typeOptions = [
  { label: '指定用户', value: 'user' },
  { label: '所有人', value: 'all' },
  { label: '审核员', value: 'REVIEWER' },
  { label: '普通用户', value: 'USER' },
]

const notificationType = ref('user')
const searchQuery = ref('')
const searchResults = ref([])
const selectedUsers = ref([])
const notificationTitle = ref('')
const notificationContent = ref('')
const sending = ref(false)

const canSend = computed(() => {
  if (!notificationTitle.value.trim() || !notificationContent.value.trim()) return false
  if (notificationType.value === 'user' && selectedUsers.value.length === 0) return false
  return true
})

async function searchUsers() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, callsign, email, uid, avatar_url')
      .or(`nickname.ilike.%${query}%,callsign.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10)

    if (error) throw error
    
    const selectedIds = selectedUsers.value.map(u => u.id)
    searchResults.value = (data || []).filter(u => !selectedIds.includes(u.id))
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function addUserToSelection(user) {
  const exists = selectedUsers.value.find(u => u.id === user.id)
  if (!exists) {
    selectedUsers.value.push(user)
  }
  searchQuery.value = ''
  searchResults.value = []
}

function removeUserFromSelection(userId) {
  selectedUsers.value = selectedUsers.value.filter(u => u.id !== userId)
}

async function sendNotification() {
  if (!canSend.value) return

  sending.value = true
  try {
    const supabase = requireSupabase()
    
    let users = []
    
    if (notificationType.value === 'user') {
      users = selectedUsers.value
    } else if (notificationType.value === 'all') {
      const { data, error: usersError } = await supabase
        .from('profiles')
        .select('id')
      if (usersError) throw usersError
      users = data || []
    } else if (notificationType.value === 'REVIEWER' || notificationType.value === 'USER') {
      const { data, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', notificationType.value)
      if (usersError) throw usersError
      users = data || []
    }
    
    if (users.length > 0) {
      const notifications = users.map(user => ({
        user_id: user.id,
        title: notificationTitle.value.trim(),
        content: notificationContent.value.trim(),
        type: notificationType.value === 'user' ? 'SYSTEM' : 'ANNOUNCEMENT',
        actor_id: auth.user.id,
        actor_display_name: auth.displayName,
      }))
      
      const { error } = await supabase.from('notifications').insert(notifications)
      if (error) throw error
      
      await safeInsertAuditLog({
        action: notificationType.value === 'user' ? 'notification.sent' : 'notification.broadcast',
        entityType: notificationType.value === 'user' ? 'user' : 'system',
        entityId: notificationType.value === 'user' ? selectedUsers.value.map(u => u.id).join(',') : notificationType.value,
        details: {
          notification_title: notificationTitle.value.trim(),
          recipient_count: users.length,
          target_group: notificationType.value,
          target_users: notificationType.value === 'user' ? selectedUsers.value.map(u => ({ id: u.id, name: u.nickname })) : undefined,
        },
      })
      
      showToast(`通知已发送给 ${users.length} 位用户`)
    }
    
    resetForm()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    sending.value = false
  }
}

function resetForm() {
  searchQuery.value = ''
  searchResults.value = []
  selectedUsers.value = []
  notificationTitle.value = ''
  notificationContent.value = ''
}
</script>

<style scoped>
.user-search-results {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(24, 34, 44, 0.12);
  border-radius: 12px;
  margin-top: 8px;
}

.user-search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-search-item:hover {
  background: rgba(103, 80, 164, 0.06);
}

.user-search-item__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #8a9aaa;
  flex-shrink: 0;
}

.user-search-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-search-item__info {
  flex: 1;
  min-width: 0;
}

.user-search-item__name {
  font-size: 14px;
  font-weight: 600;
}

.user-search-item__meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #8a9aaa;
  margin-top: 2px;
}

.selected-users-section {
  margin-top: 12px;
  padding: 12px;
  background: rgba(103, 80, 164, 0.06);
  border-radius: 12px;
}

.selected-users-header {
  font-size: 13px;
  color: #6750a4;
  margin-bottom: 10px;
}

.selected-users-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 4px;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(103, 80, 164, 0.2);
}

.selected-user-chip__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #8a9aaa;
}

.selected-user-chip__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selected-user-chip__name {
  font-size: 13px;
  font-weight: 500;
}

.selected-user-chip__remove {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #8a9aaa;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.selected-user-chip__remove:hover {
  color: #dc2626;
}

.broadcast-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 12px;
  margin-top: 12px;
  font-size: 14px;
  color: #6750a4;
}
</style>
