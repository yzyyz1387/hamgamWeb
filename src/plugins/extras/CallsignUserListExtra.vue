<template>
  <div v-if="items.length" class="plugin-inline-row plugin-inline-row--user">
    <span
      v-for="item in items"
      :key="item.key"
      class="plugin-inline-chip plugin-inline-chip--muted"
      :title="item.title || ''"
    >
      <mdui-icon v-if="item.icon" :name="item.icon" style="font-size: 13px"></mdui-icon>
      {{ item.label }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatPublicUid } from '@/lib/uid'

const props = defineProps({
  profile: { type: Object, required: true },
})

const items = computed(() => {
  const list = []
  if (props.profile?.grid_locator) {
    list.push({ key: 'grid', icon: 'fmd_good--rounded', label: props.profile.grid_locator, title: '梅登黑德网格' })
  }
  if (props.profile?.uid) {
    list.push({ key: 'uid', icon: 'badge--rounded', label: formatPublicUid(props.profile.uid), title: '公开用户 ID' })
  }
  return list
})
</script>

<style scoped>
.plugin-inline-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.plugin-inline-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid rgba(24, 34, 44, 0.08);
  background: rgba(255, 255, 255, 0.86);
  color: #4b5563;
}
.plugin-inline-chip--action {
  cursor: pointer;
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
}
.plugin-inline-chip--muted {
  background: rgba(15, 23, 42, 0.05);
}
.plugin-inline-row--image {
  margin-top: 10px;
}
.plugin-inline-row--user {
  margin-top: 8px;
}
</style>
