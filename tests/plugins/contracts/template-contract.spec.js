import { describe, it, expect } from 'vitest'
import { loadPluginTestAdapter } from './adapter.js'

describe('plugin template contract', async () => {
  const adapter = await loadPluginTestAdapter()

  it('applies notification template values when adapter provides interpolation support', async () => {
    if (!adapter?.isReady || typeof adapter.applyNotificationTemplateValues !== 'function') return

    const resolved = adapter.applyNotificationTemplateValues(
      {
        id: 'demo-template',
        title: '审核结果通知',
        target: 'user',
        values: {
          title: '你好，{{ user_name }}',
          content: '当前状态：{{ status }}',
        },
      },
      {
        user_name: '测试用户',
        status: '已通过',
      },
    )

    expect(resolved.resolvedValues.title).toContain('测试用户')
    expect(resolved.resolvedValues.content).toContain('已通过')
  })
})
