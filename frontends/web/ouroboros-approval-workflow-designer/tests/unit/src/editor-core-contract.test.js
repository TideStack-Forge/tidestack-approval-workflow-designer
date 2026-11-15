const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  buildWorkflowEditorCommandStates,
  normalizeWorkflowSelectionSnapshot,
} = require('../../../src/editor-core/coreContract.js')

test('workflow selection snapshot supports multi-selection mode', () => {
  const selection = normalizeWorkflowSelectionSnapshot({
    nodes: [{ id: 'node-a' }, { id: 'node-b' }],
    edges: [{ id: 'edge-a' }],
  })

  assert.deepStrictEqual(selection, {
    mode: 'multi',
    nodeIds: ['node-a', 'node-b'],
    edgeIds: ['edge-a'],
  })
})

test('workflow selection snapshot preserves direct nodeIds and edgeIds payloads', () => {
  const nodeSelection = normalizeWorkflowSelectionSnapshot({
    nodeIds: ['node-a'],
    edgeIds: [],
  })
  const edgeSelection = normalizeWorkflowSelectionSnapshot({
    nodeIds: [],
    edgeIds: ['edge-a'],
  })

  assert.deepStrictEqual(nodeSelection, {
    mode: 'single-node',
    primaryTargetId: 'node-a',
    nodeIds: ['node-a'],
    edgeIds: [],
  })
  assert.deepStrictEqual(edgeSelection, {
    mode: 'single-edge',
    primaryTargetId: 'edge-a',
    nodeIds: [],
    edgeIds: ['edge-a'],
  })
})

test('workflow command state keeps readonly mode on viewport-only surface', () => {
  const commandStates = buildWorkflowEditorCommandStates({
    readonly: true,
    coreCapabilities: {
      allowViewportCommands: true,
      allowDeleteSelection: false,
      allowHistoryCommands: false,
    },
    selection: {
      mode: 'single-node',
      primaryTargetId: 'node-a',
      nodeIds: ['node-a'],
      edgeIds: [],
    },
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    history: {
      available: false,
      canUndo: false,
      canRedo: false,
    },
  })

  const visibleCommandIds = commandStates
    .filter((commandState) => commandState.visible)
    .map((commandState) => commandState.commandId)

  assert.deepStrictEqual(visibleCommandIds, [
    'zoom-out',
    'zoom-percent',
    'zoom-in',
    'fit-graph',
    'center-graph',
  ])
})

test('delete-selection command follows current selection state', () => {
  const withoutSelection = buildWorkflowEditorCommandStates({
    readonly: false,
    coreCapabilities: {
      allowDeleteSelection: true,
      allowViewportCommands: true,
      allowHistoryCommands: false,
    },
    selection: {
      mode: 'none',
      nodeIds: [],
      edgeIds: [],
    },
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    history: {
      available: false,
      canUndo: false,
      canRedo: false,
    },
  }).find((commandState) => commandState.commandId === 'delete-selection')

  const withSelection = buildWorkflowEditorCommandStates({
    readonly: false,
    coreCapabilities: {
      allowDeleteSelection: true,
      allowViewportCommands: true,
      allowHistoryCommands: false,
    },
    selection: {
      mode: 'multi',
      nodeIds: ['node-a'],
      edgeIds: ['edge-a'],
    },
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    history: {
      available: false,
      canUndo: false,
      canRedo: false,
    },
  }).find((commandState) => commandState.commandId === 'delete-selection')

  assert.strictEqual(withoutSelection.visible, true)
  assert.strictEqual(withoutSelection.enabled, false)
  assert.strictEqual(withoutSelection.disabledReason, '请先选择节点或连线')
  assert.strictEqual(withSelection.visible, true)
  assert.strictEqual(withSelection.enabled, true)
})
