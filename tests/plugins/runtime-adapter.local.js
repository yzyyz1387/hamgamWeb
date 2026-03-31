import {
  getInstalledPlugins,
  getEnabledPlugins,
  getAdminQuickActions,
  getReviewBulkActions,
  getNotificationTemplates,
} from '@/plugins/runtime'
import { applyNotificationTemplateValues } from '@/plugins/templates/notificationTemplates'

export function getPluginTestAdapter() {
  return {
    isReady: true,
    getInstalledPlugins,
    getEnabledPlugins,
    getAdminQuickActions,
    getReviewBulkActions,
    getNotificationTemplates,
    applyNotificationTemplateValues,
  }
}
