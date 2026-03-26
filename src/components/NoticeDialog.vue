<template>
  <Teleport to="body">
    <Transition name="notice-fade">
      <div v-if="open && announcement" class="notice-backdrop" @click.self="close">
        <div class="notice-dialog">
          <!-- 顶部色带 -->
          <div class="notice-dialog__bar"></div>

          <div class="notice-dialog__body">
            <!-- 标题区 -->
            <div class="notice-dialog__header">
              <div class="notice-dialog__icon">
                <mdui-icon name="campaign--rounded"></mdui-icon>
              </div>
              <div class="notice-dialog__title-wrap">
                <span class="notice-dialog__eyebrow">站点公告</span>
                <h2 class="notice-dialog__title">{{ announcement.title }}</h2>
              </div>
              <button class="notice-dialog__close" @click="close" aria-label="关闭">
                <mdui-icon name="close--rounded"></mdui-icon>
              </button>
            </div>

            <!-- 内容 -->
            <div class="notice-dialog__content rich-text" v-html="textToHtml(announcement.content)"></div>

            <!-- 底部 -->
            <div class="notice-dialog__footer">
              <span class="notice-dialog__time">{{ formatDate(announcement.starts_at, { withTime: true }) }}</span>
              <div class="notice-dialog__actions">
                <mdui-button variant="text" @click="close">知道了</mdui-button>
                <mdui-button
                  v-if="safeLink(announcement.link)"
                  variant="filled"
                  @click="$emit('open-link', safeLink(announcement.link))"
                >
                  前往查看
                </mdui-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { formatDate, textToHtml } from '@/lib/format'
import { normalizeSafeLink } from '@/lib/safeLink'

const props = defineProps({
  open: Boolean,
  announcement: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'dismiss', 'open-link'])

function close() {
  if (props.announcement?.id) emit('dismiss', props.announcement.id)
  emit('update:open', false)
}
function safeLink(link) { return normalizeSafeLink(link) }
</script>
