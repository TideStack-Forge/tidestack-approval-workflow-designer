import { describe, it, expect } from 'vitest'
import {
  NODE_TYPES,
  isValidConnection,
  hasCycle,
  validateBranchOwnership,
} from '../../../../src/validation/connection-rules.js'

describe('Connection Rules', () => {
  it('should allow start to approval connection', () => {
    expect(isValidConnection(NODE_TYPES.START, NODE_TYPES.APPROVAL)).toBe(true)
  })

  it('should allow start to branch connection', () => {
    expect(isValidConnection(NODE_TYPES.START, NODE_TYPES.BRANCH)).toBe(true)
  })

  it('should reject start to start connection', () => {
    expect(isValidConnection(NODE_TYPES.START, NODE_TYPES.START)).toBe(false)
  })

  it('should allow workflow nodes to connect to the explicit end node', () => {
    expect(isValidConnection(NODE_TYPES.START, NODE_TYPES.END)).toBe(true)
    expect(isValidConnection(NODE_TYPES.APPROVAL, NODE_TYPES.END)).toBe(true)
    expect(isValidConnection(NODE_TYPES.BRANCH, NODE_TYPES.END)).toBe(true)
  })

  it('should reject any connection from end node', () => {
    expect(isValidConnection(NODE_TYPES.END, NODE_TYPES.START)).toBe(false)
    expect(isValidConnection(NODE_TYPES.END, NODE_TYPES.APPROVAL)).toBe(false)
  })

  it('should reject manual connections to condition nodes', () => {
    expect(isValidConnection(NODE_TYPES.START, NODE_TYPES.CONDITION)).toBe(false)
    expect(isValidConnection(NODE_TYPES.APPROVAL, NODE_TYPES.CONDITION)).toBe(false)
  })

  it('should allow condition to approval connection', () => {
    expect(isValidConnection(NODE_TYPES.CONDITION, NODE_TYPES.APPROVAL)).toBe(true)
  })
})

describe('Cycle Detection', () => {
  it('should detect simple cycle', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]
    const newEdge = { source: 'c', target: 'a' }

    expect(hasCycle(nodes, edges, newEdge)).toBe(true)
  })

  it('should not detect cycle in linear flow', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]
    const newEdge = { source: 'c', target: 'd' }

    expect(hasCycle(nodes, edges, newEdge)).toBe(false)
  })

  it('should detect self-loop', () => {
    const nodes = [{ id: 'a' }]
    const edges = []
    const newEdge = { source: 'a', target: 'a' }

    expect(hasCycle(nodes, edges, newEdge)).toBe(true)
  })
})

describe('Branch Ownership Validation', () => {
  it('should validate branch with condition nodes', () => {
    const branchNode = { id: 'branch-1', type: NODE_TYPES.BRANCH }
    const conditionNodes = [
      { id: 'cond-1', type: NODE_TYPES.CONDITION, data: { branchNodeId: 'branch-1' } },
    ]

    const result = validateBranchOwnership(branchNode, conditionNodes)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject branch without condition nodes', () => {
    const branchNode = { id: 'branch-1', type: NODE_TYPES.BRANCH }
    const conditionNodes = []

    const result = validateBranchOwnership(branchNode, conditionNodes)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject condition node with wrong branch ownership', () => {
    const branchNode = { id: 'branch-1', type: NODE_TYPES.BRANCH }
    const conditionNodes = [
      { id: 'cond-1', type: NODE_TYPES.CONDITION, data: { branchNodeId: 'branch-2' } },
    ]

    const result = validateBranchOwnership(branchNode, conditionNodes)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
