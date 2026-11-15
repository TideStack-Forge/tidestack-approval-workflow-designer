import { definitionToReactFlow } from '../../../../canvas-adapters/react-flow/index.js'

export const DEFAULT_READ_ONLY_CANVAS_HEIGHT = 360

const ACTIVE_NODE_STYLE = Object.freeze({
  borderColor: '#52c41a',
  boxShadow: '0 0 0 3px rgba(82, 196, 26, 0.24)',
})

function normalizeStructuredValue(value) {
  if (!value) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmedValue = value.trim()
  if (!trimmedValue.startsWith('{') && !trimmedValue.startsWith('[')) {
    return null
  }

  try {
    return JSON.parse(trimmedValue)
  } catch {
    return null
  }
}

export function resolveReadOnlyCanvasHeight(height) {
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
    return height
  }

  if (typeof height === 'string') {
    const trimmedHeight = height.trim()
    if (!trimmedHeight) {
      return DEFAULT_READ_ONLY_CANVAS_HEIGHT
    }

    if (/^\d+(\.\d+)?$/.test(trimmedHeight)) {
      const numericHeight = Number(trimmedHeight)
      return numericHeight > 0 ? numericHeight : DEFAULT_READ_ONLY_CANVAS_HEIGHT
    }

    return trimmedHeight
  }

  return DEFAULT_READ_ONLY_CANVAS_HEIGHT
}

export function resolveReadOnlyDefinition(definition, data = null) {
  const directDefinition = normalizeStructuredValue(definition)
  if (directDefinition && Array.isArray(directDefinition.nodes)) {
    return directDefinition
  }

  const scopedDefinition = normalizeStructuredValue(data?.definition)
  if (scopedDefinition && Array.isArray(scopedDefinition.nodes)) {
    return scopedDefinition
  }

  const scopedData = normalizeStructuredValue(data)
  if (scopedData && Array.isArray(scopedData.nodes)) {
    return scopedData
  }

  return directDefinition && typeof directDefinition === 'object' ? directDefinition : null
}

export function resolveReadOnlyActiveNodeIds(activeNodeIds, data = null) {
  const directActiveNodeIds = normalizeStructuredValue(activeNodeIds)
  if (Array.isArray(directActiveNodeIds)) {
    return directActiveNodeIds
  }

  if (Array.isArray(data?.activeNodeIds)) {
    return data.activeNodeIds
  }

  return []
}

export function buildReadOnlyCanvasData(definition, activeNodeIds = []) {
  if (!definition) {
    return { nodes: [], edges: [] }
  }

  const editorLayout = definition?.editorLayout
  const canvasData = definitionToReactFlow(definition, editorLayout)
  const activeNodeSet = new Set(activeNodeIds)

  return {
    nodes: (canvasData.nodes || []).map((node) => {
      const isActive = activeNodeSet.has(node.id)
      return {
        ...node,
        data: {
          ...node.data,
          isActive,
          isReadonly: true,
        },
        style: isActive
          ? {
              ...(node.style || {}),
              ...ACTIVE_NODE_STYLE,
            }
          : node.style,
      }
    }),
    edges: canvasData.edges || [],
  }
}
