import { describe, expect, it } from 'vitest'
import { EditorSession } from '../../../../src/editor-session/index.js'
import {
  definitionToReactFlow,
  middleToReactFlow,
  middleTypeToReactFlowType,
  reactFlowTypeToMiddleType,
  reactFlowToDefinitionV2,
  getNodePosition,
  extractLayoutFromReactFlow,
} from '../../../../src/canvas-adapters/react-flow/index.js'
import {
  v1DefinitionFixture,
  v2DefinitionFixture,
  v2BranchDefinitionFixture,
} from '../../../integration/workflow/harness/fixtures.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const sortIds = (items) => [...items].sort()

describe('React Flow adapter - core conversion', () => {
  it('maps node types in both directions', () => {
    expect(middleTypeToReactFlowType('审批节点')).toBe('approval')
    expect(middleTypeToReactFlowType('办理节点')).toBe('handle')
    expect(middleTypeToReactFlowType('未知节点')).toBe('default')
    expect(reactFlowTypeToMiddleType('branch')).toBe('分流节点')
    expect(reactFlowTypeToMiddleType('handle')).toBe('办理节点')
    expect(middleTypeToReactFlowType('合并节点')).toBe('join-or')
    expect(reactFlowTypeToMiddleType('join-or')).toBe('合并节点')
    expect(reactFlowTypeToMiddleType('unknown')).toBeNull()
  })

  it('returns deterministic positions when layout metadata is missing', () => {
    expect(getNodePosition('start-a', null, 0)).toEqual({ x: 100, y: 100 })
    expect(getNodePosition('approve-a', null, 4)).toEqual({ x: 350, y: 250 })
  })

  it('returns empty canvas data for missing workflow', () => {
    expect(middleToReactFlow(null, null)).toEqual({ nodes: [], edges: [] })
    expect(middleToReactFlow({}, null)).toEqual({ nodes: [], edges: [] })
  })

  it('converts a simple linear middle graph into React Flow nodes and edges', () => {
    const session = EditorSession.createFromDefinition(clone(v1DefinitionFixture))
    const reactFlowData = middleToReactFlow(session.getWorkflow(), null)

    expect(reactFlowData.nodes.length).toBe(3)
    expect(reactFlowData.edges.length).toBe(2)
    
    const startNode = reactFlowData.nodes.find(n => n.id === 'start-a')
    const approveNode = reactFlowData.nodes.find(n => n.id === 'approve-a')
    const endNode = reactFlowData.nodes.find(n => n.type === 'end')
    
    expect(startNode).toBeDefined()
    expect(approveNode).toBeDefined()
    expect(endNode).toBeDefined()
    expect(endNode.id).toBe('end-flow-v1')
  })

  it('converts V2 branch definitions into direct edge branches with one explicit end node', () => {
    const session = EditorSession.createFromDefinition(clone(v2BranchDefinitionFixture))
    const reactFlowData = middleToReactFlow(session.getWorkflow(), null)
    const nodeIds = sortIds(reactFlowData.nodes.map((node) => node.id))
    const edgeIds = sortIds(reactFlowData.edges.map((edge) => edge.id))
    const nodeById = new Map(reactFlowData.nodes.map((node) => [node.id, node]))
    const highAmountEdge = reactFlowData.edges.find((edge) => edge.id === 'edge-b-2')

    expect(nodeIds).toEqual([
      'after-b',
      'branch-approve-b',
      'branch-approve-c',
      'branch-end-b',
      'start-b',
    ])
    expect(edgeIds).toEqual([
      'edge-b-2',
      'edge-b-3',
      'edge-b-6',
      'seq-after-b-branch-end-b',
      'seq-branch-approve-b-branch-end-b',
      'seq-branch-approve-c-branch-end-b',
      'seq-start-b-after-b',
    ])
    expect(nodeById.get('start-b')?.type).toBe('start')
    expect(nodeById.get('branch-end-b')?.type).toBe('end')
    expect(highAmountEdge?.label).toBeTruthy()
    expect(highAmountEdge?.data?.name).toBeUndefined()
    expect(highAmountEdge?.data?.condition).toEqual({
      conjunction: 'and',
      children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }],
    })
  })

  it('uses provided layout metadata and extracts non-synthetic layout back out', () => {
    const session = EditorSession.createFromDefinition(clone(v2DefinitionFixture))
    const editorLayout = {
      nodePositions: {
        'start-a': { x: 32, y: 48 },
      },
      viewport: { x: 24, y: -12, zoom: 0.75 },
    }
    const reactFlowData = middleToReactFlow(session.getWorkflow(), editorLayout)
    const layout = extractLayoutFromReactFlow(
      [
        ...reactFlowData.nodes,
        { id: 'end-1', type: 'end', position: { x: 700, y: 800 } },
      ],
      editorLayout.viewport
    )

    expect(reactFlowData.nodes[0].position).toEqual({ x: 32, y: 48 })
    expect(layout).toEqual({
      nodePositions: {
        'start-a': { x: 32, y: 48 },
        'approve-a': { x: 350, y: 100 },
        'end-a': { x: 600, y: 100 },
        'end-1': { x: 700, y: 800 },
      },
      viewport: { x: 24, y: -12, zoom: 0.75 },
    })
  })

  it('projects detached nodes directly from definition graph', () => {
    const definition = {
      ...clone(v2DefinitionFixture),
      editorLayout: {
        nodePositions: {
          'start-a': { x: 32, y: 48 },
          'approve-a': { x: 280, y: 48 },
          'end-a': { x: 540, y: 48 },
          'end-detached': { x: 820, y: 200 },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      nodes: [
        ...clone(v2DefinitionFixture.nodes),
        {
          id: 'end-detached',
          type: '结束节点',
          name: '自由结束',
        },
      ],
    }

    const reactFlowData = definitionToReactFlow(definition, definition.editorLayout)
    const nodeIds = sortIds(reactFlowData.nodes.map((node) => node.id))
    const detachedNode = reactFlowData.nodes.find((node) => node.id === 'end-detached')

    expect(nodeIds).toEqual(['approve-a', 'end-a', 'end-detached', 'start-a'])
    expect(detachedNode?.type).toBe('end')
    expect(detachedNode?.position).toEqual({ x: 820, y: 200 })
    expect(detachedNode?.data?.name).toBe('自由结束')
  })

  it('projects explicit join-or nodes from the persisted definition graph', () => {
    const definition = {
      ...clone(v2DefinitionFixture),
      nodes: [
        clone(v2DefinitionFixture.nodes[0]),
        clone(v2DefinitionFixture.nodes[1]),
        { id: 'join-a', type: '合并节点', name: '合并', joinType: 'OR' },
        clone(v2DefinitionFixture.nodes[2]),
      ],
      edges: [
        { id: 'edge-start-join', type: 'SEQUENCE', sourceId: 'start-a', targetId: 'join-a' },
        { id: 'edge-approve-join', type: 'SEQUENCE', sourceId: 'approve-a', targetId: 'join-a' },
        { id: 'edge-join-end', type: 'SEQUENCE', sourceId: 'join-a', targetId: 'end-a' },
      ],
    }

    const reactFlowData = definitionToReactFlow(definition, definition.editorLayout)
    const joinNode = reactFlowData.nodes.find((node) => node.id === 'join-a')

    expect(joinNode?.type).toBe('join-or')
    expect(joinNode?.data?.joinType).toBe('OR')
    expect(
      reactFlowData.edges.filter((edge) => edge.target === 'join-a').map((edge) => edge.id).sort()
    ).toEqual(['edge-approve-join', 'edge-start-join'])
  })

  it('round-trips HandleNode between definition and React Flow without approval fields', () => {
    const definition = {
      formatVersion: 2,
      id: 'handle-flow',
      name: 'Handle Flow',
      formType: 'default',
      formKey: 'handle-form',
      nodes: [
        { id: 'start-a', type: 'StartNode', name: '发起节点' },
        {
          id: 'handle-a',
          type: 'HandleNode',
          name: '办理节点',
          candidates: [{ type: 'User', users: ['u1'] }],
          permission: [{ field: 'amount', permission: 'EDITABLE' }],
        },
        { id: 'end-a', type: 'EndNode', name: '结束' },
      ],
      edges: [
        { id: 'edge-start-handle', type: 'SEQUENCE', sourceId: 'start-a', targetId: 'handle-a' },
        { id: 'edge-handle-end', type: 'SEQUENCE', sourceId: 'handle-a', targetId: 'end-a' },
      ],
    }

    const reactFlowData = definitionToReactFlow(definition)
    const handleNode = reactFlowData.nodes.find((node) => node.id === 'handle-a')

    expect(handleNode?.type).toBe('handle')
    expect(handleNode?.data?.candidates).toEqual([{ type: 'User', users: ['u1'] }])
    expect(handleNode?.data?.permission).toEqual([{ field: 'amount', permission: 'EDITABLE' }])

    const encodedDefinition = reactFlowToDefinitionV2(reactFlowData.nodes, reactFlowData.edges, definition)
    const encodedHandleNode = encodedDefinition.nodes.find((node) => node.id === 'handle-a')

    expect(encodedHandleNode).toEqual({
      type: 'HandleNode',
      name: '办理节点',
      id: 'handle-a',
      candidates: [{ type: 'User', users: ['u1'] }],
      permission: [{ field: 'amount', permission: 'EDITABLE' }],
    })
    expect(encodedHandleNode.actions).toBeUndefined()
    expect(encodedHandleNode.subType).toBeUndefined()
    expect(encodedHandleNode.rejectAction).toBeUndefined()
  })
})
