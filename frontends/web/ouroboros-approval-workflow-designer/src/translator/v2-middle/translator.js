import {
  MiddleWorkflowGraph,
  MiddleStartNode,
  MiddleApprovalNode,
  MiddleCcNode,
  MiddleHandleNode,
  MiddleSubProcess,
  MiddleBranchNode,
  MiddleJoinNode,
  MiddleConditionNode,
  MiddleEndNode,
} from '../define/middle.js'
import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../define/persistedNodeTypes.js'

const INTERNAL_BRANCH_PREFIX = '__branch__:'

const edgeHasBranchMetadata = (edge) => {
  return Boolean(edge?.condition) || Number.isFinite(Number(edge?.order))
}

const hasExplicitEdgeOrder = (edge) => Number.isFinite(Number(edge?.order))

const sortOutgoingEdges = (edges = []) => {
  return [...edges].sort((left, right) => {
    const leftHasOrder = hasExplicitEdgeOrder(left)
    const rightHasOrder = hasExplicitEdgeOrder(right)

    if (leftHasOrder && rightHasOrder && Number(left.order) !== Number(right.order)) {
      return Number(left.order) - Number(right.order)
    }

    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1
    }

    return left._originalIndex - right._originalIndex
  })
}

const createLookupMaps = (definition) => {
  const nodeById = new Map()
  const outgoingEdgesBySourceId = new Map()

  ;(definition?.nodes || []).forEach((node) => {
    nodeById.set(node.id, node)
  })

  ;(definition?.edges || []).forEach((edge, index) => {
    const normalizedEdge = {
      ...edge,
      _originalIndex: index,
    }
    const outgoingEdges = outgoingEdgesBySourceId.get(edge.sourceId) || []
    outgoingEdges.push(normalizedEdge)
    outgoingEdgesBySourceId.set(edge.sourceId, outgoingEdges)
  })

  for (const [sourceId, outgoingEdges] of outgoingEdgesBySourceId.entries()) {
    outgoingEdgesBySourceId.set(sourceId, sortOutgoingEdges(outgoingEdges))
  }

  return {
    nodeById,
    outgoingEdgesBySourceId,
  }
}

const findStartNodeId = (nodeById) => {
  for (const node of nodeById.values()) {
    if (normalizePersistedNodeType(node.type) === PERSISTED_NODE_TYPES.START) {
      return node.id
    }
  }
  return null
}

const findEndNode = (nodeById, definition) => {
  for (const node of nodeById.values()) {
    if (normalizePersistedNodeType(node.type) === PERSISTED_NODE_TYPES.END) {
      return new MiddleEndNode(node.name || '结束', node.id, node.outcome)
    }
  }

  return new MiddleEndNode('结束', `end-${definition?.id || 'workflow'}`)
}

const markInBranch = (middleNode, inBranch) => {
  if (inBranch && middleNode && Object.prototype.hasOwnProperty.call(middleNode, 'inBranch')) {
    middleNode.inBranch = '1'
  }
}

const resolveConditionNodeName = (edge) => edge?.name || '分支条件'

const createMiddleNode = (node) => {
  switch (normalizePersistedNodeType(node.type)) {
    case PERSISTED_NODE_TYPES.START:
      return new MiddleStartNode(node.name, node.id, node.permission, null)
    case PERSISTED_NODE_TYPES.APPROVAL:
      return new MiddleApprovalNode(
        node.subType,
        node.name,
        node.id,
        node.candidates,
        node.permission,
        node.multipleMode,
        node.percentage,
        node.rejectAction,
        null,
        node.actions,
        node.noCandidateMode,
        node.reAssignUsers,
        node.timeout
      )
    case PERSISTED_NODE_TYPES.CC:
      return new MiddleCcNode(node.name, node.id, node.candidates, null)
    case PERSISTED_NODE_TYPES.HANDLE:
      return new MiddleHandleNode(node.name, node.id, node.candidates, node.permission, null)
    case PERSISTED_NODE_TYPES.SUBFLOW:
      return new MiddleSubProcess(
        node.name,
        node.id,
        node.subFlowKey || node.subProcessId,
        node.inParameters,
        node.outParameters,
        node.rejectAction,
        null
      )
    case '分流节点':
      return new MiddleBranchNode(node.name, node.id, node.logic, [], null)
    case PERSISTED_NODE_TYPES.JOIN:
      return new MiddleJoinNode(node.name || '合并', node.id, node.joinType || 'OR', null)
    default:
      throw new Error(`Unsupported V2 node type: ${node.type}`)
  }
}

const buildInternalBranchId = (nodeId) => `${INTERNAL_BRANCH_PREFIX}${nodeId}`

const isBranchLikeEdge = (edge) => {
  return edgeHasBranchMetadata(edge)
}

const resolveBranchProjection = (outgoingEdges = []) => {
  if (!outgoingEdges.length) {
    return {
      continueEdge: null,
      branchEdges: [],
    }
  }

  if (outgoingEdges.length === 1) {
    return {
      continueEdge: outgoingEdges[0],
      branchEdges: [],
    }
  }

  const explicitBranchEdges = outgoingEdges.filter(isBranchLikeEdge)
  if (explicitBranchEdges.length > 0) {
    const continueEdge = outgoingEdges.find((edge) => !isBranchLikeEdge(edge)) || null
    return {
      continueEdge,
      branchEdges: continueEdge
        ? outgoingEdges.filter((edge) => edge.id !== continueEdge.id)
        : outgoingEdges,
    }
  }

  return {
    continueEdge: outgoingEdges[0],
    branchEdges: outgoingEdges.slice(1),
  }
}

const decorateConditionNodeFromEdge = (conditionNode, edge) => {
  conditionNode.edgeType = 'SEQUENCE'
  conditionNode.implicitOrderEligible = edgeHasBranchMetadata(edge)
}

const appendJoinIncoming = (joinNode, parentId, inBranch) => {
  if (!joinNode || !parentId) {
    return
  }

  if (!Array.isArray(joinNode.incoming)) {
    joinNode.incoming = []
  }

  if (!joinNode.incoming.includes(parentId)) {
    joinNode.incoming.push(parentId)
  }

  if (!joinNode.pre) {
    joinNode.pre = parentId
  }

  if (inBranch) {
    joinNode.inBranch = '1'
  }
}

const createBuilder = (definition, middleNodeRepository, middleWorkflowGraph) => {
  const { nodeById, outgoingEdgesBySourceId } = createLookupMaps(definition)
  const endNode = findEndNode(nodeById, definition)

  middleWorkflowGraph.endNode = endNode
  middleNodeRepository.set(endNode.id, endNode)

  const buildNodeFromId = (nodeId, inBranch = false, parentId = null) => {
    if (!nodeId || nodeId === endNode.id) {
      return null
    }

    const node = nodeById.get(nodeId)
    if (!node || normalizePersistedNodeType(node.type) === PERSISTED_NODE_TYPES.END) {
      return null
    }

    const existingNode = middleNodeRepository.get(nodeId)
    if (existingNode) {
      if (existingNode.type === '合并节点') {
        appendJoinIncoming(existingNode, parentId, inBranch)
        return existingNode
      }

      throw new Error(`Unsupported V2 branch merge into shared node: ${nodeId}`)
    }

    const middleNode = createMiddleNode(node)
    markInBranch(middleNode, inBranch)
    middleNode.pre = parentId || ''
    if (middleNode.type === '合并节点') {
      appendJoinIncoming(middleNode, parentId, inBranch)
    }
    middleNodeRepository.set(nodeId, middleNode)

    const outgoingEdges = outgoingEdgesBySourceId.get(nodeId) || []
    const { continueEdge, branchEdges } = resolveBranchProjection(outgoingEdges)

    if (node.type === '分流节点') {
      branchEdges.forEach((edge) => {
        const conditionNode = new MiddleConditionNode(resolveConditionNodeName(edge), edge.id, edge.condition, null)
        conditionNode.branchNodeId = nodeId
        conditionNode.order = edge.order
        conditionNode.pre = nodeId
        decorateConditionNodeFromEdge(conditionNode, edge)
        middleNodeRepository.set(conditionNode.id, conditionNode)
        conditionNode.next = edge.targetId === endNode.id ? null : buildNodeFromId(edge.targetId, true, conditionNode.id)
        middleNode.branches.push(conditionNode)
      })

      middleNode.next = continueEdge && continueEdge.targetId !== endNode.id
        ? buildNodeFromId(continueEdge.targetId, inBranch, nodeId)
        : null
      return middleNode
    }

    if (branchEdges.length > 0) {
      const branchNodeId = buildInternalBranchId(nodeId)
      const branchNode = new MiddleBranchNode('条件分流', branchNodeId, 'exclusive', [], null)
      branchNode.pre = nodeId
      branchNode.inBranch = inBranch ? '1' : '0'
      middleNodeRepository.set(branchNode.id, branchNode)
      middleNode.next = branchNode

      branchEdges.forEach((edge) => {
        const conditionNode = new MiddleConditionNode(resolveConditionNodeName(edge), edge.id, edge.condition, null)
        conditionNode.branchNodeId = branchNode.id
        conditionNode.order = edge.order
        conditionNode.pre = branchNode.id
        decorateConditionNodeFromEdge(conditionNode, edge)
        middleNodeRepository.set(conditionNode.id, conditionNode)
        conditionNode.next = edge.targetId === endNode.id ? null : buildNodeFromId(edge.targetId, true, conditionNode.id)
        branchNode.branches.push(conditionNode)
      })

      branchNode.next = continueEdge && continueEdge.targetId !== endNode.id
        ? buildNodeFromId(continueEdge.targetId, inBranch, branchNode.id)
        : null
      return middleNode
    }

    middleNode.next = continueEdge && continueEdge.targetId !== endNode.id
      ? buildNodeFromId(continueEdge.targetId, inBranch, nodeId)
      : null

    return middleNode
  }

  const startNodeId = findStartNodeId(nodeById)
  middleWorkflowGraph.firstNode = buildNodeFromId(startNodeId, false, null)
}

export const v2ToMiddleTranslator = (definition) => {
  const middleWorkflowGraph = new MiddleWorkflowGraph(
    definition.name,
    definition.id,
    definition.icon,
    definition.color,
    definition.category,
    definition.description,
    definition.formKey,
    null
  )
  const middleNodeRepository = new Map()
  const result = {
    middleWorkflowGraph,
    middleNodeRepository,
  }

  if (!definition?.nodes || !definition.nodes.length) {
    return result
  }

  createBuilder(definition, middleNodeRepository, middleWorkflowGraph)

  return result
}
