<template>
  <mdui-select
    ref="selectRef"
    variant="outlined"
    :label="label"
    :value="stringValue"
    :placeholder="placeholder"
    :helper="helper"
    :required="required"
    :disabled="disabled"
    :clearable="clearable"
    v-bind="$attrs"
    @change="handleChange"
  >
    <mdui-menu-item
      v-for="option in options"
      :key="String(option.value)"
      :value="String(option.value)"
    >
      {{ option.label }}
    </mdui-menu-item>
  </mdui-select>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: {
    type: Array,
    default: () => [],
  },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helper: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const selectRef = ref(null)

const stringValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) return ''
  return String(props.modelValue)
})

function restoreTypedValue(raw) {
  const matched = props.options.find((option) => String(option.value) === String(raw))
  return matched ? matched.value : raw
}

function handleChange(event) {
  const raw = event?.target?.value ?? selectRef.value?.value ?? ''
  const next = restoreTypedValue(raw)
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
