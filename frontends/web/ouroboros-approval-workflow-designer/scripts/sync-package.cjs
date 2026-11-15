const fs = require('node:fs')
const path = require('node:path')

const sourceZipName = 'approval-workflow.zip'
const targetZipRelativePath =
  'core/ouroboros-approval-workflow/ouroboros-approval-workflow-web/src/main/metadata/micro-web/package/approval-workflow.zip'

function syncPackage(options = {}) {
  const packageRoot = options.packageRoot || path.resolve(__dirname, '..')
  const repoRoot = options.repoRoot || path.resolve(packageRoot, '..', '..', '..')
  const sourceZipPath = path.resolve(packageRoot, sourceZipName)
  const targetZipPath = path.resolve(repoRoot, targetZipRelativePath)

  if (!fs.existsSync(sourceZipPath)) {
    throw new Error(`Source zip not found: ${sourceZipPath}`)
  }

  fs.mkdirSync(path.dirname(targetZipPath), { recursive: true })
  fs.copyFileSync(sourceZipPath, targetZipPath)
  console.log(`Copied ${sourceZipPath} -> ${targetZipPath}`)

  return { sourceZipPath, targetZipPath }
}

if (require.main === module) {
  syncPackage()
}

module.exports = { syncPackage }
