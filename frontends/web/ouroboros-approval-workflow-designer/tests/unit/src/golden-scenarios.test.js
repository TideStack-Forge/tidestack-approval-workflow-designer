const assert = require('assert')
const fs = require('fs')
const path = require('path')

const fixturesDir = path.resolve(
  __dirname,
  '../../../../../../testing/fixtures/approval-workflow/v2-explicit-graph'
)

const loadScenario = (filename) => {
  const filePath = path.join(fixturesDir, filename)
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const outgoingSequenceCountBySource = (definition) => {
  const result = new Map()
  ;(definition.edges || []).forEach((edge) => {
    if (edge.type !== 'SEQUENCE') {
      return
    }
    const current = result.get(edge.sourceId) || 0
    result.set(edge.sourceId, current + 1)
  })
  return result
}

test('golden scenarios align with unified gateway/join semantics', () => {
  const scenario1 = loadScenario('golden-scenario-1-single-branch.json')
  const scenario2 = loadScenario('golden-scenario-2-or-branch.json')
  const scenario3 = loadScenario('golden-scenario-3-nested-branch.json')

  const scenarios = [scenario1, scenario2, scenario3]

  scenarios.forEach((scenario) => {
    ;(scenario.edges || []).forEach((edge) => {
      assert.equal(edge.type, 'SEQUENCE')
    })

    ;(scenario.nodes || []).forEach((node) => {
      assert.notEqual(node.splitType, 'XOR')
      assert.notEqual(node.joinType, 'XOR')
      assert.notEqual(node.type, 'XORGatewayNode')
      assert.notEqual(node.type, 'XORJoinNode')
    })
  })

  const scenario1NodeById = new Map((scenario1.nodes || []).map((node) => [node.id, node]))
  const scenario3NodeById = new Map((scenario3.nodes || []).map((node) => [node.id, node]))

  const scenario1OutgoingCount = outgoingSequenceCountBySource(scenario1)
  const scenario3OutgoingCount = outgoingSequenceCountBySource(scenario3)

  const scenario1HasXorByConditionalEdges = Array.from(scenario1OutgoingCount.entries()).some(
    ([sourceId, count]) => {
      if (count < 2) {
        return false
      }
      const node = scenario1NodeById.get(sourceId)
      return node && node.type !== 'GatewayNode' && node.type !== 'JoinNode'
    }
  )
  assert.equal(scenario1HasXorByConditionalEdges, true)

  const scenario3HasXorByConditionalEdges = Array.from(scenario3OutgoingCount.entries()).some(
    ([sourceId, count]) => {
      if (count < 2) {
        return false
      }
      const node = scenario3NodeById.get(sourceId)
      return node && node.type !== 'GatewayNode' && node.type !== 'JoinNode'
    }
  )
  assert.equal(scenario3HasXorByConditionalEdges, true)

  const scenario2HasOrGateway = (scenario2.nodes || []).some(
    (node) => node.type === 'GatewayNode' && node.splitType === 'OR'
  )
  const scenario2HasOrJoin = (scenario2.nodes || []).some(
    (node) => node.type === 'JoinNode' && node.joinType === 'OR'
  )

  assert.equal(scenario2HasOrGateway, true)
  assert.equal(scenario2HasOrJoin, true)
})
