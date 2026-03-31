import { describe, it, expect } from 'vitest'
import { loadPluginTestAdapter } from './adapter.js'

function isSemverLike(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || ''))
}

describe('plugin compatibility / migration contract', async () => {
  const adapter = await loadPluginTestAdapter()

  it('declares versioning and migration metadata on installed plugins', async () => {
    if (!adapter?.isReady || typeof adapter.getInstalledPlugins !== 'function') return
    const plugins = await adapter.getInstalledPlugins()

    for (const plugin of plugins) {
      expect(isSemverLike(plugin.version)).toBe(true)
      expect(isSemverLike(plugin.apiVersion)).toBe(true)
      expect(typeof plugin.hostVersionRange).toBe('string')
      expect(isSemverLike(plugin.schemaVersion)).toBe(true)
      expect(['host-schema', 'host-migrations', 'scripted']).toContain(plugin.migrationStrategy)
      expect(Array.isArray(plugin.migrationIds)).toBe(true)
      expect(typeof plugin.migrationNotes === 'string' || plugin.migrationNotes === undefined).toBe(true)
      if (plugin.migrationStrategy === 'host-migrations') {
        expect(plugin.migrationIds.length).toBeGreaterThan(0)
      }
    }
  })
})
