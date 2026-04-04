<template>
  <div ref="containerRef" class="masonry-gallery" :style="containerStyle">
    <div
      v-for="image in images"
      :key="image.id"
      :ref="(element) => setItemRef(image.id, element)"
      class="masonry-gallery__item"
      :style="getItemStyle(image)"
    >
      <GalleryCard :image="image"></GalleryCard>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import GalleryCard from '@/components/GalleryCard.vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  minColumnWidth: { type: Number, default: 220 },
  gap: { type: Number, default: 16 },
  estimateBodyHeight: { type: Number, default: 108 },
})

const DEFAULT_MEDIA_RATIO = 4 / 3

const containerRef = ref(null)
const containerWidth = ref(0)
const containerHeight = ref(0)
const itemStyleMap = ref({})

const itemHeights = reactive({})

const itemRefs = new Map()
const itemObservers = new Map()

let containerObserver = null
let layoutFrame = 0

const columnCount = computed(() => {
  if (!containerWidth.value) return 1
  return Math.max(1, Math.floor((containerWidth.value + props.gap) / (props.minColumnWidth + props.gap)))
})

const itemWidth = computed(() => {
  const columns = columnCount.value
  if (!columns || !containerWidth.value) return props.minColumnWidth
  return Math.max(0, (containerWidth.value - props.gap * (columns - 1)) / columns)
})

const containerStyle = computed(() => ({
  height: props.images.length ? `${containerHeight.value}px` : '0px',
}))

watch(
  () => props.images.map((image) => image.id),
  (nextIds) => {
    const validIds = new Set(nextIds)
    for (const [id, observer] of itemObservers.entries()) {
      if (validIds.has(id)) continue
      observer.disconnect()
      itemObservers.delete(id)
      itemRefs.delete(id)
      delete itemHeights[id]
    }
    scheduleLayout()
  },
  { deep: false },
)

watch(columnCount, () => {
  scheduleLayout()
})

watch(itemWidth, () => {
  scheduleLayout()
})

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    containerObserver = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect?.width || 0)
      if (!nextWidth || nextWidth === containerWidth.value) return
      containerWidth.value = nextWidth
      scheduleLayout()
    })
    containerObserver.observe(containerRef.value)
  } else if (containerRef.value) {
    containerWidth.value = Math.floor(containerRef.value.clientWidth || 0)
    scheduleLayout()
  }
})

onBeforeUnmount(() => {
  if (layoutFrame) cancelAnimationFrame(layoutFrame)
  containerObserver?.disconnect()
  for (const observer of itemObservers.values()) {
    observer.disconnect()
  }
  itemObservers.clear()
  itemRefs.clear()
})

function setItemRef(imageId, element) {
  const current = itemRefs.get(imageId)
  if (current === element) return

  if (current && itemObservers.has(imageId)) {
    itemObservers.get(imageId)?.disconnect()
    itemObservers.delete(imageId)
  }

  if (!element) {
    itemRefs.delete(imageId)
    return
  }

  itemRefs.set(imageId, element)

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver((entries) => {
      const nextHeight = Math.ceil(entries[0]?.contentRect?.height || 0)
      if (!nextHeight || itemHeights[imageId] === nextHeight) return
      itemHeights[imageId] = nextHeight
      scheduleLayout()
    })
    observer.observe(element)
    itemObservers.set(imageId, observer)
  }

  scheduleLayout()
}

function resolveAspectRatio(image) {
  const width = Number(image?.image_width || 0)
  const height = Number(image?.image_height || 0)
  if (width > 0 && height > 0) {
    return width / height
  }
  return DEFAULT_MEDIA_RATIO
}

function estimateItemHeight(image) {
  const mediaHeight = itemWidth.value / resolveAspectRatio(image)
  const titleLength = String(image?.title || '').trim().length
  const titleLines = Math.max(1, Math.ceil(titleLength / 16))
  const reactionHeight = Number(image?.reaction_total_count || 0) > 0 ? 28 : 0
  const pluginExtrasHeight = 0
  const bodyHeight = props.estimateBodyHeight + (titleLines - 1) * 18 + reactionHeight + pluginExtrasHeight
  return Math.ceil(mediaHeight + bodyHeight)
}

function scheduleLayout() {
  if (layoutFrame) cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(async () => {
    layoutFrame = 0
    await nextTick()
    performLayout()
  })
}

function performLayout() {
  if (!props.images.length) {
    itemStyleMap.value = {}
    containerHeight.value = 0
    return
  }

  const width = itemWidth.value
  const columns = columnCount.value
  if (!width || !columns) return

  const columnHeights = Array.from({ length: columns }, () => 0)
  const nextStyles = {}

  for (const image of props.images) {
    const id = image.id
    const height = itemHeights[id] || estimateItemHeight(image)
    let targetColumn = 0

    for (let i = 1; i < columnHeights.length; i += 1) {
      if (columnHeights[i] < columnHeights[targetColumn]) {
        targetColumn = i
      }
    }

    const left = targetColumn * (width + props.gap)
    const top = columnHeights[targetColumn]

    nextStyles[id] = {
      width: `${width}px`,
      transform: `translate3d(${left}px, ${top}px, 0)`,
      opacity: 1,
    }

    columnHeights[targetColumn] += height + props.gap
  }

  itemStyleMap.value = nextStyles
  containerHeight.value = Math.max(...columnHeights) - props.gap
}

function getItemStyle(image) {
  return itemStyleMap.value[image.id] || {
    width: `${itemWidth.value}px`,
    transform: 'translate3d(0, 0, 0)',
    opacity: 0,
  }
}
</script>

<style scoped>
.masonry-gallery {
  position: relative;
  width: 100%;
}

.masonry-gallery__item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 0.22s ease, opacity 0.18s ease;
}

.masonry-gallery__item :deep(.image-card) {
  margin-bottom: 0;
  min-width: 0;
}
@media (prefers-reduced-motion: reduce) {
  .masonry-gallery__item {
    transition: none;
  }
}
</style>
