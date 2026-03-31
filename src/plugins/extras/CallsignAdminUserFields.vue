<template>
  <div class="plugin-admin-field-card">
    <div class="plugin-admin-field-card__header">
      <span>无线电信息</span>
      <span class="muted">插件字段</span>
    </div>
    <div class="plugin-admin-field-grid">
      <div class="plugin-admin-field-item">
        <span>呼号</span>
        <strong>{{ row?.callsign || profile?.callsign || '未认证' }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>网格</span>
        <strong>{{ row?.grid_locator || profile?.grid_locator || '未填写' }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>UID</span>
        <strong>{{ formatUid(row?.uid || profile?.uid) }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>认证数</span>
        <strong>{{ certifications.length }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  row: { type: Object, default: null },
  profile: { type: Object, default: null },
})

const certifications = computed(() => {
  const raw = props.row?.certifications || props.profile?.certifications
  return Array.isArray(raw) ? raw : []
})

function formatUid(uid) {
  if (!uid) return '未生成'
  return String(uid).startsWith('H') ? uid : `H${uid}`
}
</script>

<style scoped>
.plugin-admin-field-card {
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(103, 80, 164, 0.06);
  border: 1px solid rgba(103, 80, 164, 0.08);
}
.plugin-admin-field-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
}
.plugin-admin-field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.plugin-admin-field-item {
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plugin-admin-field-item span {
  font-size: 12px;
  color: #6b7280;
}
.plugin-admin-field-item strong {
  font-size: 13px;
  word-break: break-word;
}
</style>
