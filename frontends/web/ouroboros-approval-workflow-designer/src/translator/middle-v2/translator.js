import {
  FlowDefinitionV2,
  V2ApprovalNode,
  V2CcNode,
  V2Edge,
  V2EndNode,
  V2HandleNode,
  V2JoinNode,
  V2StartNode,
  V2SubProcessNode,
} from '../define/v2.js'
import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../define/persistedNodeTypes.js'

const buildSequenceEdgeId = (sourceId, targetId) => `seq-${sourceId}-${targetId}`
const hasExplicitBranchOrder = (order) => Number.isFinite(Number(order))

const createImplicitBranchOrderResolver = (branches) => {
  const explicitOrders = branches
    .map((branch) => branch?.order)
    .filter((order) => hasExplicitBranchOrder(order))
    .map((order) => Number(order))
  let nextImplicitOrder = explicitOrders.length ? Math.max(...explicitOrders) + 1 : 1

  return (conditionNode) => {
    if (hasExplicitBranchOrder(conditionNode?.order)) {
      return conditionNode.order
    }

    const generatedOrder = nextImplicitOrder
    nextImplicitOrder += 1
    return generatedOrder
  }
}

const createV2Node = (middleNode) => {
  switch (normalizePersistedNodeType(middleNode.type) || middleNode.type) {
    case '发起节点':
    case PERSISTED_NODE_TYPES.START:
      return new V2StartNode(
        middleNode.name,
        middleNode.id,
        middleNode.candidates,
        middleNode.permission
      )
    case '审批节点':
    case PERSISTED_NODE_TYPES.APPROVAL:
      return new V2ApprovalNode(
        middleNode.subType,
        middleNode.name,
        middleNode.id,
        middleNode.candidates,
        middleNode.multipleMode,
        middleNode.percentage,
        middleNode.permission,
        middleNode.rejectAction,
        middleNode.actions,
        middleNode.noCandidateMode,
        middleNode.reAssignUsers,
        middleNode.timeout
      )
    case '抄送节点':
    case PERSISTED_NODE_TYPES.CC:
      return new V2CcNode(middleNode.name, middleNode.id, middleNode.candidates)
    case '办理节点':
    case PERSISTED_NODE_TYPES.HANDLE:
      return new V2HandleNode(
        middleNode.name,
        middleNode.id,
        middleNode.candidates,
        middleNode.permission
      )
    case '子流程节点':
    case PERSISTED_NODE_TYPES.SUBFLOW:
      return new V2SubProcessNode(
        middleNode.name,
        middleNode.id,
        middleNode.subFlowKey || middleNode.subProcessId,
        middleNode.inParameters,
        middleNode.outParameters,
        middleNode.rejectAction
      )
    case '合并节点':
    case PERSISTED_NODE_TYPES.JOIN:
      return new V2JoinNode(middleNode.name || '合并', middleNode.id, middleNode.joinType || 'OR')
    case '结束节点':
    case PERSISTED_NODE_TYPES.END:
      return new V2EndNode(middleNode.name, middleNode.id, middleNode.outcome)
    default:
      throw new Error(`Unsupported middle node type for V2 export: ${middleNode.type}`)
  }
}

const walkMiddleNode = (middleNode, nodes, edges, visitedNodeIds, parentByNodeId, endNode, parentId = null) => {
  if (!middleNode || middleNode.type === '条件节点' || middleNode.type === '分流节点') {
    return
  }

  const existingParentId = parentByNodeId.get(middleNode.id)
  if (existingParentId === undefined) {
    parentByNodeId.set(middleNode.id, parentId)
  } else if (existingParentId !== parentId && middleNode.type !== '合并节点') {
    throw new Error(`Unsupported middle branch merge into shared node: ${middleNode.id}`)
  }

  if (visitedNodeIds.has(middleNode.id)) {
    return
  }

  visitedNodeIds.add(middleNode.id)
  nodes.push(createV2Node(middleNode))

  const nextNode = middleNode.next

  if (nextNode?.type === '分流节点') {
    const branchNode = nextNode
    const branches = branchNode.branches || []
    const resolveBranchOrder = createImplicitBranchOrderResolver(branches)

    branches.forEach((conditionNode) => {
      const targetId = conditionNode?.next?.id || endNode.id
      edges.push(
        new V2Edge(
          conditionNode.id,
          'SEQUENCE',
          middleNode.id,
          targetId,
          undefined,
          conditionNode.condition,
          conditionNode.implicitOrderEligible
            ? resolveBranchOrder(conditionNode)
            : conditionNode.order
        )
      )

      if (conditionNode?.next) {
        walkMiddleNode(conditionNode.next, nodes, edges, visitedNodeIds, parentByNodeId, endNode, conditionNode.id)
      }
    })

    if (branchNode.next) {
      edges.push(
        new V2Edge(
          buildSequenceEdgeId(middleNode.id, branchNode.next.id),
          'SEQUENCE',
          middleNode.id,
          branchNode.next.id
        )
      )
      walkMiddleNode(branchNode.next, nodes, edges, visitedNodeIds, parentByNodeId, endNode, branchNode.id)
    }

    return
  }

  if (!nextNode) {
    edges.push(new V2Edge(buildSequenceEdgeId(middleNode.id, endNode.id), 'SEQUENCE', middleNode.id, endNode.id))
    return
  }

  edges.push(new V2Edge(buildSequenceEdgeId(middleNode.id, nextNode.id), 'SEQUENCE', middleNode.id, nextNode.id))
  walkMiddleNode(nextNode, nodes, edges, visitedNodeIds, parentByNodeId, endNode, middleNode.id)
}

export const middleToDefinitionV2 = (middleWorkflowGraph) => {
  const nodes = []
  const edges = []
  const endNode = middleWorkflowGraph?.endNode || {
    type: '结束节点',
    name: '结束',
    id: `end-${middleWorkflowGraph?.id || 'workflow'}`,
  }

  if (middleWorkflowGraph?.firstNode) {
    walkMiddleNode(middleWorkflowGraph.firstNode, nodes, edges, new Set(), new Map(), endNode, null)
  }

  nodes.push(createV2Node(endNode))

  return new FlowDefinitionV2(
    middleWorkflowGraph?.id,
    middleWorkflowGraph?.name,
    middleWorkflowGraph?.icon,
    middleWorkflowGraph?.color,
    middleWorkflowGraph?.category,
    middleWorkflowGraph?.description,
    middleWorkflowGraph?.formKey,
    middleWorkflowGraph?.formType,
    nodes,
    edges
  )
}
