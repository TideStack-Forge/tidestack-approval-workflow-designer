const assert = require('assert')
require('@babel/register')({
  extensions: ['.js', '.jsx'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  buildNodeConfigSchemaDescriptor,
  buildNodeConfigValueProjection,
  buildWorkflowInspectorSchemaKey,
  extractDrawerSubmitPayload,
  getDrawerFieldsetTitles,
  pickWorkflowInspectorBridgeSchemaContext,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/propertyEditorContracts.js')
const {
  buildRouteEdgeDrawerRequest,
  buildWorkflowEdgeConditionPatch,
  buildWorkflowEdgeInspectorSchemaDescriptor,
  buildWorkflowEdgeInspectorSchemaKey,
  buildWorkflowEdgeInspectorValueProjection,
  normalizeRouteEdgePatch,
  summarizeCondition,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowEdgeInspectorContract.js')
const {
  edgeBelongsToConditionalRoute,
  resolveSplitEdgeContext,
} = require('../../../src/editor-core/workflowEdgeConditionContract.js')
const { EditorSession } = require('../../../src/editor-session/index.js')
const { v2BranchDefinitionFixture } = require('../../integration/workflow/harness/fixtures.js')

test('route condition summaries render comparisons instead of raw JSON', () => {
  const condition = { left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }
  assert.strictEqual(summarizeCondition(condition), 'amount 大于 1000')
  assert.strictEqual(
    summarizeCondition(condition, [{ name: 'amount', label: '金额', type: 'number' }]),
    '金额 大于 1000'
  )
})

test('route condition editor projects a saved comparison as one editable condition', () => {
  const condition = { left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }
  const edge = { id: 'amount-route', data: { condition } }
  const expectedValue = { conjunction: 'and', children: [condition] }

  assert.deepStrictEqual(
    buildWorkflowEdgeInspectorValueProjection({ edge }).values.condition,
    expectedValue
  )
  assert.deepStrictEqual(buildRouteEdgeDrawerRequest(edge).body.body[0].value, expectedValue)
  assert.deepStrictEqual(edge.data.condition, condition)
})

test('route condition summaries preserve zero, false, options and nested conjunctions', () => {
  const compare = (field, op, right) => ({ left: { type: 'field', field }, op, right })
  const fields = [
    { name: 'amount', label: '金额' },
    { name: 'enabled', label: '启用' },
    { name: 'status', label: '状态', options: [{ value: 0, label: '未提交' }] },
  ]

  assert.strictEqual(summarizeCondition(compare('amount', 'greater', 0), fields), '金额 大于 0')
  assert.strictEqual(summarizeCondition(compare('enabled', 'equal', false), fields), '启用 = false')
  assert.strictEqual(summarizeCondition(compare('status', 'select_equals', 0), fields), '状态 = "未提交"')
  assert.strictEqual(summarizeCondition(compare('amount', 'is_empty'), fields), '金额 为空')
  assert.strictEqual(summarizeCondition({
    conjunction: 'and', children: [compare('amount', 'greater', 0), {}],
  }, fields), '2 个条件')
  assert.strictEqual(
    summarizeCondition({
      conjunction: 'and',
      children: [compare('amount', 'greater', 0), {
        conjunction: 'or',
        children: [compare('enabled', 'equal', false), compare('status', 'select_any_in', [0, 1])],
      }],
    }, fields),
    '(金额 大于 0) 且 ((启用 = false) 或 (状态 包含 "未提交", 1))'
  )
})

const fetcher = async (request) => {
  const requestUrl = request?.url || request

  if (requestUrl === '/api/approval-workflow/candidate') {
    return {
      data: {
        items: [
          {
            name: 'UserSelect',
            label: '用户自选',
            configMode: 'Enum',
            valueKey: 'mode',
            items: [{ label: '单人', value: 'single' }],
          },
          {
            name: 'User',
            label: '用户',
            configMode: 'SingleSelect',
            valueKey: 'value',
            items: [{ label: '张三', value: 'u1' }],
          },
        ],
      },
    }
  }

  return {
    data: {
      items: [{ label: '金额', value: 'amount' }],
    },
  }
}

const candidateSource = {
  revisionToken: 'candidate:2',
  items: [
    {
      name: 'UserSelect',
      label: '用户自选',
      configMode: 'Enum',
      valueKey: 'mode',
      items: [{ label: '单人', value: 'single' }],
    },
    {
      name: 'User',
      label: '用户',
      configMode: 'SingleSelect',
      valueKey: 'value',
      items: [{ label: '张三', value: 'u1' }],
    },
  ],
}

const formPermissionFieldSource = {
  revisionToken: 'form-permission:1',
  fields: [{ label: '金额', value: 'amount' }],
}

const candidateFieldSource = {
  revisionToken: 'form-fields:manager',
  fields: [{ label: '直属主管', value: 'managerId' }],
}

test('reactflow property editor reuses legacy node config sections for approval nodes without embedding form data', async () => {
  const session = EditorSession.createFromDefinition(JSON.parse(JSON.stringify(v2BranchDefinitionFixture)))

  const schemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session,
    nodeId: 'branch-approve-b',
    targetKind: 'node:approval',
    nodeType: 'approval',
    fetcher,
    isReadonly: false,
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
    conditionFieldSource: {
      revisionToken: 'form-fields:1',
      fields: [{ label: '金额', value: 'amount' }],
    },
  })

  assert.ok(schemaDescriptor, 'schema descriptor should exist for approval node')
  assert.deepEqual(getDrawerFieldsetTitles(schemaDescriptor.schema), ['基础信息', '人员配置', '审批配置', '表单权限配置'])
  assert.equal(schemaDescriptor.schema?.body?.data, undefined)
})

test('reactflow property editor passes candidate field source into FormField candidate schema', async () => {
  const session = EditorSession.createFromDefinition({
    formatVersion: 2,
    id: 'candidate-field-flow',
    name: 'Candidate Field Flow',
    nodes: [
      { id: 'start', type: 'StartNode', name: '发起节点' },
      { id: 'approve-a', type: 'ApprovalNode', name: '经理审批', subType: '单签' },
      { id: 'end', type: 'EndNode', name: '结束节点', terminalType: 'approved' },
    ],
    edges: [
      { id: 'e1', type: 'SEQUENCE', sourceId: 'start', targetId: 'approve-a' },
      { id: 'e2', type: 'SEQUENCE', sourceId: 'approve-a', targetId: 'end' },
    ],
  })

  const schemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session,
    nodeId: 'approve-a',
    targetKind: 'node:approval',
    nodeType: 'approval',
    fetcher,
    isReadonly: false,
    bridgeContext: {
      nodeConfig: {},
      candidateSource: {
        revisionToken: 'candidate:form-field',
        items: [
          {
            name: 'FormField',
            label: '表单字段',
            valueKey: 'field',
            schema: {
              type: 'select',
              name: 'field',
              label: '请选择处理人字段',
              source: '$candidateFieldSource.fields',
            },
          },
        ],
      },
      formPermissionFieldSource,
      candidateFieldSource,
    },
  })

  const candidateFieldset = schemaDescriptor.schema.body.body.find(
    (item) => item?.title === '人员配置'
  )
  const fieldSelector = candidateFieldset.body[0].items.find((item) => item?.name === 'field')

  assert.deepEqual(fieldSelector.options, [{ label: '直属主管', value: 'managerId', type: 'text', name: 'managerId' }])
  assert.equal(fieldSelector.source, undefined)
})

test('reactflow property editor hides start node form permission in designer flows', async () => {
  const defaultSession = EditorSession.createFromDefinition({
    formatVersion: 2,
    id: 'default-flow',
    name: 'Default Flow',
    formType: 'default',
    formKey: 'order',
    nodes: [
      { id: 'start', type: 'StartNode', name: '发起节点' },
      { id: 'approve-a', type: 'ApprovalNode', name: '经理审批', subType: '单签' },
      { id: 'end', type: 'EndNode', name: '结束节点', terminalType: 'approved' },
    ],
    edges: [
      { id: 'e1', type: 'SEQUENCE', sourceId: 'start', targetId: 'approve-a' },
      { id: 'e2', type: 'SEQUENCE', sourceId: 'approve-a', targetId: 'end' },
    ],
  })
  const boundSession = EditorSession.createFromDefinition({
    formatVersion: 2,
    id: 'bound-flow',
    name: 'Bound Flow',
    formType: 'business-model',
    formKey: 'order',
    nodes: [
      { id: 'start', type: 'StartNode', name: '发起节点' },
      { id: 'approve-a', type: 'ApprovalNode', name: '经理审批', subType: '单签' },
      { id: 'end', type: 'EndNode', name: '结束节点', terminalType: 'approved' },
    ],
    edges: [
      { id: 'e1', type: 'SEQUENCE', sourceId: 'start', targetId: 'approve-a' },
      { id: 'e2', type: 'SEQUENCE', sourceId: 'approve-a', targetId: 'end' },
    ],
  })

  const defaultSchemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session: defaultSession,
    nodeId: 'start',
    targetKind: 'node:start',
    nodeType: 'start',
    fetcher,
    isReadonly: false,
    formType: 'default',
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })
  const boundSchemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session: boundSession,
    nodeId: 'start',
    targetKind: 'node:start',
    nodeType: 'start',
    fetcher,
    isReadonly: false,
    formType: 'business-model',
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })

  assert.ok(defaultSchemaDescriptor, 'schema descriptor should exist for default start node')
  assert.equal(defaultSchemaDescriptor.schema, null)
  assert.ok(boundSchemaDescriptor, 'schema descriptor should exist for bound start node')
  assert.equal(boundSchemaDescriptor.schema, null)
})

test('reactflow property editor exposes basic info for join-or nodes', async () => {
  const session = EditorSession.createFromDefinition({
    formatVersion: 2,
    id: 'join-flow',
    name: 'Join Flow',
    formType: 'default',
    formKey: 'join-form',
    nodes: [
      { id: 'start', type: 'StartNode', name: '发起节点' },
      { id: 'join-a', type: 'JoinNode', name: '合并', joinType: 'OR' },
      { id: 'end', type: 'EndNode', name: '结束节点', terminalType: 'approved' },
    ],
    edges: [
      { id: 'e1', type: 'SEQUENCE', sourceId: 'start', targetId: 'join-a' },
      { id: 'e2', type: 'SEQUENCE', sourceId: 'join-a', targetId: 'end' },
    ],
  })

  const schemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session,
    nodeId: 'join-a',
    targetKind: 'node:join-or',
    nodeType: 'join-or',
    fetcher,
    isReadonly: false,
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })

  assert.ok(schemaDescriptor, 'schema descriptor should exist for join-or node')
  assert.deepEqual(schemaDescriptor.schema.body.body, [
    {
      type: 'input-text',
      name: 'name',
      label: '节点名称',
      required: true,
      disabled: false,
      clearable: true,
    },
  ])
})

test('workflow inspector schema key ignores target identity but reacts to structural revisions', () => {
  const bridgeSchemaContext = pickWorkflowInspectorBridgeSchemaContext({
    fetcher: async () => ({}),
    flowKey: 'flow-a',
    nodeConfig: {
      hideFormPermission: true,
      approvalConfiguration: {
        hideActions: true,
      },
    },
    candidateSource,
    formPermissionFieldSource,
  })

  const baseKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: 'approval',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:2',
      fields: [],
    },
    bridgeContext: {
      ...bridgeSchemaContext,
      fetcher: async () => ({ data: {} }),
      flowKey: 'flow-b',
    },
  })
  const sameStructureKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: 'approval',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:2',
      fields: [{ label: '金额', value: 'amount' }],
    },
    bridgeContext: {
      ...bridgeSchemaContext,
      fetcher: async () => ({ data: { items: [] } }),
      flowKey: 'flow-c',
    },
  })
  const changedRevisionKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: 'approval',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:3',
      fields: [],
    },
    bridgeContext: bridgeSchemaContext,
  })
  const changedBridgeKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: 'approval',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:2',
      fields: [],
    },
    bridgeContext: {
      ...bridgeSchemaContext,
      candidateSource: {
        revisionToken: 'candidate:3',
        items: [],
      },
    },
  })

  assert.equal(baseKey, sameStructureKey)
  assert.notEqual(baseKey, changedRevisionKey)
  assert.notEqual(baseKey, changedBridgeKey)
})

test('workflow inspector value projection normalizes empty approval candidates outside the schema', () => {
  const session = {
    getRepository() {
      return new Map([
        [
          'approve-a',
          {
            id: 'approve-a',
            type: 'ApprovalNode',
            name: '经理审批',
            candidates: [],
            subType: '单签',
          },
        ],
      ])
    },
  }

  const valueProjection = buildNodeConfigValueProjection({
    session,
    nodeId: 'approve-a',
  })

  assert.deepEqual(valueProjection, {
    targetId: 'approve-a',
    values: {
      id: 'approve-a',
      type: 'ApprovalNode',
      name: '经理审批',
      subType: '单签',
      permission: [],
      candidates: [{ type: '' }],
    },
  })
})

test('workflow inspector exposes handle node candidates and permission without approval config', async () => {
  const session = {
    getRepository() {
      return new Map([
        [
          'handle-a',
          {
            id: 'handle-a',
            type: 'HandleNode',
            name: '办理节点',
            candidates: [],
          },
        ],
      ])
    },
  }

  const schemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session,
    nodeId: 'handle-a',
    targetKind: 'node:handle',
    nodeType: 'handle',
    fetcher,
    isReadonly: false,
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })
  const valueProjection = buildNodeConfigValueProjection({
    session,
    nodeId: 'handle-a',
  })

  assert.ok(schemaDescriptor, 'schema descriptor should exist for handle node')
  assert.deepEqual(getDrawerFieldsetTitles(schemaDescriptor.schema), ['基础信息', '人员配置', '表单权限配置'])
  assert.deepEqual(valueProjection.values.candidates, [{ type: '' }])
  assert.deepEqual(valueProjection.values.permission, [])
})

test('workflow inspector exposes cc node candidate configuration', async () => {
  const session = {
    getRepository() {
      return new Map([
        [
          'cc-a',
          {
            id: 'cc-a',
            type: 'CcNode',
            name: '抄送节点',
            candidates: [],
          },
        ],
      ])
    },
  }

  const schemaDescriptor = await buildNodeConfigSchemaDescriptor({
    session,
    nodeId: 'cc-a',
    targetKind: 'node:cc',
    nodeType: 'cc',
    fetcher,
    isReadonly: false,
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })
  const valueProjection = buildNodeConfigValueProjection({
    session,
    nodeId: 'cc-a',
  })

  assert.ok(schemaDescriptor, 'schema descriptor should exist for cc node')
  assert.deepEqual(getDrawerFieldsetTitles(schemaDescriptor.schema), ['基础信息', '抄送人员'])
  assert.equal(schemaDescriptor.schema.body.body[0].title, '基础信息')
  assert.equal(schemaDescriptor.schema.body.body[1].title, '抄送人员')
  assert.deepEqual(valueProjection.values.candidates, [{ type: '' }])
})

test('workflow inspector value projection provides empty permission arrays for permission-bearing nodes', () => {
  const session = {
    getRepository() {
      return new Map([
        [
          'start-a',
          {
            id: 'start-a',
            type: 'StartNode',
            name: '发起节点',
          },
        ],
        [
          'approve-a',
          {
            id: 'approve-a',
            type: 'ApprovalNode',
            name: '经理审批',
            subType: '单签',
            candidates: [{ type: 'UserSelect' }],
          },
        ],
      ])
    },
  }

  assert.deepEqual(
    buildNodeConfigValueProjection({
      session,
      nodeId: 'start-a',
    })?.values.permission,
    []
  )
  assert.deepEqual(
    buildNodeConfigValueProjection({
      session,
      nodeId: 'approve-a',
    })?.values.permission,
    []
  )
})

test('workflow inspector value projection defaults approval and handle permissions to visible fields', () => {
  const session = {
    getRepository() {
      return new Map([
        [
          'approve-a',
          {
            id: 'approve-a',
            type: 'ApprovalNode',
            name: '经理审批',
            subType: '单签',
            candidates: [],
          },
        ],
        [
          'handle-a',
          {
            id: 'handle-a',
            type: 'HandleNode',
            name: '办理节点',
            candidates: [],
            permission: [{ value: 'amount', visible: false, writable: false }],
          },
        ],
        [
          'start-a',
          {
            id: 'start-a',
            type: 'StartNode',
            name: '发起节点',
          },
        ],
      ])
    },
  }
  const source = {
    revisionToken: 'form-permission:2',
    fields: [
      { label: '金额', value: 'amount' },
      { label: '标题', value: 'title' },
    ],
  }

  assert.deepEqual(
    buildNodeConfigValueProjection({
      session,
      nodeId: 'approve-a',
      formPermissionFieldSource: source,
    })?.values.permission,
    [
      { label: '金额', value: 'amount', name: 'amount', visible: true, writable: false, required: false },
      { label: '标题', value: 'title', name: 'title', visible: true, writable: false, required: false },
    ]
  )
  assert.deepEqual(
    buildNodeConfigValueProjection({
      session,
      nodeId: 'handle-a',
      formPermissionFieldSource: source,
    })?.values.permission,
    [
      { label: '金额', value: 'amount', name: 'amount', visible: false, writable: false, required: false },
      { label: '标题', value: 'title', name: 'title', visible: true, writable: false, required: false },
    ]
  )
  assert.deepEqual(
    buildNodeConfigValueProjection({
      session,
      nodeId: 'start-a',
      formPermissionFieldSource: source,
    })?.values.permission,
    []
  )
})

test('workflow inspector schema key canonicalizes node type aliases', () => {
  const canonicalKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: 'ApprovalNode',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:2',
      fields: [],
    },
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })

  const legacyAliasKey = buildWorkflowInspectorSchemaKey({
    targetKind: 'node:approval',
    nodeType: '审批节点',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:2',
      fields: [],
    },
    bridgeContext: {
      nodeConfig: {},
      candidateSource,
      formPermissionFieldSource,
    },
  })

  assert.equal(canonicalKey, legacyAliasKey)
})

test('workflow inspector candidate submission keeps only the selected candidate value field', () => {
  const candidateSourceWithUsers = {
    ...candidateSource,
    items: candidateSource.items.map((item) =>
      item.name === 'User' ? { ...item, valueKey: 'users' } : item
    ),
  }

  assert.deepEqual(
    extractDrawerSubmitPayload(
      {
        candidates: [
          {
            type: 'UserSelect',
            mode: 'single',
            users: ['u1'],
          },
        ],
      },
      { candidateSource: candidateSourceWithUsers }
    ),
    {
      candidates: [{ type: 'UserSelect', mode: 'single' }],
    }
  )
})

test('route edge drawer contract remains available for legacy branch editor compatibility', () => {
  const edge = {
    id: 'edge-b-2',
    data: {
      name: '金额大于 1000',
      order: 20,
      condition: { expression: 'amount > 1000' },
    },
  }

  const drawerRequest = buildRouteEdgeDrawerRequest(edge, [{ label: '金额', value: 'amount' }])

  assert.equal(drawerRequest.body.body.length, 1)
  assert.equal(drawerRequest.body.body[0].type, 'condition-builder')
  assert.equal(drawerRequest.body.body[0].name, 'condition')
  assert.deepEqual(drawerRequest.body.body[0].fields, [
    { label: '金额', value: 'amount', name: 'amount', type: 'text' },
  ])
})

test('inline workflow edge inspector contract keeps schema and values separate', () => {
  const schemaDescriptor = buildWorkflowEdgeInspectorSchemaDescriptor({
    targetKind: 'edge:sequence',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:9',
      fields: [{ label: '金额', value: 'amount' }],
    },
    hasOrder: true,
  })

  assert.equal(
    schemaDescriptor.schemaKey,
    buildWorkflowEdgeInspectorSchemaKey({
      targetKind: 'edge:sequence',
      isReadonly: false,
      conditionFieldSource: {
        revisionToken: 'form-fields:9',
        fields: [{ label: '金额', value: 'amount' }],
      },
      hasOrder: true,
    })
  )
  assert.equal(schemaDescriptor.summaryOnly, false)
  assert.equal(schemaDescriptor.schema.body[0].type, 'condition-builder')
  assert.equal(schemaDescriptor.schema.body[0].name, 'condition')
  assert.equal(schemaDescriptor.schema.body[0].value, undefined)
  assert.equal(schemaDescriptor.schema.body[1].name, 'order')

  const valueProjection = buildWorkflowEdgeInspectorValueProjection({
    edge: {
      id: 'edge-b-2',
      data: {
        condition: {
          conjunction: 'and',
          children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }],
        },
        order: 20,
      },
    },
    hasOrder: true,
  })

  assert.deepEqual(valueProjection, {
    targetId: 'edge-b-2',
    values: {
      condition: {
        conjunction: 'and',
        children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }],
      },
      order: 20,
    },
  })
})

test('inline workflow edge inspector projects missing condition as stable empty route value', () => {
  const valueProjection = buildWorkflowEdgeInspectorValueProjection({
    edge: {
      id: 'edge-without-condition',
      data: {
        edgeType: 'SEQUENCE',
      },
    },
    hasOrder: false,
  })

  assert.deepEqual(valueProjection, {
    targetId: 'edge-without-condition',
    values: {
      condition: null,
    },
  })
})

test('inline workflow edge inspector patch keeps canonical edge payload', () => {
  const edge = {
    id: 'edge-b-2',
    data: {
      name: '金额大于 1000',
      order: 20,
      condition: {
        conjunction: 'and',
        children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }],
      },
    },
  }

  const patch = buildWorkflowEdgeConditionPatch({
    edge,
    submission: {
      condition: {
        conjunction: 'and',
        children: [{ left: { field: 'amount' }, op: 'greater_or_equal', right: 1000 }],
      },
    },
  })

  assert.deepEqual(patch, {
    name: undefined,
    condition: {
      conjunction: 'and',
      children: [{ left: { field: 'amount' }, op: 'greater_or_equal', right: 1000 }],
    },
    order: 20,
  })

  const legacyPatch = normalizeRouteEdgePatch(edge, {
    condition: {
      conjunction: 'and',
      children: [{ left: { field: 'amount' }, op: 'greater_or_equal', right: 1000 }],
    },
  })

  assert.deepEqual(legacyPatch, {
    name: undefined,
    condition: {
      conjunction: 'and',
      children: [{ left: { field: 'amount' }, op: 'greater_or_equal', right: 1000 }],
    },
    order: 20,
  })
})

test('condition summary favors human-readable expression output', () => {
  assert.equal(summarizeCondition({ expression: 'amount > 1000' }), 'amount > 1000')
  assert.equal(summarizeCondition({ conjunction: 'and', children: [{}, {}] }), '2 个条件')
})

test('edge inspector schema falls back to summary mode when no condition field source exists', () => {
  const schemaDescriptor = buildWorkflowEdgeInspectorSchemaDescriptor({
    targetKind: 'edge:sequence',
    isReadonly: false,
    conditionFieldSource: {
      revisionToken: 'form-fields:0',
      fields: [],
    },
    hasOrder: false,
  })

  assert.equal(schemaDescriptor.summaryOnly, true)
  assert.equal(schemaDescriptor.schema, null)
})

test('split edge condition contract is inferred from multiple outgoing edges even before metadata exists', () => {
  const edges = [
    {
      id: 'edge-route-a',
      source: 'start-1',
      target: 'approval-1',
      data: {
        edgeType: 'SEQUENCE',
      },
    },
    {
      id: 'edge-route-b',
      source: 'start-1',
      target: 'approval-2',
      data: {
        edgeType: 'SEQUENCE',
      },
    },
    {
      id: 'edge-linear',
      source: 'approval-2',
      target: 'end-1',
      data: {
        edgeType: 'SEQUENCE',
      },
    },
  ]

  const splitContext = resolveSplitEdgeContext(edges[0], edges)

  assert.deepEqual(splitContext, {
    sourceId: 'start-1',
    outgoingCount: 2,
    isSplitEdge: true,
    hasExplicitRouteMetadata: false,
  })
  assert.equal(edgeBelongsToConditionalRoute(edges[0], edges), true)
  assert.equal(edgeBelongsToConditionalRoute(edges[1], edges), true)
  assert.equal(edgeBelongsToConditionalRoute(edges[2], edges), false)
})

test('linear edge condition contract ignores null route metadata from persisted definitions', () => {
  const edges = [
    {
      id: 'edge-linear',
      source: 'approval-1',
      target: 'end-1',
      data: {
        edgeType: 'SEQUENCE',
        condition: null,
        order: null,
      },
    },
  ]

  assert.deepEqual(resolveSplitEdgeContext(edges[0], edges), {
    sourceId: 'approval-1',
    outgoingCount: 1,
    isSplitEdge: false,
    hasExplicitRouteMetadata: false,
  })
  assert.equal(edgeBelongsToConditionalRoute(edges[0], edges), false)
})
