const WORKFLOW_NODE_APPEARANCE = Object.freeze({
  start: {
    label: '流程开始',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(64, 158, 255, 0.56)',
    iconColor: '#2563eb',
    iconClassName: 'fa-solid fa-play',
  },
  approval: {
    label: '审批节点',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(250, 140, 22, 0.56)',
    iconColor: '#d97706',
    iconClassName: 'fa-solid fa-user-check',
  },
  handle: {
    label: '办理节点',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(168, 85, 247, 0.46)',
    iconColor: '#7c3aed',
    iconClassName: 'fa-solid fa-clipboard-check',
  },
  cc: {
    label: '抄送节点',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(14, 165, 233, 0.52)',
    iconColor: '#0284c7',
    iconClassName: 'fa-solid fa-paper-plane',
  },
  subprocess: {
    label: '子流程节点',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(47, 84, 235, 0.48)',
    iconColor: '#2563eb',
    iconClassName: 'fa-solid fa-diagram-project',
  },
  'join-or': {
    label: '合并节点',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(82, 196, 26, 0.56)',
    iconColor: '#16a34a',
    iconClassName: 'fa-solid fa-code-branch',
  },
  end: {
    label: '流程结束',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(140, 140, 140, 0.68)',
    iconColor: '#4b5563',
    iconClassName: 'fa-solid fa-flag-checkered',
  },
})

export const getWorkflowNodeAppearance = (nodeType) => {
  return WORKFLOW_NODE_APPEARANCE[nodeType] || WORKFLOW_NODE_APPEARANCE.approval
}

export const isWorkflowSpecialNodeType = (nodeType) => {
  return nodeType === 'start' || nodeType === 'end'
}

export default WORKFLOW_NODE_APPEARANCE
