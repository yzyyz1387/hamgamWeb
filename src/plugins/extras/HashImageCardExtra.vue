<template>
  <div class="plugin-inline-row plugin-inline-row--image" @click.stop>
    <button
      v-if="hasHashes"
      type="button"
      class="plugin-inline-chip plugin-inline-chip--muted"
      @click.stop="copyHashes"
      title="复制当前图片哈希信息"
    >
      <mdui-icon name="tag--rounded" style="font-size: 13px"></mdui-icon>
      已有哈希
    </button>
    <button type="button" class="plugin-inline-chip plugin-inline-chip--action" @click.stop="openTool">
      <mdui-icon name="calculate--rounded" style="font-size: 13px"></mdui-icon>
      哈希工具
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { copyText } from '@/lib/format'
import { showToast } from '@/lib/toast'

const props = defineProps({
  image: { type: Object, required: true },
})

const router = useRouter()
const hasHashes = computed(() => Boolean(props.image?.phash || props.image?.file_md5))

async function copyHashes() {
  const lines = []
  if (props.image?.phash) lines.push(`pHash: ${props.image.phash}`)
  if (props.image?.file_md5) lines.push(`MD5: ${props.image.file_md5}`)
  if (!lines.length) {
    showToast('当前图片还没有可复制的哈希信息。')
    return
  }
  await copyText(lines.join('\n'))
  showToast('已复制图片哈希信息。', 'success')
}

function openTool() {
  router.push('/admin/hash-processor')
}
</script>

<style scoped>
.plugin-inline-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.plugin-inline-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid rgba(24, 34, 44, 0.08);
  background: rgba(255, 255, 255, 0.86);
  color: #4b5563;
}
.plugin-inline-chip--action {
  cursor: pointer;
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
}
.plugin-inline-chip--muted {
  background: rgba(15, 23, 42, 0.05);
}
.plugin-inline-row--image {
  margin-top: 10px;
}
.plugin-inline-row--user {
  margin-top: 8px;
}
</style>
