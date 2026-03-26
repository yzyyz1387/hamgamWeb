<template>
  <mdui-text-field
    ref="fieldRef"
    variant="outlined"
    :label="label"
    :type="type"
    :value="stringValue"
    :placeholder="placeholder"
    :helper="helper"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :clearable="clearable"
    :rows="rows"
    :autosize="autosize"
    :min-rows="minRows"
    :max-rows="maxRows"
    :maxlength="maxlength"
    :counter="counter"
    :toggle-password="togglePassword"
    v-bind="$attrs"
    @input="handleInput"
    @change="handleChange"
    @keydown="handleKeydown"
  ></mdui-text-field>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  helper: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  rows: { type: [Number, String], default: undefined },
  autosize: { type: Boolean, default: false },
  minRows: { type: [Number, String], default: undefined },
  maxRows: { type: [Number, String], default: undefined },
  maxlength: { type: [Number, String], default: undefined },
  counter: { type: Boolean, default: false },
  togglePassword: { type: Boolean, default: false },
  trim: { type: Boolean, default: false },
  number: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change', 'enter'])

const fieldRef = ref(null)

const stringValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) return ''
  return String(props.modelValue)
})

function normalizeValue(raw) {
  let next = typeof raw === 'string' ? raw : String(raw ?? '')
  if (props.trim) {
    next = next.trim()
  }
  if (props.number) {
    if (next === '') return ''
    const parsed = Number(next)
    return Number.isNaN(parsed) ? next : parsed
  }
  return next
}

function readValue(event) {
  return event?.target?.value ?? fieldRef.value?.value ?? ''
}

function handleInput(event) {
  emit('update:modelValue', normalizeValue(readValue(event)))
}

function handleChange(event) {
  const next = normalizeValue(readValue(event))
  emit('update:modelValue', next)
  emit('change', next)
}

function handleKeydown(event) {
  if (event.key === 'Enter') {
    emit('enter', event)
  }
}
</script>
