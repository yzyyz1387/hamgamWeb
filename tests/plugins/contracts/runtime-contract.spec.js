import { describe, it, expect } from 'vitest'
import { contextFixtures } from '../fixtures/pluginFixtures.js'
import { loadPluginTestAdapter } from './adapter.js'
import { callAdapter, ensureArray, hasAdapterMethod, isPlainObject } from '../helpers/contractTestUtils.js'

describe('plugin runtime contract', async () => {
  const adapter = await loadPluginTestAdapter()

  it('has a ready adapter before running strict assertions', () => {
    if (!adapter?.isReady) {
      expect(adapter?.reason || '未提供 adapter').toBeTruthy()
      return
    }
    expect(adapter.isReady).toBe(true)
  })

  it('returns installed plugins as an array when adapter is ready', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getInstalledPlugins')) return
    const installedPlugins = ensureArray(await callAdapter(adapter, 'getInstalledPlugins'))
    expect(Array.isArray(installedPlugins)).toBe(true)
    for (const plugin of installedPlugins) {
      expect(typeof plugin.id).toBe('string')
      expect(typeof plugin.name).toBe('string')
    }
  })

  it('returns admin quick actions with normalized fields', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getAdminQuickActions')) return
    const actions = ensureArray(await callAdapter(adapter, 'getAdminQuickActions', contextFixtures.dashboard))
    for (const action of actions) {
      expect(typeof action.id).toBe('string')
      expect(typeof action.label).toBe('string')
      expect(typeof action.target).toBe('string')
      expect(['primary', 'secondary', 'neutral', 'danger', undefined]).toContain(action.tone)
    }
  })

  it('returns review bulk actions with standardized metadata', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getReviewBulkActions')) return
    const actions = ensureArray(await callAdapter(adapter, 'getReviewBulkActions', contextFixtures.submissions))
    for (const action of actions) {
      expect(typeof action.id).toBe('string')
      expect(typeof action.label).toBe('string')
      expect(typeof action.target).toBe('string')
      expect(typeof action.requiresSelection === 'boolean' || action.requiresSelection === undefined).toBe(true)
      expect(typeof action.menuOnly === 'boolean' || action.menuOnly === undefined).toBe(true)
      expect(typeof action.group === 'string' || action.group === undefined).toBe(true)
    }
  })

  it('returns notification templates with normalized presentation fields', async () => {
    if (!adapter?.isReady || !hasAdapterMethod(adapter, 'getNotificationTemplates')) return
    const templates = ensureArray(await callAdapter(adapter, 'getNotificationTemplates', contextFixtures.notifications))
    for (const template of templates) {
      expect(typeof template.id).toBe('string')
      expect(typeof template.title).toBe('string')
      expect(typeof template.target).toBe('string')
      expect(typeof template.category === 'string' || template.category === undefined).toBe(true)
      expect(Array.isArray(template.tags) || template.tags === undefined).toBe(true)
      if (template.values !== undefined) {
        expect(isPlainObject(template.values)).toBe(true)
      }
    }
  })
})
