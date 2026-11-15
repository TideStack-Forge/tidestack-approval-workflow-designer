export const v1DefinitionFixture = {
  id: 'flow-v1',
  name: '旧流程',
  formType: 'default',
  formKey: 'purchase',
  nodes: [
    { id: 'start-a', type: '发起节点', name: '发起节点', next: 'approve-a' },
    {
      id: 'approve-a',
      type: '审批节点',
      name: '经理审批',
      subType: '单签',
      candidates: [{ type: 'User', users: ['u1'] }],
      next: '',
    },
  ],
}

export const v2DefinitionFixture = {
  formatVersion: 2,
  id: 'flow-v2',
  name: '新流程',
  formType: 'customForm',
  formKey: 'purchase',
  nodes: [
    { id: 'start-a', type: '发起节点', name: '发起节点' },
    { id: 'approve-a', type: '审批节点', name: '经理审批', subType: '单签', candidates: [{ type: 'User', users: ['u1'] }] },
    { id: 'end-a', type: '结束节点', name: '结束' },
  ],
  edges: [
    { id: 'edge-1', type: 'SEQUENCE', sourceId: 'start-a', targetId: 'approve-a' },
    { id: 'edge-2', type: 'SEQUENCE', sourceId: 'approve-a', targetId: 'end-a' },
  ],
}

// Stable V2 conditional-route fixture: only SEQUENCE edges, route semantics come from condition/order.
export const v2BranchDefinitionFixture = {
  formatVersion: 2,
  id: 'flow-v2-branch',
  name: '分支流程',
  formType: 'default',
  formKey: 'purchase',
  nodes: [
    { id: 'start-b', type: '发起节点', name: '发起节点' },
    { id: 'branch-approve-b', type: '审批节点', name: '条件审批', subType: '单签', candidates: [{ type: 'User', users: ['u1'] }] },
    {
      id: 'branch-end-b',
      type: '结束节点',
      name: '条件结束',
    },
    {
      id: 'branch-end-c',
      type: '结束节点',
      name: '兜底结束节点',
    },
    { id: 'branch-approve-c', type: '审批节点', name: '等待审批', subType: '单签', candidates: [{ type: 'User', users: ['u5'] }] },
    { id: 'after-b', type: '审批节点', name: '后续审批', subType: '单签', candidates: [{ type: 'User', users: ['u4'] }] },
    { id: 'end-b', type: '结束节点', name: '结束' },
  ],
  edges: [
    { id: 'edge-b-1', type: 'SEQUENCE', sourceId: 'start-b', targetId: 'after-b' },
    {
      id: 'edge-b-2',
      type: 'SEQUENCE',
      sourceId: 'start-b',
      targetId: 'branch-approve-b',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'amount' },
            op: 'greater',
            right: 1000,
          },
        ],
      },
      order: 20,
    },
    {
      id: 'edge-b-3',
      type: 'SEQUENCE',
      sourceId: 'start-b',
      targetId: 'branch-approve-c',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'amount' },
            op: 'less_or_equal',
            right: 1000,
          },
        ],
      },
      order: 10,
    },
    {
      id: 'edge-b-6',
      type: 'SEQUENCE',
      sourceId: 'start-b',
      targetId: 'branch-end-c',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'department' },
            op: 'select_equals',
            right: 'fallback',
          },
        ],
      },
      order: 30,
    },
    {
      id: 'edge-b-4',
      type: 'SEQUENCE',
      sourceId: 'branch-approve-b',
      targetId: 'branch-end-b',
    },
    { id: 'edge-b-5', type: 'SEQUENCE', sourceId: 'after-b', targetId: 'end-b' },
    { id: 'edge-b-7', type: 'SEQUENCE', sourceId: 'branch-end-b', targetId: 'end-b' },
    { id: 'edge-b-8', type: 'SEQUENCE', sourceId: 'branch-end-c', targetId: 'end-b' },
    { id: 'edge-b-9', type: 'SEQUENCE', sourceId: 'branch-approve-c', targetId: 'end-b' },
  ],
}

// Legacy compatibility fixture: retains deprecated BRANCH edges for read-path compatibility tests only.
export const legacyBranchEdgeDefinitionFixture = {
  formatVersion: 2,
  id: 'flow-v2-legacy-branch-edge',
  name: '分支流程-旧连线兼容',
  formType: 'default',
  formKey: 'purchase',
  nodes: JSON.parse(JSON.stringify(v2BranchDefinitionFixture.nodes)),
  edges: [
    { id: 'edge-b-1', type: 'SEQUENCE', sourceId: 'start-b', targetId: 'after-b' },
    {
      id: 'edge-b-2',
      type: 'BRANCH',
      sourceId: 'start-b',
      targetId: 'branch-approve-b',
      name: '金额大于 1000',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'amount' },
            op: 'greater',
            right: 1000,
          },
        ],
      },
      order: 20,
    },
    {
      id: 'edge-b-3',
      type: 'BRANCH',
      sourceId: 'start-b',
      targetId: 'branch-approve-c',
      name: '金额不大于 1000',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'amount' },
            op: 'less_or_equal',
            right: 1000,
          },
        ],
      },
      order: 10,
    },
    {
      id: 'edge-b-6',
      type: 'BRANCH',
      sourceId: 'start-b',
      targetId: 'branch-end-c',
      name: '兜底通知',
      condition: {
        conjunction: 'and',
        children: [
          {
            left: { type: 'field', field: 'department' },
            op: 'select_equals',
            right: 'fallback',
          },
        ],
      },
    },
    {
      id: 'edge-b-4',
      type: 'SEQUENCE',
      sourceId: 'branch-approve-b',
      targetId: 'branch-end-b',
    },
    { id: 'edge-b-5', type: 'SEQUENCE', sourceId: 'after-b', targetId: 'end-b' },
    { id: 'edge-b-7', type: 'SEQUENCE', sourceId: 'branch-end-b', targetId: 'end-b' },
    { id: 'edge-b-8', type: 'SEQUENCE', sourceId: 'branch-end-c', targetId: 'end-b' },
    { id: 'edge-b-9', type: 'SEQUENCE', sourceId: 'branch-approve-c', targetId: 'end-b' },
  ],
}
