const WORKFLOW_NODE_CATALOG_ENTRIES = Object.freeze([
  {
    key: 'approval',
    nodeType: 'approval',
    label: '审批',
    group: '处理节点',
    description: '添加需要人工审批的处理节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'handle',
    nodeType: 'handle',
    label: '办理',
    group: '处理节点',
    description: '添加只需人工办理完成的处理节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'cc',
    nodeType: 'cc',
    label: '抄送',
    group: '处理节点',
    description: '添加只登记流程可见人员的抄送节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'subprocess',
    nodeType: 'subprocess',
    label: '子流程',
    group: '处理节点',
    description: '添加复用其他流程定义的处理节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'start',
    nodeType: 'start',
    label: '流程开始',
    group: '结构节点',
    description: '添加流程入口节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'join-or',
    nodeType: 'join-or',
    label: '合并',
    group: '结构节点',
    description: '显式 OR 合并节点',
    draggable: true,
    enabled: true,
  },
  {
    key: 'end',
    nodeType: 'end',
    label: '流程结束',
    group: '结构节点',
    description: '添加流程终止节点',
    draggable: true,
    enabled: true,
  },
])

const HIDDEN_WORKFLOW_NODE_CATALOG_ENTRIES = Object.freeze([
  {
    key: 'branch',
    nodeType: 'branch',
    label: '分流',
    group: '结构节点',
    description: 'legacy 隐藏节点',
    draggable: false,
    enabled: false,
    hiddenReason: '当前版本不允许新增',
  },
  {
    key: 'condition',
    nodeType: 'condition',
    label: '条件',
    group: '结构节点',
    description: 'legacy 隐藏节点',
    draggable: false,
    enabled: false,
    hiddenReason: '当前版本不允许新增',
  },
  {
    key: 'join-and',
    nodeType: 'join-and',
    label: '并行合并',
    group: '结构节点',
    description: 'deferred 隐藏节点',
    draggable: false,
    enabled: false,
    hiddenReason: '当前版本暂未开放新增',
  },
])

export const WORKFLOW_NODE_CATALOG = Object.freeze({
  visibleEntries: WORKFLOW_NODE_CATALOG_ENTRIES,
  hiddenEntries: HIDDEN_WORKFLOW_NODE_CATALOG_ENTRIES,
})

const VISIBLE_WORKFLOW_NODE_TYPE_SET = new Set(
  WORKFLOW_NODE_CATALOG.visibleEntries.map((entry) => entry.nodeType)
)

export const isVisibleWorkflowNodeCatalogType = (nodeType) => {
  return VISIBLE_WORKFLOW_NODE_TYPE_SET.has(nodeType)
}

export const buildWorkflowNodeCatalog = ({ readonly = false, coreCapabilities = null } = {}) => {
  if (readonly || coreCapabilities?.allowPaletteInsert === false) {
    return []
  }

  return WORKFLOW_NODE_CATALOG.visibleEntries.map((entry) => ({
    ...entry,
    draggable: entry.draggable && entry.enabled,
  }))
}
