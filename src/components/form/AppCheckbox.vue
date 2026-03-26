<template>
  <mdui-checkbox
    ref="checkboxRef"
    :checked="modelValue"
    :disabled="disabled"
    v-bind="$attrs"
    @change="handleChange"
  >
    <slot>{{ label }}</slot>
  </mdui-checkbox>
</template>

<script setup>
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const checkboxRef = ref(null)

function handleChange(event) {
  const checked = Boolean(event?.target?.checked ?? checkboxRef.value?.checked)
  emit('update:modelValue', checked)
  emit('change', checked)
}
</script>
