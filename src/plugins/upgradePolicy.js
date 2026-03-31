export const PLUGIN_MIGRATION_STRATEGIES = ['host-schema', 'host-migrations', 'scripted']

export function normalizeMigrationStrategy(value) {
  return PLUGIN_MIGRATION_STRATEGIES.includes(value) ? value : 'host-schema'
}

export function getMigrationStrategyLabel(strategy) {
  switch (normalizeMigrationStrategy(strategy)) {
    case 'host-migrations':
      return '宿主 migrations'
    case 'scripted':
      return '脚本迁移'
    default:
      return '宿主 schema'
  }
}

export function getMigrationCommand(policy = {}) {
  const strategy = normalizeMigrationStrategy(policy.migrationStrategy)
  if (strategy === 'host-migrations') {
    const ids = Array.isArray(policy.migrationIds) ? policy.migrationIds.filter(Boolean) : []
    return ids.length
      ? `执行 supabase/migrations 中这些迁移：${ids.join(', ')}`
      : '执行 supabase/migrations 中对应迁移。'
  }
  if (strategy === 'scripted') {
    return policy.migrationScript || '执行插件声明的迁移脚本。'
  }
  return '执行宿主 supabase/schema.sql 即可。'
}

export function buildPluginUpgradePolicy(plugin = {}) {
  const migrationIds = Array.isArray(plugin.migrationIds) ? plugin.migrationIds.filter(Boolean) : []
  const policy = {
    schemaVersion: plugin.schemaVersion || '1.0.0',
    migrationStrategy: normalizeMigrationStrategy(plugin.migrationStrategy),
    migrationIds,
    migrationNotes: plugin.migrationNotes || '',
    migrationScript: plugin.migrationScript || '',
  }

  return {
    ...policy,
    migrationStrategyLabel: getMigrationStrategyLabel(policy.migrationStrategy),
    commandHint: getMigrationCommand(policy),
  }
}
