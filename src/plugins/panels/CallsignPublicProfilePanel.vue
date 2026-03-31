<template>
  <mdui-card class="section-card plugin-profile-panel plugin-profile-panel--public">
    <div class="section-card__header">
      <div>
        <h2>无线电档案</h2>
        <p class="muted plugin-profile-panel__lead">
          <span v-if="profile?.callsign">{{ profile.callsign }}</span>
          <span v-if="profile?.callsign && profile?.grid_locator"> · </span>
          <span v-if="profile?.grid_locator">{{ profile.grid_locator }}</span>
          <span v-if="!profile?.callsign && !profile?.grid_locator">暂无更多公开的无线电身份信息</span>
        </p>
      </div>
    </div>

    <div class="plugin-profile-panel__metrics">
      <div class="plugin-profile-panel__metric">
        <span>认证数</span>
        <strong>{{ certifications.length }}</strong>
      </div>
      <div class="plugin-profile-panel__metric">
        <span>呼号状态</span>
        <strong>{{ profile?.callsign ? '已公开' : '未公开' }}</strong>
      </div>
    </div>

    <div v-if="certifications.length" class="callsign-public-tags">
      <span v-for="cert in certifications" :key="cert.label" class="identity-pill identity-pill--cert">{{ cert.label || '认证' }}</span>
    </div>
    <p v-else class="muted" style="margin-top: 12px">该用户暂未公开更多认证标签。</p>
  </mdui-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  profile: { type: Object, default: null },
})

const certifications = computed(() => {
  const raw = props.profile?.certifications
  if (!Array.isArray(raw)) return []
  return raw.map((item) => (typeof item === 'string' ? { label: item } : item))
})
</script>

<style scoped>
.plugin-profile-panel { height: 100%; }
.plugin-profile-panel__lead {
  margin: 6px 0 0;
  font-size: 13px;
}
.plugin-profile-panel__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.plugin-profile-panel__metric {
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(103, 80, 164, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plugin-profile-panel__metric span {
  font-size: 12px;
  color: #6b7280;
}
.callsign-public-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
@media (max-width: 640px) {
  .plugin-profile-panel__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
