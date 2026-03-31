import fs from 'node:fs/promises'
import path from 'node:path'

const checklistPath = path.resolve('docs/plugins/REGRESSION_CHECKLIST.md')
const content = await fs.readFile(checklistPath, 'utf8')

console.log('\n=== 插件系统回归清单 ===\n')
console.log(content)
