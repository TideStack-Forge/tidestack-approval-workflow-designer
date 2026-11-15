import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../../translator/define/persistedNodeTypes.js'

export const MIDDLE_TO_RF_TYPE = Object.freeze({
  发起节点: 'start',
  审批节点: 'approval',
  办理节点: 'handle',
  抄送节点: 'cc',
  分流节点: 'branch',
  条件节点: 'condition',
  子流程节点: 'subprocess',
  合并节点: 'join-or',
  结束节点: 'end',
  [PERSISTED_NODE_TYPES.START]: 'start',
  [PERSISTED_NODE_TYPES.APPROVAL]: 'approval',
  [PERSISTED_NODE_TYPES.HANDLE]: 'handle',
  [PERSISTED_NODE_TYPES.CC]: 'cc',
  [PERSISTED_NODE_TYPES.SUBFLOW]: 'subprocess',
  [PERSISTED_NODE_TYPES.JOIN]: 'join-or',
  [PERSISTED_NODE_TYPES.END]: 'end',
})

export function middleTypeToReactFlowType(middleType) {
  return MIDDLE_TO_RF_TYPE[normalizePersistedNodeType(middleType) || middleType] || 'default'
}

export function reactFlowTypeToMiddleType(rfType) {
  const reverse = Object.entries(MIDDLE_TO_RF_TYPE).find(([, reactFlowType]) => reactFlowType === rfType)
  return reverse ? reverse[0] : null
}
