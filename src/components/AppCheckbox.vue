<template>
  <mdui-checkbox
    class="app-checkbox"
    :checked="modelValue"
    :disabled="disabled"
    @change="handleChange"
    @input="handleChange"
  >
    {{ label }}
  </mdui-checkbox>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

function handleChange(event) {
  const next = Boolean(event?.target?.checked)
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
