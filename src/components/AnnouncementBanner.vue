<template>
  <div v-if="visibleItems.length" class="banner-strip-wrap">
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="banner-strip"
    >
      <span class="banner-strip__label">公告</span>
      <div class="banner-strip__marquee-wrap">
        <div class="banner-strip__marquee" style="margin: 0 auto;">
          <span class="banner-strip__text">{{ item.title }}{{ item.content ? '：' + item.content : '' }}</span>
          <span class="banner-strip__text" aria-hidden="true">{{ item.title }}{{ item.content ? '：' + item.content : '' }}</span>
        </div>
      </div>
      <button
        v-if="item.dismissible !== false"
        class="banner-strip__close"
        type="button"
        aria-label="关闭公告"
        @click="dismiss(item.id)"
      >×</button>
      <button
        v-if="safeLink(item.link)"
        class="banner-strip__link"
        type="button"
        @click="$emit('open-link', safeLink(item.link))"
      >查看</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { normalizeSafeLink } from '@/lib/safeLink'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['open-link'])

const dismissed = ref(new Set())

const visibleItems = computed(() =>
  props.items.filter((item) => !dismissed.value.has(item.id)),
)

function dismiss(id) {
  dismissed.value = new Set([...dismissed.value, id])
}

function safeLink(link) {
  return normalizeSafeLink(link)
}
</script>
