import { describe, expect, it } from 'vitest'
import {
  buildGraphDeleteRequest,
  GRAPH_DELETE_SOURCES,
  planGraphDelete,
} from '../../../src/canvas-adapters/react-flow/planGraphDelete.js'

const createNode = (id, type) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {
    name: id,
  },
})

describe('planGraphDelete', () => {
  it('normalizes duplicate delete targets into a single request', () => {
    expect(
      buildGraphDeleteRequest({
        source: GRAPH_DELETE_SOURCES.TOOLBAR,
        nodeIds: ['start-a', 'start-a', null],
        edgeIds: ['edge-1', 'edge-1'],
      })
    ).toEqual({
      source: GRAPH_DELETE_SOURCES.TOOLBAR,
      nodeIds: ['start-a'],
      edgeIds: ['edge-1'],
    })
  })

  it('allows deleting the start node and leaves start cardinality validation to the workflow validator', () => {
    const nodes = [createNode('start-a', 'start'), createNode('approve-a', 'approval')]
    const edges = [{ id: 'edge-1', source: 'start-a', target: 'approve-a' }]

    const outcome = planGraphDelete({
      nodes,
      edges,
      request: {
        source: GRAPH_DELETE_SOURCES.NODE_ACTION,
        nodeIds: ['start-a'],
        edgeIds: [],
      },
    })

    expect(outcome.kind).toBe('applied')
    expect(outcome.nextNodes.map((node) => node.id)).toEqual(['approve-a'])
    expect(outcome.nextEdges).toEqual([])
  })

  it('allows deleting an end node while keeping the rest of the graph intact', () => {
    const nodes = [createNode('start-a', 'start'), createNode('approve-a', 'approval'), createNode('end-a', 'end')]
    const edges = [
      { id: 'edge-1', source: 'start-a', target: 'approve-a' },
      { id: 'edge-2', source: 'approve-a', target: 'end-a' },
    ]

    const outcome = planGraphDelete({
      nodes,
      edges,
      request: {
        source: GRAPH_DELETE_SOURCES.NODE_ACTION,
        nodeIds: ['end-a'],
        edgeIds: [],
      },
    })

    expect(outcome.kind).toBe('applied')
    expect(outcome.nextNodes.map((node) => node.id)).toEqual(['start-a', 'approve-a'])
    expect(outcome.nextEdges.map((edge) => edge.id)).toEqual(['edge-1'])
  })

  it('keeps bridge-edge rewiring when deleting a middle node', () => {
    const nodes = [
      createNode('start-a', 'start'),
      createNode('approve-a', 'approval'),
      createNode('subprocess-a', 'subprocess'),
      createNode('end-a', 'end'),
    ]
    const edges = [
      { id: 'edge-1', source: 'start-a', target: 'approve-a' },
      { id: 'edge-2', source: 'approve-a', target: 'subprocess-a' },
      { id: 'edge-3', source: 'subprocess-a', target: 'end-a' },
    ]

    const outcome = planGraphDelete({
      nodes,
      edges,
      request: {
        source: GRAPH_DELETE_SOURCES.TOOLBAR,
        nodeIds: ['subprocess-a'],
        edgeIds: [],
      },
    })

    expect(outcome.kind).toBe('applied')
    expect(outcome.nextNodes.map((node) => node.id)).toEqual(['start-a', 'approve-a', 'end-a'])
    expect(outcome.nextEdges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      'start-a->approve-a',
      'approve-a->end-a',
    ])
  })
})
