/**
 * 中间结构是一种树状结构，是承接旧版工作流结构和 React Flow 工作流结构的过渡结构
 * 虽然是树形结构，但是节点仍然需要使用 map 去存储
 */

// 工作流结构定义
export function MiddleWorkflowGraph(
  name,
  id,
  icon,
  color,
  category,
  description,
  formkey,
  firstNode,
  endNode = null
) {
  this.name = name
  this.id = id
  this.icon = icon
  this.color = color
  this.category = category
  this.description = description
  this.formKey = formkey
  this.firstNode = firstNode
  this.endNode = endNode
}

// 发起节点的结构
export function MiddleStartNode(name, id, permission, next) {
  this.type = '发起节点'
  this.name = name
  this.id = id
  this.permission = permission
  this.pre = ''
  this.next = next
}

// 审批节点的结构
export function MiddleApprovalNode(
  subType,
  name,
  id,
  candidates = null,
  permission = null,
  multipleMode = null,
  percentage = null,
  rejectAction = null,
  next = null,
  actions = ['reject'],
  noCandidateMode = 'approved',
  reAssignUsers = [],
  timeout = null
) {
  this.type = '审批节点'
  this.subType = subType
  this.name = name
  this.id = id
  this.candidates = candidates
  this.permission = permission
  this.multipleMode = multipleMode
  this.percentage = percentage
  this.rejectAction = rejectAction
  this.actions = actions
  this.inBranch = '0'
  this.pre = ''
  this.next = next
  this.noCandidateMode = noCandidateMode
  this.reAssignUsers = reAssignUsers
  this.timeout = timeout
}

export function MiddleCcNode(name, id, candidates = null, next = null) {
  this.type = '抄送节点'
  this.name = name
  this.id = id
  this.candidates = candidates
  this.inBranch = '0'
  this.pre = ''
  this.next = next
}

export function MiddleHandleNode(name, id, candidates = null, permission = null, next = null) {
  this.type = '办理节点'
  this.name = name
  this.id = id
  this.candidates = candidates
  this.permission = permission
  this.inBranch = '0'
  this.pre = ''
  this.next = next
}

// 子流程节点的结构
export function MiddleSubProcess(
  name,
  id,
  subProcessId,
  inParameters,
  outParameters,
  rejectAction,
  next
) {
  this.type = '子流程节点'
  this.name = name
  this.id = id
  this.subProcessId = subProcessId
  this.inParameters = inParameters
  this.outParameters = outParameters
  this.rejectAction = rejectAction
  this.inBranch = '0'
  this.pre = ''
  this.next = next
}

// 分流节点的结构
export function MiddleBranchNode(name, id, logic, branches, next) {
  this.type = '分流节点'
  this.name = name
  this.id = id
  this.logic = logic
  this.branches = branches
  this.inBranch = '1'
  this.pre = ''
  this.next = next
}

// 分支的第一个节点（条件节点）的结构
export function MiddleConditionNode(name, id, condition, next) {
  this.type = '条件节点'
  this.name = name
  this.id = id
  this.condition = condition
  this.branchNodeId = ''
  this.inBranch = '1'
  this.pre = ''
  this.next = next
}

export function MiddleEndNode(name, id, outcome) {
  this.type = '结束节点'
  this.name = name
  this.id = id
  if (outcome) {
    this.outcome = outcome
  }
  this.pre = ''
}

export function MiddleJoinNode(name, id, joinType = 'OR', next = null) {
  this.type = '合并节点'
  this.name = name
  this.id = id
  this.joinType = joinType
  this.inBranch = '0'
  this.pre = ''
  this.incoming = []
  this.next = next
}
