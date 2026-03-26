<template>
  <div class="emoji-bar-wrap">
    <div class="emoji-bar" :class="{ 'emoji-bar--collapsed': !expanded && needsCollapse }">
      <button
        v-for="item in displayedSummary"
        :key="item.emoji"
        type="button"
        class="emoji-pill"
        :class="{ 'emoji-pill--selected': selectedSet.has(item.emoji) }"
        :disabled="!interactive"
        @click="emitToggle(item.emoji)"
      >
        <span>{{ item.emoji }}</span>
        <span>{{ item.count }}</span>
      </button>

      <button
        v-for="emoji in extraEmojis"
        :key="emoji"
        type="button"
        class="emoji-pill emoji-pill--add"
        :class="{ 'emoji-pill--selected': selectedSet.has(emoji) }"
        :disabled="!interactive"
        @click="emitToggle(emoji)"
      >
        <span>{{ emoji }}</span>
        <span>+</span>
      </button>

      <span v-if="!displayedSummary.length && !interactive" class="muted">还没有反应</span>
    </div>

    <button
      v-if="needsCollapse"
      type="button"
      class="emoji-bar__toggle"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : `展开全部 (${allCount})` }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { defaultReactionSet } from '@/config/site'
import { normalizeReactionSummary } from '@/lib/image'

const props = defineProps({
  summary: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: true },
  limit: { type: Number, default: 0 },
  // 折叠阈值：超过几个 pill 就折叠（0=不折叠）
  collapseAfter: { type: Number, default: 0 },
})

const emit = defineEmits(['toggle'])
const expanded = ref(false)

const normalizedSummary = computed(() => normalizeReactionSummary(props.summary))
const displayedSummary = computed(() =>
  props.limit > 0 ? normalizedSummary.value.slice(0, props.limit) : normalizedSummary.value,
)
const selectedSet = computed(() => new Set(props.selected || []))
const extraEmojis = computed(() => {
  if (!props.interactive || props.limit > 0) return []
  const existing = new Set(normalizedSummary.value.map((item) => item.emoji))
  return defaultReactionSet.filter((emoji) => !existing.has(emoji))
})

const allCount = computed(() => displayedSummary.value.length + extraEmojis.value.length)
const needsCollapse = computed(() => props.collapseAfter > 0 && allCount.value > props.collapseAfter)

function emitToggle(emoji) {
  if (!props.interactive) return
  emit('toggle', emoji)
}
</script>
