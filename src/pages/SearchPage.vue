<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">搜索</div>
          <h1>在图集中查找</h1>
          <p class="muted">支持按标题、描述、贡献者搜索，实时显示匹配结果。</p>
        </div>
      </div>

      <div class="search-input-wrap">
        <div class="form-control">
          <AppTextField
            id="search-input"
            v-model="keyword"
            trim
            type="search"
            label="关键词"
            placeholder="搜索标题、描述、贡献者…"
            autocomplete="off"
            @enter="doSearch"
          ></AppTextField>
        </div>
        <div class="action-row" style="margin-top: 12px">
          <mdui-button variant="filled" @click="doSearch">搜索</mdui-button>
          <mdui-button variant="text" v-if="keyword" @click="keyword = ''">清空</mdui-button>
        </div>
      </div>
    </mdui-card>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在搜索…</div>
    </div>

    <template v-else-if="searched">
      <div v-if="results.length" class="gallery-grid">
        <GalleryCard v-for="image in results" :key="image.id" :image="image"></GalleryCard>
      </div>
      <div v-else class="empty-state">没有找到与「{{ lastKeyword }}」相关的图片，换个关键词试试。</div>
    </template>

    <div v-else class="empty-state">输入关键词后按回车或点击搜索。</div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { useGalleryStore } from '@/stores/gallery'
import GalleryCard from '@/components/GalleryCard.vue'
import AppTextField from '@/components/form/AppTextField.vue'

const route = useRoute()
const router = useRouter()
const galleryStore = useGalleryStore()

const keyword = ref('')
const lastKeyword = ref('')
const results = ref([])
const loading = ref(false)
const searched = ref(false)

onMounted(async () => {
  try {
    await galleryStore.loadImages()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
  const q = route.query.q
  if (q) {
    keyword.value = String(q)
    doSearch()
  }
})

watch(keyword, (value) => {
  if (!value) {
    results.value = []
    searched.value = false
  }
})

function doSearch() {
  const q = keyword.value.trim()
  if (!q) return
  lastKeyword.value = q
  searched.value = true
  loading.value = true
  router.replace({ path: '/search', query: { q } })
  try {
    const lower = q.toLowerCase()
    results.value = galleryStore.images.filter((image) =>
      [image.title, image.description, image.contributor_name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(lower)),
    )
  } finally {
    loading.value = false
  }
}
</script>
