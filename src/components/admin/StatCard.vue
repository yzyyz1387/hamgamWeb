<template>
  <div class="stat-card-enhanced" :class="{ 'stat-card-enhanced--clickable': clickable }" @click="handleClick">
    <div class="stat-card-enhanced__icon" :class="`stat-card-enhanced__icon--${color}`">
      <mdui-icon :name="icon"></mdui-icon>
    </div>
    <div class="stat-card-enhanced__content">
      <div class="stat-card-enhanced__value">{{ formattedValue }}</div>
      <div class="stat-card-enhanced__label">{{ label }}</div>
      <div v-if="trend !== null" class="stat-card-enhanced__trend" :class="trendClass">
        <mdui-icon :name="trend >= 0 ? 'trending_up--rounded' : 'trending_down--rounded'"></mdui-icon>
        <span>{{ Math.abs(trend) }}%</span>
        <span class="stat-card-enhanced__trend-label">vs 上周</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: [Number, String], default: 0 },
  label: { type: String, default: '' },
  icon: { type: String, default: 'info--rounded' },
  color: { type: String, default: 'primary' },
  trend: { type: Number, default: null },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  if (props.value >= 10000) return `${(props.value / 10000).toFixed(1)}万`
  if (props.value >= 1000) return `${(props.value / 1000).toFixed(1)}k`
  return String(props.value)
})

const trendClass = computed(() => props.trend >= 0 ? 'stat-card-enhanced__trend--up' : 'stat-card-enhanced__trend--down')

function handleClick() {
  if (props.clickable) emit('click')
}
</script>

<style scoped>
.stat-card-enhanced {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(24, 34, 44, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card-enhanced--clickable {
  cursor: pointer;
}

.stat-card-enhanced--clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
}

.stat-card-enhanced__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-card-enhanced__icon--primary {
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
}

.stat-card-enhanced__icon--success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.stat-card-enhanced__icon--warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.stat-card-enhanced__icon--danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.stat-card-enhanced__icon--info {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.stat-card-enhanced__content {
  flex: 1;
  min-width: 0;
}

.stat-card-enhanced__value {
  font-size: 28px;
  font-weight: 700;
  color: #18222c;
  line-height: 1.2;
}

.stat-card-enhanced__label {
  font-size: 13px;
  color: #5f6b76;
  margin-top: 4px;
}

.stat-card-enhanced__trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

.stat-card-enhanced__trend--up {
  color: #16a34a;
}

.stat-card-enhanced__trend--down {
  color: #dc2626;
}

.stat-card-enhanced__trend-label {
  color: #8a9aaa;
  font-weight: 400;
}
</style>
