const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { syncPackage } = require('../../../scripts/sync-package.cjs')

const packageRoot = path.resolve(__dirname, '..', '..', '..')
const targetRelativePath =
  'core/ouroboros-approval-workflow/ouroboros-approval-workflow-web/src/main/metadata/micro-web/package/approval-workflow.zip'

function createWorkspace() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-workflow-sync-'))
  const packageRoot = path.join(repoRoot, 'frontends/web/ouroboros-approval-workflow-designer')

  fs.mkdirSync(packageRoot, { recursive: true })

  return { repoRoot, packageRoot }
}

test('approval workflow designer sync copies the zip and exposes sync scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  const workspace = createWorkspace()

  try {
    assert.equal(packageJson.scripts.sync, 'node ./scripts/sync-package.cjs')
    assert.equal(packageJson.scripts['package:sync'], 'npm run package && npm run sync')

    const sourceZipPath = path.join(workspace.packageRoot, 'approval-workflow.zip')
    const targetZipPath = path.join(workspace.repoRoot, targetRelativePath)

    fs.writeFileSync(sourceZipPath, 'approval-workflow-zip-bytes')

    const result = syncPackage({ packageRoot: workspace.packageRoot, repoRoot: workspace.repoRoot })

    assert.equal(fs.readFileSync(targetZipPath, 'utf8'), 'approval-workflow-zip-bytes')
    assert.equal(result.sourceZipPath, sourceZipPath)
    assert.equal(result.targetZipPath, targetZipPath)
  } finally {
    fs.rmSync(workspace.repoRoot, { recursive: true, force: true })
  }
})

test('approval workflow designer sync fails when the source zip is missing', () => {
  const workspace = createWorkspace()

  try {
    assert.throws(
      () => syncPackage({ packageRoot: workspace.packageRoot, repoRoot: workspace.repoRoot }),
      /Source zip not found:/
    )
  } finally {
    fs.rmSync(workspace.repoRoot, { recursive: true, force: true })
  }
})
