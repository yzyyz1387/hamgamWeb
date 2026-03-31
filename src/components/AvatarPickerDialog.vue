<template>
  <div v-if="open" class="notice-dialog-backdrop" @click.self="$emit('close')">
    <mdui-card class="notice-dialog section-card avatar-picker-dialog">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">系统头像</div>
          <h3>选择一个预设头像</h3>
          <p>从下方选择一个头像，也可以使用昵称首字母作为默认头像。</p>
        </div>
        <mdui-button variant="text" @click="$emit('close')">关闭</mdui-button>
      </div>

      <div class="avatar-picker-grid">
        <button
          v-for="url in presetAvatarUrls"
          :key="url"
          type="button"
          class="avatar-picker-item"
          :class="{ 'avatar-picker-item--active': modelValue === url }"
          @click="$emit('update:modelValue', url)"
        >
          <img :src="url" alt="预设头像" />
        </button>
      </div>

      <div class="notice-dialog__actions" style="justify-content: space-between">
        <mdui-button variant="text" @click="$emit('update:modelValue', '')">使用字母头像</mdui-button>
        <mdui-button variant="filled" @click="$emit('confirm')">确认使用</mdui-button>
      </div>
    </mdui-card>
  </div>
</template>

<script setup>
import { presetAvatarUrls } from '@/config/avatars'

defineProps({
  open: Boolean,
  modelValue: {
    type: String,
    default: '',
  },
})

defineEmits(['close', 'confirm', 'update:modelValue'])
</script>
