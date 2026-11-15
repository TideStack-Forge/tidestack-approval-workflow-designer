const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const { EditorSession } = require('../../../src/editor-session/index.js')
const {
  MiddleWorkflowGraph,
  MiddleStartNode,
  MiddleApprovalNode,
} = require('../../../src/translator/define/middle.js')
const {
  v2BranchDefinitionFixture,
  v2DefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')

const clone = (value) => JSON.parse(JSON.stringify(value))

const createDefinitionWithDetachedNotice = () => {
  const definition = clone(v2DefinitionFixture)
  definition.editorLayout = {
    nodePositions: {
      'start-a': { x: 60, y: 100 },
      'approve-a': { x: 300, y: 100 },
      'end-a': { x: 540, y: 100 },
      'notice-detached': { x: 780, y: 220 },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  definition.nodes.push({
    id: 'notice-detached',
    type: '结束节点',
    name: '自由通知',
    notice: {
      content: '脱链通知',
      channel: ['message'],
      candidates: [{ type: 'User', users: ['u9'] }],
    },
  })

  return definition
}

const createDefinitionWithUnknownMetadata = () => {
  const definition = createDefinitionWithDetachedNotice()
  definition.editorMeta = {
    layout: 'wide',
    laneCollapsed: true,
  }
  definition.ext = {
    owner: 'approval-design',
  }
  return definition
}

const createFakeInitialState = (nodeStore, flowId) => {
  const startNode = new MiddleStartNode('发起节点', 'start-fake', [], null)
  const approvalNode = new MiddleApprovalNode('单签', '审批节点', 'approve-fake', [], [])

  startNode.next = approvalNode
  nodeStore.set(startNode.id, startNode)
  nodeStore.set(approvalNode.id, approvalNode)

  return new MiddleWorkflowGraph('Fake Flow', flowId, 'shenpi', '#fff', '', '', '', startNode)
}

test('editor session delegates lifecycle mutations to workflow adapter', async () => {
  const calls = []
  const fakeAdapter = {
    createInitialState(nodeStore, flowId) {
      calls.push(['createInitialState', flowId])
      return createFakeInitialState(nodeStore, flowId)
    },
    updateNodeConfig(nodeStore, nodeId, patch) {
      calls.push(['updateNodeConfig', nodeId, patch.name, Object.prototype.hasOwnProperty.call(patch, 'next')])
      const node = nodeStore.get(nodeId)
      if (!node) {
        return false
      }

      Object.keys(patch).forEach((key) => {
        if (key === 'next' || key === 'pre') {
          return
        }
        node[key] = patch[key]
      })

      return true
    },
    insertNode(nodeStore, targetNodeId, nodeData) {
      calls.push(['insertNode', targetNodeId, nodeData.id])
    },
    appendBranch(nodeStore, branchNodeId) {
      calls.push(['appendBranch', branchNodeId])
    },
    async removeNode(nodeStore, nodeId) {
      calls.push(['removeNode', nodeId])
      return true
    },
  }

  const session = EditorSession.createInitial('flow-adapter', {
    workflowEditorAdapter: fakeAdapter,
  })

  assert.equal(session.getGraphState().id, 'flow-adapter')
  assert.equal(session.getNodeStore().get('start-fake').id, 'start-fake')
  assert.equal(session.getRevision(), 0)
  assert.deepEqual(calls[0], ['createInitialState', 'flow-adapter'])

  session.updateNodeConfig('approve-fake', {
    id: 'ignored-id',
    name: '更新后的审批节点',
    next: {
      id: 'ignored-next',
    },
  })
  assert.equal(session.getRevision(), 1)
  assert.equal(session.getNodeStore().get('approve-fake').name, '更新后的审批节点')
  assert.equal(session.getNodeStore().get('approve-fake').next, null)

  session.addNode('approve-fake', {
    id: 'approval-fake',
    name: '等待处理',
    type: 'ApprovalNode',
  })
  assert.equal(session.getRevision(), 2)
  session.addBranch('approve-fake')
  assert.equal(session.getRevision(), 3)
  await session.deleteNode('approve-fake')
  assert.equal(session.getRevision(), 4)

  assert.deepEqual(calls.slice(1), [
    ['updateNodeConfig', 'approve-fake', '更新后的审批节点', true],
    ['insertNode', 'approve-fake', 'approval-fake'],
    ['appendBranch', 'approve-fake'],
    ['removeNode', 'approve-fake'],
  ])
})

test('editor session keeps V2 branch definitions flattened and preserves the explicit end node', () => {
  const session = EditorSession.createFromDefinition(
    JSON.parse(JSON.stringify(v2BranchDefinitionFixture))
  )
  const definition = session.getDefinition()

  assert.equal(definition.nodes.some((node) => node.type === '分流节点'), false)
  assert.equal(definition.nodes.some((node) => node.type === 'EndNode'), true)
  assert.equal(definition.edges.every((edge) => edge.type === 'SEQUENCE'), true)
  assert.deepEqual(
    definition.edges
      .filter((edge) => edge.sourceId === 'start-b' && edge.condition)
      .map((edge) => edge.sourceId),
    ['start-b', 'start-b', 'start-b']
  )
})

test('editor session preserves detached definition nodes across adapter-backed syncs', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.updateNodeConfig('approve-a', {
    name: '经理审批（更新）',
  })

  const definition = session.getDefinition()
  const detachedNode = definition.nodes.find((node) => node.id === 'notice-detached')
  const updatedApprovalNode = definition.nodes.find((node) => node.id === 'approve-a')

  assert.ok(detachedNode, 'detached node should survive middle-graph sync')
  assert.equal(detachedNode.name, '自由通知')
  assert.equal(updatedApprovalNode.name, '经理审批（更新）')
  assert.deepEqual(definition.editorLayout.nodePositions['notice-detached'], { x: 780, y: 220 })
})

test('editor session updates metadata and detached node config against definition graph', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.updateWorkflowMeta({
    description: '更新后的流程描述',
    editorLayout: {
      nodePositions: {
        'notice-detached': { x: 860, y: 260 },
      },
      viewport: { x: -40, y: 24, zoom: 0.9 },
    },
  })
  session.updateNodeConfig('notice-detached', {
    name: '自由通知（已修改）',
  })

  const definition = session.getDefinition()
  const detachedNode = definition.nodes.find((node) => node.id === 'notice-detached')

  assert.equal(definition.description, '更新后的流程描述')
  assert.equal(detachedNode.name, '自由通知（已修改）')
  assert.deepEqual(definition.editorLayout.nodePositions['notice-detached'], { x: 860, y: 260 })
  assert.equal(definition.editorLayout.viewport, undefined)
})

test('editor session preserves unknown persisted definition shell fields across node config mutations', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithUnknownMetadata())

  session.updateNodeConfig('approve-a', {
    name: '经理审批（保留外壳）',
  })

  const definition = session.getDefinition()

  assert.equal(definition.nodes.find((node) => node.id === 'approve-a')?.name, '经理审批（保留外壳）')
  assert.deepEqual(definition.editorMeta, {
    layout: 'wide',
    laneCollapsed: true,
  })
  assert.deepEqual(definition.ext, {
    owner: 'approval-design',
  })
})

test('editor session preserves unknown persisted definition shell fields across replaceDefinition paths', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithUnknownMetadata())
  const nextDefinition = clone(session.getDefinition())

  nextDefinition.edges = nextDefinition.edges.filter((edge) => edge.id !== 'edge-2')

  session.replaceDefinition(nextDefinition)

  const definition = session.getDefinition()

  assert.equal(definition.edges.some((edge) => edge.id === 'edge-2'), false)
  assert.deepEqual(definition.editorMeta, {
    layout: 'wide',
    laneCollapsed: true,
  })
  assert.deepEqual(definition.ext, {
    owner: 'approval-design',
  })
})

test('editor session exposes history snapshot and replays node config mutations through undo/redo', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: false,
    canRedo: false,
    undoLabel: undefined,
    redoLabel: undefined,
  })

  session.updateNodeConfig('approve-a', {
    name: '经理审批（已改名）',
  })

  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: true,
    canRedo: false,
    undoLabel: '修改节点名称',
    redoLabel: undefined,
  })
  assert.equal(
    session.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批（已改名）'
  )

  assert.equal(session.undo(), true)
  assert.equal(
    session.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批'
  )
  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: false,
    canRedo: true,
    undoLabel: undefined,
    redoLabel: '修改节点名称',
  })

  assert.equal(session.redo(), true)
  assert.equal(
    session.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批（已改名）'
  )
  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: true,
    canRedo: false,
    undoLabel: '修改节点名称',
    redoLabel: undefined,
  })
})

test('editor session truncates redo history after a new mutation', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.updateNodeConfig('approve-a', {
    name: '经理审批（第一次修改）',
  })
  session.updateNodeConfig('approve-a', {
    name: '经理审批（第二次修改）',
  })

  assert.equal(session.undo(), true)
  assert.equal(
    session.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批（第一次修改）'
  )
  assert.equal(session.getHistorySnapshot().canRedo, true)

  session.updateNodeConfig('approve-a', {
    name: '经理审批（改走新分支）',
  })

  assert.equal(
    session.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批（改走新分支）'
  )
  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: true,
    canRedo: false,
    undoLabel: '修改节点名称',
    redoLabel: undefined,
  })
})

test('editor session records workflow meta mutations in the same history chain without persisting viewport browsing state', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.updateWorkflowMeta({
    name: '自由通知流程（更新）',
    description: '更新后的流程说明',
  })

  assert.deepEqual(session.getHistorySnapshot(), {
    available: true,
    canUndo: true,
    canRedo: false,
    undoLabel: '修改流程基础信息',
    redoLabel: undefined,
  })
  assert.equal(session.getDefinition().name, '自由通知流程（更新）')
  assert.equal(session.getDefinition().description, '更新后的流程说明')

  const snapshotAfterMetaUpdate = session.getHistorySnapshot()
  session.updateWorkflowMeta({
    editorLayout: {
      viewport: { x: 120, y: 80, zoom: 0.9 },
    },
  })

  assert.deepEqual(session.getHistorySnapshot(), snapshotAfterMetaUpdate)
  assert.equal(session.getDefinition().editorLayout.viewport, undefined)
})

test('editor session removes workflow meta fields patched to undefined', () => {
  const initialDefinition = createDefinitionWithDetachedNotice()
  initialDefinition.formType = 'business-model'
  initialDefinition.formKey = 'demo.order'
  const session = EditorSession.createFromDefinition(initialDefinition)

  session.updateWorkflowMeta({
    formType: undefined,
    formKey: undefined,
  })

  const definition = session.getDefinition()
  assert.equal(Object.prototype.hasOwnProperty.call(definition, 'formType'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(definition, 'formKey'), false)
})

test('editor session resets history baseline when a fresh session is rebuilt from the current definition', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.updateNodeConfig('approve-a', {
    name: '经理审批（会话内修改）',
  })

  assert.equal(session.getHistorySnapshot().canUndo, true)

  const reloadedSession = EditorSession.createFromDefinition(clone(session.getDefinition()))

  assert.deepEqual(reloadedSession.getHistorySnapshot(), {
    available: true,
    canUndo: false,
    canRedo: false,
    undoLabel: undefined,
    redoLabel: undefined,
  })
  assert.equal(
    reloadedSession.getDefinition().nodes.find((node) => node.id === 'approve-a')?.name,
    '经理审批（会话内修改）'
  )
})

test('editor session supports adding and deleting detached definition nodes', async () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.addNode(null, {
    id: 'approval-detached',
    name: '自由审批',
    type: 'ApprovalNode',
  })

  let definition = session.getDefinition()
  let detachedApproval = definition.nodes.find((node) => node.id === 'approval-detached')
  assert.ok(detachedApproval, 'detached approval node should be written into definition')
  assert.equal(detachedApproval.type, 'ApprovalNode')
  assert.equal(session.getNodeStore().has('approval-detached'), false)

  const deleted = await session.deleteNode('notice-detached')
  definition = session.getDefinition()
  detachedApproval = definition.nodes.find((node) => node.id === 'approval-detached')

  assert.equal(deleted, true)
  assert.equal(definition.nodes.some((node) => node.id === 'notice-detached'), false)
  assert.ok(detachedApproval, 'other detached nodes should remain after delete')
})

test('editor session supports adding detached end nodes from the stable palette surface', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.addNode(null, {
    id: 'end-detached',
    name: '结束',
    type: 'EndNode',
  })

  const definition = session.getDefinition()
  const detachedEndNode = definition.nodes.find((node) => node.id === 'end-detached')

  assert.ok(detachedEndNode, 'detached end node should be written into definition')
  assert.equal(detachedEndNode.type, 'EndNode')
  assert.equal(detachedEndNode.name, '结束')
})

test('editor session preserves detached cc node candidates when adding directly into definition', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.addNode(null, {
    id: 'cc-detached',
    name: '自由抄送',
    type: 'CcNode',
    candidates: [{ type: 'User', users: ['u-cc-detached'] }],
  })

  const definition = session.getDefinition()
  const detachedCcNode = definition.nodes.find((node) => node.id === 'cc-detached')

  assert.ok(detachedCcNode, 'detached cc node should be written into definition')
  assert.equal(detachedCcNode.type, 'CcNode')
  assert.deepEqual(detachedCcNode.candidates, [{ type: 'User', users: ['u-cc-detached'] }])
})

test('editor session does not persist detached branch helper nodes into V2 definition', () => {
  const session = EditorSession.createFromDefinition(createDefinitionWithDetachedNotice())

  session.addNode(null, {
    id: 'branch-detached',
    name: '条件分流',
    type: 'BranchNode',
  })

  const definition = session.getDefinition()

  assert.equal(definition.nodes.some((node) => node.id === 'branch-detached'), false)
})
