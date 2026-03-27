<template>
  <section class="page">
    <!-- 精简 hero 区 -->
    <mdui-card class="section-card home-hero">
      <div class="home-hero__left">
        <div class="eyebrow">Hamburger Gallery</div>
        <h2 class="home-hero__title">发现每一张有故事的图片。</h2>
        <div class="action-row home-hero__actions">
          <mdui-button variant="filled" @click="goRandom">随机一张</mdui-button>
          <mdui-button variant="filled-tonal" @click="reshuffle">重新乱序</mdui-button>
          <mdui-button variant="text" @click="goSubmit">投稿</mdui-button>
        </div>
      </div>
      <div class="home-hero__right">
        <div class="action-row" style="justify-content:flex-end">
          <mdui-button :variant="galleryStore.sortMode === 'shuffle' ? 'filled' : 'text'" @click="setSortMode('shuffle')">乱序</mdui-button>
          <mdui-button :variant="galleryStore.sortMode === 'recent' ? 'filled' : 'text'" @click="setSortMode('recent')">最新</mdui-button>
        </div>
        <div class="form-control" style="margin-top:8px">
          <AppTextField v-model="searchKeyword" trim type="search" label="搜索图片" placeholder="搜索标题、描述、贡献者…"></AppTextField>
        </div>
      </div>
    </mdui-card>

    <SetupRequiredCard v-if="!supabaseEnabled"></SetupRequiredCard>

    <div class="home-body">
      <!-- 侧边统计栏 -->
      <aside class="home-sidebar">
        <div class="sidebar-stats">
          <div class="stat-card">
            <strong>{{ filteredImages.length }}</strong>
            <span>当前结果</span>
          </div>
          <div class="stat-card">
            <strong>{{ galleryStore.images.length }}</strong>
            <span>已发布</span>
          </div>
          <div class="stat-card">
            <strong>{{ contributorCount }}</strong>
            <span>贡献者</span>
          </div>
          <div class="stat-card">
            <strong>{{ totalComments }}</strong>
            <span>累计评论</span>
          </div>
        </div>

        <div v-if="latestImage" class="sidebar-latest section-card">
          <div class="eyebrow">最近更新</div>
          <strong style="display:block;margin:4px 0 2px;font-size:14px">{{ latestImage.title }}</strong>
          <div class="muted" style="font-size:12px">{{ latestImage.contributor_name }} · {{ formatDate(latestImage.sort_at) }}</div>
          <mdui-button variant="text" style="margin-top:6px;padding:0" @click="router.push(`/image/${latestImage.slug}`)">查看详情</mdui-button>
        </div>

        <!-- 友情链接 -->
        <div v-if="friendLinks.length" class="sidebar-links section-card">
          <div class="eyebrow" style="margin-bottom:8px">友情链接</div>
          <div class="sidebar-links-list">
            <a
              v-for="link in friendLinks"
              :key="link.id"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="link.description || link.title"
              class="sidebar-link"
            >{{ link.title }}</a>
          </div>
        </div>
      </aside>

      <!-- 图墙 -->
      <div class="home-gallery">
        <div v-if="loading" class="empty-state">
          <mdui-circular-progress></mdui-circular-progress>
          <div>正在加载图片…</div>
        </div>
        <div v-else-if="pagedImages.length" class="gallery-grid">
          <GalleryCard v-for="image in pagedImages" :key="image.id" :image="image"></GalleryCard>
        </div>
        <div v-else class="empty-state">没有找到匹配结果，试试换个搜索词或重新乱序。</div>

        <!-- 加载更多触发器 -->
        <div ref="loadMoreRef" style="height:1px"></div>
        <div v-if="loadingMore" class="empty-state" style="padding:16px">
          <mdui-circular-progress></mdui-circular-progress>
        </div>
        <div v-if="!loading && !loadingMore && pagedImages.length > 0 && pagedImages.length >= filteredImages.length" class="muted" style="text-align:center;padding:12px;font-size:13px">
          已显示全部 {{ filteredImages.length }} 张
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { supabaseEnabled, requireSupabase } from '@/lib/supabase'
import { useGalleryStore } from '@/stores/gallery'
import { useAppStore } from '@/stores/app'
import GalleryCard from '@/components/GalleryCard.vue'
import SetupRequiredCard from '@/components/SetupRequiredCard.vue'
import AppTextField from '@/components/form/AppTextField.vue'

const router = useRouter()
const galleryStore = useGalleryStore()
const appStore = useAppStore()

const loading = ref(false)
const searchKeyword = ref('')
const friendLinks = ref([])

const PAGE_SIZE = 30
const page = ref(1)
const loadingMore = ref(false)
const loadMoreRef = ref(null)
let observer = null

const latestImage = computed(() =>
  [...galleryStore.images].sort((a, b) => new Date(b.sort_at || 0) - new Date(a.sort_at || 0))[0],
)

const filteredImages = computed(() => {
  const keyword = searchKeyword.value.toLowerCase()
  const base = galleryStore.images.filter((image) => {
    if (!keyword) return true
    return [image.title, image.description, image.contributor_name]
      .filter(Boolean)
      .some((item) => item.toLowerCase().includes(keyword))
  })
  if (galleryStore.sortMode === 'recent') {
    return [...base].sort((a, b) => new Date(b.sort_at || 0) - new Date(a.sort_at || 0))
  }
  return galleryStore.sortedImages.filter((img) => {
    if (!keyword) return true
    return [img.title, img.description, img.contributor_name]
      .filter(Boolean)
      .some((item) => item.toLowerCase().includes(keyword))
  })
})

const contributorCount = computed(
  () => new Set(galleryStore.images.map((i) => i.contributor_name).filter(Boolean)).size,
)
const totalComments = computed(() =>
  galleryStore.images.reduce((sum, i) => sum + Number(i.comments_count || 0), 0),
)

const pagedImages = computed(() => filteredImages.value.slice(0, page.value * PAGE_SIZE))

watch([searchKeyword], () => { page.value = 1 })

function setSortMode(mode) {
  galleryStore.setSortMode(mode)
}

function reshuffle() {
  galleryStore.reshuffle()
  page.value = 1
}

onMounted(async () => {
  galleryStore.initFromStorage()
  loading.value = true
  try {
    await Promise.all([galleryStore.loadImages(), appStore.loadAnnouncements()])
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
  if (supabaseEnabled) {
    try {
      const supabase = requireSupabase()
      const { data } = await supabase
        .from('friend_links').select('id, title, url, description')
        .eq('is_active', true).order('sort_order').limit(20)
      friendLinks.value = data || []
    } catch {}
  }
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loadingMore.value) {
      if (pagedImages.value.length < filteredImages.value.length) {
        loadingMore.value = true
        setTimeout(() => {
          page.value++
          loadingMore.value = false
        }, 200)
      }
    }
  }, { rootMargin: '200px' })
  if (loadMoreRef.value) observer.observe(loadMoreRef.value)
})

onUnmounted(() => { observer?.disconnect() })

function goRandom() {
  router.push('/random')
}

function goSubmit() {
  router.push('/submit')
}
</script>
