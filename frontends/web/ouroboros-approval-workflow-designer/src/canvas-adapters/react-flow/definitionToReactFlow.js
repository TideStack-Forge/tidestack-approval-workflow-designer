import { middleTypeToReactFlowType } from './nodeTypeMapping.js'
import { getNodePosition } from './layoutHelpers.js'
import { summarizeCondition } from '../../views/workflow/components/ReactFlowDesigner/workflowEdgeInspectorContract.js'

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const extractNodeData = (definitionNode) => {
  return {
    label: definitionNode?.name,
    ...clone(definitionNode),
  }
}

const buildBranchLabel = (edge) => {
  if (edge?.name) {
    return edge.name
  }

  if (edge?.condition) {
    return summarizeCondition(edge.condition)
  }

  return undefined
}

const createEdge = (edge) => ({
  id: edge.id,
  source: edge.sourceId,
  target: edge.targetId,
  type: 'default',
  label: buildBranchLabel(edge),
  data: {
    id: edge.id,
    edgeType: edge.type || 'SEQUENCE',
    condition: edge.condition,
    order: edge.order,
  },
  labelStyle: { fill: '#666', fontSize: 12 },
  labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
})

export function definitionToReactFlow(definition, editorLayout = definition?.editorLayout) {
  if (!definition?.nodes?.length) {
    return { nodes: [], edges: [] }
  }

  const nodes = definition.nodes.map((node, index) => ({
    id: node.id,
    type: middleTypeToReactFlowType(node.type),
    position: getNodePosition(node.id, editorLayout, index),
    data: extractNodeData(node),
  }))

  const edges = (definition.edges || []).map(createEdge)

  return {
    nodes,
    edges,
  }
}

export default definitionToReactFlow
