<template>
  <div v-if="groups.length" class="template-gallery">
    <div class="template-gallery__header">
      <div class="template-gallery__label">通知模板</div>
      <div class="template-gallery__meta">{{ templates.length }} 个可用模板</div>
    </div>
    <div v-for="group in groups" :key="group.id" class="template-gallery__group">
      <div class="template-gallery__group-name">{{ group.label }}</div>
      <div class="template-gallery__grid">
        <button
          v-for="template in group.items"
          :key="template.id"
          type="button"
          class="template-card"
          :class="[`template-card--${template.tone || 'secondary'}`]"
          @click="$emit('apply', template)"
        >
          <div class="template-card__topline">
            <span class="template-card__icon-wrap">
              <mdui-icon :name="template.icon || 'campaign--rounded'"></mdui-icon>
            </span>
            <span class="template-card__target">{{ resolveTargetLabel(template.target) }}</span>
          </div>
          <strong class="template-card__title">{{ template.title }}</strong>
          <span v-if="template.description" class="template-card__description">{{ template.description }}</span>
          <div v-if="template.tags?.length" class="template-card__tags">
            <span v-for="tag in template.tags" :key="tag" class="template-card__tag">{{ tag }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  templates: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['apply'])

const groupLabelMap = {
  general: '通用模板',
  broadcast: '群发模板',
  role: '角色模板',
  direct: '定向模板',
}

const groups = computed(() => {
  const bucket = new Map()
  for (const template of props.templates || []) {
    const category = template.category || 'general'
    if (!bucket.has(category)) bucket.set(category, [])
    bucket.get(category).push(template)
  }
  return Array.from(bucket.entries()).map(([id, items]) => ({
    id,
    label: groupLabelMap[id] || '其他模板',
    items: items.slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
  }))
})

function resolveTargetLabel(target) {
  if (target === 'all') return '发给所有人'
  if (target === 'user') return '指定用户'
  if (target === 'USER') return '普通用户'
  if (target === 'REVIEWER') return '审核员'
  return `目标：${target}`
}
</script>

<style scoped>
.template-gallery {
  display: grid;
  gap: 16px;
  padding: 16px;
  border-radius: 24px;
  background: rgba(103, 80, 164, 0.04);
  border: 1px solid rgba(103, 80, 164, 0.08);
}

.template-gallery__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.template-gallery__label,
.template-gallery__group-name {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6f6785;
}

.template-gallery__meta {
  font-size: 12px;
  color: #7a8594;
}

.template-gallery__group {
  display: grid;
  gap: 12px;
}

.template-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.template-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.template-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.template-card--primary { border-color: rgba(103, 80, 164, 0.22); }
.template-card--secondary { border-color: rgba(15, 118, 110, 0.18); }
.template-card--neutral { border-color: rgba(100, 116, 139, 0.18); }

.template-card__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.template-card__icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(103, 80, 164, 0.12);
  color: #6750a4;
}

.template-card__target {
  font-size: 12px;
  color: #6b7280;
}

.template-card__title {
  font-size: 15px;
  color: #18222c;
}

.template-card__description {
  font-size: 13px;
  color: #55616e;
  line-height: 1.5;
}

.template-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-card__tag {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(103, 80, 164, 0.08);
  color: #6750a4;
  font-size: 12px;
}
</style>
