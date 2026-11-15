const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})
const {
  DEFINITION_FORMAT_APPROVAL_METADATA,
  detectDefinitionFormat,
  createDefinitionRequestSource,
  definitionToMiddle,
  definitionV2ToMetadata,
  metadataToDefinitionV2,
  middleToDefinitionV2,
  shouldNotifyV1Upgrade,
} = require('../../../src/translator/definition-format/index.js')
const { EditorSession } = require('../../../src/editor-session/index.js')
const { middleToReactFlow } = require('../../../src/canvas-adapters/react-flow/index.js')
const { reactFlowToDefinitionV2 } = require('../../../src/canvas-adapters/react-flow/reactFlowToDefinitionV2.js')
const {
  v1DefinitionFixture,
  v2DefinitionFixture,
  v2BranchDefinitionFixture,
  legacyBranchEdgeDefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')
const {
  MiddleWorkflowGraph,
  MiddleStartNode,
  MiddleBranchNode,
  MiddleConditionNode,
  MiddleEndNode,
  MiddleJoinNode,
  MiddleSubProcess,
} = require('../../../src/translator/define/middle.js')

test('definition format adapters preserve legacy and V2 workflow behavior', () => {

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const v1Definition = deepClone(v1DefinitionFixture)
const v2Definition = deepClone(v2DefinitionFixture)
const v2BranchDefinition = deepClone(v2BranchDefinitionFixture)
const legacyBranchEdgeDefinition = deepClone(legacyBranchEdgeDefinitionFixture)

const v2InvalidMergeDefinition = {
  formatVersion: 2,
  id: 'flow-v2-invalid-merge',
  name: '非法合流流程',
  formType: 'default',
  formKey: 'purchase',
  nodes: [
    { id: 'start-c', type: '发起节点', name: '发起节点' },
    { id: 'fork-c', type: '分流节点', name: '条件分流', logic: 'exclusive' },
    { id: 'branch-approve-c', type: '审批节点', name: '分支审批', subType: '单签', candidates: [] },
    { id: 'after-c', type: '审批节点', name: '后续审批', subType: '单签', candidates: [] },
  ],
  edges: [
    { id: 'edge-c-1', type: 'SEQUENCE', sourceId: 'start-c', targetId: 'fork-c' },
    {
      id: 'edge-c-2',
      type: 'BRANCH',
      sourceId: 'fork-c',
      targetId: 'branch-approve-c',
      name: '命中分支',
      condition: {
        conjunction: 'and',
        children: [{ left: { type: 'field', field: 'flag' }, op: 'equal', right: true }],
      },
      order: 1,
    },
    { id: 'edge-c-3', type: 'SEQUENCE', sourceId: 'branch-approve-c', targetId: 'after-c' },
    { id: 'edge-c-4', type: 'CONTINUE', sourceId: 'fork-c', targetId: 'after-c' },
  ],
}

const approvalMetadataDefinition = {
  formatVersion: 1,
  name: 'expense-approval',
  title: '费用审批',
  description: '费用申请审批流程',
  version: 7,
  enabled: false,
  form: {
    formType: 'business-model',
    formId: 'demo.expense',
  },
  editorLayout: {
    nodePositions: {
      'expense-approval-start': { x: 0, y: 0 },
      'expense-approval-end': { x: 240, y: 0 },
    },
  },
  nodes: [
    { id: 'expense-approval-start', type: 'StartNode', name: '发起节点' },
    { id: 'expense-approval-end', type: 'EndNode', name: '结束' },
  ],
  edges: [
    {
      id: 'expense-approval-edge',
      type: 'SEQUENCE',
      sourceId: 'expense-approval-start',
      targetId: 'expense-approval-end',
    },
  ],
}

assert.equal(detectDefinitionFormat(v1Definition), 1)
assert.equal(detectDefinitionFormat({ formatVersion: 1 }), 1)
assert.equal(detectDefinitionFormat(approvalMetadataDefinition), DEFINITION_FORMAT_APPROVAL_METADATA)
assert.equal(detectDefinitionFormat(v2Definition), 2)
assert.equal(detectDefinitionFormat({ formatVersion: '' }), 1)
assert.equal(detectDefinitionFormat({ formatVersion: '   ' }), 1)
assert.throws(
  () => detectDefinitionFormat({ formatVersion: 3 }),
  /Unsupported definition formatVersion: 3/
)
assert.equal(
  createDefinitionRequestSource({ method: 'get', url: '/api/approval-workflow/definition/flow-v1' }).url,
  '/api/approval-workflow/definition/flow-v1'
)
assert.equal(
  createDefinitionRequestSource('/api/approval-workflow/definition/flow-v1?formatVersion=1'),
  '/api/approval-workflow/definition/flow-v1?formatVersion=1'
)
assert.equal(
  createDefinitionRequestSource(
    '/api/approval-workflow/definition/flow-v1?foo=bar&formatVersion=1&baz=qux'
  ),
  '/api/approval-workflow/definition/flow-v1?foo=bar&formatVersion=1&baz=qux'
)
assert.equal(
  createDefinitionRequestSource({
    method: 'get',
    url: '/api/approval-workflow/definition/flow-v1?foo=bar&formatVersion=1&baz=qux',
  }).url,
  '/api/approval-workflow/definition/flow-v1?foo=bar&formatVersion=1&baz=qux'
)
assert.equal(
  createDefinitionRequestSource({
    method: 'get',
    url: '/api/approval-workflow/definition/flow-legacy',
  }).url,
  '/api/approval-workflow/definition/flow-legacy'
)

const sourceWithoutUrl = { method: 'get', data: { keep: true } }
assert.strictEqual(createDefinitionRequestSource(sourceWithoutUrl), sourceWithoutUrl)

const loaded = definitionToMiddle(v2Definition)
const startNode = loaded.middleWorkflowGraph.firstNode

assert.equal(loaded.sourceFormatVersion, 2)
assert.equal(startNode.type, '发起节点')
assert.equal(startNode.id, 'start-a')
assert.equal(startNode.next.id, 'approve-a')
assert.equal(loaded.middleNodeRepository.get('approve-a').type, '审批节点')
assert.equal(loaded.middleWorkflowGraph.formType, 'customForm')

const metadataRuntimeDefinition = metadataToDefinitionV2(approvalMetadataDefinition)
assert.equal(metadataRuntimeDefinition.formatVersion, 2)
assert.equal(metadataRuntimeDefinition.id, 'expense-approval')
assert.equal(metadataRuntimeDefinition.name, '费用审批')
assert.equal(metadataRuntimeDefinition.formType, 'business-model')
assert.equal(metadataRuntimeDefinition.formKey, 'demo.expense')

const metadataRoundTrip = definitionV2ToMetadata(metadataRuntimeDefinition, approvalMetadataDefinition)
assert.equal(metadataRoundTrip.formatVersion, 1)
assert.equal(metadataRoundTrip.name, 'expense-approval')
assert.equal(metadataRoundTrip.title, '费用审批')
assert.equal(metadataRoundTrip.version, 7)
assert.equal(metadataRoundTrip.enabled, false)
assert.equal(metadataRoundTrip.form.formType, 'business-model')
assert.equal(metadataRoundTrip.form.formId, 'demo.expense')
assert.equal(Object.prototype.hasOwnProperty.call(metadataRoundTrip, 'id'), false)
assert.equal(Object.prototype.hasOwnProperty.call(metadataRoundTrip, 'formType'), false)
assert.equal(Object.prototype.hasOwnProperty.call(metadataRoundTrip, 'formKey'), false)

const loadedMetadata = definitionToMiddle(approvalMetadataDefinition)
assert.equal(loadedMetadata.sourceFormatVersion, DEFINITION_FORMAT_APPROVAL_METADATA)
assert.equal(loadedMetadata.editorDefinition.id, 'expense-approval')
assert.equal(loadedMetadata.editorDefinition.formKey, 'demo.expense')

const loadedJoin = definitionToMiddle({
  formatVersion: 2,
  id: 'flow-v2-join',
  name: '显式 OR 合并流程',
  formType: 'default',
  formKey: 'purchase',
  nodes: [
    { id: 'start-j', type: '发起节点', name: '发起节点' },
    { id: 'approve-j-1', type: '审批节点', name: '审批 A', subType: '单签', candidates: [] },
    { id: 'approve-j-2', type: '审批节点', name: '审批 B', subType: '单签', candidates: [] },
    { id: 'join-j', type: '合并节点', name: '合并', joinType: 'OR' },
    { id: 'end-j', type: '结束节点', name: '结束' },
  ],
  edges: [
    { id: 'edge-j-1', type: 'SEQUENCE', sourceId: 'start-j', targetId: 'approve-j-1' },
    { id: 'edge-j-2', type: 'SEQUENCE', sourceId: 'start-j', targetId: 'approve-j-2' },
    { id: 'edge-j-3', type: 'SEQUENCE', sourceId: 'approve-j-1', targetId: 'join-j' },
    { id: 'edge-j-4', type: 'SEQUENCE', sourceId: 'approve-j-2', targetId: 'join-j' },
    { id: 'edge-j-5', type: 'SEQUENCE', sourceId: 'join-j', targetId: 'end-j' },
  ],
})
const loadedJoinNode = loadedJoin.middleNodeRepository.get('join-j')

assert.equal(loadedJoinNode.type, '合并节点')
assert.equal(loadedJoinNode.joinType, 'OR')
assert.deepEqual(loadedJoinNode.incoming.sort(), ['approve-j-1', 'approve-j-2'])
assert.equal(loadedJoinNode.next, null)

const loadedBranch = definitionToMiddle(legacyBranchEdgeDefinition)
const forkNode = loadedBranch.middleWorkflowGraph.firstNode.next
const highAmountCondition = forkNode.branches.find((branch) => branch.id === 'edge-b-2')
const lowAmountCondition = forkNode.branches.find((branch) => branch.id === 'edge-b-3')
const fallbackCondition = forkNode.branches.find((branch) => branch.id === 'edge-b-6')
const highAmountConditionFixture = legacyBranchEdgeDefinition.edges.find((edge) => edge.id === 'edge-b-2')
const lowAmountConditionFixture = legacyBranchEdgeDefinition.edges.find((edge) => edge.id === 'edge-b-3')
const fallbackConditionFixture = legacyBranchEdgeDefinition.edges.find((edge) => edge.id === 'edge-b-6')

assert.equal(forkNode.type, '分流节点')
assert.equal(forkNode.logic, 'exclusive')
assert.equal(forkNode.branches.length, 3)
assert.deepEqual(
  forkNode.branches.map((branch) => branch.id),
  ['edge-b-3', 'edge-b-2', 'edge-b-6']
)
assert.equal(highAmountCondition.type, '条件节点')
assert.equal(highAmountCondition.name, '金额大于 1000')
assert.deepEqual(highAmountCondition.condition, highAmountConditionFixture.condition)
assert.equal(highAmountCondition.order, 20)
assert.equal(highAmountCondition.next.id, 'branch-approve-b')
assert.equal(highAmountCondition.next.next, null)
assert.equal(loadedBranch.middleNodeRepository.get('branch-approve-b').type, '审批节点')
assert.equal(loadedBranch.middleNodeRepository.get('branch-end-b').type, '结束节点')
assert.equal(lowAmountCondition.type, '条件节点')
assert.equal(lowAmountCondition.name, '金额不大于 1000')
assert.deepEqual(lowAmountCondition.condition, lowAmountConditionFixture.condition)
assert.equal(lowAmountCondition.order, 10)
assert.equal(lowAmountCondition.next.id, 'branch-approve-c')
assert.equal(lowAmountCondition.next.type, '审批节点')
assert.equal(lowAmountCondition.next.next, null)
assert.equal(loadedBranch.middleNodeRepository.get('branch-approve-c').type, '审批节点')
assert.equal(fallbackCondition.type, '条件节点')
assert.equal(fallbackCondition.name, '兜底通知')
assert.deepEqual(fallbackCondition.condition, fallbackConditionFixture.condition)
assert.equal(fallbackCondition.order, undefined)
assert.equal(fallbackCondition.next, null)
assert.equal(forkNode.next.id, 'after-b')

const loadedV1 = definitionToMiddle(v1Definition)

assert.equal(loadedV1.sourceFormatVersion, 1)
assert.equal(shouldNotifyV1Upgrade(v1Definition, false), true)
assert.equal(shouldNotifyV1Upgrade(v2Definition, false), false)
assert.equal(shouldNotifyV1Upgrade(v1Definition, true), false)

assert.throws(
  () => definitionToMiddle(v2InvalidMergeDefinition),
  /Unsupported V2 branch merge into shared node: after-c/
)

const upgradedFromV1 = middleToDefinitionV2(definitionToMiddle(v1Definition).middleWorkflowGraph)
assert.equal(upgradedFromV1.formatVersion, 2)
assert.equal(upgradedFromV1.formType, 'default')
assert.ok(upgradedFromV1.edges.some((edge) => edge.type === 'SEQUENCE'))

const upgradedFromV2 = middleToDefinitionV2(loaded.middleWorkflowGraph)
assert.equal(upgradedFromV2.formType, 'customForm')

const upgradedSession = EditorSession.createFromDefinition(v1Definition)

assert.equal(upgradedSession.getSourceFormatVersion(), 1)
assert.equal(upgradedSession.getDefinition().formatVersion, 2)
assert.equal(upgradedSession.shouldNotifyUpgrade(false), true)
assert.equal(upgradedSession.shouldNotifyUpgrade(true), false)

const initialSession = EditorSession.createInitial('flow-initial')

assert.equal(initialSession.getGraphState().id, 'flow-initial')
assert.strictEqual(initialSession.getGraphState(), initialSession.getWorkflow())
assert.strictEqual(initialSession.getNodeStore(), initialSession.getRepository())
assert.ok(initialSession.getNodeStore().has(initialSession.getGraphState().firstNode.id))
assert.equal(initialSession.getRevision(), 0)

const initialApprovalNodeId = initialSession.getGraphState().firstNode.next.id
initialSession.updateNodeConfig(initialApprovalNodeId, {
  name: '初始审批节点',
  next: {
    id: 'unexpected-next',
  },
})

assert.equal(initialSession.getRevision(), 1)
assert.equal(initialSession.getNodeStore().get(initialApprovalNodeId).name, '初始审批节点')
assert.equal(initialSession.getGraphState().firstNode.next.id, initialApprovalNodeId)

upgradedSession.updateWorkflowMeta({
  name: '升级后的流程',
  category: 'finance',
  formKey: 'expense',
})

assert.equal(upgradedSession.getDefinition().name, '升级后的流程')
assert.equal(upgradedSession.getDefinition().category, 'finance')
assert.equal(upgradedSession.getWorkflow().formKey, 'expense')

const insertSession = EditorSession.createFromDefinition(v2Definition)
assert.equal(insertSession.getRevision(), 0)
insertSession.addNode('start-a', {
  type: 'ApprovalNode',
  id: 'approval-insert',
  name: '等待审批',
})

assert.equal(insertSession.getRevision(), 1)
assert.equal(insertSession.getWorkflow().firstNode.next.id, 'approval-insert')
assert.equal(insertSession.getWorkflow().firstNode.next.next.id, 'approve-a')
assert.ok(
  insertSession
    .getDefinition()
    .edges.some(
      (edge) =>
        edge.type === 'SEQUENCE' &&
        edge.sourceId === 'start-a' &&
        edge.targetId === 'approval-insert'
    )
)

const branchSession = EditorSession.createFromDefinition(v2BranchDefinition)
assert.equal(branchSession.getRevision(), 0)
assert.equal(branchSession.getDefinition().nodes.some((node) => node.type === '分流节点'), false)
assert.equal(branchSession.getDefinition().nodes.some((node) => node.type === 'EndNode'), true)
assert.equal(
  branchSession.getDefinition().edges.filter((edge) => edge.type === 'SEQUENCE' && edge.sourceId === 'start-b' && edge.condition).length,
  3
)

const canvasData = middleToReactFlow(
  insertSession.getWorkflow(),
  insertSession.getDefinition().editorLayout
)

assert.ok(Array.isArray(canvasData.nodes))
assert.ok(Array.isArray(canvasData.edges))
assert.ok(canvasData.nodes.some((node) => node.id === 'approval-insert'))
assert.ok(canvasData.nodes.some((node) => node.id === 'end-a'))
assert.ok(canvasData.edges.some((edge) => edge.source === 'start-a' && edge.target === 'approval-insert'))

const roundTripV2 = middleToDefinitionV2(loadedBranch.middleWorkflowGraph)
const exportedStartSequenceEdge = roundTripV2.edges.find(
  (edge) =>
    edge.type === 'SEQUENCE' &&
    edge.sourceId === 'start-b' &&
    edge.targetId === 'after-b' &&
    !edge.condition
)
const exportedHighBranchEdge = roundTripV2.edges.find((edge) => edge.id === 'edge-b-2')
const exportedLowBranchEdge = roundTripV2.edges.find((edge) => edge.id === 'edge-b-3')
const exportedFallbackBranchEdge = roundTripV2.edges.find((edge) => edge.id === 'edge-b-6')
const exportedBranchSequenceEdge = roundTripV2.edges.find(
  (edge) => edge.type === 'SEQUENCE' && edge.sourceId === 'branch-approve-b'
)
const exportedEndNode = roundTripV2.nodes.find((node) => node.id === 'branch-end-b')

assert.equal(roundTripV2.formatVersion, 2)
assert.equal(roundTripV2.formType, 'default')
assert.ok(exportedStartSequenceEdge)
assert.ok(exportedHighBranchEdge)
assert.ok(exportedLowBranchEdge)
assert.ok(exportedFallbackBranchEdge)
assert.ok(exportedBranchSequenceEdge)
assert.ok(exportedEndNode)
assert.equal(exportedEndNode.outcome, undefined)
assert.equal(exportedHighBranchEdge.name, undefined)
assert.deepEqual(exportedHighBranchEdge.condition, highAmountConditionFixture.condition)
assert.equal(exportedHighBranchEdge.order, 20)
assert.equal(exportedHighBranchEdge.id, 'edge-b-2')
assert.equal(exportedLowBranchEdge.name, undefined)
assert.deepEqual(exportedLowBranchEdge.condition, lowAmountConditionFixture.condition)
assert.equal(exportedLowBranchEdge.order, 10)
assert.equal(exportedLowBranchEdge.id, 'edge-b-3')
assert.equal(exportedFallbackBranchEdge.name, undefined)
assert.deepEqual(exportedFallbackBranchEdge.condition, fallbackConditionFixture.condition)
assert.equal(exportedFallbackBranchEdge.order, 21)
assert.equal(exportedFallbackBranchEdge.id, 'edge-b-6')
assert.equal(exportedStartSequenceEdge.id, 'seq-start-b-after-b')
assert.equal(exportedBranchSequenceEdge.id, 'seq-branch-approve-b-branch-end-b')
assert.equal(roundTripV2.nodes.some((node) => node.type === '分流节点'), false)
assert.equal(roundTripV2.edges.every((edge) => edge.type === 'SEQUENCE'), true)

const newWorkflowSession = EditorSession.createInitial('flow-new')
const newDefinition = newWorkflowSession.getDefinition()
const newPersistedDefinition = newWorkflowSession.getPersistedDefinition()

assert.equal(newDefinition.formatVersion, 2)
assert.equal(newDefinition.id, 'flow-new')
assert.equal(newDefinition.formType, undefined)
assert.equal(newDefinition.color, undefined)
assert.ok(newDefinition.nodes.find((node) => node.type === 'StartNode'))
assert.ok(newDefinition.nodes.find((node) => node.type === 'EndNode'))
assert.ok(newDefinition.edges.find((edge) => edge.sourceId && edge.targetId))
assert.equal(newWorkflowSession.getRevision(), 0)
assert.equal(newWorkflowSession.getSourceFormatVersion(), DEFINITION_FORMAT_APPROVAL_METADATA)
assert.equal(newPersistedDefinition.formatVersion, 1)
assert.equal(newPersistedDefinition.name, 'flow-new')
assert.equal(newPersistedDefinition.title, '新审批流')
assert.equal(Object.prototype.hasOwnProperty.call(newPersistedDefinition, 'id'), false)
assert.equal(Object.prototype.hasOwnProperty.call(newPersistedDefinition, 'formType'), false)
assert.equal(Object.prototype.hasOwnProperty.call(newPersistedDefinition, 'formKey'), false)

const subflowStartNode = new MiddleStartNode('发起节点', 'start-subflow', [], null)
const subflowNode = new MiddleSubProcess('调用子流程', 'subflow-a', 'child-flow', [], [], 'reject', null)
subflowStartNode.next = subflowNode
const subflowWorkflow = new MiddleWorkflowGraph(
  '子流程导出',
  'flow-subflow',
  'shenpi',
  'rgba(255, 69, 0, 0.68)',
  '',
  '',
  'purchase',
  subflowStartNode
)
subflowWorkflow.endNode = new MiddleEndNode('结束', 'end-subflow')
const subflowDefinition = middleToDefinitionV2(subflowWorkflow)
const exportedSubflowNode = subflowDefinition.nodes.find((node) => node.id === 'subflow-a')

assert.equal(exportedSubflowNode.subFlowKey, 'child-flow')
assert.equal(exportedSubflowNode.subProcessId, undefined)

const reactFlowDefinition = reactFlowToDefinitionV2(
  [
    {
      id: 'end-rf',
      type: 'end',
      data: {
        name: '结束节点',
        outcome: 'rejected',
      },
    },
  ],
  [],
  {
    id: 'rf-flow',
    name: 'RF 导出',
    formKey: 'purchase',
  }
)
assert.equal(reactFlowDefinition.formType, undefined)
assert.equal(reactFlowDefinition.nodes[0].outcome, 'rejected')
assert.equal(Object.prototype.hasOwnProperty.call(reactFlowDefinition.nodes[0], 'notice'), false)
assert.equal(Object.prototype.hasOwnProperty.call(reactFlowDefinition.nodes[0], 'timer'), false)

const reactFlowUnboundDefinition = reactFlowToDefinitionV2(
  [
    {
      id: 'approve-rf',
      type: 'approval',
      data: {
        name: '审批节点',
        subType: '单签',
        candidates: [],
      },
    },
  ],
  [],
  {
    id: 'rf-unbound',
    name: '未绑定流程',
    formType: 'default',
    formKey: '',
  }
)

assert.equal(reactFlowUnboundDefinition.formType, undefined)
assert.equal(reactFlowUnboundDefinition.formKey, undefined)

const mergeStartNode = new MiddleStartNode('发起节点', 'start-merge', [], null)
const mergeForkNode = new MiddleBranchNode('条件分流', 'fork-merge', 'exclusive', [], null)
const mergeHighCondition = new MiddleConditionNode(
  '高优先级',
  'cond-merge-1',
  { conjunction: 'and', children: [{ left: { type: 'field', field: 'flag' }, op: 'equal', right: 1 }] },
  null
)
const mergeLowCondition = new MiddleConditionNode(
  '低优先级',
  'cond-merge-2',
  { conjunction: 'and', children: [{ left: { type: 'field', field: 'flag' }, op: 'equal', right: 2 }] },
  null
)
const mergeSharedEnd = new MiddleEndNode('共享结束', 'end-merge')

mergeStartNode.next = mergeForkNode
mergeHighCondition.branchNodeId = mergeForkNode.id
mergeLowCondition.branchNodeId = mergeForkNode.id
mergeHighCondition.next = mergeSharedEnd
mergeLowCondition.next = mergeSharedEnd
mergeForkNode.branches.push(mergeHighCondition, mergeLowCondition)

const invalidMergeWorkflow = new MiddleWorkflowGraph(
  '非法合流导出',
  'flow-merge',
  'shenpi',
  'rgba(255, 69, 0, 0.68)',
  '',
  '',
  '',
  mergeStartNode
)

assert.throws(
  () => middleToDefinitionV2(invalidMergeWorkflow),
  /Unsupported middle branch merge into shared node: end-merge/
)

const joinMergeStartNode = new MiddleStartNode('发起节点', 'start-join-merge', [], null)
const joinMergeForkNode = new MiddleBranchNode('条件分流', 'fork-join-merge', 'exclusive', [], null)
const joinHighCondition = new MiddleConditionNode(
  '高优先级',
  'cond-join-1',
  { conjunction: 'and', children: [{ left: { type: 'field', field: 'flag' }, op: 'equal', right: 1 }] },
  null
)
const joinLowCondition = new MiddleConditionNode(
  '低优先级',
  'cond-join-2',
  { conjunction: 'and', children: [{ left: { type: 'field', field: 'flag' }, op: 'equal', right: 2 }] },
  null
)
const joinNode = new MiddleJoinNode('合并', 'join-merge', 'OR', null)
const joinTailEnd = new MiddleEndNode('合并后结束', 'end-after-join')

joinMergeStartNode.next = joinMergeForkNode
joinHighCondition.branchNodeId = joinMergeForkNode.id
joinLowCondition.branchNodeId = joinMergeForkNode.id
joinHighCondition.edgeType = 'SEQUENCE'
joinHighCondition.implicitOrderEligible = false
joinLowCondition.edgeType = 'SEQUENCE'
joinLowCondition.implicitOrderEligible = false
joinHighCondition.next = joinNode
joinLowCondition.next = joinNode
joinNode.pre = 'cond-join-1'
joinNode.incoming = ['cond-join-1', 'cond-join-2']
joinNode.next = joinTailEnd
joinMergeForkNode.branches.push(joinHighCondition, joinLowCondition)

const validJoinMergeWorkflow = new MiddleWorkflowGraph(
  '合法 OR 合并导出',
  'flow-join-merge',
  'shenpi',
  'rgba(255, 69, 0, 0.68)',
  '',
  '',
  '',
  joinMergeStartNode
)
validJoinMergeWorkflow.endNode = new MiddleEndNode('结束', 'end-join-merge')

const validJoinMergeDefinition = middleToDefinitionV2(validJoinMergeWorkflow)
const exportedJoinNode = validJoinMergeDefinition.nodes.find((node) => node.id === 'join-merge')

assert.equal(exportedJoinNode.type, 'JoinNode')
assert.equal(exportedJoinNode.joinType, 'OR')
assert.equal(
  validJoinMergeDefinition.edges.filter((edge) => edge.targetId === 'join-merge').length,
  2
)
  assert.ok(
    validJoinMergeDefinition.edges.some(
      (edge) => edge.sourceId === 'join-merge' && edge.targetId === 'end-after-join'
    )
  )
})

test('cc node round-trip keeps canonical type and candidates across save and reload', () => {
  const deepClone = (value) => JSON.parse(JSON.stringify(value))

  const reactFlowNodes = [
    {
      id: 'start-cc',
      type: 'start',
      data: {
        name: '发起节点',
      },
    },
    {
      id: 'cc-1',
      type: 'cc',
      data: {
        name: '抄送节点',
        candidates: [{ type: 'User', users: ['u-cc-1'] }],
      },
    },
    {
      id: 'end-cc',
      type: 'end',
      data: {
        name: '结束',
      },
    },
  ]

  const reactFlowEdges = [
    { id: 'edge-cc-1', source: 'start-cc', target: 'cc-1', data: {} },
    { id: 'edge-cc-2', source: 'cc-1', target: 'end-cc', data: {} },
  ]

  const savedDefinition = reactFlowToDefinitionV2(reactFlowNodes, reactFlowEdges, {
    id: 'flow-cc',
    name: '抄送流程',
    formType: 'default',
    formKey: 'purchase',
  })

  const savedCcNode = savedDefinition.nodes.find((node) => node.id === 'cc-1')
  assert.equal(savedCcNode.type, 'CcNode')
  assert.deepEqual(savedCcNode.candidates, [{ type: 'User', users: ['u-cc-1'] }])

  const session = EditorSession.createFromDefinition(deepClone(savedDefinition))
  const canvasData = middleToReactFlow(
    session.getWorkflow(),
    session.getDefinition().editorLayout
  )
  const reloadedCcNode = canvasData.nodes.find((node) => node.id === 'cc-1')

  assert.equal(reloadedCcNode.type, 'cc')
  assert.deepEqual(reloadedCcNode.data.candidates, [{ type: 'User', users: ['u-cc-1'] }])
})

test('explicit end node and edge branches follow serialization contracts', () => {
  const session = EditorSession.createFromDefinition(
    JSON.parse(JSON.stringify(v2BranchDefinitionFixture))
  )
  const canvasData = middleToReactFlow(
    session.getWorkflow(),
    session.getDefinition().editorLayout
  )
  const definition = session.getDefinition()

  assert.ok(canvasData.nodes.some((node) => node.type === 'end'))
  assert.equal(canvasData.nodes.some((node) => node.type === 'condition'), false)
  assert.equal(definition.nodes.some((node) => node.type === 'EndNode'), true)
  assert.equal(definition.nodes.some((node) => node.type === '分流节点'), false)
  assert.equal(definition.edges.every((edge) => edge.type === 'SEQUENCE'), true)

  const branchNode = session.getWorkflow().firstNode.next
  const conditionNodeIds = branchNode.branches.map((branch) => branch.id)

  conditionNodeIds.forEach((conditionNodeId) => {
    assert.ok(
        definition.edges.some(
        (edge) => edge.type === 'SEQUENCE' && edge.id === conditionNodeId
      )
    )
  })
})
