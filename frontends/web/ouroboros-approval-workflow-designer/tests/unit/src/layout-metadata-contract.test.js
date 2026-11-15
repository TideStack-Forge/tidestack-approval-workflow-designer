const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  definitionToMiddle,
  middleToDefinitionV2,
} = require('../../../src/translator/definition-format/index.js')
const { addEditorLayoutToV2 } = require('../../../src/translator/define/v2-extensions.js')
const { EditorSession } = require('../../../src/editor-session/index.js')
const {
  v1DefinitionFixture,
  v2DefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')

test('editorLayout root metadata only persists node positions into V2 definition', () => {
  const definitionWithLayout = {
    ...JSON.parse(JSON.stringify(v2DefinitionFixture)),
    editorLayout: {
      viewport: {
        x: 120,
        y: -80,
        zoom: 0.75,
      },
      nodePositions: {
        'start-a': { x: 40, y: 60 },
        'approve-a': { x: 40, y: 260 },
      },
    },
  }

  const loaded = definitionToMiddle(definitionWithLayout)
  const roundTrip = addEditorLayoutToV2(
    middleToDefinitionV2(loaded.middleWorkflowGraph),
    loaded.middleWorkflowGraph.editorLayout
  )

  assert.deepEqual(roundTrip.editorLayout, {
    nodePositions: definitionWithLayout.editorLayout.nodePositions,
  })
})

test('editor session keeps viewport updates out of persisted editorLayout metadata', () => {
  const session = EditorSession.createFromDefinition(
    JSON.parse(JSON.stringify(v2DefinitionFixture))
  )

  session.updateWorkflowMeta({
    editorLayout: {
      viewport: {
        x: 16,
        y: 24,
        zoom: 1.25,
      },
      nodePositions: {
        'start-a': { x: 20, y: 20 },
      },
    },
  })

  assert.deepEqual(session.getDefinition().editorLayout, {
    nodePositions: {
      'start-a': { x: 20, y: 20 },
      'approve-a': { x: 0, y: 200 },
      'end-a': { x: 0, y: 400 },
    },
  })
})

test('legacy definition without layout gets deterministic initial editorLayout fallback', () => {
  const session = EditorSession.createFromDefinition(
    JSON.parse(JSON.stringify(v1DefinitionFixture))
  )
  const definition = session.getDefinition()

  assert.deepEqual(definition.editorLayout, {
    nodePositions: {
      'start-a': { x: 0, y: 0 },
      'approve-a': { x: 0, y: 200 },
    },
  })
})
