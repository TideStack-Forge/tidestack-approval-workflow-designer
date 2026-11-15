const STABLE_WORKFLOW_INSPECTOR_TARGET_KINDS = Object.freeze([
  'selection:none',
  'selection:multi',
  'node:start',
  'node:approval',
  'node:handle',
  'node:cc',
  'node:subprocess',
  'node:end',
  'node:join-or',
  'edge:sequence',
])

const HIDDEN_LEGACY_WORKFLOW_INSPECTOR_TARGET_KINDS = Object.freeze([
  'node:branch',
  'node:condition',
])

const NODE_TYPE_TO_TARGET_KIND = Object.freeze({
  start: 'node:start',
  approval: 'node:approval',
  handle: 'node:handle',
  cc: 'node:cc',
  subprocess: 'node:subprocess',
  end: 'node:end',
  'join-or': 'node:join-or',
  branch: 'node:branch',
  condition: 'node:condition',
})

const NODE_TYPE_LABELS = Object.freeze({
  start: '发起',
  approval: '审批',
  handle: '办理节点',
  cc: '抄送节点',
  subprocess: '子流程',
  end: '结束',
  'join-or': '合并节点',
  branch: '分流',
  condition: '条件',
})

const CONFIGURABLE_WORKFLOW_INSPECTOR_TARGET_KINDS = Object.freeze([
  'node:start',
  'node:approval',
  'node:handle',
  'node:cc',
  'node:subprocess',
  'node:join-or',
])

export const WORKFLOW_INSPECTOR_REGISTRY = Object.freeze({
  targetKinds: STABLE_WORKFLOW_INSPECTOR_TARGET_KINDS,
  hiddenLegacyTargetKinds: HIDDEN_LEGACY_WORKFLOW_INSPECTOR_TARGET_KINDS,
})

export const resolveWorkflowInspectorTargetKind = ({
  selectionMode,
  selection,
} = {}) => {
  if (selectionMode === 'multi') {
    return 'selection:multi'
  }

  if (!selection) {
    return 'selection:none'
  }

  if (selectionMode === 'single-edge') {
    return 'edge:sequence'
  }

  if (selectionMode === 'single-node') {
    return NODE_TYPE_TO_TARGET_KIND[selection.type] || 'selection:none'
  }

  return 'selection:none'
}

export const getWorkflowInspectorPanelTitle = (targetKind) => {
  switch (targetKind) {
    case 'selection:multi':
      return '多选摘要'
    case 'edge:sequence':
      return '连线属性'
    case 'selection:none':
      return '属性检查器'
    default:
      return '节点属性'
  }
}

export const getWorkflowNodeTypeLabel = (nodeType) => {
  return NODE_TYPE_LABELS[nodeType] || nodeType || ''
}

export const isHiddenLegacyWorkflowInspectorTargetKind = (targetKind) => {
  return WORKFLOW_INSPECTOR_REGISTRY.hiddenLegacyTargetKinds.includes(targetKind)
}

export const isConfigurableWorkflowInspectorTargetKind = (targetKind) => {
  return CONFIGURABLE_WORKFLOW_INSPECTOR_TARGET_KINDS.includes(targetKind)
}
