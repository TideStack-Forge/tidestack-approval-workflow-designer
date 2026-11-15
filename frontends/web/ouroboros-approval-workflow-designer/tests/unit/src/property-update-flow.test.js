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
  MiddleEndNode,
} = require('../../../src/translator/define/middle.js')

const createTestSession = () => {
  const nodeStore = new Map()
  const startNode = new MiddleStartNode('发起节点', 'start-1', [], null)
  const approvalNode = new MiddleApprovalNode('单签', '审批节点', 'approval-1', [], [])

  startNode.next = approvalNode
  nodeStore.set(startNode.id, startNode)
  nodeStore.set(approvalNode.id, approvalNode)

  const workflow = new MiddleWorkflowGraph('Test Flow', 'test-flow', 'shenpi', '#fff', '', '', '', startNode)

  return new EditorSession({
    graphState: workflow,
    nodeStore,
    sourceFormatVersion: 2,
  })
}

test('updateNodeConfig updates node properties and increments revision', () => {
  const session = createTestSession()
  const initialRevision = session.getRevision()

  const result = session.updateNodeConfig('approval-1', { name: '更新后的审批节点' })

  assert.strictEqual(result, session, 'updateNodeConfig should return session for chaining')
  assert.strictEqual(session.getRevision(), initialRevision + 1, 'revision should increment')

  const updatedNode = session.getRepository().get('approval-1')
  assert.strictEqual(updatedNode.name, '更新后的审批节点', 'node name should be updated')
})

test('updateNodeConfig returns session without incrementing revision when no change', () => {
  const session = createTestSession()
  const initialRevision = session.getRevision()

  const result = session.updateNodeConfig('nonexistent-node', { name: 'Test' })

  assert.strictEqual(result, session, 'should return session even when node not found')
  assert.strictEqual(session.getRevision(), initialRevision, 'revision should not increment for failed update')
})

test('updateNodeConfig updates multiple properties', () => {
  const session = createTestSession()

  session.updateNodeConfig('approval-1', {
    name: '新名称',
    approvalType: '会签',
  })

  const updatedNode = session.getRepository().get('approval-1')
  assert.strictEqual(updatedNode.name, '新名称', 'name should be updated')
  assert.strictEqual(updatedNode.approvalType, '会签', 'approvalType should be updated')
})

test('updateNodeConfig preserves node structure', () => {
  const session = createTestSession()
  const originalNode = session.getRepository().get('approval-1')
  const originalNext = originalNode.next

  session.updateNodeConfig('approval-1', { name: '新名称' })

  const updatedNode = session.getRepository().get('approval-1')
  assert.strictEqual(updatedNode.next, originalNext, 'next pointer should be preserved')
  assert.strictEqual(updatedNode.type, originalNode.type, 'type should be preserved')
  assert.strictEqual(updatedNode.id, originalNode.id, 'id should be preserved')
})

test('updateNodeConfig does not allow renaming start node', () => {
  const session = createTestSession()

  session.updateNodeConfig('start-1', { name: '新发起名称' })

  const updatedNode = session.getRepository().get('start-1')
  assert.strictEqual(updatedNode.name, '发起节点', 'start node name should stay fixed')
})

test('updateNodeConfig does not allow renaming end node', () => {
  const session = createTestSession()
  const nodeStore = session.getRepository()
  const approvalNode = nodeStore.get('approval-1')
  const endNode = new MiddleEndNode('结束', 'end-1', [])

  approvalNode.next = endNode
  nodeStore.set(endNode.id, endNode)

  session.updateNodeConfig('end-1', { name: '新的结束名称' })

  const updatedNode = session.getRepository().get('end-1')
  assert.strictEqual(updatedNode.name, '结束', 'end node name should stay fixed')
})

test('updateNodeConfig syncs definition after update', () => {
  const session = createTestSession()
  const initialDefinition = session.getDefinition()

  session.updateNodeConfig('approval-1', { name: '同步测试' })

  const updatedDefinition = session.getDefinition()
  assert.ok(updatedDefinition, 'definition should exist')
  assert.notStrictEqual(updatedDefinition, initialDefinition, 'definition should be regenerated')
})

test('property update flow with session mutations', () => {
  const session = createTestSession()
  const changes = []

  const mockOnSessionChange = (updatedSession) => {
    changes.push(updatedSession.getRevision())
  }

  const updateNode = (nodeId, properties) => {
    if (!session || !nodeId || !properties) {
      return false
    }
    session.updateNodeConfig(nodeId, properties)
    mockOnSessionChange(session)
    return true
  }

  const result = updateNode('approval-1', { name: '属性更新测试' })

  assert.strictEqual(result, true, 'updateNode should return true on success')
  assert.strictEqual(changes.length, 1, 'onSessionChange should be called once')
  assert.ok(changes[0] > 0, 'revision should be incremented')

  const updatedNode = session.getRepository().get('approval-1')
  assert.strictEqual(updatedNode.name, '属性更新测试', 'node should be updated')
})

test('property update flow handles invalid inputs', () => {
  const session = createTestSession()

  const updateNode = (nodeId, properties) => {
    if (!session || !nodeId || !properties) {
      return false
    }
    session.updateNodeConfig(nodeId, properties)
    return true
  }

  assert.strictEqual(updateNode(null, { name: 'Test' }), false, 'should return false for null nodeId')
  assert.strictEqual(updateNode('approval-1', null), false, 'should return false for null properties')
  assert.strictEqual(updateNode('', { name: 'Test' }), false, 'should return false for empty nodeId')
})
