import {
  FlowDefinitionV2,
  V2ApprovalNode,
  V2CcNode,
  V2Edge,
  V2EndNode,
  V2HandleNode,
  V2JoinNode,
  V2StartNode,
  V2SubProcessNode,
} from '../../translator/define/v2.js'
import { isSyntheticNodeType } from '../../translator/define/reactflow.js'

const EDGE_TYPES = Object.freeze({
  SEQUENCE: 'SEQUENCE',
})

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const createDefinitionNodeFromReactFlow = (rfNode) => {
  const data = rfNode?.data || {}

  switch (rfNode?.type) {
    case 'start':
      return new V2StartNode(
        data.name || data.label || '发起节点',
        rfNode.id,
        clone(data.candidates),
        clone(data.permission)
      )
    case 'approval':
      return new V2ApprovalNode(
        data.subType,
        data.name || data.label || '审批节点',
        rfNode.id,
        clone(data.candidates),
        data.multipleMode,
        data.percentage,
        clone(data.permission),
        data.rejectAction,
        clone(data.actions),
        data.noCandidateMode,
        clone(data.reAssignUsers),
        clone(data.timeout)
      )
    case 'handle':
      return new V2HandleNode(
        data.name || data.label || '办理节点',
        rfNode.id,
        clone(data.candidates),
        clone(data.permission)
      )
    case 'cc':
      return new V2CcNode(
        data.name || data.label || '抄送节点',
        rfNode.id,
        clone(data.candidates)
      )
    case 'subprocess':
      return new V2SubProcessNode(
        data.name || data.label || '子流程节点',
        rfNode.id,
        data.subFlowKey || data.subProcessId,
        clone(data.inParameters),
        clone(data.outParameters),
        data.rejectAction
      )
    case 'end':
      return new V2EndNode(data.name || data.label || '结束', rfNode.id, data.outcome)
    case 'join-or':
      return new V2JoinNode(
        data.name || data.label || '合并',
        rfNode.id,
        data.joinType || 'OR'
      )
    default:
      throw new Error(`Unsupported React Flow node type for V2 export: ${rfNode?.type}`)
  }
}

export function reactFlowToDefinitionV2(rfNodes, rfEdges, originalDefinition = {}) {
  const nodes = (rfNodes || [])
    .filter((node) => node && !isSyntheticNodeType(node.type))
    .map(createDefinitionNodeFromReactFlow)

  const edges = (rfEdges || []).map((edge) => {
    const edgeData = edge?.data || {}
    return new V2Edge(
      edge.id,
      EDGE_TYPES.SEQUENCE,
      edge.source,
      edge.target,
      undefined,
      clone(edgeData.condition),
      edgeData.order
    )
  })

  return new FlowDefinitionV2(
    originalDefinition?.id,
    originalDefinition?.name,
    originalDefinition?.icon,
    originalDefinition?.color,
    originalDefinition?.category,
    originalDefinition?.description,
    originalDefinition?.formKey,
    originalDefinition?.formType,
    nodes,
    edges
  )
}

export default reactFlowToDefinitionV2
