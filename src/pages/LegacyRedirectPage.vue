<template>
  <section class="page">
    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在尝试从旧链接跳转…</div>
    </div>
    <div v-else class="empty-state">
      <p>{{ message }}</p>
      <mdui-button variant="filled" @click="router.push('/')">返回主页</mdui-button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { useGalleryStore } from '@/stores/gallery'

const route = useRoute()
const router = useRouter()
const galleryStore = useGalleryStore()

const loading = ref(false)
const found = ref(false)

const message = computed(() =>
  found.value ? '即将跳转…' : '没有找到这个旧链接对应的图片。',
)

onMounted(resolveLegacyLink)
watch(() => route.fullPath, resolveLegacyLink)

async function resolveLegacyLink() {
  const legacyPath = Array.isArray(route.params.legacyPath)
    ? route.params.legacyPath.join('/')
    : route.params.legacyPath || ''
  if (!legacyPath) {
    router.replace('/')
    return
  }
  loading.value = true
  found.value = false
  try {
    await galleryStore.loadImages()
    const image = await galleryStore.fetchImageByLegacyPath(legacyPath)
    if (image) {
      found.value = true
      router.replace(`/image/${image.slug}`)
      return
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}
</script>
