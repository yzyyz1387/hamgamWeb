import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function toKebabCase(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function toPascalCase(value) {
  return String(value || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

async function copyTemplateDir(sourceDir, targetDir, replacements) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    let targetName = entry.name
      .replace('ExamplePluginPage', `${replacements.pascalName}Page`)
      .replace('ExampleDashboardWidget', `${replacements.pascalName}DashboardWidget`)
      .replace('ExampleProfilePanel', `${replacements.pascalName}ProfilePanel`)
    const targetPath = path.join(targetDir, targetName)

    if (entry.isDirectory()) {
      await copyTemplateDir(sourcePath, targetPath, replacements)
      continue
    }

    let content = await fs.readFile(sourcePath, 'utf8')
    content = content
      .replaceAll('__PLUGIN_ID__', replacements.pluginId)
      .replaceAll('__PLUGIN_NAME__', replacements.pluginName)
      .replaceAll('ExamplePluginPage', `${replacements.pascalName}Page`)
      .replaceAll('ExampleDashboardWidget', `${replacements.pascalName}DashboardWidget`)
      .replaceAll('ExampleProfilePanel', `${replacements.pascalName}ProfilePanel`)

    await fs.writeFile(targetPath, content, 'utf8')
  }
}

async function main() {
  const rawId = process.argv[2]
  const rawName = process.argv[3]

  if (!rawId) {
    console.error('用法: npm run plugin:scaffold <plugin-id> [插件名称]')
    process.exit(1)
  }

  const pluginId = toKebabCase(rawId)
  const pluginName = rawName?.trim() || pluginId
  const pascalName = toPascalCase(pluginId)

  const rootDir = process.cwd()
  const templateDir = path.join(rootDir, 'src', 'plugins', 'templates', 'example-plugin')
  const targetDir = path.join(rootDir, 'src', 'plugins', 'plugins', pluginId)

  try {
    await fs.access(targetDir)
    console.error(`目标目录已存在: ${targetDir}`)
    process.exit(1)
  } catch {
    // expected
  }

  await copyTemplateDir(templateDir, targetDir, {
    pluginId,
    pluginName,
    pascalName,
  })

  console.log(`已创建插件模板: ${targetDir}`)
  console.log('下一步:')
  console.log('1. 在该目录中补充你的业务逻辑')
  console.log('2. 在 src/plugins/runtime.js 中导入并注册新插件')
  console.log('3. 启动项目并到 /admin/plugins 中启用插件')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
