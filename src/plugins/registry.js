import friendLinksPlugin from '@/plugins/plugins/friend-links'
import callsignPlugin from '@/plugins/plugins/callsign'
import hashProcessorPlugin from '@/plugins/plugins/hash-processor'
import imageFeedbackPlugin from '@/plugins/plugins/image-feedback'

const builtinPluginCatalog = [
  {
    id: friendLinksPlugin.id,
    source: 'builtin',
    installMode: 'bundled',
    loader: async () => friendLinksPlugin,
    plugin: friendLinksPlugin,
  },
  {
    id: callsignPlugin.id,
    source: 'builtin',
    installMode: 'bundled',
    loader: async () => callsignPlugin,
    plugin: callsignPlugin,
  },
  {
    id: hashProcessorPlugin.id,
    source: 'builtin',
    installMode: 'bundled',
    loader: async () => hashProcessorPlugin,
    plugin: hashProcessorPlugin,
  },
  {
    id: imageFeedbackPlugin.id,
    source: 'builtin',
    installMode: 'bundled',
    loader: async () => imageFeedbackPlugin,
    plugin: imageFeedbackPlugin,
  },
]

export function getPluginCatalogEntries() {
  return builtinPluginCatalog.slice()
}

export function getPluginCatalogManifests() {
  return builtinPluginCatalog.map((entry) => entry.plugin)
}

export function getPluginCatalogEntryById(pluginId) {
  return builtinPluginCatalog.find((entry) => entry.id === pluginId) || null
}

export function getPluginCatalogManifestById(pluginId) {
  return getPluginCatalogEntryById(pluginId)?.plugin || null
}
