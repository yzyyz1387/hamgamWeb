<template>
  <div class="review-dialog__section review-dialog__section--plugin">
    <div class="review-dialog__section-title">
      <mdui-icon name="fingerprint--rounded"></mdui-icon>
      哈希状态
    </div>
    <div class="hash-review-grid">
      <div class="hash-review-item">
        <span>pHash</span>
        <strong>{{ submission?.phash || '缺失' }}</strong>
      </div>
      <div class="hash-review-item">
        <span>MD5</span>
        <strong>{{ submission?.file_md5 || '缺失' }}</strong>
      </div>
      <div class="hash-review-item">
        <span>来源</span>
        <strong>{{ submission?.storage_bucket || '未知' }}</strong>
      </div>
      <div class="hash-review-item">
        <span>发布后写入</span>
        <strong>{{ hasHashes ? '可继承到 images' : '建议补算' }}</strong>
      </div>
    </div>
    <div class="action-row" style="margin-top: 12px">
      <mdui-button variant="text" @click="copyHashes" :disabled="!hasHashes">复制哈希</mdui-button>
      <mdui-button variant="text" @click="router.push('/admin/hash-processor')">打开工具</mdui-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { copyText } from '@/lib/format'
import { showToast } from '@/lib/toast'

const props = defineProps({
  submission: { type: Object, default: null },
})

const router = useRouter()
const hasHashes = computed(() => Boolean(props.submission?.phash || props.submission?.file_md5))

async function copyHashes() {
  const lines = []
  if (props.submission?.phash) lines.push(`pHash: ${props.submission.phash}`)
  if (props.submission?.file_md5) lines.push(`MD5: ${props.submission.file_md5}`)
  if (!lines.length) {
    showToast('当前投稿还没有哈希信息。')
    return
  }
  await copyText(lines.join('\n'))
  showToast('已复制投稿哈希信息。', 'success')
}
</script>

<style scoped>
.hash-review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.hash-review-item {
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.78);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hash-review-item span {
  font-size: 12px;
  color: #64748b;
}
.hash-review-item strong {
  font-size: 13px;
  word-break: break-all;
}
@media (max-width: 640px) {
  .hash-review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
