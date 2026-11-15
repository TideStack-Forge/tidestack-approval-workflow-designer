import { t } from '../../i18n.js'
import {
  MiddleWorkflowGraph,
  MiddleApprovalNode,
  MiddleCcNode,
  MiddleHandleNode,
  MiddleSubProcess,
  MiddleBranchNode,
  MiddleConditionNode,
  MiddleStartNode,
  MiddleEndNode,
} from '../../translator/define/middle.js'

import getUUID from '../../utils/uuid.js'
import toast from '../../utils/toast.js'

import { confirm } from 'ouroboros-sdk'
// import { ElMessageBox } from 'element-plus'

/**
 * 节点编辑器，主要维护 middle 工作流结构，因此节点操作主要是在 middle 结构上进行
 * 节点操作主要包括增加节点和删除节点
 */

/**
 * 添加节点
 * @param {Map} middleNodeRepository middle 结构的节点映射
 * @param {String} prevNodeId 当前选中“添加”节点的 id
 * @param {{id: String, name: String, type: String}} nodeData 添加节点的类型
 */
export function addNode(middleNodeRepository, prevNodeId, nodeData) {
  // 获取画布中“添加”节点上面的节点
  const curNodeId = prevNodeId.slice(4)
  // 根据 id 获得节点
  const curNode = middleNodeRepository.get(curNodeId)
  // 根据 type 值构建新节点

  switch (nodeData.type) {
    // 审批节点
    case 'ApprovalNode': {
      const newApprovalNode = new MiddleApprovalNode(
        nodeData.subType || '单签',
        nodeData.name,
        nodeData.id,
        nodeData.candidates || [],
        nodeData.permission || []
      )

      // 根据前序节点的 inBranch 属性判断是否是将节点添加到某一条分支上
      if (curNode.inBranch === '1' && curNode.type !== '分流节点') {
        newApprovalNode.inBranch = '1'
      } else {
        newApprovalNode.inBranch = '0'
      }

      newApprovalNode.next = curNode.next
      curNode.next = newApprovalNode
      middleNodeRepository.set(newApprovalNode.id, newApprovalNode)

      break
    }
    case 'CcNode': {
      const newCcNode = new MiddleCcNode(nodeData.name, nodeData.id, nodeData.candidates || [], null)

      if (curNode.inBranch === '1' && curNode.type !== '分流节点') {
        newCcNode.inBranch = '1'
      } else {
        newCcNode.inBranch = '0'
      }

      newCcNode.next = curNode.next
      curNode.next = newCcNode
      middleNodeRepository.set(newCcNode.id, newCcNode)
      break
    }
    case 'HandleNode': {
      const newHandleNode = new MiddleHandleNode(
        nodeData.name,
        nodeData.id,
        nodeData.candidates || [],
        nodeData.permission || [],
        null
      )

      if (curNode.inBranch === '1' && curNode.type !== '分流节点') {
        newHandleNode.inBranch = '1'
      } else {
        newHandleNode.inBranch = '0'
      }

      newHandleNode.next = curNode.next
      curNode.next = newHandleNode
      middleNodeRepository.set(newHandleNode.id, newHandleNode)
      break
    }
    // 子流程
    case 'SubProcess': {
      const newSubProcess = new MiddleSubProcess(
        nodeData.name,
        nodeData.id,
        '',
        [],
        [],
        '',
        null
      )

      // 根据前序节点的 inBranch 属性判断是否是将节点添加到某一条分支上
      if (curNode.inBranch === '1' && curNode.type !== '分流节点') {
        newSubProcess.inBranch = '1'
      } else {
        newSubProcess.inBranch = '0'
      }

      newSubProcess.next = curNode.next
      curNode.next = newSubProcess
      middleNodeRepository.set(newSubProcess.id, newSubProcess)
      break
    }
    // 分流节点
    case 'BranchNode': {
      const newBranchNode = new MiddleBranchNode(
        nodeData.name,
        nodeData.id,
        'exclusive',
        [],
        null
      )
      newBranchNode.next = curNode.next
      curNode.next = newBranchNode
      middleNodeRepository.set(newBranchNode.id, newBranchNode)
      // 分支构造
      for (let i = 0; i < 2; i++) {
        // 条件节点
        let newConditionNode = new MiddleConditionNode(
          '分支条件',
          getUUID('cond'),
          '',
          null
        )
        newConditionNode.branchNodeId = newBranchNode.id
        // 审批节点
        let newApprovalNdoe = new MiddleApprovalNode(
          '单签',
          '审批节点',
          getUUID('appr'),
          [],
          []
        )

        newApprovalNdoe.inBranch = '1'

        newConditionNode.next = newApprovalNdoe

        middleNodeRepository.set(newConditionNode.id, newConditionNode)
        middleNodeRepository.set(newApprovalNdoe.id, newApprovalNdoe)

        newBranchNode.branches.push(newConditionNode)
      }
    }
  }
}

/**
 * 添加分支
 * @param {Map} middleNodeRepository middle 结构的节点映射
 * @param {String} branchNodeId 分流节点的 id
 */
export function addBranch(middleNodeRepository, branchNodeId) {
  // 获得分流节点
  const branchNode = middleNodeRepository.get(branchNodeId)
  // 为分流节点增加一条分支
  // 条件节点
  let newConditionNode = new MiddleConditionNode('分支条件', getUUID('cond'), '', null)
  newConditionNode.branchNodeId = branchNode.id
  // 审批节点
  let newApprovalNdoe = new MiddleApprovalNode(
    '单签',
    '审批节点',
    getUUID('appr'),
    [],
    []
  )
  newApprovalNdoe.inBranch = '1'
  newConditionNode.next = newApprovalNdoe

  middleNodeRepository.set(newConditionNode.id, newConditionNode)
  middleNodeRepository.set(newApprovalNdoe.id, newApprovalNdoe)

  branchNode.branches.push(newConditionNode)
}

/**
 * 删除节点
 * @param {Map} middleNodeRepository middle 结构的节点映射
 * @param {String} deleteNodeId 将要被删除的节点的 id
 */
export async function deleteNode(middleNodeRepository, deleteNodeId) {
  // 获得待删除结点
  const deleteNode = middleNodeRepository.get(deleteNodeId)
  // 被删除的节点有两种情况，一种是条件节点，也就是直接删除一条分支；一种是重要的工作流节点，这一类的删除要考虑是否能够删除

  // 条件节点，直接删除分支
  if (deleteNode.type === '条件节点') {
    const switchNodePromise = await confirm(
      t('点击删除后将会直接删除该分支，是否直接删除 ？'),
      t('提示')
    )
    if (!switchNodePromise) return
    // 获得分流节点
    const branchNode = middleNodeRepository.get(deleteNode.branchNodeId)
    const preNode = middleNodeRepository.get(branchNode.pre)
    if (deleteNode.inBranch === '1') {
      if (preNode.type === '条件节点' && branchNode.next === null) {
        // 不能删除
        toast({
          msg: '该节点是该分支的唯一有效节点，不能删除',
          msgType: 'warning',
          timeout: 2.8 * 1000000,
        })
        return
      }
    }
    if (preNode.type === '发起节点' && branchNode.next === null) {
      // 不能删除
      toast({
        msg: '该节点是当前工作流中除发起节点外的唯一有效节点，不能删除！',
        msgType: 'warning',
        timeout: 2.8 * 1000000,
      })
      return
    }
    // 分支小于等于 2 时，将直接删除所有分支
    if (branchNode.branches.length <= 2) {
      for (let i = 0; i < branchNode.branches.length; i++) {
        // 删除每一条分支的每一个节点
        let curSubNode = branchNode.branches[i]
        while (curSubNode !== null) {
          const deleteId = curSubNode.id
          curSubNode = curSubNode.next
          middleNodeRepository.delete(deleteId)
        }
      }
      branchNode.branches = []
      middleNodeRepository.get(branchNode.pre).next = branchNode.next
      middleNodeRepository.delete(branchNode.id)
    } else {
      for (let i = 0; i < branchNode.branches.length; i++) {
        // 删除指定分支
        if (branchNode.branches[i].id === deleteNodeId) {
          middleNodeRepository.delete(branchNode.branches[i].id)
          branchNode.branches.splice(i, 1)
          break
        }
      }
    }
  }
  // 工作流的主要节点（子流程、审批节点）
  else {
    // 这些节点的处理方式是一致的，主要根据是否在分支中进行不同的逻辑处理
    // 一定有前序节点
    const preNode = middleNodeRepository.get(deleteNode.pre)

    // 在某一条分支中，且一定不是条件节点，说明肯定有前序
    if (deleteNode.inBranch === '1') {
      // 在分支中，如果前序节点不是条件节点，那么可以直接删除
      if (preNode.type !== '条件节点') {
        // 直接删除
        preNode.next = deleteNode.next
        middleNodeRepository.delete(deleteNodeId)
      }
      // 如果前序节点就是条件节点，还要判断后序节点是否为空
      else {
        // 前序节点是条件节点，后序节点不为空
        if (deleteNode.next !== null) {
          // 直接删除
          preNode.next = deleteNode.next
          middleNodeRepository.delete(deleteNodeId)
        }
        // 前序节点是条件节点，后序节点为空
        else {
          // 不能删除
          toast({
            msg: '该节点是该分支的唯一有效节点，不能删除！',
            msgType: 'warning',
            timeout: 2.8 * 1000000,
          })
        }
      }
    }
    // 不在分支中，且必不是发起节点，则必有前序
    else {
      // 前序节点不是发起节点，直接删除
      if (preNode.type !== '发起节点') {
        // 直接删除
        preNode.next = deleteNode.next
        middleNodeRepository.delete(deleteNodeId)
      }
      // 前序节点是发起节点，还要判断后序节点是否为空
      else {
        // 前序节点是发起节点，后序节点不为空
        if (deleteNode.next !== null) {
          // 直接删除
          preNode.next = deleteNode.next
          middleNodeRepository.delete(deleteNodeId)
        }
        // 前序节点是发起节点，后序节点为空
        else {
          // 不能删除
          toast({
            msg: '该节点是当前工作流中除发起节点外的唯一有效节点，不能删除！',
            msgType: 'warning',
            timeout: 2.8 * 1000000,
          })
        }
      }
    }
  }
}

/**
 * 新建初始的工作流结构，需要传进来 middleNodeRepository，因为是深拷贝，所以可以直接修改中间结构节点映射的值，然后返回新建的中间结构工作流
 */
export const createInitialWorkflow = (middleNodeRepository, flowId) => {
  // 画布 id
  const middleWorkflowGraphId = flowId || ''

  // 发起节点构造
  const StartNodeId = getUUID('start')
  let StartNode = new MiddleStartNode('发起节点', StartNodeId, [], null)
  middleNodeRepository.set(StartNode.id, StartNode)

  // 默认的审批节点构造
  const DefaultApprovalNodeId = getUUID('appr')
  let DefaultApprovalNode = new MiddleApprovalNode(
    '单签',
    '审批节点',
    DefaultApprovalNodeId,
    [],
    []
  )
  middleNodeRepository.set(DefaultApprovalNode.id, DefaultApprovalNode)

  // 将发起节点的 next 指针进行设置
  middleNodeRepository.get(StartNode.id).next = middleNodeRepository.get(
    DefaultApprovalNode.id
  )

  // 初始化工作流
  const workflow = new MiddleWorkflowGraph(
    '新审批流',
    middleWorkflowGraphId,
    'shenpi',
    'rgba(255, 69, 0, 0.68)',
    '',
    '',
    '',
    middleNodeRepository.get(StartNode.id)
  )

  const endNode = new MiddleEndNode('结束', getUUID('end'))
  workflow.endNode = endNode
  middleNodeRepository.set(endNode.id, endNode)

  return workflow
}
