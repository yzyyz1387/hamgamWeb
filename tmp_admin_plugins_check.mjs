import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabaseEnabled } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'
import PluginConfigEditor from '@/components/admin/PluginConfigEditor.vue'
import {
  getInstalledPlugins,
  getPluginConfig,
  getPluginRuntimeState,
  getPluginSettings,
  reloadPluginRuntime,
  resetPluginConfig,
  savePluginConfig,
  setPluginEnabled,
  syncInstalledPluginsToRemote,
} from '@/plugins/runtime'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const installedPlugins = getInstalledPlugins()
const runtimeState = getPluginRuntimeState()

const refreshing = ref(false)
const syncing = ref(false)
const savingPluginId = ref('')
const savingConfigPluginId = ref('')
const targetEnabledState = ref(null)
const autoSeedTried = ref(false)
const searchKeyword = ref('')
const filterMode = ref('all')
const localSelectedPluginId = ref('')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '已启用', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
]

const runtimeSourceLabel = computed(() => {
  if (runtimeState.source === 'supabase') return 'Supabase 配置表'
  if (runtimeState.source === 'local') return '浏览器本地回退'
  return 'Manifest 默认值'
})

const canSyncRemote = computed(() => supabaseEnabled && auth.isSuperAdmin)

const pluginCards = computed(() =>
  installedPlugins.map((plugin) => {
    const settings = getPluginSettings(plugin.id)
    const enabled = settings?.enabled ?? plugin.enabled !== false
    const declaredRoutes = plugin.routes || []
    const declaredMenus = plugin.menus || []
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description || '',
      capabilities: plugin.capabilities || [],
      declaredRoutes,
      declaredMenus,
      activeRoutes: enabled ? declaredRoutes : [],
      activeMenus: enabled ? declaredMenus : [],
      enabled,
      config: getPluginConfig(plugin.id),
      defaultConfig: plugin.defaultConfig || {},
      configSchema: plugin.configSchema || [],
    }
  }),
)

const filteredPluginCards = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return pluginCards.value.filter((plugin) => {
    const passesFilter =
      filterMode.value === 'all'
      || (filterMode.value === 'enabled' && plugin.enabled)
      || (filterMode.value === 'disabled' && !plugin.enabled)

    if (!passesFilter) return false
    if (!keyword) return true

    return [plugin.name, plugin.id, plugin.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword))
  })
})

const enabledCount = computed(() => pluginCards.value.filter((plugin) => plugin.enabled).length)
const totalActiveRoutes = computed(() => pluginCards.value.reduce((total, plugin) => total + plugin.activeRoutes.length, 0))
const totalActiveMenus = computed(() => pluginCards.value.reduce((total, plugin) => total + plugin.activeMenus.length, 0))

const selectedPluginId = computed(() => {
  const routePluginId = typeof route.params.pluginId === 'string' ? route.params.pluginId : ''
  if (filteredPluginCards.value.some((plugin) => plugin.id === routePluginId)) {
    return routePluginId
  }
  if (filteredPluginCards.value.some((plugin) => plugin.id === localSelectedPluginId.value)) {
    return localSelectedPluginId.value
  }
  return filteredPluginCards.value[0]?.id || ''
})

const selectedPlugin = computed(() =>
  filteredPluginCards.value.find((plugin) => plugin.id === selectedPluginId.value) || null,
)

const selectedPluginQuickRoute = computed(() => {
  const plugin = selectedPlugin.value
  if (!plugin || !plugin.enabled) return ''
  const targetRoute = plugin.declaredRoutes.find((item) => item.path?.startsWith('/admin')) || plugin.declaredRoutes[0]
  return targetRoute?.path || ''
})

watch(
  () => route.params.pluginId,
  (value) => {
    if (typeof value === 'string' && value) {
      localSelectedPluginId.value = value
    }
  },
  { immediate: true },
)

watch(
  filteredPluginCards,
  (plugins) => {
    if (!plugins.length) {
      localSelectedPluginId.value = ''
      return
    }
    const stillExists = plugins.some((plugin) => plugin.id === localSelectedPluginId.value)
    if (!stillExists) {
      localSelectedPluginId.value = plugins[0].id
    }
  },
  { immediate: true },
)

function formatTime(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function selectPlugin(plugin) {
  if (!plugin?.id) return
  localSelectedPluginId.value = plugin.id
  router.replace({
    name: 'admin-plugins',
    params: { pluginId: plugin.id },
  })
}

async function maybeAutoSeedRemote() {
  if (autoSeedTried.value || !canSyncRemote.value) return
  if (runtimeState.source !== 'supabase' || runtimeState.remoteCount > 0 || runtimeState.error) return
  autoSeedTried.value = true
  try {
    syncing.value = true
    await syncInstalledPluginsToRemote()
    showToast('已自动初始化插件配置表。', 'success')
  } catch (error) {
    console.error('[plugins] Failed to auto seed remote registry', error)
  } finally {
    syncing.value = false
  }
}

async function refreshRuntime(options = {}) {
  refreshing.value = true
  try {
    await reloadPluginRuntime({ router })
    await maybeAutoSeedRemote()
    if (!options.silent) {
      showToast('插件运行时状态已刷新。', 'success')
    }
  } catch (error) {
    console.error('[plugins] Failed to refresh runtime', error)
    showToast(error?.message || '刷新插件状态失败。', 'error')
  } finally {
    refreshing.value = false
  }
}

async function syncToSupabase() {
  syncing.value = true
  try {
    await syncInstalledPluginsToRemote()
    showToast('插件清单和默认配置已同步到 Supabase。', 'success')
  } catch (error) {
    console.error('[plugins] Failed to sync registry', error)
    showToast(error?.message || '同步插件清单失败。', 'error')
  } finally {
    syncing.value = false
  }
}

async function togglePlugin(plugin, enabled) {
  savingPluginId.value = plugin.id
  targetEnabledState.value = enabled
  try {
    await setPluginEnabled(plugin.id, enabled, { router, persistRemote: supabaseEnabled })
    showToast(`${plugin.name}已${enabled ? '启用' : '停用'}。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to update plugin state', error)
    showToast(error?.message || '更新插件状态失败。', 'error')
  } finally {
    savingPluginId.value = ''
    targetEnabledState.value = null
  }
}

async function saveConfig(plugin, config) {
  savingConfigPluginId.value = plugin.id
  try {
    await savePluginConfig(plugin.id, config, { persistRemote: supabaseEnabled })
    showToast(`${plugin.name}配置已保存。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to save config', error)
    showToast(error?.message || '保存插件配置失败。', 'error')
  } finally {
    savingConfigPluginId.value = ''
  }
}

async function applyDefaultConfig(plugin, config) {
  try {
    await resetPluginConfig(plugin.id, { persistRemote: false })
    await savePluginConfig(plugin.id, config, { persistRemote: supabaseEnabled })
    showToast(`${plugin.name}配置已恢复默认值。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to reset config', error)
    showToast(error?.message || '恢复默认配置失败。', 'error')
  }
}

onMounted(async () => {
  await refreshRuntime({ silent: true })
})