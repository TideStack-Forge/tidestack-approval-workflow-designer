import { SYNTHETIC_NODE_TYPES } from '../../translator/define/reactflow.js'
import { getNodePosition } from './layoutHelpers.js'

const CONDITION_X_OFFSET = 180
const END_X_OFFSET = 220
const BRANCH_VERTICAL_SPACING = 160

const walkRealNodes = (middleGraph, visitor) => {
  const visitedNodeIds = new Set()

  const walk = (middleNode) => {
    if (!middleNode || visitedNodeIds.has(middleNode.id)) {
      return
    }

    visitedNodeIds.add(middleNode.id)
    visitor(middleNode)

    if (middleNode.type === '分流节点') {
      ;(middleNode.branches || []).forEach((conditionNode) => {
        if (conditionNode?.next) {
          walk(conditionNode.next)
        }
      })
    }

    if (middleNode.next) {
      walk(middleNode.next)
    }
  }

  walk(middleGraph?.firstNode)
}

const buildConditionPosition = (branchNode, conditionNode, branchIndex, editorLayout) => {
  const branchPosition = getNodePosition(branchNode.id, editorLayout)

  if (conditionNode?.next) {
    const nextNodePosition = getNodePosition(conditionNode.next.id, editorLayout)

    return {
      x: branchPosition.x + CONDITION_X_OFFSET,
      y: nextNodePosition.y,
    }
  }

  return {
    x: branchPosition.x + CONDITION_X_OFFSET,
    y: branchPosition.y + (branchIndex + 1) * BRANCH_VERTICAL_SPACING,
  }
}

export function generateSyntheticEndNodes(middleGraph, editorLayout) {
  const endNodes = []
  const addedNodeIds = new Set()

  const addEndNode = (sourceId, position, data = {}) => {
    const endNodeId = `end-${sourceId}`

    if (addedNodeIds.has(endNodeId)) {
      return
    }

    addedNodeIds.add(endNodeId)
    endNodes.push({
      id: endNodeId,
      type: SYNTHETIC_NODE_TYPES.END,
      position: {
        x: position.x + END_X_OFFSET,
        y: position.y,
      },
      sourcePosition: 'right',
      targetPosition: 'left',
      selectable: false,
      deletable: false,
      data: {
        label: '结束',
        name: '结束',
        synthetic: true,
        sourceNodeId: sourceId,
        ...data,
      },
    })
  }

  walkRealNodes(middleGraph, (middleNode) => {
    if (middleNode.type === '分流节点') {
      ;(middleNode.branches || []).forEach((conditionNode, branchIndex) => {
        if (!conditionNode || conditionNode.next) {
          return
        }

        addEndNode(conditionNode.id, buildConditionPosition(middleNode, conditionNode, branchIndex, editorLayout), {
          branchNodeId: middleNode.id,
        })
      })
    }

    if (middleNode.next) {
      return
    }

    addEndNode(middleNode.id, getNodePosition(middleNode.id, editorLayout))
  })

  return endNodes
}

export function generateSyntheticConditionNodes(middleGraph, editorLayout) {
  const conditionNodes = []

  walkRealNodes(middleGraph, (middleNode) => {
    if (middleNode.type !== '分流节点') {
      return
    }

    ;(middleNode.branches || []).forEach((conditionNode, branchIndex) => {
      if (!conditionNode) {
        return
      }

      conditionNodes.push({
        id: conditionNode.id,
        type: SYNTHETIC_NODE_TYPES.CONDITION,
        position: buildConditionPosition(middleNode, conditionNode, branchIndex, editorLayout),
        sourcePosition: 'right',
        targetPosition: 'left',
        data: {
          label: conditionNode.name,
          name: conditionNode.name,
          condition: conditionNode.condition,
          synthetic: true,
          branchNodeId: middleNode.id,
          order: conditionNode.order,
        },
      })
    })
  })

  return conditionNodes
}
