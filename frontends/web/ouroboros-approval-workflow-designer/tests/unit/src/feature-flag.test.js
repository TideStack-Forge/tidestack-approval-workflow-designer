const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const { EditorSession } = require('../../../src/editor-session/index.js')
const {
  v2DefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')

test('Mode compatibility: editorLayout is optional and backward-compatible', () => {
  const definitionWithLayout = {
    ...JSON.parse(JSON.stringify(v2DefinitionFixture)),
    editorLayout: {
      viewport: { x: 100, y: 200, zoom: 0.8 },
      nodePositions: {
        'start-a': { x: 50, y: 100 },
      },
    },
  }

  const session = EditorSession.createFromDefinition(definitionWithLayout)
  const savedDefinition = session.getDefinition()
  
  assert.ok(savedDefinition.editorLayout)
  assert.deepEqual(savedDefinition.editorLayout.nodePositions, {
    'start-a': { x: 50, y: 100 },
  })
  assert.equal(savedDefinition.editorLayout.viewport, undefined)
})

test('Mode compatibility: React Flow mode uses editorLayout', () => {
  const definitionWithLayout = {
    ...JSON.parse(JSON.stringify(v2DefinitionFixture)),
    editorLayout: {
      viewport: { x: 100, y: 200, zoom: 0.8 },
      nodePositions: {
        'start-a': { x: 50, y: 100 },
        'approve-a': { x: 50, y: 300 },
      },
    },
  }

  const session = EditorSession.createFromDefinition(definitionWithLayout)
  const workflow = session.getWorkflow()
  
  assert.ok(workflow.editorLayout)
  assert.deepEqual(workflow.editorLayout.viewport, {
    x: 100,
    y: 200,
    zoom: 0.8,
  })
  assert.deepEqual(workflow.editorLayout.nodePositions['start-a'], {
    x: 50,
    y: 100,
  })
})

test('Mode compatibility: mode switching preserves data integrity', () => {
  const initialDefinition = JSON.parse(JSON.stringify(v2DefinitionFixture))
  
  const session1 = EditorSession.createFromDefinition(initialDefinition)
  session1.updateWorkflowMeta({
    editorLayout: {
      viewport: { x: 100, y: 200, zoom: 0.8 },
      nodePositions: {
        'start-a': { x: 50, y: 100 },
      },
    },
  })
  const savedWithLayout = session1.getDefinition()
  
  const session2 = EditorSession.createFromDefinition(savedWithLayout)
  const reloadedDefinition = session2.getDefinition()
  
  assert.deepEqual(reloadedDefinition.nodes, savedWithLayout.nodes)
  assert.deepEqual(reloadedDefinition.edges, savedWithLayout.edges)
  assert.deepEqual(reloadedDefinition.editorLayout, {
    nodePositions: {
      'start-a': { x: 50, y: 100 },
      'approve-a': { x: 0, y: 200 },
      'end-a': { x: 0, y: 400 },
    },
  })
})
