import {
  DEFINITION_FORMAT_APPROVAL_METADATA,
  definitionToMiddle,
  definitionV2ToMetadata,
  isApprovalWorkflowMetadata,
  middleToDefinitionV2,
} from '../translator/definition-format/index.js'
import { addEditorLayoutToV2 } from '../translator/define/v2-extensions.js'
import { canonicalizePersistedDefinitionNodeTypes } from '../translator/define/persistedNodeTypes.js'
import { middleWorkflowEditorAdapter } from '../workflow-editor-adapters/middle/index.js'
import {
  V2ApprovalNode,
  V2CcNode,
  V2EndNode,
  V2HandleNode,
  V2JoinNode,
  V2StartNode,
  V2SubProcessNode,
} from '../translator/define/v2.js'

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const areDefinitionsEqual = (previousDefinition, nextDefinition) => {
  return JSON.stringify(previousDefinition || null) === JSON.stringify(nextDefinition || null)
}

const createEmptyWorkflowHistoryState = () => ({
  entries: [],
  cursor: 0,
})

const buildWorkflowHistorySnapshot = (historyState) => {
  const entries = historyState?.entries || []
  const cursor = Math.max(0, Math.min(historyState?.cursor || 0, entries.length))
  const undoEntry = cursor > 0 ? entries[cursor - 1] : null
  const redoEntry = cursor < entries.length ? entries[cursor] : null

  return {
    available: true,
    canUndo: !!undoEntry,
    canRedo: !!redoEntry,
    undoLabel: undoEntry?.label,
    redoLabel: redoEntry?.label,
  }
}

const pushWorkflowHistoryEntry = (historyState, entry) => {
  const retainedEntries = (historyState?.entries || []).slice(
    0,
    Math.max(0, historyState?.cursor || 0)
  )
  retainedEntries.push(entry)

  return {
    entries: retainedEntries,
    cursor: retainedEntries.length,
  }
}

const findDefinitionNode = (definition, nodeId) => {
  if (!definition?.nodes?.length || !nodeId) {
    return null
  }

  return definition.nodes.find((node) => node.id === nodeId) || null
}

const resolveWorkflowMetaHistoryLabel = (previousDefinition, nextDefinition) => {
  const nameChanged = previousDefinition?.name !== nextDefinition?.name
  const descriptionChanged =
    (previousDefinition?.description || '') !== (nextDefinition?.description || '')
  const previousNodePositions = previousDefinition?.editorLayout?.nodePositions || {}
  const nextNodePositions = nextDefinition?.editorLayout?.nodePositions || {}
  const nodePositionsChanged = !areDefinitionsEqual(previousNodePositions, nextNodePositions)

  if (nameChanged && descriptionChanged) {
    return '修改流程基础信息'
  }

  if (nameChanged) {
    return '修改流程名称'
  }

  if (descriptionChanged) {
    return '修改流程描述'
  }

  if (nodePositionsChanged) {
    return '调整节点位置'
  }

  return '更新流程信息'
}

const resolveNodeConfigHistoryLabel = (previousDefinition, nextDefinition, nodeId) => {
  const previousNode = findDefinitionNode(previousDefinition, nodeId)
  const nextNode = findDefinitionNode(nextDefinition, nodeId)

  if (previousNode?.name !== nextNode?.name) {
    return '修改节点名称'
  }

  return '修改节点属性'
}

const mergeEditorLayout = (previousLayout, nextLayout) => {
  if (!previousLayout && !nextLayout) {
    return undefined
  }

  const resolvedPreviousLayout = previousLayout || {}
  const resolvedNextLayout = nextLayout || {}

  return {
    ...resolvedPreviousLayout,
    ...resolvedNextLayout,
    nodePositions: {
      ...(resolvedPreviousLayout.nodePositions || {}),
      ...(resolvedNextLayout.nodePositions || {}),
    },
    viewport: resolvedNextLayout.viewport || resolvedPreviousLayout.viewport,
  }
}

const mergeDefinitionShell = (previousDefinition, nextDefinition) => {
  if (!nextDefinition) {
    return nextDefinition
  }

  if (!previousDefinition) {
    return clone(nextDefinition)
  }

  return {
    ...clone(previousDefinition),
    ...clone(nextDefinition),
  }
}

const preserveDetachedDefinitionGraph = (previousDefinition, nextDefinition) => {
  if (!previousDefinition) {
    return nextDefinition
  }

  const nextNodeIds = new Set((nextDefinition?.nodes || []).map((node) => node.id))
  const preservedNodes = (previousDefinition?.nodes || []).filter((node) => !nextNodeIds.has(node.id))
  const preservedNodeIds = new Set(preservedNodes.map((node) => node.id))
  const nextEdgeIds = new Set((nextDefinition?.edges || []).map((edge) => edge.id))
  const preservedEdges = (previousDefinition?.edges || []).filter((edge) => {
    if (nextEdgeIds.has(edge.id)) {
      return false
    }

    return preservedNodeIds.has(edge.sourceId) && preservedNodeIds.has(edge.targetId)
  })

  const mergedDefinition = mergeDefinitionShell(previousDefinition, nextDefinition)
  mergedDefinition.nodes = [
    ...(mergedDefinition.nodes || []),
    ...clone(preservedNodes),
  ]
  mergedDefinition.edges = [
    ...(mergedDefinition.edges || []),
    ...clone(preservedEdges),
  ]

  const mergedLayout = mergeEditorLayout(
    previousDefinition?.editorLayout,
    mergedDefinition?.editorLayout
  )

  return addEditorLayoutToV2(mergedDefinition, mergedLayout)
}

const applyDefinitionMetaPatch = (definition, patch = {}) => {
  if (!definition) {
    return definition
  }

  const nextDefinition = clone(definition)

  Object.keys(patch).forEach((key) => {
    if (key === 'editorLayout') {
      nextDefinition.editorLayout = mergeEditorLayout(
        nextDefinition.editorLayout,
        patch.editorLayout
      )
      return
    }

    if (typeof patch[key] === 'undefined') {
      delete nextDefinition[key]
      return
    }

    nextDefinition[key] = clone(patch[key])
  })

  return addEditorLayoutToV2(nextDefinition, nextDefinition.editorLayout)
}

const patchDefinitionNode = (definition, nodeId, patch = {}) => {
  if (!definition?.nodes?.length) {
    return null
  }

  const targetIndex = definition.nodes.findIndex((node) => node.id === nodeId)
  if (targetIndex < 0) {
    return null
  }

  const nextDefinition = clone(definition)
  const nextNode = {
    ...nextDefinition.nodes[targetIndex],
  }

  Object.keys(patch).forEach((key) => {
    if (key === 'next' || key === 'pre') {
      return
    }

    nextNode[key] = clone(patch[key])
  })

  nextDefinition.nodes[targetIndex] = nextNode
  return addEditorLayoutToV2(nextDefinition, nextDefinition.editorLayout)
}

const removeDetachedNodeFromDefinition = (definition, nodeId) => {
  if (!definition?.nodes?.length) {
    return null
  }

  const targetExists = definition.nodes.some((node) => node.id === nodeId)
  if (!targetExists) {
    return null
  }

  const nextDefinition = clone(definition)
  nextDefinition.nodes = nextDefinition.nodes.filter((node) => node.id !== nodeId)
  nextDefinition.edges = (nextDefinition.edges || []).filter(
    (edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId
  )

  if (nextDefinition.editorLayout?.nodePositions) {
    delete nextDefinition.editorLayout.nodePositions[nodeId]
  }

  return addEditorLayoutToV2(nextDefinition, nextDefinition.editorLayout)
}

const createDetachedDefinitionNode = (nodeData) => {
  switch (nodeData?.type) {
    case 'StartNode':
      return new V2StartNode(nodeData.name, nodeData.id, nodeData.candidates || [], nodeData.permission || [])
    case 'ApprovalNode':
      return new V2ApprovalNode(
        nodeData.subType || '单签',
        nodeData.name,
        nodeData.id,
        nodeData.candidates || [],
        undefined,
        undefined,
        nodeData.permission || [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      )
    case 'HandleNode':
      return new V2HandleNode(nodeData.name, nodeData.id, nodeData.candidates || [], nodeData.permission || [])
    case 'CcNode':
      return new V2CcNode(nodeData.name, nodeData.id, nodeData.candidates || [])
    case 'SubProcess':
      return new V2SubProcessNode(nodeData.name, nodeData.id, '', [], [], '')
    case 'EndNode':
      return new V2EndNode(nodeData.name, nodeData.id, nodeData.outcome)
    case 'JoinOrNode':
      return new V2JoinNode(nodeData.name, nodeData.id, 'OR')
    default:
      return null
  }
}

const normalizeSessionDefinition = ({
  definition,
  editorDefinition,
  sourceFormatVersion,
  graphState,
}) => {
  if (
    (sourceFormatVersion === 2 || sourceFormatVersion === DEFINITION_FORMAT_APPROVAL_METADATA) &&
    (editorDefinition || definition)
  ) {
    return addEditorLayoutToV2(
      canonicalizePersistedDefinitionNodeTypes(clone(editorDefinition || definition)),
      graphState?.editorLayout
    )
  }

  return addEditorLayoutToV2(
    middleToDefinitionV2(graphState),
    graphState?.editorLayout
  )
}

export class EditorSession {
  static createFromDefinition(definition, options = {}) {
    const {
      middleWorkflowGraph,
      middleNodeRepository,
      sourceFormatVersion,
      editorDefinition,
    } = definitionToMiddle(definition)

    return new EditorSession({
      graphState: middleWorkflowGraph,
      nodeStore: middleNodeRepository,
      sourceFormatVersion,
      sourceDefinitionFormat: sourceFormatVersion,
      metadataTemplate: isApprovalWorkflowMetadata(definition) ? clone(definition) : null,
      persistAsMetadata: true,
      definition: normalizeSessionDefinition({
        definition,
        editorDefinition,
        sourceFormatVersion,
        graphState: middleWorkflowGraph,
      }),
      workflowEditorAdapter:
        options.workflowEditorAdapter || middleWorkflowEditorAdapter,
    })
  }

  static createInitial(flowId, options = {}) {
    const workflowEditorAdapter =
      options.workflowEditorAdapter || middleWorkflowEditorAdapter
    const nodeStore = new Map()
    const graphState = workflowEditorAdapter.createInitialState(nodeStore, flowId)

    return new EditorSession({
      graphState,
      nodeStore,
      sourceFormatVersion: DEFINITION_FORMAT_APPROVAL_METADATA,
      sourceDefinitionFormat: DEFINITION_FORMAT_APPROVAL_METADATA,
      metadataTemplate: {
        formatVersion: 1,
        name: flowId || '',
        title: flowId || '',
        description: '',
        version: 1,
        enabled: true,
        form: {
          formType: '',
          formId: '',
        },
      },
      persistAsMetadata: true,
      workflowEditorAdapter,
    })
  }

  constructor({
    graphState,
    nodeStore,
    sourceFormatVersion,
    sourceDefinitionFormat = sourceFormatVersion,
    metadataTemplate = null,
    persistAsMetadata = sourceDefinitionFormat === DEFINITION_FORMAT_APPROVAL_METADATA,
    definition = null,
    workflowEditorAdapter = middleWorkflowEditorAdapter,
    middleWorkflowGraph = graphState,
    middleNodeRepository = nodeStore,
  }) {
    // Use mutable containers to avoid issues with AMIS framework freezing objects
    this._graphStateContainer = { value: graphState || middleWorkflowGraph }
    this._nodeStoreContainer = { value: nodeStore || middleNodeRepository }
    this._definitionContainer = { value: definition }
    this._revisionState = { value: 0 }
    this._historyState = { value: createEmptyWorkflowHistoryState() }

    this.sourceFormatVersion = sourceFormatVersion
    this.sourceDefinitionFormat = sourceDefinitionFormat
    this.metadataTemplate = metadataTemplate ? clone(metadataTemplate) : null
    this.persistAsMetadata = persistAsMetadata === true
    this.workflowEditorAdapter = workflowEditorAdapter

    if (!this.definition) {
      this.syncDefinition()
    }
  }

  get graphState() {
    return this._graphStateContainer.value
  }

  set graphState(value) {
    this._graphStateContainer.value = value
  }

  get nodeStore() {
    return this._nodeStoreContainer.value
  }

  set nodeStore(value) {
    this._nodeStoreContainer.value = value
  }

  get middleWorkflowGraph() {
    return this._graphStateContainer.value
  }

  set middleWorkflowGraph(value) {
    this._graphStateContainer.value = value
  }

  get middleNodeRepository() {
    return this._nodeStoreContainer.value
  }

  set middleNodeRepository(value) {
    this._nodeStoreContainer.value = value
  }

  syncDefinition() {
    const nextDefinition = addEditorLayoutToV2(
      middleToDefinitionV2(this.graphState),
      this.graphState.editorLayout
    )
    this.definition = preserveDetachedDefinitionGraph(this.definition, nextDefinition)
  }

  touch() {
    this._revisionState.value += 1
    return this
  }

  get historyState() {
    return this._historyState.value
  }

  set historyState(value) {
    this._historyState.value = value
  }

  getRevision() {
    return this._revisionState.value
  }

  get definition() {
    return this._definitionContainer.value
  }

  set definition(value) {
    this._definitionContainer.value = value
  }

  getDefinition() {
    return this.definition
  }

  getPersistedDefinition() {
    if (!this.persistAsMetadata) {
      return this.getDefinition()
    }

    return definitionV2ToMetadata(this.getDefinition(), this.metadataTemplate || {})
  }

  getGraphState() {
    return this.graphState
  }

  getWorkflow() {
    return this.graphState
  }

  getNodeStore() {
    return this.nodeStore
  }

  getRepository() {
    return this.nodeStore
  }

  getSourceFormatVersion() {
    return this.sourceFormatVersion
  }

  getHistorySnapshot() {
    return buildWorkflowHistorySnapshot(this.historyState)
  }

  pushHistoryEntry({
    beforeDefinition,
    afterDefinition = this.definition,
    label,
  } = {}) {
    if (!beforeDefinition || !afterDefinition) {
      return this
    }

    this.historyState = pushWorkflowHistoryEntry(this.historyState, {
      label: label || '更新流程定义',
      beforeDefinition: clone(beforeDefinition),
      afterDefinition: clone(afterDefinition),
    })

    return this
  }

  recordHistoryIfDefinitionChanged(beforeDefinition, label) {
    if (!beforeDefinition || !this.definition) {
      return false
    }

    if (areDefinitionsEqual(beforeDefinition, this.definition)) {
      return false
    }

    this.pushHistoryEntry({
      beforeDefinition,
      label,
    })

    return true
  }

  shouldNotifyUpgrade(isReadonly) {
    return !isReadonly && this.sourceFormatVersion === 1
  }

  replaceDefinition(nextDefinition, options = {}) {
    const beforeDefinition = clone(this.definition)
    const mergedDefinition = mergeDefinitionShell(this.definition, nextDefinition)
    const normalizedDefinition = addEditorLayoutToV2(
      clone(mergedDefinition),
      nextDefinition?.editorLayout
    )
    const {
      middleWorkflowGraph,
      middleNodeRepository,
    } = definitionToMiddle(normalizedDefinition)

    this.graphState = middleWorkflowGraph
    this.middleWorkflowGraph = middleWorkflowGraph
    this.nodeStore = middleNodeRepository
    this.middleNodeRepository = middleNodeRepository
    this.definition = normalizedDefinition
    this.sourceFormatVersion = this.persistAsMetadata
      ? DEFINITION_FORMAT_APPROVAL_METADATA
      : 2

    if (options.recordHistory !== false) {
      this.recordHistoryIfDefinitionChanged(
        beforeDefinition,
        options.historyLabel || '更新流程结构'
      )
    }

    return this.touch()
  }

  updateWorkflowMeta(patch = {}, options = {}) {
    const beforeDefinition = clone(this.definition)
    // AMIS framework freezes data objects - create mutable copies when needed
    const needsCopy = Object.isFrozen(this.graphState)

    if (needsCopy) {
      const mutableCopy = { ...this.graphState }

      Object.keys(patch).forEach((key) => {
        const value = patch[key]
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          mutableCopy[key] = JSON.parse(JSON.stringify(value))
        } else {
          mutableCopy[key] = value
        }
      })

      this.graphState = mutableCopy
      this.middleWorkflowGraph = mutableCopy
    } else {
      Object.keys(patch).forEach((key) => {
        this.graphState[key] = patch[key]
      })
    }

    this.definition = applyDefinitionMetaPatch(this.definition, patch)
    if (!this.definition) {
      this.syncDefinition()
    }

    if (options.recordHistory !== false) {
      this.recordHistoryIfDefinitionChanged(
        beforeDefinition,
        options.historyLabel || resolveWorkflowMetaHistoryLabel(beforeDefinition, this.definition)
      )
    }

    return this.touch()
  }

  updateNodeConfig(nodeId, patch = {}, options = {}) {
    const beforeDefinition = clone(this.definition)
    const nextDetachedDefinition = patchDefinitionNode(this.definition, nodeId, patch)

    if (!this.workflowEditorAdapter.updateNodeConfig) {
      if (nextDetachedDefinition) {
        this.definition = nextDetachedDefinition
        if (options.recordHistory !== false) {
          this.recordHistoryIfDefinitionChanged(
            beforeDefinition,
            options.historyLabel || resolveNodeConfigHistoryLabel(beforeDefinition, this.definition, nodeId)
          )
        }
        return this.touch()
      }
      return this
    }

    const changed = this.workflowEditorAdapter.updateNodeConfig(
      this.nodeStore,
      nodeId,
      patch
    )

    if (changed !== false) {
      this.definition = nextDetachedDefinition || this.definition
      if (!this.definition) {
        this.syncDefinition()
      }
      if (options.recordHistory !== false) {
        this.recordHistoryIfDefinitionChanged(
          beforeDefinition,
          options.historyLabel || resolveNodeConfigHistoryLabel(beforeDefinition, this.definition, nodeId)
        )
      }
      return this.touch()
    }

    if (nextDetachedDefinition) {
      this.definition = nextDetachedDefinition
      if (options.recordHistory !== false) {
        this.recordHistoryIfDefinitionChanged(
          beforeDefinition,
          options.historyLabel || resolveNodeConfigHistoryLabel(beforeDefinition, this.definition, nodeId)
        )
      }
      return this.touch()
    }

    return this
  }

  addNode(targetNodeId, nodeData, options = {}) {
    if (!targetNodeId) {
      const nextDefinitionNode = createDetachedDefinitionNode(nodeData)
      if (!nextDefinitionNode || !this.definition) {
        return this
      }

      const nextDefinition = clone(this.definition)
      nextDefinition.nodes = [
        ...(nextDefinition.nodes || []),
        nextDefinitionNode,
      ]

      return this.replaceDefinition(nextDefinition, {
        historyLabel: options.historyLabel || '新增节点',
        recordHistory: options.recordHistory,
      })
    }

    const beforeDefinition = clone(this.definition)

    // AMIS framework freezes data objects - create mutable copies when needed
    const needsUnfreeze = Array.from(this.nodeStore.values()).some((node) =>
      Object.isFrozen(node)
    )

    if (needsUnfreeze) {
      const mutableNodeStore = new Map()
      const nodeIdToMutableNode = new Map()

      this.nodeStore.forEach((node, id) => {
        if (Object.isFrozen(node)) {
          const mutableNode = { ...node }
          mutableNodeStore.set(id, mutableNode)
          nodeIdToMutableNode.set(id, mutableNode)
        } else {
          mutableNodeStore.set(id, node)
          nodeIdToMutableNode.set(id, node)
        }
      })

      mutableNodeStore.forEach((node) => {
        if (node.next && typeof node.next === 'object') {
          const nextId = node.next.id
          if (nodeIdToMutableNode.has(nextId)) {
            node.next = nodeIdToMutableNode.get(nextId)
          }
        }

        if (node.branches && Array.isArray(node.branches)) {
          node.branches = node.branches.map((branch) => {
            if (branch && typeof branch === 'object' && branch.id) {
              return nodeIdToMutableNode.get(branch.id) || branch
            }
            return branch
          })
        }
      })

      this.nodeStore = mutableNodeStore

      if (this.graphState.firstNode && this.graphState.firstNode.id) {
        const mutableFirstNode = nodeIdToMutableNode.get(
          this.graphState.firstNode.id
        )
        if (mutableFirstNode) {
          this.graphState = {
            ...this.graphState,
            firstNode: mutableFirstNode,
          }
        }
      }
    }

    this.workflowEditorAdapter.insertNode(this.nodeStore, targetNodeId, nodeData)
    this.syncDefinition()
    if (options.recordHistory !== false) {
      this.recordHistoryIfDefinitionChanged(
        beforeDefinition,
        options.historyLabel || '新增节点'
      )
    }
    return this.touch()
  }

  addBranch(branchNodeId, options = {}) {
    const beforeDefinition = clone(this.definition)
    this.workflowEditorAdapter.appendBranch(this.nodeStore, branchNodeId)
    this.syncDefinition()
    if (options.recordHistory !== false) {
      this.recordHistoryIfDefinitionChanged(
        beforeDefinition,
        options.historyLabel || '新增分支'
      )
    }
    return this.touch()
  }

  async deleteNode(nodeId, options = {}) {
    const beforeDefinition = clone(this.definition)
    const detachedDefinition = removeDetachedNodeFromDefinition(this.definition, nodeId)

    if (!this.nodeStore?.has(nodeId)) {
      if (detachedDefinition) {
        this.definition = detachedDefinition
        if (options.recordHistory !== false) {
          this.recordHistoryIfDefinitionChanged(
            beforeDefinition,
            options.historyLabel || '删除节点'
          )
        }
        this.touch()
        return true
      }
      return false
    }

    const result = await this.workflowEditorAdapter.removeNode(
      this.nodeStore,
      nodeId
    )
    this.syncDefinition()

    if (detachedDefinition) {
      this.definition = preserveDetachedDefinitionGraph(
        detachedDefinition,
        this.definition
      )
    }

    if (options.recordHistory !== false) {
      this.recordHistoryIfDefinitionChanged(
        beforeDefinition,
        options.historyLabel || '删除节点'
      )
    }

    this.touch()
    return result
  }

  undo() {
    const currentHistoryState = this.historyState
    if ((currentHistoryState?.cursor || 0) <= 0) {
      return false
    }

    const targetCursor = currentHistoryState.cursor - 1
    const targetEntry = currentHistoryState.entries[targetCursor]
    if (!targetEntry?.beforeDefinition) {
      return false
    }

    this.replaceDefinition(targetEntry.beforeDefinition, {
      recordHistory: false,
    })
    this.historyState = {
      entries: currentHistoryState.entries,
      cursor: targetCursor,
    }

    return true
  }

  redo() {
    const currentHistoryState = this.historyState
    if ((currentHistoryState?.cursor || 0) >= (currentHistoryState?.entries || []).length) {
      return false
    }

    const targetEntry = currentHistoryState.entries[currentHistoryState.cursor]
    if (!targetEntry?.afterDefinition) {
      return false
    }

    this.replaceDefinition(targetEntry.afterDefinition, {
      recordHistory: false,
    })
    this.historyState = {
      entries: currentHistoryState.entries,
      cursor: currentHistoryState.cursor + 1,
    }

    return true
  }
}
