/**
 * Connection validation rules for React Flow editor
 */

// Node type definitions (matching existing Chinese types)
export const NODE_TYPES = {
  START: '发起节点',
  APPROVAL: '审批节点',
  HANDLE: '办理节点',
  BRANCH: '分流节点',
  CONDITION: '条件节点', // synthetic
  SUBPROCESS: '子流程节点',
  JOIN_OR: '合并节点',
  END: '结束节点',
}

// Valid connection matrix
// true = allowed, false = not allowed
export const CONNECTION_RULES = {
  [NODE_TYPES.START]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false, // condition is auto-created
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.APPROVAL]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.HANDLE]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.BRANCH]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.CONDITION]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.NOTICE]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.TIMER]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.SUBPROCESS]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.HANDLE]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.JOIN_OR]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: true,
    [NODE_TYPES.BRANCH]: true,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: true,
    [NODE_TYPES.TIMER]: true,
    [NODE_TYPES.SUBPROCESS]: true,
    [NODE_TYPES.JOIN_OR]: true,
    [NODE_TYPES.END]: true,
  },
  [NODE_TYPES.END]: {
    [NODE_TYPES.START]: false,
    [NODE_TYPES.APPROVAL]: false,
    [NODE_TYPES.HANDLE]: false,
    [NODE_TYPES.BRANCH]: false,
    [NODE_TYPES.CONDITION]: false,
    [NODE_TYPES.NOTICE]: false,
    [NODE_TYPES.TIMER]: false,
    [NODE_TYPES.SUBPROCESS]: false,
    [NODE_TYPES.JOIN_OR]: false,
    [NODE_TYPES.END]: false,
  },
}

/**
 * Check if a connection between two node types is valid
 * @param {string} sourceType - Source node type
 * @param {string} targetType - Target node type
 * @returns {boolean} True if connection is allowed
 */
export function isValidConnection(sourceType, targetType) {
  if (!CONNECTION_RULES[sourceType]) {
    return false
  }
  return CONNECTION_RULES[sourceType][targetType] === true
}

/**
 * Detect if adding a new edge would create a cycle
 * @param {Array} nodes - Array of nodes
 * @param {Array} edges - Array of existing edges
 * @param {Object} newEdge - New edge to add { source, target }
 * @returns {boolean} True if adding newEdge would create a cycle
 */
export function hasCycle(nodes, edges, newEdge) {
  // Build adjacency list including the new edge
  const adjacency = {}
  nodes.forEach((node) => {
    adjacency[node.id] = []
  })

  edges.forEach((edge) => {
    if (adjacency[edge.source]) {
      adjacency[edge.source].push(edge.target)
    }
  })

  // Add the new edge
  if (adjacency[newEdge.source]) {
    adjacency[newEdge.source].push(newEdge.target)
  }

  // DFS to detect cycle
  const visited = new Set()
  const recursionStack = new Set()

  function dfs(nodeId) {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = adjacency[nodeId] || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true
        }
      } else if (recursionStack.has(neighbor)) {
        return true // Cycle detected
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  // Check from the new edge's source
  return dfs(newEdge.source)
}

/**
 * Validate branch ownership rules
 * Each branch must have exactly one condition node
 * Condition nodes must belong to a branch
 * @param {Object} branchNode - Branch node
 * @param {Array} conditionNodes - Array of condition nodes
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateBranchOwnership(branchNode, conditionNodes) {
  const errors = []

  if (!branchNode) {
    errors.push('Branch node is required')
    return { valid: false, errors }
  }

  if (!conditionNodes || conditionNodes.length === 0) {
    errors.push(`Branch ${branchNode.id} has no condition nodes`)
    return { valid: false, errors }
  }

  // Check each condition node belongs to this branch
  conditionNodes.forEach((conditionNode) => {
    if (conditionNode.data && conditionNode.data.branchNodeId !== branchNode.id) {
      errors.push(
        `Condition node ${conditionNode.id} does not belong to branch ${branchNode.id}`
      )
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
