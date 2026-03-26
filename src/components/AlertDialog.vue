<template>
  <Teleport to="body">
    <Transition name="notice-fade">
      <div v-if="open" class="notice-backdrop" @click.self="close">
        <div class="alert-dialog">
          <div class="alert-dialog__bar" :class="`alert-dialog__bar--${type}`"></div>
          <div class="alert-dialog__body">
            <div class="alert-dialog__header">
              <div class="alert-dialog__icon" :class="`alert-dialog__icon--${type}`">
                <mdui-icon :name="iconName"></mdui-icon>
              </div>
              <div class="alert-dialog__title-wrap">
                <h3 class="alert-dialog__title">{{ title }}</h3>
              </div>
            </div>
            <p v-if="message" class="alert-dialog__message">{{ message }}</p>
            <div class="alert-dialog__actions">
              <mdui-button variant="filled" @click="close">{{ confirmText }}</mdui-button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: Boolean,
  type: { type: String, default: 'error' }, // error | warn | info | success
  title: { type: String, default: '提示' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '知道了' },
})
const emit = defineEmits(['close'])

const iconName = computed(() => ({
  error: 'error--rounded',
  warn: 'warning--rounded',
  info: 'info--rounded',
  success: 'check_circle--rounded',
}[props.type] || 'info--rounded'))

function close() { emit('close') }
</script>
