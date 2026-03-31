import { describe, it, expect } from 'vitest'
import { loadPluginTestAdapter } from './adapter.js'
import { callAdapter, ensureArray, hasAdapterMethod } from '../helpers/contractTestUtils.js'

describe('plugin registry contract', async () => {
  const adapter = await loadPluginTestAdapter()

  it('can expose available plugins separately from installed plugins', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getAvailablePlugins') || !hasAdapterMethod(adapter, 'getInstalledPlugins')) return
    const available = ensureArray(await callAdapter(adapter, 'getAvailablePlugins'))
    const installed = ensureArray(await callAdapter(adapter, 'getInstalledPlugins'))
    expect(Array.isArray(available)).toBe(true)
    expect(Array.isArray(installed)).toBe(true)
    expect(available.length).toBeGreaterThanOrEqual(installed.length)
  })

  it('installed plugins should all have id and name', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getInstalledPlugins')) return
    const installed = ensureArray(await callAdapter(adapter, 'getInstalledPlugins'))
    for (const plugin of installed) {
      expect(typeof plugin.id).toBe('string')
      expect(typeof plugin.name).toBe('string')
    }
  })
})
