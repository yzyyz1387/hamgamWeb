<template>
  <button
    type="button"
    class="image-feedback-btn"
    :title="auth.isLoggedIn ? '举报/反馈此图片' : '登录后可反馈'"
    :disabled="!auth.isLoggedIn"
    @click="showDialog = true"
  >
    <mdui-icon name="flag--rounded" style="font-size: 16px"></mdui-icon>
    <span>反馈</span>
  </button>

  <FeedbackDialog
    v-model:visible="showDialog"
    :image-id="imageId"
    :image-title="imageTitle"
    @submitted="onSubmitted"
  ></FeedbackDialog>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import FeedbackDialog from './FeedbackDialog.vue'

const props = defineProps({
  imageId: { type: String, required: true },
  imageTitle: { type: String, default: '' },
})

const auth = useAuthStore()
const showDialog = ref(false)

function onSubmitted() {
  showDialog.value = false
}
</script>

<style scoped>
.image-feedback-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid rgba(15,23,42,0.1);
  border-radius: 8px;
  background: rgba(255,255,255,0.7);
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.image-feedback-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  color: #d97706;
  background: rgba(245,158,11,0.06);
}

.image-feedback-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
