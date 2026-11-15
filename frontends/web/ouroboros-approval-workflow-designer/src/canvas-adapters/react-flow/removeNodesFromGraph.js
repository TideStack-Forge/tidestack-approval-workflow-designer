const EDGE_TYPES = Object.freeze({
  SEQUENCE: 'SEQUENCE',
})

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const edgeHasRouteMetadata = (edgeData) => {
  return (
    edgeData?.condition !== undefined ||
    Boolean(edgeData?.name) ||
    Number.isFinite(Number(edgeData?.order))
  )
}

const buildBridgeEdge = (incomingEdge, outgoingEdge, bridgeEdgeId) => {
  const incomingData = incomingEdge?.data || {}
  const outgoingData = outgoingEdge?.data || {}
  const routeSource = edgeHasRouteMetadata(incomingData) ? incomingData : outgoingData

  return {
    ...(incomingEdge || {}),
    id: bridgeEdgeId,
    source: incomingEdge.source,
    target: outgoingEdge.target,
    sourceHandle: null,
    targetHandle: null,
    data: {
      id: bridgeEdgeId,
      edgeType:
        routeSource.edgeType ||
        incomingData.edgeType ||
        outgoingData.edgeType ||
        EDGE_TYPES.SEQUENCE,
      name: clone(routeSource.name),
      condition: clone(routeSource.condition),
      order: clone(routeSource.order),
    },
  }
}

export const removeNodesFromGraph = ({
  nodes = [],
  edges = [],
  deletedNodeIds = [],
} = {}) => {
  const deletedNodeIdSet = new Set((deletedNodeIds || []).filter(Boolean))
  const nextNodes = (nodes || []).filter((node) => !deletedNodeIdSet.has(node?.id))
  const nextEdges = (edges || []).filter((edge) => {
    return !deletedNodeIdSet.has(edge?.source) && !deletedNodeIdSet.has(edge?.target)
  })
  const existingPairs = new Set(
    nextEdges.map((edge) => `${edge?.source || ''}->${edge?.target || ''}`)
  )
  const bridgeEdges = []
  let bridgeIndex = 0

  deletedNodeIdSet.forEach((nodeId) => {
    const incomingEdges = (edges || []).filter((edge) => {
      return edge?.target === nodeId && !deletedNodeIdSet.has(edge?.source)
    })
    const outgoingEdges = (edges || []).filter((edge) => {
      return edge?.source === nodeId && !deletedNodeIdSet.has(edge?.target)
    })

    incomingEdges.forEach((incomingEdge) => {
      outgoingEdges.forEach((outgoingEdge) => {
        if (!incomingEdge?.source || !outgoingEdge?.target) {
          return
        }

        if (incomingEdge.source === outgoingEdge.target) {
          return
        }

        const pairKey = `${incomingEdge.source}->${outgoingEdge.target}`
        if (existingPairs.has(pairKey)) {
          return
        }

        const bridgeEdgeId = `sequence-${incomingEdge.source}-${outgoingEdge.target}-bridge-${bridgeIndex}`
        bridgeIndex += 1
        bridgeEdges.push(buildBridgeEdge(incomingEdge, outgoingEdge, bridgeEdgeId))
        existingPairs.add(pairKey)
      })
    })
  })

  return {
    nodes: nextNodes,
    edges: [...nextEdges, ...bridgeEdges],
  }
}

export default removeNodesFromGraph
