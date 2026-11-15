export const PERSISTED_NODE_TYPES = Object.freeze({
  START: 'StartNode',
  APPROVAL: 'ApprovalNode',
  HANDLE: 'HandleNode',
  CC: 'CcNode',
  SUBFLOW: 'SubflowNode',
  JOIN: 'JoinNode',
  END: 'EndNode',
})

const LEGACY_NODE_TYPE_ALIASES = Object.freeze({
  [PERSISTED_NODE_TYPES.START]: ['发起节点'],
  [PERSISTED_NODE_TYPES.APPROVAL]: ['审批节点'],
  [PERSISTED_NODE_TYPES.HANDLE]: ['办理节点'],
  [PERSISTED_NODE_TYPES.CC]: ['抄送节点'],
  [PERSISTED_NODE_TYPES.SUBFLOW]: ['子流程节点'],
  [PERSISTED_NODE_TYPES.JOIN]: ['合并节点'],
  [PERSISTED_NODE_TYPES.END]: ['结束节点'],
})

export function normalizePersistedNodeType(type) {
  if (!type) {
    return type
  }

  const canonicalType = Object.values(PERSISTED_NODE_TYPES).find((candidate) => {
    return candidate === type || (LEGACY_NODE_TYPE_ALIASES[candidate] || []).includes(type)
  })

  return canonicalType || type
}

export function isPersistedNodeType(type, expectedType) {
  return normalizePersistedNodeType(type) === expectedType
}

const canonicalizePersistedNode = (node) => {
  if (!node || typeof node !== 'object') {
    return node
  }

  const nextNode = {
    ...node,
    type: normalizePersistedNodeType(node?.type),
  }

  if (nextNode.type === PERSISTED_NODE_TYPES.SUBFLOW) {
    if (nextNode.subFlowKey === undefined) {
      nextNode.subFlowKey = node.subProcessId
    }
    delete nextNode.subProcessId
  }

  return nextNode
}

const canonicalizePersistedEdge = (edge) => {
  if (!edge || typeof edge !== 'object') {
    return edge
  }

  const rest = { ...edge }
  delete rest.name
  return {
    ...rest,
    type: 'SEQUENCE',
  }
}

export function canonicalizePersistedDefinitionNodeTypes(definition) {
  if (!definition) {
    return definition
  }

  const nextDefinition = {
    ...definition,
  }

  if (Array.isArray(definition.nodes)) {
    nextDefinition.nodes = definition.nodes.map(canonicalizePersistedNode)
  }

  if (Array.isArray(definition.edges)) {
    nextDefinition.edges = definition.edges.map(canonicalizePersistedEdge)
  }

  return nextDefinition
}
