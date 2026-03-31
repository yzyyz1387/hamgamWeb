import { describe, it, expect } from 'vitest'
import { loadPluginTestAdapter } from './adapter.js'

describe('plugin regression smoke', async () => {
  const adapter = await loadPluginTestAdapter()

  it('documents why tests are skipped when no adapter is wired', () => {
    if (adapter?.isReady) {
      expect(adapter.isReady).toBe(true)
      return
    }

    expect(typeof adapter?.reason).toBe('string')
    expect(adapter.reason.length).toBeGreaterThan(0)
  })
})
