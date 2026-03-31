<template>
  <div class="plugin-config-editor">
    <div v-if="schema.length" class="form-grid plugin-config-editor__grid">
      <template v-for="field in schema" :key="field.key">
        <div class="form-control" :style="field.type === 'textarea' ? 'grid-column: 1 / -1' : ''">
          <AppCheckbox
            v-if="field.type === 'boolean'"
            :model-value="Boolean(localConfig[field.key])"
            @update:model-value="updateField(field, $event)"
          >
            {{ field.label }}
          </AppCheckbox>
          <AppSelect
            v-else-if="field.type === 'select'"
            :model-value="localConfig[field.key]"
            :label="field.label"
            :options="field.options || []"
            :helper="''"
            @update:model-value="updateField(field, $event)"
          ></AppSelect>

          <AppTextField
            v-else
            :model-value="localConfig[field.key]"
            :label="field.label"
            :helper="''"
            :placeholder="field.placeholder || ''"
            :type="field.type === 'number' ? 'number' : 'text'"
            :number="field.type === 'number'"
            :rows="field.type === 'textarea' ? field.rows || 3 : undefined"
            :autosize="field.type === 'textarea'"
            :min-rows="field.type === 'textarea' ? field.minRows || 3 : undefined"
            :max-rows="field.type === 'textarea' ? field.maxRows || 6 : undefined"
            @update:model-value="updateField(field, $event)"
          ></AppTextField>
        </div>
      </template>
    </div>
    <div v-else class="muted">这个插件暂时没有可配置项。</div>

    <div class="plugin-config-editor__actions">
      <mdui-button variant="filled-tonal" :disabled="!dirty || saving" :loading="saving" @click="emit('save', localConfig)">
        保存配置
      </mdui-button>
      <mdui-button variant="text" :disabled="!dirty || saving" @click="resetToCurrent">
        撤销改动
      </mdui-button>
      <mdui-button variant="text" :disabled="saving" @click="resetToDefaults">
        恢复默认
      </mdui-button>
      <span v-if="dirty" class="muted plugin-config-editor__dirty">有未保存改动</span>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, computed } from 'vue'
import AppCheckbox from '@/components/form/AppCheckbox.vue'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'

const props = defineProps({
  schema: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  defaultValue: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'reset'])

const localConfig = reactive({})

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function applyModel(value) {
  const next = cloneValue(value)
  Object.keys(localConfig).forEach((key) => {
    if (!(key in next)) delete localConfig[key]
  })
  Object.assign(localConfig, next)
}

watch(
  () => props.modelValue,
  (value) => {
    applyModel(value)
  },
  { immediate: true, deep: true },
)

const dirty = computed(() => JSON.stringify(localConfig) !== JSON.stringify(props.modelValue || {}))

function clampNumber(field, value) {
  let next = Number(value)
  if (Number.isNaN(next)) {
    next = Number(props.defaultValue?.[field.key] ?? 0)
  }
  if (typeof field.min === 'number') next = Math.max(field.min, next)
  if (typeof field.max === 'number') next = Math.min(field.max, next)
  return next
}

function updateField(field, rawValue) {
  if (!field?.key) return
  if (field.type === 'boolean') {
    localConfig[field.key] = Boolean(rawValue)
    return
  }
  if (field.type === 'number') {
    localConfig[field.key] = clampNumber(field, rawValue)
    return
  }
  localConfig[field.key] = rawValue ?? ''
}

function resetToCurrent() {
  applyModel(props.modelValue)
}

function resetToDefaults() {
  applyModel(props.defaultValue)
  emit('reset', cloneValue(props.defaultValue))
}
</script>

<style scoped>
.plugin-config-editor__grid {
  margin-top: 8px;
}


.plugin-config-editor__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 16px;
}

.plugin-config-editor__dirty {
  font-size: 12px;
}
</style>
