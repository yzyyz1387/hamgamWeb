/**
 * 把这个文件复制为 tests/plugins/runtime-adapter.local.js 后，再按你的当前项目实现对应方法。
 *
 * 例子：
 * import {
 *   getInstalledPlugins,
 *   getEnabledPlugins,
 *   getAdminQuickActions,
 *   getReviewBulkActions,
 *   getNotificationTemplates,
 * } from '@/plugins/runtime'
 * import { applyNotificationTemplateValues } from '@/plugins/templates/notificationTemplates'
 *
 * export function getPluginTestAdapter() {
 *   return {
 *     isReady: true,
 *     getInstalledPlugins,
 *     getEnabledPlugins,
 *     getAdminQuickActions,
 *     getReviewBulkActions,
 *     getNotificationTemplates,
 *     applyNotificationTemplateValues,
 *   }
 * }
 */
export function getPluginTestAdapter() {
  return {
    isReady: false,
    reason: '尚未实现 runtime adapter。复制 tests/plugins/runtime-adapter.example.js 为 runtime-adapter.local.js 后接入当前插件运行时。',
  }
}
