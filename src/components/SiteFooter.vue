<template>
  <footer class="site-footer">
    <div class="site-footer__inner container">
      <div class="site-footer__links" v-if="links.length">
        <span class="site-footer__links-label">友情链接</span>
        <a
          v-for="link in links"
          :key="link.id"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.description || link.title"
          class="site-footer__link"
        >{{ link.title }}</a>
      </div>
      <div class="site-footer__bottom">
        <span class="site-footer__name">{{ siteConfig.name }}</span>
        <span v-if="siteConfig.icp" class="site-footer__icp">{{ siteConfig.icp }}</span>
        <a
          v-if="siteConfig.moeIcp"
          :href="`https://icp.gov.moe/?keyword=${siteConfig.moeIcp}`"
          target="_blank"
          rel="noopener noreferrer"
          class="site-footer__moe-icp"
        >
          <img src="/icon120.png" alt="萌ICP" class="site-footer__moe-icp-icon" />
          <span>萌ICP备{{ siteConfig.moeIcp }}号</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { siteConfig } from '@/config/site'
import { supabaseEnabled, requireSupabase } from '@/lib/supabase'

const links = ref([])

onMounted(async () => {
  if (!supabaseEnabled) return
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('friend_links')
      .select('id, title, url, description')
      .eq('is_active', true)
      .order('sort_order')
      .limit(20)
    links.value = data || []
  } catch {
    // 表不存在时静默失败
  }
})
</script>
