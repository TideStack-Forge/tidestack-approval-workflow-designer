const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..', '..', '..')
const srcRoot = path.join(packageRoot, 'src')

function walk(dir, predicate, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, predicate, result)
      continue
    }
    if (predicate(fullPath)) {
      result.push(path.relative(packageRoot, fullPath))
    }
  }
  return result
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, relativePath), 'utf8'))
}

test('approval workflow designer test layout follows the unified unit/integration standard', () => {
  const packageJson = readJson('package.json')
  const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8')
  const srcTestFiles = walk(
    srcRoot,
    (filePath) =>
      /(^|\/)__tests__\//.test(filePath) || /\.(test|spec)\.(js|ts|tsx)$/.test(filePath)
  )

  assert.ok(
    fs.existsSync(path.join(packageRoot, 'tests/README.md')),
    'tests/README.md should document the package testing standard'
  )
  assert.equal(
    srcTestFiles.length,
    0,
    `test files should not remain under src/: ${srcTestFiles.join(', ')}`
  )
  assert.ok(packageJson.scripts['test:unit'], 'package.json should expose test:unit')
  assert.match(
    packageJson.scripts['test:unit'],
    /vitest run/,
    'test:unit should be backed by Vitest'
  )
  assert.ok(!packageJson.scripts['test:node'], 'legacy test:node alias should be removed')
  assert.ok(
    !packageJson.scripts['test:playwright'],
    'legacy test:playwright alias should be removed'
  )
  assert.ok(packageJson.scripts['test:integration'], 'package.json should expose test:integration')
  assert.ok(!packageJson.scripts['test:browser'], 'package.json should not expose legacy test:browser')
  assert.ok(packageJson.scripts['test:all'], 'package.json should expose test:all')
  assert.ok(
    fs.existsSync(path.join(packageRoot, 'vitest.config.js')),
    'approval workflow designer should define a vitest config'
  )
  assert.ok(
    fs.existsSync(path.join(packageRoot, 'webpack.config.js')),
    'approval workflow designer should define a webpack config'
  )
  assert.ok(
    !fs.existsSync(path.join(packageRoot, 'vue.config.js')),
    'approval workflow designer should not keep a vue-cli config'
  )
  assert.ok(
    !fs.existsSync(path.join(packageRoot, 'src/router/index.js')),
    'dead Vue router residue should be removed'
  )
  const forbiddenDeps = ['vue', '@vue/runtime-core']
  forbiddenDeps.forEach((dep) => {
    assert.ok(
      !packageJson.dependencies?.[dep],
      `dependencies should not include retired Vue dependency: ${dep}`
    )
  })
  const forbiddenDevDeps = [
    '@vue/cli-plugin-babel',
    '@vue/cli-plugin-eslint',
    '@vue/cli-plugin-router',
    '@vue/cli-plugin-vuex',
    '@vue/cli-service',
    'eslint-plugin-vue',
  ]
  forbiddenDevDeps.forEach((dep) => {
    assert.ok(
      !packageJson.devDependencies?.[dep],
      `devDependencies should not include retired Vue tooling: ${dep}`
    )
  })
  assert.ok(
    fs.existsSync(path.join(packageRoot, 'tests/integration/workflow/harness/index.js')),
    'workflow harness entry should live under tests/integration'
  )
  assert.ok(
    fs.existsSync(path.join(packageRoot, 'tests/integration/workflow/designer-smoke.spec.js')),
    'workflow integration specs should live under tests/integration'
  )
  assert.ok(
    fs.existsSync(path.join(packageRoot, 'tests/integration/workflow/harness/playwright-harness.html')),
    'workflow harness template should live under tests/integration'
  )
  assert.ok(
    !fs.existsSync(path.join(packageRoot, 'src/testing')),
    'src/testing should be removed after standardization'
  )
  assert.ok(
    !readme.includes('vite + vue3'),
    'README should not describe the designer as a vite + vue3 package once webpack ownership is active'
  )
  assert.ok(
    !fs.existsSync(path.join(packageRoot, 'public/playwright-harness.html')),
    'public/playwright-harness.html should be moved under tests/integration'
  )
  assert.ok(
    !fs.existsSync(path.join(packageRoot, 'scripts/verify-editor-session.js')),
    'legacy verify scripts should move under tests/unit'
  )
})
