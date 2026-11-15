import { isSyntheticNodeType } from '../../translator/define/reactflow.js'

const clonePosition = (position) => ({
  x: position.x,
  y: position.y,
})

export function getNodePosition(nodeId, editorLayout, index = 0) {
  if (editorLayout?.nodePositions?.[nodeId]) {
    return clonePosition(editorLayout.nodePositions[nodeId])
  }

  return {
    x: 100 + (index % 3) * 250,
    y: 100 + Math.floor(index / 3) * 150,
  }
}

export function extractLayoutFromReactFlow(rfNodes, viewport) {
  const nodePositions = {}

  ;(rfNodes || []).forEach((node) => {
    if (!node || isSyntheticNodeType(node.type)) {
      return
    }

    nodePositions[node.id] = clonePosition(node.position)
  })

  return {
    nodePositions,
    viewport,
  }
}
