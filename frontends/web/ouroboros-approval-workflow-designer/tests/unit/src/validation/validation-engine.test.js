import { describe, expect, it } from 'vitest'
import {
  ValidationEngine,
  WORKFLOW_DIAGNOSTIC_CODES,
  buildWorkflowValidationSnapshot,
} from '../../../../src/validation/validationEngine.js'

const createNode = (id, type, data = {}) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
})

describe('ValidationEngine', () => {
  it('validates React Flow node types against connection rules', () => {
    const engine = new ValidationEngine([
      createNode('start-1', 'start', { name: '发起节点' }),
      createNode('approval-1', 'approval', { name: '经理审批' }),
    ])

    expect(engine.validateConnection('start-1', 'approval-1')).toMatchObject({
      valid: true,
    })
  })

  it('rejects invalid manual connections to condition nodes', () => {
    const engine = new ValidationEngine([
      createNode('start-1', 'start', { name: '发起节点' }),
      createNode('condition-1', 'condition', {
        name: '条件节点',
        branchNodeId: 'branch-1',
      }),
    ])

    const result = engine.validateConnection('start-1', 'condition-1')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('不能连接到')
  })

  it('rejects connections that would create a cycle', () => {
    const nodes = [
      createNode('approval-0', 'approval', { name: '审批节点 A' }),
      createNode('approval-1', 'approval', { name: '审批节点 B' }),
      createNode('approval-2', 'approval', { name: '审批节点 B' }),
    ]
    const edges = [
      { id: 'edge-1', source: 'approval-0', target: 'approval-1' },
      { id: 'edge-2', source: 'approval-1', target: 'approval-2' },
    ]
    const engine = new ValidationEngine(nodes, edges)

    expect(engine.validateConnection('approval-2', 'approval-0')).toMatchObject({
      valid: false,
      error: '这条连线会形成循环，请选择其他节点',
    })
  })

  it('rejects branch to condition connections in graph validation', () => {
    const nodes = [
      createNode('branch-1', 'branch', { name: '分流节点' }),
      createNode('condition-1', 'condition', {
        name: '条件节点',
        branchNodeId: 'branch-1',
      }),
      createNode('approval-1', 'approval', { name: '审批节点' }),
    ]
    const edges = [
      {
        id: 'edge-branch-entry',
        source: 'branch-1',
        target: 'condition-1',
        data: { edgeType: 'BRANCH_ENTRY' },
      },
      {
        id: 'edge-branch-target',
        source: 'condition-1',
        target: 'approval-1',
        data: { edgeType: 'BRANCH' },
      },
    ]
    const engine = new ValidationEngine(nodes, edges)

    const result = engine.validateGraph()
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].edgeId).toBe('edge-branch-entry')
  })

  it('allows multiple upstream edges to explicit join-or nodes', () => {
    const nodes = [
      createNode('approval-1', 'approval', { name: '审批 A' }),
      createNode('approval-2', 'approval', { name: '审批 B' }),
      createNode('join-1', 'join-or', { name: '合并', joinType: 'OR' }),
    ]
    const edges = [{ id: 'edge-a', source: 'approval-1', target: 'join-1' }]
    const engine = new ValidationEngine(nodes, edges)

    expect(engine.validateConnection('approval-2', 'join-1')).toMatchObject({
      valid: true,
    })
  })

  it('reports invalid edges in an existing graph', () => {
    const nodes = [
      createNode('start-1', 'start', { name: '发起节点' }),
      createNode('condition-1', 'condition', {
        name: '条件节点',
        branchNodeId: 'branch-1',
      }),
    ]
    const edges = [{ id: 'edge-invalid', source: 'start-1', target: 'condition-1' }]
    const engine = new ValidationEngine(nodes, edges)

    const result = engine.validateGraph()
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].edgeId).toBe('edge-invalid')
    expect(result.errors[0].code).toBe('CONNECTION_RULE')
    expect(result.errors[0].error).toContain('不能连接到')
  })

  it('builds draft-invalid diagnostics for blocking node, edge and graph issues', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('approval-1', 'approval', { name: '经理审批', candidates: [] }),
        createNode('approval-2', 'approval', {
          name: '财务审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
      ],
      edges: [
        {
          id: 'edge-condition-empty',
          source: 'approval-1',
          target: 'approval-2',
          data: {
            edgeType: 'SEQUENCE',
            condition: {},
          },
        },
      ],
      conditionFieldSource: {
        fields: [],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items.every((item) => item.persistUntilResolved)).toBe(true)
    expect(snapshot.items.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        WORKFLOW_DIAGNOSTIC_CODES.APPROVAL_NODE_CANDIDATES_REQUIRED,
        WORKFLOW_DIAGNOSTIC_CODES.EDGE_CONDITION_REQUIRED,
        WORKFLOW_DIAGNOSTIC_CODES.CONDITION_FIELD_SOURCE_REQUIRED,
      ])
    )
  })

  it('uses a blocking HandleNode diagnostic when candidates are empty', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('handle-1', 'handle', { name: '办理节点', candidates: [] }),
        createNode('end-1', 'end', { name: '结束' }),
      ],
      edges: [
        { id: 'edge-start-handle', source: 'start-1', target: 'handle-1' },
        { id: 'edge-handle-end', source: 'handle-1', target: 'end-1' },
      ],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `node:handle-1:${WORKFLOW_DIAGNOSTIC_CODES.HANDLE_NODE_CANDIDATES_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.HANDLE_NODE_CANDIDATES_REQUIRED,
          targetType: 'node',
          targetId: 'handle-1',
          blocking: true,
          persistUntilResolved: true,
        }),
      ])
    )
  })

  it('builds blocking diagnostics for duplicate start nodes', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '流程开始' }),
        createNode('start-2', 'start', { name: '流程开始' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('end-1', 'end', { name: '流程结束' }),
      ],
      edges: [
        { id: 'edge-start-approval', source: 'start-1', target: 'approval-1' },
        { id: 'edge-approval-end', source: 'approval-1', target: 'end-1' },
      ],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `node:start-1:${WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED,
          targetType: 'node',
          targetId: 'start-1',
          blocking: true,
          persistUntilResolved: true,
        }),
        expect.objectContaining({
          id: `node:start-2:${WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED,
          targetType: 'node',
          targetId: 'start-2',
          blocking: true,
          persistUntilResolved: true,
        }),
      ])
    )
  })

  it('builds a blocking graph diagnostic when the start node is missing', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('end-1', 'end', { name: '流程结束' }),
      ],
      edges: [{ id: 'edge-approval-end', source: 'approval-1', target: 'end-1' }],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `graph:${WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED,
          message: '画布必须包含一个流程开始节点',
          targetType: 'graph',
          blocking: true,
          persistUntilResolved: true,
        }),
      ])
    )
  })

  it('builds a blocking diagnostic when timeout transfer target is empty', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
          timeout: {
            duration: 'PT2H',
            action: 'transfer',
            transferTo: '   ',
          },
        }),
        createNode('end-1', 'end', { name: '结束' }),
      ],
      edges: [
        { id: 'edge-start-approval', source: 'start-1', target: 'approval-1' },
        { id: 'edge-approval-end', source: 'approval-1', target: 'end-1' },
      ],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `node:approval-1:${WORKFLOW_DIAGNOSTIC_CODES.TIMEOUT_TRANSFER_TARGET_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.TIMEOUT_TRANSFER_TARGET_REQUIRED,
          targetType: 'node',
          targetId: 'approval-1',
          blocking: true,
          persistUntilResolved: true,
        }),
      ])
    )
  })

  it('builds a persistent warning for conditional route coverage confirmation', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('approval-2', 'approval', {
          name: '财务审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('end-1', 'end', { name: '结束 A' }),
        createNode('end-2', 'end', { name: '结束 B' }),
      ],
      edges: [
        {
          id: 'edge-route-a',
          source: 'start-1',
          target: 'approval-1',
          data: {
            edgeType: 'SEQUENCE',
            condition: {
              conjunction: 'and',
              children: [
                { left: { type: 'field', field: 'amount' }, op: 'less', right: 1000 },
              ],
            },
          },
        },
        {
          id: 'edge-route-b',
          source: 'start-1',
          target: 'approval-2',
          data: {
            edgeType: 'SEQUENCE',
            condition: {
              conjunction: 'and',
              children: [
                {
                  left: { type: 'field', field: 'amount' },
                  op: 'greater_or_equal',
                  right: 1000,
                },
              ],
            },
          },
        },
        {
          id: 'edge-end-a',
          source: 'approval-1',
          target: 'end-1',
        },
        {
          id: 'edge-end-b',
          source: 'approval-2',
          target: 'end-2',
        },
      ],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('warning')
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0]).toMatchObject({
      severity: 'warning',
      code: WORKFLOW_DIAGNOSTIC_CODES.CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED,
      targetType: 'node',
      targetId: 'start-1',
      blocking: false,
      persistUntilResolved: true,
    })
  })

  it('treats multiple outgoing sequence edges as conditional routes even before a condition payload is written', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('approval-2', 'approval', {
          name: '财务审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('end-1', 'end', { name: '结束 A' }),
        createNode('end-2', 'end', { name: '结束 B' }),
      ],
      edges: [
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
          id: 'edge-end-a',
          source: 'approval-1',
          target: 'end-1',
        },
        {
          id: 'edge-end-b',
          source: 'approval-2',
          target: 'end-2',
        },
      ],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        WORKFLOW_DIAGNOSTIC_CODES.EDGE_CONDITION_REQUIRED,
        WORKFLOW_DIAGNOSTIC_CODES.CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED,
      ])
    )
    expect(
      snapshot.items.filter(
        (item) => item.code === WORKFLOW_DIAGNOSTIC_CODES.EDGE_CONDITION_REQUIRED
      )
    ).toHaveLength(2)
  })

  it('does not treat null condition metadata on a linear persisted edge as a conditional route', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
        createNode('end-1', 'end', { name: '结束' }),
      ],
      edges: [
        {
          id: 'edge-start-approval',
          source: 'start-1',
          target: 'approval-1',
          data: {
            edgeType: 'SEQUENCE',
            condition: null,
            order: null,
          },
        },
        {
          id: 'edge-approval-end',
          source: 'approval-1',
          target: 'end-1',
          data: {
            edgeType: 'SEQUENCE',
            condition: null,
            order: null,
          },
        },
      ],
      conditionFieldSource: {
        fields: [],
      },
    })

    expect(snapshot.status).toBe('clean')
    expect(snapshot.items).toEqual([])
  })

  it('builds a blocking diagnostic when a non-end node has no outgoing edge', () => {
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('start-1', 'start', { name: '发起节点' }),
        createNode('approval-1', 'approval', {
          name: '经理审批',
          candidates: [{ type: 'UserSelect', mode: 'single' }],
        }),
      ],
      edges: [{ id: 'edge-1', source: 'start-1', target: 'approval-1' }],
      conditionFieldSource: {
        fields: [{ name: 'amount', label: '金额' }],
      },
    })

    expect(snapshot.status).toBe('draft-invalid')
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.NODE_OUTGOING_REQUIRED,
          targetType: 'node',
          targetId: 'approval-1',
          blocking: true,
          persistUntilResolved: true,
        }),
      ])
    )
  })
})

describe('form field revision diagnostics', () => {
  it('retains the draft condition and diagnoses a removed field inside nested groups', () => {
    const condition = {
      conjunction: 'and',
      children: [
        {
          conjunction: 'or',
          children: [
            { left: { type: 'field', field: 'removed' }, op: 'equal', right: 1 },
          ],
        },
      ],
    }
    const edges = [
      { id: 'route', source: 's', target: 'a', data: { condition } },
      { id: 'fallback', source: 's', target: 'e' },
    ]
    const snapshot = buildWorkflowValidationSnapshot({
      nodes: [
        createNode('s', 'start'),
        createNode('a', 'approval'),
        createNode('e', 'end'),
      ],
      edges,
      conditionFieldSource: { fields: [{ name: 'amount' }] },
    })
    expect(snapshot.items).toContainEqual(
      expect.objectContaining({
        code: 'CONDITION_FIELD_UNAVAILABLE',
        targetId: 'route',
        message: expect.stringContaining('removed'),
      })
    )
    expect(edges[0].data.condition).toEqual(condition)
  })
})
