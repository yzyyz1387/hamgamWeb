<template>
  <div class="bulk-toolbar">
    <div class="bulk-toolbar__meta">
      <strong>已选择 {{ selectedCount }} 项</strong>
      <span class="muted">统一审核动作</span>
      <div v-if="groupLabels.length" class="bulk-toolbar__groups">
        <span v-for="label in groupLabels" :key="label" class="bulk-toolbar__group-chip">{{ label }}</span>
      </div>
    </div>
    <div class="bulk-toolbar__actions">
      <mdui-button variant="text" @click="$emit('toggle-select-all')">
        {{ allSelected ? '取消全选' : '全选当前列表' }}
      </mdui-button>
      <mdui-button variant="text" :disabled="!selectedCount" @click="$emit('clear')">清空选择</mdui-button>
      <template v-for="action in primaryActions" :key="action.id">
        <mdui-button
          :variant="resolveVariant(action)"
          :disabled="action.requiresSelection !== false && !selectedCount"
          :class="['plugin-action-btn', `plugin-action-btn--${action.appearance || 'secondary'}`]"
          :title="action.summary || action.label"
          @click="handleRun(action)"
        >
          <mdui-icon v-if="action.icon" slot="icon" :name="action.icon"></mdui-icon>
          {{ action.label }}
        </mdui-button>
      </template>
      <details v-if="secondaryActions.length" class="plugin-action-menu">
        <summary class="plugin-action-menu__summary">更多动作</summary>
        <div class="plugin-action-menu__list">
          <button
            v-for="action in secondaryActions"
            :key="action.id"
            type="button"
            class="plugin-action-menu__item"
            :disabled="action.requiresSelection !== false && !selectedCount"
            @click="handleRun(action)"
          >
            <mdui-icon v-if="action.icon" :name="action.icon"></mdui-icon>
            <span class="plugin-action-menu__content">
              <span>{{ action.label }}</span>
              <small v-if="action.summary">{{ action.summary }}</small>
            </span>
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  actions: {
    type: Array,
    default: () => [],
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
  allSelected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-select-all', 'clear', 'run'])

const groupNameMap = {
  general: '通用',
  copy: '复制',
  inspect: '查看',
  export: '导出',
}

const primaryActions = computed(() =>
  props.actions
    .filter((action) => !action.menuOnly)
    .slice(0, 3),
)

const secondaryActions = computed(() => {
  const visiblePrimaryIds = new Set(primaryActions.value.map((action) => action.id))
  return props.actions.filter((action) => action.menuOnly || !visiblePrimaryIds.has(action.id))
})

const groupLabels = computed(() => {
  const labels = new Set()
  for (const action of props.actions || []) {
    const key = action.group || 'general'
    labels.add(groupNameMap[key] || key)
  }
  return Array.from(labels).slice(0, 4)
})

function resolveVariant(action) {
  switch (action.appearance) {
    case 'primary':
      return 'filled'
    case 'danger':
      return 'filled-tonal'
    case 'neutral':
      return 'text'
    default:
      return action.variant || 'filled-tonal'
  }
}

function handleRun(action) {
  if ((action.requiresSelection !== false) && !props.selectedCount) return
  const confirmText = action.confirmText || action.confirmTitle
  if (confirmText && typeof window !== 'undefined') {
    const accepted = window.confirm(confirmText)
    if (!accepted) return
  }
  emit('run', action)
}
</script>

<style scoped>
.bulk-toolbar__groups {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bulk-toolbar__group-chip {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(103, 80, 164, 0.08);
  color: #6750a4;
  font-size: 11px;
}

.plugin-action-btn--danger {
  --mdui-comp-button-filled-tonal-container-color: rgba(239, 68, 68, 0.12);
  --mdui-comp-button-filled-tonal-label-text-color: #b91c1c;
}

.plugin-action-menu {
  position: relative;
}

.plugin-action-menu__summary {
  list-style: none;
  cursor: pointer;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(103, 80, 164, 0.14);
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: #6750a4;
  background: rgba(103, 80, 164, 0.04);
}

.plugin-action-menu__summary::-webkit-details-marker {
  display: none;
}

.plugin-action-menu[open] .plugin-action-menu__list {
  display: grid;
}

.plugin-action-menu__list {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 220px;
  display: none;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
  z-index: 10;
}

.plugin-action-menu__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  color: #18222c;
  text-align: left;
}

.plugin-action-menu__content {
  display: grid;
  gap: 2px;
}

.plugin-action-menu__content small {
  color: #7a8594;
}

.plugin-action-menu__item:hover:not(:disabled) {
  background: rgba(103, 80, 164, 0.08);
}

.plugin-action-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
