import { reactFlowToDefinitionV2 } from './reactFlowToDefinitionV2.js'
import { v2ToMiddleTranslator } from '../../translator/v2-middle/translator.js'

export function reactFlowToMiddle(rfNodes, rfEdges, originalMiddleGraph) {
  if (!originalMiddleGraph) {
    throw new Error('originalMiddleGraph is required for React Flow to middle conversion')
  }

  const definition = reactFlowToDefinitionV2(rfNodes, rfEdges, {
    id: originalMiddleGraph.id,
    name: originalMiddleGraph.name,
    icon: originalMiddleGraph.icon,
    color: originalMiddleGraph.color,
    category: originalMiddleGraph.category,
    description: originalMiddleGraph.description,
    formKey: originalMiddleGraph.formKey,
    formType: originalMiddleGraph.formType,
  })

  return v2ToMiddleTranslator(definition).middleWorkflowGraph
}
