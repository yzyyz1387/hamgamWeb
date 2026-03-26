<template>
  <mdui-text-field
    class="app-text-field"
    variant="outlined"
    :label="label || undefined"
    :placeholder="placeholder || undefined"
    :helper="helper || undefined"
    :value="displayValue"
    :type="type || undefined"
    :rows="rows || undefined"
    :autosize="autosize"
    :min-rows="minRows || undefined"
    :max-rows="maxRows || undefined"
    :maxlength="maxlength || undefined"
    :minlength="minlength || undefined"
    :counter="counterEnabled"
    :clearable="clearable"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :min="min ?? undefined"
    :max="max ?? undefined"
    :step="step ?? undefined"
    :icon="icon || undefined"
    :end-icon="endIcon || undefined"
    :toggle-password="togglePassword"
    :name="name || undefined"
    :inputmode="inputmode || undefined"
    style="width: 100%"
    @input="handleInput"
    @change="handleChange"
    @clear="handleClear"
  ></mdui-text-field>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helper: { type: String, default: '' },
  type: { type: String, default: 'text' },
  rows: { type: Number, default: 0 },
  autosize: { type: Boolean, default: false },
  minRows: { type: Number, default: 0 },
  maxRows: { type: Number, default: 0 },
  maxlength: { type: Number, default: 0 },
  minlength: { type: Number, default: 0 },
  counter: { type: Boolean, default: undefined },
  clearable: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  min: { type: [Number, String], default: null },
  max: { type: [Number, String], default: null },
  step: { type: [Number, String], default: null },
  icon: { type: String, default: '' },
  endIcon: { type: String, default: '' },
  togglePassword: { type: Boolean, default: false },
  name: { type: String, default: '' },
  inputmode: { type: String, default: '' },
  trim: { type: Boolean, default: false },
  number: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const displayValue = computed(() => (props.modelValue ?? '').toString())
const counterEnabled = computed(() => (typeof props.counter === 'boolean' ? props.counter : Boolean(props.maxlength)))

function normalizeValue(value) {
  let next = value
  if (props.trim && typeof next === 'string') {
    next = next.trim()
  }
  if (props.number) {
    if (next === '' || next === null || next === undefined) return ''
    const parsed = Number(next)
    return Number.isNaN(parsed) ? props.modelValue : parsed
  }
  return next
}

function handleInput(event) {
  emit('update:modelValue', normalizeValue(event?.target?.value ?? ''))
}

function handleChange(event) {
  const next = normalizeValue(event?.target?.value ?? '')
  emit('update:modelValue', next)
  emit('change', next)
}

function handleClear() {
  const next = props.number ? '' : ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
