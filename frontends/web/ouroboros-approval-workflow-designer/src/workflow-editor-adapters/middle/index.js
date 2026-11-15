import {
  createInitialWorkflow,
  addNode,
  addBranch,
  deleteNode,
} from './nodeEditor.js'

const PROTECTED_NODE_KEYS = new Set(['next', 'pre'])
const FIXED_NAME_NODE_TYPES = new Set(['发起节点', '结束节点'])

export const middleWorkflowEditorAdapter = {
  createInitialState(nodeStore, flowId) {
    return createInitialWorkflow(nodeStore, flowId)
  },

  updateNodeConfig(nodeStore, nodeId, patch = {}) {
    const node = nodeStore.get(nodeId)
    if (!node) {
      return false
    }

    const normalizedPatch = { ...patch }
    if (FIXED_NAME_NODE_TYPES.has(node.type)) {
      delete normalizedPatch.name
      delete normalizedPatch.label
    }

    Object.keys(normalizedPatch).forEach((key) => {
      if (PROTECTED_NODE_KEYS.has(key)) {
        return
      }

      node[key] = normalizedPatch[key]
    })

    return true
  },

  insertNode(nodeStore, targetNodeId, nodeData) {
    return addNode(nodeStore, `add-${targetNodeId}`, nodeData)
  },

  appendBranch(nodeStore, branchNodeId) {
    return addBranch(nodeStore, branchNodeId)
  },

  removeNode(nodeStore, nodeId) {
    return deleteNode(nodeStore, nodeId)
  },
}
