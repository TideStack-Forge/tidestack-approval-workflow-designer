const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const { EditorSession } = require('../../../src/editor-session/index.js')
const {
  v2DefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')

test('save/load round-trip preserves node layout metadata but not viewport persistence', () => {
  const initialDefinition = {
    ...JSON.parse(JSON.stringify(v2DefinitionFixture)),
    editorLayout: {
      viewport: { x: 100, y: 200, zoom: 0.8 },
      nodePositions: {
        'start-a': { x: 50, y: 100 },
        'approve-a': { x: 50, y: 300 },
      },
    },
  }

  const session = EditorSession.createFromDefinition(initialDefinition)
  
  session.updateWorkflowMeta({
    editorLayout: {
      ...session.getWorkflow().editorLayout,
      viewport: { x: 150, y: 250, zoom: 0.9 },
    },
  })

  const savedDefinition = session.getDefinition()

  assert.equal(savedDefinition.editorLayout.viewport, undefined)

  const reloadedSession = EditorSession.createFromDefinition(savedDefinition)
  const reloadedDefinition = reloadedSession.getDefinition()

  assert.equal(reloadedDefinition.editorLayout.viewport, undefined)
  assert.deepEqual(reloadedDefinition.editorLayout.nodePositions, {
    'start-a': { x: 50, y: 100 },
    'approve-a': { x: 50, y: 300 },
  })
})

test('node position updates are persisted', () => {
  const session = EditorSession.createFromDefinition(
    JSON.parse(JSON.stringify(v2DefinitionFixture))
  )

  const currentLayout = session.getWorkflow().editorLayout || { nodePositions: {}, viewport: { x: 0, y: 0, zoom: 1 } }
  session.updateWorkflowMeta({
    editorLayout: {
      ...currentLayout,
      nodePositions: {
        ...currentLayout.nodePositions,
        'start-a': { x: 200, y: 300 },
      },
    },
  })

  const savedDefinition = session.getDefinition()
  assert.deepEqual(savedDefinition.editorLayout.nodePositions['start-a'], {
    x: 200,
    y: 300,
  })
})

test('editorLayout is optional and does not break save/load', () => {
  const definitionWithoutLayout = JSON.parse(JSON.stringify(v2DefinitionFixture))
  delete definitionWithoutLayout.editorLayout

  const session = EditorSession.createFromDefinition(definitionWithoutLayout)
  const savedDefinition = session.getDefinition()

  assert.ok(savedDefinition.editorLayout)
  assert.ok(savedDefinition.editorLayout.nodePositions)
  assert.equal(savedDefinition.editorLayout.viewport, undefined)
})
