export const DEFAULT_WORKFLOW_CANVAS_NODE_DIMENSIONS = Object.freeze({
  default: {
    width: 152,
    height: 56,
  },
  end: {
    width: 124,
    height: 44,
  },
})

export const WORKFLOW_CANVAS_SNAP_GRID = Object.freeze([20, 20])
export const WORKFLOW_ALIGNMENT_GUIDE_THRESHOLD = 8

const resolveNodeDimensions = (node) => {
  const dimensions =
    DEFAULT_WORKFLOW_CANVAS_NODE_DIMENSIONS[node?.type] ||
    DEFAULT_WORKFLOW_CANVAS_NODE_DIMENSIONS.default
  return {
    width: Number(node?.measured?.width || node?.width || dimensions.width),
    height: Number(node?.measured?.height || node?.height || dimensions.height),
  }
}

export const resolveWorkflowCanvasNodeRect = (node) => {
  const dimensions = resolveNodeDimensions(node)
  const position = node?.positionAbsolute || node?.position || { x: 0, y: 0 }

  return {
    left: position.x,
    top: position.y,
    right: position.x + dimensions.width,
    bottom: position.y + dimensions.height,
    centerX: position.x + dimensions.width / 2,
    centerY: position.y + dimensions.height / 2,
  }
}

const createAxisAnchors = (rect) => ({
  vertical: [rect.left, rect.centerX, rect.right],
  horizontal: [rect.top, rect.centerY, rect.bottom],
})

const pickNearestGuide = (currentAnchors, candidateAnchors, threshold) => {
  let nearestMatch = null
  let nearestDistance = Number.POSITIVE_INFINITY

  currentAnchors.forEach((currentAnchor, anchorIndex) => {
    candidateAnchors.forEach((candidateAnchor) => {
      const distance = Math.abs(currentAnchor - candidateAnchor)
      if (distance > threshold || distance >= nearestDistance) {
        return
      }

      nearestMatch = {
        guide: candidateAnchor,
        sourceAnchor: currentAnchor,
        anchorIndex,
        delta: candidateAnchor - currentAnchor,
      }
      nearestDistance = distance
    })
  })

  return nearestMatch
}

export const resolveWorkflowNodeAlignmentGuides = ({
  activeNode,
  nodes = [],
  enabled = true,
  threshold = WORKFLOW_ALIGNMENT_GUIDE_THRESHOLD,
} = {}) => {
  if (!enabled || !activeNode?.id) {
    return {
      vertical: null,
      horizontal: null,
      snappedPosition: null,
    }
  }

  const activeRect = resolveWorkflowCanvasNodeRect(activeNode)
  const activeAnchors = createAxisAnchors(activeRect)
  let verticalGuide = null
  let horizontalGuide = null
  let deltaX = 0
  let deltaY = 0
  let verticalDistance = Number.POSITIVE_INFINITY
  let horizontalDistance = Number.POSITIVE_INFINITY

  nodes
    .filter((node) => node?.id && node.id !== activeNode.id)
    .forEach((node) => {
      const candidateRect = resolveWorkflowCanvasNodeRect(node)
      const candidateAnchors = createAxisAnchors(candidateRect)
      const nextVerticalMatch = pickNearestGuide(
        activeAnchors.vertical,
        candidateAnchors.vertical,
        threshold
      )
      const nextHorizontalMatch = pickNearestGuide(
        activeAnchors.horizontal,
        candidateAnchors.horizontal,
        threshold
      )

      if (nextVerticalMatch !== null) {
        const distance = Math.abs(nextVerticalMatch.delta)
        if (distance < verticalDistance) {
          verticalGuide = nextVerticalMatch.guide
          deltaX = nextVerticalMatch.delta
          verticalDistance = distance
        }
      }

      if (nextHorizontalMatch !== null) {
        const distance = Math.abs(nextHorizontalMatch.delta)
        if (distance < horizontalDistance) {
          horizontalGuide = nextHorizontalMatch.guide
          deltaY = nextHorizontalMatch.delta
          horizontalDistance = distance
        }
      }
    })

  return {
    vertical: verticalGuide,
    horizontal: horizontalGuide,
    snappedPosition:
      verticalGuide === null && horizontalGuide === null
        ? null
        : {
            x: activeNode.position.x + deltaX,
            y: activeNode.position.y + deltaY,
          },
  }
}

export const snapWorkflowCanvasPositionToGrid = (
  position,
  snapGrid = WORKFLOW_CANVAS_SNAP_GRID
) => {
  if (!position) {
    return position
  }

  const [gridX, gridY] = snapGrid
  return {
    x: Math.round(position.x / gridX) * gridX,
    y: Math.round(position.y / gridY) * gridY,
  }
}

export const projectFlowGuideToScreenStyle = ({
  guide = null,
  viewport = null,
  canvasRect = null,
} = {}) => {
  if (!guide || !viewport || !canvasRect) {
    return {
      verticalStyle: null,
      horizontalStyle: null,
    }
  }

  const zoom = Number(viewport.zoom) || 1
  const verticalStyle =
    guide.vertical === null
      ? null
      : {
          left: guide.vertical * zoom + viewport.x,
        }
  const horizontalStyle =
    guide.horizontal === null
      ? null
      : {
          top: guide.horizontal * zoom + viewport.y,
        }

  return {
    verticalStyle,
    horizontalStyle,
  }
}
