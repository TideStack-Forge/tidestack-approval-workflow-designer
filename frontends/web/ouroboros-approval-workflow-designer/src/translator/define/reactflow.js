/**
 * React Flow view-model definitions
 * These are ONLY for canvas rendering, NOT for persistence
 */

// React Flow node structure
export function ReactFlowNode(id, type, position, data) {
  this.id = id
  this.type = type // 'start', 'approval', 'condition', 'branch', 'subprocess', 'end'
  this.position = position // { x, y }
  this.data = data // node-specific data
}

// React Flow edge structure
export function ReactFlowEdge(id, source, target, sourceHandle, targetHandle, data) {
  this.id = id
  this.source = source
  this.target = target
  this.sourceHandle = sourceHandle || null
  this.targetHandle = targetHandle || null
  this.data = data || {}
}

// Synthetic node type markers
export const SYNTHETIC_NODE_TYPES = {
  CONDITION: 'condition',
}

// Check if a node type is synthetic
export function isSyntheticNodeType(type) {
  return Object.values(SYNTHETIC_NODE_TYPES).includes(type)
}

// Canvas session layout. Only nodePositions is persisted into V2 editorLayout.
export function EditorLayout(nodePositions, viewport) {
  this.nodePositions = nodePositions || {} // { [nodeId]: { x, y } }
  this.viewport = viewport || { x: 0, y: 0, zoom: 1 } // { x, y, zoom }
}
