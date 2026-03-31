<template>
  <div class="plugin-admin-field-card">
    <div class="plugin-admin-field-card__header">
      <span>申请补充信息</span>
      <span class="muted">插件字段</span>
    </div>
    <div class="plugin-admin-field-grid">
      <div class="plugin-admin-field-item">
        <span>申请人 UID</span>
        <strong>{{ formatUid(profile?.uid || row?.user_uid) }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>公开网格</span>
        <strong>{{ profile?.grid_locator || '未填写' }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>当前呼号</span>
        <strong>{{ profile?.callsign || '未认证' }}</strong>
      </div>
      <div class="plugin-admin-field-item">
        <span>证明文件</span>
        <strong>{{ row?.file_name || '无' }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  row: { type: Object, default: null },
  profile: { type: Object, default: null },
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
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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
