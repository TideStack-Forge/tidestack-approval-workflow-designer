import {
  MiddleWorkflowGraph,
  MiddleStartNode,
  MiddleApprovalNode,
  MiddleSubProcess,
  MiddleBranchNode,
  MiddleConditionNode,
} from '../define/middle.js'

/**
 * 核心的处理逻辑是分流节点的处理逻辑
 * 向 middle 结构转换需要额外配置一个 map，key 为节点 id，value 为节点 object
 * 因为 xinpai 工作流中的节点的 next 是其后序节点的 id，所以需要为 xinpai 工作流构造对应的节点 map 集合映射
 */

/**
 * 构造任意 xinpai 工作流的节点 map 映射
 * @param {XinpaiWorkflowGraph} xinpaiWorkflowGraph xinpai 工作流
 */
const createXinpaiNodeRepository = (xinpaiWorkflowGraph) => {
  // return：节点的集合映射
  const nodeRepository = new Map()
  const nodes = xinpaiWorkflowGraph?.nodes || []
  let startNodeId = null
  // return：startNodeId
  nodes.forEach((node) => {
    if (node.type === '发起节点') {
      startNodeId = node.id
    }
    nodeRepository.set(node.id, node)
  })
  return {
    nodeRepository,
    startNodeId,
  }
}

/**
 * 发起节点的处理逻辑
 * @param {XinpaiStartNode} curNode
 * @param {Map} middleNodeRepository
 * @param {MiddleWorkflowGraph} middleWorkflowGraph
 */
const xinpaiToMiddleStartNodeTranspiler = (
  curNode,
  middleNodeRepository,
  middleWorkflowGraph
) => {
  // middle 的发起节点
  let startNode = new MiddleStartNode(
    curNode.name,
    curNode.id,
    curNode.permission,
    curNode.next
  )
  middleNodeRepository.set(startNode.id, startNode)
  middleWorkflowGraph.firstNode = startNode
}

/**
 * 审批节点的处理逻辑
 * @param {XinpaiApprovalNode} curNode
 * @param {Map} middleNodeRepository
 */
const xinpaiToMiddleApprovalNodeTranspiler = (curNode, middleNodeRepository) => {
  // middle 的审批节点
  let approvalNode = new MiddleApprovalNode(
    curNode.subType,
    curNode.name,
    curNode.id,
    curNode.candidates,
    curNode.permission,
    curNode.multipleMode,
    curNode.percentage,
    curNode.rejectAction,
    curNode.next,
    curNode.actions,
    curNode.noCandidateMode,
    curNode.reAssignUsers
  )
  middleNodeRepository.set(approvalNode.id, approvalNode)
}

/**
 * 子流程节点的处理逻辑
 * @param {XinpaiSubProcess} curNode
 * @param {Map} middleNodeRepository
 */
const xinpaiToMiddleSubProcessTranspiler = (curNode, middleNodeRepository) => {
  // middle 的子流程节点
  let subProcess = new MiddleSubProcess(
    curNode.name,
    curNode.id,
    curNode.subProcessId,
    curNode.inParameters,
    curNode.outParameters,
    curNode.rejectAction,
    curNode.next
  )
  middleNodeRepository.set(subProcess.id, subProcess)
}

/**
 * 分流节点的处理逻辑（核心）
 * @param {XinpaiBranchNode} curNode
 * @param {Map} xinpaiNodeRepository
 * @param {Map} middleNodeRepository
 */
const xinpaiToMiddleBranchNodeTranspiler = (
  curNode,
  xinpaiNodeRepository,
  middleNodeRepository
) => {
  let xinpaiBranches = curNode.branches
  // middle 的分流节点
  let branchNode = new MiddleBranchNode(
    curNode.name,
    curNode.id,
    curNode.logic,
    [],
    curNode.next
  )
  // 下面把每一条分支都处理完
  for (let i = 0; i < xinpaiBranches.length; i++) {
    // 获取 xinpai 工作流的分流构造
    let xinpaiCondition = xinpaiBranches[i]
    // 构建 middle 的 conditionNode 构造
    let conditionNode = new MiddleConditionNode(
      xinpaiCondition.name,
      xinpaiCondition.id,
      xinpaiCondition.condition,
      xinpaiCondition.first
    )
    conditionNode.branchNodeId = curNode.id
    middleNodeRepository.set(conditionNode.id, conditionNode)
    let pre = conditionNode
    while (pre.next !== '') {
      // 获得 xinpai 结构的”下一个“节点
      let cur = xinpaiNodeRepository.get(pre.next)
      switch (cur.type) {
        case '审批节点': {
          xinpaiToMiddleApprovalNodeTranspiler(cur, middleNodeRepository)
          pre.next = middleNodeRepository.get(cur.id)
          pre = pre.next

          middleNodeRepository.get(cur.id).inBranch = '1'

          break
        }
        case '子流程节点': {
          xinpaiToMiddleSubProcessTranspiler(cur, middleNodeRepository)
          pre.next = middleNodeRepository.get(cur.id)
          pre = pre.next

          middleNodeRepository.get(cur.id).inBranch = '1'

          break
        }
        case '分流节点': {
          xinpaiToMiddleBranchNodeTranspiler(
            cur,
            xinpaiNodeRepository,
            middleNodeRepository
          )
          pre.next = middleNodeRepository.get(cur.id)
          pre = pre.next
          break
        }
      }
    }
    pre.next = null
    branchNode.branches.push(conditionNode)
  }
  middleNodeRepository.set(branchNode.id, branchNode)
}

/**
 * 转换器
 * @param {XinpaiWorkflowGraph} xinpaiWorkflowGraph xinpai 工作流
 */
export const xinpaiToMiddleTranslator = (xinpaiWorkflowGraph) => {
  // 获得 xinpai 工作流的 node 集合映射以及工作流的发起节点
  const { nodeRepository: xinpaiNodeRepository, startNodeId: xinpaiStartNodeId } =
    createXinpaiNodeRepository(xinpaiWorkflowGraph)

  // middle 工作流结构
  const middleWorkflowGraph = new MiddleWorkflowGraph(
    xinpaiWorkflowGraph.name,
    xinpaiWorkflowGraph.id,
    xinpaiWorkflowGraph.icon,
    xinpaiWorkflowGraph.color,
    xinpaiWorkflowGraph.category,
    xinpaiWorkflowGraph.description,
    xinpaiWorkflowGraph.formKey,
    null
  )
  // middle 的 node 集合的映射
  let middleNodeRepository = new Map()
  // 构造 result
  let result = {
    middleWorkflowGraph,
    middleNodeRepository,
  }

  // 如果 xinpai 工作流没有节点，是一个空工作流，则直接返回结果
  if (!xinpaiWorkflowGraph.nodes || !xinpaiWorkflowGraph.nodes.length) {
    return result
  }

  // 获得 xinpai 结构中的第一个节点，即发起节点（如果 xinpai 工作流中有节点，则一定有发起节点）
  // let curNode = xinpaiNodeRepository.get(xinpaiStartNodeId);
  let curNodeId = xinpaiStartNodeId

  // 后续，根据 xinpai 工作流中的后序节点继续构造 middle 工作流
  while (curNodeId) {
    let curNode = xinpaiNodeRepository.get(curNodeId)
    // 节点类型
    switch (curNode.type) {
      case '发起节点': {
        xinpaiToMiddleStartNodeTranspiler(
          curNode,
          middleNodeRepository,
          middleWorkflowGraph
        )
        break
      }
      case '审批节点': {
        xinpaiToMiddleApprovalNodeTranspiler(curNode, middleNodeRepository)
        break
      }
      case '子流程节点': {
        xinpaiToMiddleSubProcessTranspiler(curNode, middleNodeRepository)
        break
      }
      case '分流节点': {
        xinpaiToMiddleBranchNodeTranspiler(
          curNode,
          xinpaiNodeRepository,
          middleNodeRepository
        )
        break
      }
    }
    // 获得 curNode 的后序节点
    curNodeId = curNode.next
  }

  // 将所有节点串起来
  // 获得 middle 的第一个节点
  let p = middleNodeRepository.get(xinpaiStartNodeId)
  while (p.next) {
    // 下一节点的 id，如果是最后一个节点，则为 ""
    let nextId = p.next
    p.next = middleNodeRepository.get(nextId)
    p = middleNodeRepository.get(nextId)
  }
  p.next = null

  return result
}
