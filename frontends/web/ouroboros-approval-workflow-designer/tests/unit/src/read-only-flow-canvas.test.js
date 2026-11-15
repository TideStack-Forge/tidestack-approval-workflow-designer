const assert = require('assert')
const fs = require('fs')
const path = require('path')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  DEFAULT_READ_ONLY_CANVAS_HEIGHT,
  buildReadOnlyCanvasData,
  resolveReadOnlyCanvasHeight,
  resolveReadOnlyActiveNodeIds,
  resolveReadOnlyDefinition,
} = require('../../../src/views/workflow/components/ReadOnlyFlowCanvas/transform.js')
const { v2DefinitionFixture } = require('../../integration/workflow/harness/fixtures.js')

const readSource = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

test('ReadOnlyFlowCanvas transformation logic', () => {
  const definition = JSON.parse(JSON.stringify(v2DefinitionFixture))

  const canvasData = buildReadOnlyCanvasData(definition)

  assert.deepStrictEqual(
    canvasData.nodes.map((node) => node.id),
    ['start-a', 'approve-a', 'end-a']
  )
  assert.deepStrictEqual(
    canvasData.edges.map((edge) => `${edge.source}->${edge.target}`),
    ['start-a->approve-a', 'approve-a->end-a']
  )
})

test('ReadOnlyFlowCanvas highlights active nodes correctly', () => {
  const canvasData = buildReadOnlyCanvasData(JSON.parse(JSON.stringify(v2DefinitionFixture)), ['start-a'])

  const node1 = canvasData.nodes.find((n) => n.id === 'start-a')
  const node2 = canvasData.nodes.find((n) => n.id === 'approve-a')
  const endNode = canvasData.nodes.find((n) => n.id === 'end-a')

  assert.strictEqual(node1.data.isActive, true, 'active node should be highlighted')
  assert.strictEqual(node1.data.isReadonly, true, 'viewer nodes should always be readonly')
  assert.strictEqual(node1.style.borderColor, '#52c41a', 'active node should be highlighted')
  assert.ok(!node2.data.isActive, 'node2 should not be highlighted')
  assert.strictEqual(endNode.data.isReadonly, true, 'end node should be readonly')
})

test('ReadOnlyFlowCanvas handles empty definition', () => {
  const definition = {}
  const canvasData = buildReadOnlyCanvasData(definition)

  assert.strictEqual(canvasData.nodes.length, 0)
  assert.strictEqual(canvasData.edges.length, 0)
})

test('ReadOnlyFlowCanvas resolves an explicit viewer height for container-less hosts', () => {
  assert.strictEqual(resolveReadOnlyCanvasHeight(600), 600)
  assert.strictEqual(resolveReadOnlyCanvasHeight('500'), 500)
  assert.strictEqual(resolveReadOnlyCanvasHeight('60vh'), '60vh')
  assert.strictEqual(resolveReadOnlyCanvasHeight(''), DEFAULT_READ_ONLY_CANVAS_HEIGHT)
  assert.strictEqual(resolveReadOnlyCanvasHeight(null), DEFAULT_READ_ONLY_CANVAS_HEIGHT)
})

test('ReadOnlyFlowCanvas preserves existing node styles', () => {
  const canvasData = buildReadOnlyCanvasData(JSON.parse(JSON.stringify(v2DefinitionFixture)))

  assert.ok(canvasData.nodes.every((node) => node.data.isReadonly), 'all viewer nodes should be readonly')
})

test('ReadOnlyFlowCanvas active highlighting merges with existing styles', () => {
  const canvasData = buildReadOnlyCanvasData(JSON.parse(JSON.stringify(v2DefinitionFixture)), ['start-a'])
  const activeNode = canvasData.nodes.find((node) => node.id === 'start-a')

  assert.ok(activeNode.style)
  assert.strictEqual(activeNode.style.borderColor, '#52c41a')
  assert.ok(String(activeNode.style.boxShadow || '').includes('82, 196, 26'))
})

test('ReadOnlyFlowCanvas resolves definition from renderer scope data when schema passes literal template strings', () => {
  const detailScopeDefinition = JSON.parse(JSON.stringify(v2DefinitionFixture))
  const versionScopeDefinition = JSON.parse(JSON.stringify(v2DefinitionFixture))

  assert.deepStrictEqual(
    resolveReadOnlyDefinition('$$', detailScopeDefinition),
    detailScopeDefinition
  )
  assert.deepStrictEqual(
    resolveReadOnlyDefinition('${definition}', {
      definition: versionScopeDefinition,
    }),
    versionScopeDefinition
  )
})

test('ReadOnlyFlowCanvas resolves active node ids from renderer scope data when schema passes literal template strings', () => {
  assert.deepStrictEqual(
    resolveReadOnlyActiveNodeIds('${activeNodeIds}', {
      activeNodeIds: ['approve-a'],
    }),
    ['approve-a']
  )
})

test('ReadOnlyFlowCanvas uses React Flow viewer instead of legacy canvas', () => {
  const source = readSource('src/views/workflow/components/ReadOnlyFlowCanvas/index.jsx')

  assert.ok(source.includes("import ReactFlowCanvas from '../ReactFlowDesigner/ReactFlowCanvas'"))
  assert.ok(source.includes("import '../ReactFlowDesigner/styles.scss'"))
  assert.ok(!source.includes('ProcessDesigner/FlowCanvas'))
  assert.ok(!source.includes('workflow-chart'))
  assert.ok(!source.includes('editorMode'))
  assert.ok(source.includes('prevProps.data !== this.props.data'))
  assert.ok(source.includes('resolveReadOnlyCanvasHeight'))
  assert.ok(source.includes('style={viewerStyle}'))
})

test('ReactFlowCanvas disables editing affordances in readonly mode', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes('onDrop={isReadonly ? undefined : onDrop}'))
  assert.ok(source.includes('nodesDraggable={!isReadonly}'))
  assert.ok(source.includes('nodesConnectable={!isReadonly}'))
  assert.ok(source.includes('const allowDeleteSelection = !isReadonly && coreCapabilities?.allowDeleteSelection !== false'))
  assert.ok(source.includes('onBeforeDelete={!allowDeleteSelection ? undefined : handleBeforeDelete}'))
  assert.ok(source.includes('onDelete={!allowDeleteSelection ? undefined : handleDelete}'))
  assert.ok(source.includes('deleteKeyCode={allowDeleteSelection ? \'Delete\' : null}'))
  assert.ok(source.includes("from './canvasGestureContract'"))
  assert.ok(source.includes('buildCanvasGestureInteractionProps'))
  assert.ok(source.includes('const canvasGestureInteractionProps = useMemo(() => {'))
  assert.ok(source.includes('{...canvasGestureInteractionProps}'))
  assert.ok(!source.includes('panOnDrag={!allowMultiSelect}'))
  assert.ok(!source.includes('selectionOnDrag={allowMultiSelect}'))
  assert.ok(source.includes('onRegisterCommandBridge'))
  assert.ok(source.includes('onRegisterMutationBridge'))
  assert.ok(source.includes('const isConnectable = !data?.isReadonly'))
  assert.ok(source.includes('isConnectable={isConnectable}'))
})
