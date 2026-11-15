import { resolveWorkflowInspectorTargetKind } from '../../../../editor-core/workflowInspectorRegistry'
import { normalizePersistedNodeType } from '../../../../translator/define/persistedNodeTypes.js'

export const resolveWorkflowInspectorSelectionPayload = ({
  selectionSnapshot,
  nodes = [],
  edges = [],
} = {}) => {
  const selectionMode = selectionSnapshot?.mode || 'none'
  const targetId = selectionSnapshot?.primaryTargetId || null

  if (selectionMode === 'single-node' && targetId) {
    return nodes.find((node) => node.id === targetId) || null
  }

  if (selectionMode === 'single-edge' && targetId) {
    return edges.find((edge) => edge.id === targetId) || null
  }

  return null
}

export const createWorkflowInspectorTargetSnapshot = ({
  selectionMode,
  selectionSnapshot,
  selectionPayload,
} = {}) => {
  const resolvedSelectionMode = selectionMode || selectionSnapshot?.mode || 'none'
  const targetKind = resolveWorkflowInspectorTargetKind({
    selectionMode: resolvedSelectionMode,
    selection: selectionPayload,
  })

  return {
    selectionMode: resolvedSelectionMode,
    targetKind,
    targetId:
      resolvedSelectionMode === 'single-node' || resolvedSelectionMode === 'single-edge'
        ? selectionSnapshot?.primaryTargetId || selectionPayload?.id || null
        : null,
    nodeType:
      resolvedSelectionMode === 'single-node'
        ? normalizePersistedNodeType(selectionPayload?.type) || selectionPayload?.type || null
        : null,
  }
}
