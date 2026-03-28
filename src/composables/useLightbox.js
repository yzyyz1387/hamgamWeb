import { ref } from 'vue'
import VueEasyLightbox from 'vue-easy-lightbox'

const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)

export function useLightbox() {
  function openLightbox(images, index = 0) {
    const imageList = Array.isArray(images) ? images : [images]
    lightboxImages.value = imageList
    lightboxIndex.value = index
    lightboxVisible.value = true
  }

  function closeLightbox() {
    lightboxVisible.value = false
  }

  return {
    lightboxVisible,
    lightboxImages,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    VueEasyLightbox,
  }
}

export function setupGlobalLightbox() {
  return {
    lightboxVisible,
    lightboxImages,
    lightboxIndex,
    closeLightbox,
  }
}
