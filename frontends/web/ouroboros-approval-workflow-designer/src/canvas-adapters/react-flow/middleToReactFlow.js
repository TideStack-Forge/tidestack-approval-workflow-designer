import { definitionToReactFlow } from './definitionToReactFlow.js'
import { middleToDefinitionV2 } from '../../translator/middle-v2/translator.js'

export function middleToReactFlow(middleGraph, editorLayout) {
  if (!middleGraph || !middleGraph.firstNode) {
    return { nodes: [], edges: [] }
  }

  return definitionToReactFlow(middleToDefinitionV2(middleGraph), editorLayout)
}
