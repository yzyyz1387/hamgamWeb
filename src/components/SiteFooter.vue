<template>
  <footer class="site-footer">
    <div class="site-footer__inner container">
      <div class="site-footer__links" v-if="showFriendLinks && links.length">
        <span class="site-footer__links-label">{{ footerTitle }}</span>
        <a
          v-for="link in links"
          :key="link.id"
          :href="link.url"
          :target="openInNewTab ? '_blank' : '_self'"
          :rel="openInNewTab ? 'noopener noreferrer' : undefined"
          :title="link.description || link.title"
          class="site-footer__link"
        >{{ link.title }}</a>
      </div>
      <div class="site-footer__bottom">
        <span class="site-footer__name">{{ siteConfig.name }}</span>
        <span v-if="siteConfig.icp" class="site-footer__icp">{{ siteConfig.icp }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { siteConfig } from '@/config/site'
import { supabaseEnabled, requireSupabase } from '@/lib/supabase'
import { getPluginConfig } from '@/plugins/runtime'

const links = ref([])

const pluginConfig = computed(() => getPluginConfig('friend-links'))
const showFriendLinks = computed(() => pluginConfig.value.enablePublicFooterLinks !== false)
const footerTitle = computed(() => pluginConfig.value.footerTitle || '友情链接')
const openInNewTab = computed(() => pluginConfig.value.openInNewTab !== false)
const maxVisibleLinks = computed(() => Math.max(1, Number(pluginConfig.value.maxVisibleLinks || 20)))

async function loadLinks() {
  if (!supabaseEnabled || !showFriendLinks.value) {
    links.value = []
    return
  }
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('friend_links')
      .select('id, title, url, description')
      .eq('is_active', true)
      .order('sort_order')
      .limit(maxVisibleLinks.value)
    links.value = data || []
  } catch {
    // 表不存在时静默失败
  }
}

onMounted(loadLinks)
watch([maxVisibleLinks, showFriendLinks], loadLinks)
</script>
