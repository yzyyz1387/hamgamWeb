<template>
  <div v-if="actions.length" class="admin-quick-strip">
    <button
      v-for="action in actions"
      :key="action.id"
      type="button"
      class="admin-quick-strip__item"
      :class="[`admin-quick-strip__item--${action.tone || 'secondary'}`]"
      @click="$emit('run', action)"
    >
      <div class="admin-quick-strip__icon">
        <mdui-icon :name="action.icon || 'bolt--rounded'"></mdui-icon>
      </div>
      <div class="admin-quick-strip__body">
        <div class="admin-quick-strip__label-row">
          <strong>{{ action.label }}</strong>
          <span v-if="action.badge" class="admin-quick-strip__badge">{{ action.badge }}</span>
        </div>
        <div v-if="action.description" class="admin-quick-strip__description">{{ action.description }}</div>
      </div>
    </button>
  </div>
</template>

<script setup>
defineProps({
  actions: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['run'])
</script>

<style scoped>
.admin-quick-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 16px 0 20px;
}

.admin-quick-strip__item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  border: 1px solid rgba(103, 80, 164, 0.12);
  border-radius: 18px;
  background: #fff;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.admin-quick-strip__item:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  border-color: rgba(103, 80, 164, 0.24);
}

.admin-quick-strip__item--primary {
  background: linear-gradient(135deg, rgba(103, 80, 164, 0.1), rgba(103, 80, 164, 0.02));
}

.admin-quick-strip__item--danger {
  border-color: rgba(239, 68, 68, 0.18);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02));
}

.admin-quick-strip__icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-quick-strip__item--danger .admin-quick-strip__icon {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.admin-quick-strip__body {
  min-width: 0;
  flex: 1;
}

.admin-quick-strip__label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.admin-quick-strip__label-row strong {
  font-size: 14px;
  color: #18222c;
}

.admin-quick-strip__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(103, 80, 164, 0.14);
  color: #6750a4;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.admin-quick-strip__description {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  color: #6b7280;
}

@media (max-width: 640px) {
  .admin-quick-strip {
    grid-template-columns: 1fr;
  }
}
</style>
