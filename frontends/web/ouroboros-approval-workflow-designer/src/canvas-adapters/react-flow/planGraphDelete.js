import { removeNodesFromGraph } from './removeNodesFromGraph.js'

export const GRAPH_DELETE_SOURCES = Object.freeze({
  KEYBOARD: 'keyboard',
  TOOLBAR: 'toolbar',
  NODE_ACTION: 'node-action',
})

const normalizeIdList = (ids) => {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)))
}

export const buildGraphDeleteRequest = ({
  source = GRAPH_DELETE_SOURCES.TOOLBAR,
  nodeIds = [],
  edgeIds = [],
} = {}) => {
  return {
    source,
    nodeIds: normalizeIdList(nodeIds),
    edgeIds: normalizeIdList(edgeIds),
  }
}

export const planGraphDelete = ({
  nodes = [],
  edges = [],
  request,
} = {}) => {
  const normalizedRequest = buildGraphDeleteRequest(request)
  const deletedNodeIdSet = new Set(normalizedRequest.nodeIds)
  const deletedEdgeIdSet = new Set(normalizedRequest.edgeIds)

  const nextGraphAfterNodeDelete =
    deletedNodeIdSet.size > 0
      ? removeNodesFromGraph({
          nodes,
          edges,
          deletedNodeIds: normalizedRequest.nodeIds,
        })
      : {
          nodes: [...(nodes || [])],
          edges: [...(edges || [])],
        }

  const nextEdges =
    deletedEdgeIdSet.size > 0
      ? nextGraphAfterNodeDelete.edges.filter((edge) => !deletedEdgeIdSet.has(edge?.id))
      : nextGraphAfterNodeDelete.edges

  return {
    kind: 'applied',
    request: normalizedRequest,
    nextNodes: nextGraphAfterNodeDelete.nodes,
    nextEdges,
    selectionModeAfterDelete: 'empty',
  }
}

export default planGraphDelete
