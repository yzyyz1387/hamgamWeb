<template>
  <mdui-select
    class="app-select"
    variant="outlined"
    :label="label || undefined"
    :placeholder="placeholder || undefined"
    :helper="helper || undefined"
    :value="displayValue"
    :clearable="clearable"
    :disabled="disabled"
    style="width: 100%"
    @change="handleChange"
  >
    <mdui-menu-item
      v-for="option in options"
      :key="String(option.value)"
      :value="String(option.value)"
    >
      <span class="app-select__option">
        <mdui-icon v-if="option.icon" :name="option.icon" class="app-select__option-icon"></mdui-icon>
        <span>{{ option.label }}</span>
      </span>
    </mdui-menu-item>
  </mdui-select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helper: { type: String, default: '' },
  clearable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  options: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'change'])
const displayValue = computed(() => (props.modelValue ?? '').toString())

function handleChange(event) {
  const next = event?.target?.value ?? ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>


<style scoped>
.app-select__option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.app-select__option-icon {
  font-size: 18px;
}
</style>
