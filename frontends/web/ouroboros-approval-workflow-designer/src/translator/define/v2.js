/**
 * V2 工作流定义构造
 */

import { PERSISTED_NODE_TYPES } from './persistedNodeTypes.js'

export function FlowDefinitionV2(
  id,
  name,
  icon,
  color,
  category,
  description,
  formKey,
  formType,
  nodes,
  edges
) {
  const normalizedFormKey =
    typeof formKey === 'string' ? formKey.trim() : formKey
  const hasFormKey = !!normalizedFormKey

  this.formatVersion = 2
  this.id = id
  this.name = name
  this.icon = icon
  this.category = category
  this.description = description
  this.formKey = hasFormKey ? normalizedFormKey : undefined
  this.formType = formType === 'default' && !hasFormKey ? undefined : formType
  this.nodes = nodes
  this.edges = edges
}

export function V2StartNode(name, id, candidates, permission) {
  this.type = PERSISTED_NODE_TYPES.START
  this.name = name
  this.id = id
  this.candidates = candidates
  this.permission = permission
}

export function V2ApprovalNode(
  subType,
  name,
  id,
  candidates,
  multipleMode,
  percentage,
  permission,
  rejectAction,
  actions,
  noCandidateMode,
  reAssignUsers,
  timeout
) {
  this.type = PERSISTED_NODE_TYPES.APPROVAL
  this.subType = subType
  this.name = name
  this.id = id
  this.candidates = candidates
  this.multipleMode = multipleMode
  this.percentage = percentage
  this.permission = permission
  this.rejectAction = rejectAction
  this.actions = actions
  this.noCandidateMode = noCandidateMode
  this.reAssignUsers = reAssignUsers
  this.timeout = timeout
}

export function V2CcNode(name, id, candidates) {
  this.type = PERSISTED_NODE_TYPES.CC
  this.name = name
  this.id = id
  this.candidates = candidates
}

export function V2HandleNode(name, id, candidates, permission) {
  this.type = PERSISTED_NODE_TYPES.HANDLE
  this.name = name
  this.id = id
  this.candidates = candidates
  this.permission = permission
}

export function V2SubProcessNode(
  name,
  id,
  subFlowKey,
  inParameters,
  outParameters,
  rejectAction
) {
  this.type = PERSISTED_NODE_TYPES.SUBFLOW
  this.name = name
  this.id = id
  this.subFlowKey = subFlowKey
  this.inParameters = inParameters
  this.outParameters = outParameters
  this.rejectAction = rejectAction
}

export function V2BranchNode(name, id, logic) {
  this.type = '分流节点'
  this.name = name
  this.id = id
  this.logic = logic
}

export function V2EndNode(name, id, outcome) {
  this.type = PERSISTED_NODE_TYPES.END
  this.name = name
  this.id = id
  if (outcome) {
    this.outcome = outcome
  }
}

export function V2JoinNode(name, id, joinType = 'OR') {
  this.type = PERSISTED_NODE_TYPES.JOIN
  this.name = name
  this.id = id
  this.joinType = joinType
}

export function V2Edge(id, type, sourceId, targetId, name, condition, order) {
  this.id = id
  this.type = type
  this.sourceId = sourceId
  this.targetId = targetId
  this.condition = condition
  this.order = order
}
