const readEdgeCondition = (edge) => {
  if (edge?.data?.condition !== undefined) {
    return edge.data.condition
  }

  return edge?.condition
}

const readEdgeOrder = (edge) => {
  if (edge?.data?.order !== undefined) {
    return edge.data.order
  }

  return edge?.order
}

export const edgeHasExplicitRouteMetadata = (edge) => {
  const condition = readEdgeCondition(edge)
  const order = readEdgeOrder(edge)
  const hasConditionMetadata = condition !== undefined && condition !== null
  const hasOrderMetadata =
    order !== undefined &&
    order !== null &&
    (typeof order !== 'string' || order.trim().length > 0) &&
    Number.isFinite(Number(order))

  return (
    hasConditionMetadata ||
    hasOrderMetadata
  )
}

export const buildOutgoingEdgeCountBySource = (edges = []) => {
  return (edges || []).reduce((result, edge) => {
    const sourceId = edge?.source || edge?.sourceId
    if (!sourceId) {
      return result
    }

    result.set(sourceId, (result.get(sourceId) || 0) + 1)
    return result
  }, new Map())
}

export const resolveSplitEdgeContext = (edge, edges = []) => {
  const sourceId = edge?.source || edge?.sourceId || null
  if (!sourceId) {
    return {
      sourceId: null,
      outgoingCount: 0,
      isSplitEdge: false,
      hasExplicitRouteMetadata: edgeHasExplicitRouteMetadata(edge),
    }
  }

  const outgoingCount = buildOutgoingEdgeCountBySource(edges).get(sourceId) || 0

  return {
    sourceId,
    outgoingCount,
    isSplitEdge: outgoingCount > 1,
    hasExplicitRouteMetadata: edgeHasExplicitRouteMetadata(edge),
  }
}

export const isSplitEdge = (edge, edges = []) => {
  return resolveSplitEdgeContext(edge, edges).isSplitEdge
}

export const edgeBelongsToConditionalRoute = (edge, edges = []) => {
  const context = resolveSplitEdgeContext(edge, edges)
  return context.isSplitEdge || context.hasExplicitRouteMetadata
}

export const resolveEdgeConditionValue = readEdgeCondition
