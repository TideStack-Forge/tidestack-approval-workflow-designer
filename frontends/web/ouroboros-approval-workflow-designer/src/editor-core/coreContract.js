export const DEFAULT_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES = Object.freeze({
  allowPaletteInsert: true,
  allowInspectorEdit: true,
  allowDeleteSelection: true,
  allowEdgeReconnect: false,
  allowMultiSelect: true,
  allowHistoryCommands: false,
  allowViewportCommands: true,
  allowDiagnosticsNavigation: true,
})

export const READONLY_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES = Object.freeze({
  ...DEFAULT_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES,
  allowPaletteInsert: false,
  allowInspectorEdit: false,
  allowDeleteSelection: false,
  allowEdgeReconnect: false,
})

export const EMPTY_WORKFLOW_CONDITION_FIELD_SOURCE = Object.freeze({
  sourceKind: 'definition-bound-form',
  revisionToken: '__empty__',
  fields: [],
})

export const createReadonlyCoreCapabilities = () => ({
  ...READONLY_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES,
})

export const normalizeApprovalWorkflowEditorCoreCapabilities = (
  coreCapabilities,
  readonly
) => {
  if (readonly) {
    return {
      ...READONLY_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES,
      ...(coreCapabilities || {}),
      allowPaletteInsert: false,
      allowInspectorEdit: false,
      allowDeleteSelection: false,
      allowEdgeReconnect: false,
      allowViewportCommands: true,
      allowDiagnosticsNavigation: true,
    }
  }

  return {
    ...DEFAULT_APPROVAL_WORKFLOW_EDITOR_CORE_CAPABILITIES,
    ...(coreCapabilities || {}),
    allowEdgeReconnect: false,
  }
}

const EQUALITY_OPERATORS = ['equal', 'not_equal']
const ORDERED_OPERATORS = [
  ...EQUALITY_OPERATORS,
  'less',
  'less_or_equal',
  'greater',
  'greater_or_equal',
  'between',
  'not_between',
  'is_empty',
  'is_not_empty',
]
const STRING_OPERATORS = [
  ...EQUALITY_OPERATORS,
  'like',
  'not_like',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
]
const EQUALITY_OPERATOR_ALIASES = {
  select_equals: 'equal',
  select_not_equals: 'not_equal',
}
const readOperatorValue = (operator) => operator?.value || operator

const projectConditionValueType = (field) => {
  if (typeof field.valueType !== 'string' || !field.valueType.trim()) {
    return {}
  }

  const valueType = field.valueType.trim().toLowerCase()
  let type = 'text'
  let operators = EQUALITY_OPERATORS
  if (
    field.type === 'select' ||
    (Array.isArray(field.options) && field.options.length > 0)
  ) {
    type = 'select'
    operators = [
      'select_equals',
      'select_not_equals',
      'select_any_in',
      'select_not_any_in',
      'is_empty',
      'is_not_empty',
    ]
  } else if (
    ['short', 'integer', 'long', 'float', 'double', 'decimal', 'number'].includes(
      valueType
    )
  ) {
    type = 'number'
    operators = ORDERED_OPERATORS
  } else if (['date', 'time', 'datetime'].includes(valueType)) {
    type = valueType
    operators = ORDERED_OPERATORS
  } else if (valueType === 'string' || valueType === 'text') {
    operators = STRING_OPERATORS
  } else if (valueType === 'boolean') {
    type = 'boolean'
  }

  const allowedOperators = Array.isArray(field.operators)
    ? field.operators.filter((operator) => {
        const value = readOperatorValue(operator)
        return (
          operators.includes(value) ||
          operators.includes(EQUALITY_OPERATOR_ALIASES[value] || value)
        )
      })
    : [...operators]
  const operatorValues = allowedOperators.map(readOperatorValue)
  return {
    type,
    operators: allowedOperators,
    defaultOp: operatorValues.includes(field.defaultOp)
      ? field.defaultOp
      : operatorValues[0],
  }
}

const normalizeWorkflowConditionField = (field) => {
  if (!field || typeof field !== 'object') {
    return null
  }

  if (Array.isArray(field.children)) {
    const children = field.children.map(normalizeWorkflowConditionField).filter(Boolean)
    if (children.length === 0) {
      return null
    }

    return {
      ...field,
      label: field.label || field.title || '字段分组',
      children,
    }
  }

  const value = field.value || field.name || field.key || null
  const label = field.label || field.title || value

  if (!value) {
    return null
  }

  const valueTypeProjection = projectConditionValueType(field)
  if (valueTypeProjection.operators?.length === 0) {
    return null
  }

  return {
    ...field,
    name: field.name || value,
    label,
    value,
    type: field.type || 'text',
    ...valueTypeProjection,
  }
}

export const normalizeWorkflowConditionFieldSource = (conditionFieldSource) => {
  if (Array.isArray(conditionFieldSource)) {
    const fields = conditionFieldSource
      .map(normalizeWorkflowConditionField)
      .filter(Boolean)
    return {
      sourceKind: 'definition-bound-form',
      revisionToken: `${fields.length}`,
      fields,
    }
  }

  if (!conditionFieldSource || typeof conditionFieldSource !== 'object') {
    return {
      ...EMPTY_WORKFLOW_CONDITION_FIELD_SOURCE,
    }
  }

  const fields = Array.isArray(conditionFieldSource.fields)
    ? conditionFieldSource.fields.map(normalizeWorkflowConditionField).filter(Boolean)
    : Array.isArray(conditionFieldSource.items)
      ? conditionFieldSource.items.map(normalizeWorkflowConditionField).filter(Boolean)
      : []

  return {
    sourceKind: conditionFieldSource.sourceKind || 'definition-bound-form',
    revisionToken:
      conditionFieldSource.revisionToken ||
      `${conditionFieldSource.sourceKind || 'definition-bound-form'}:${fields.length}`,
    fields,
  }
}

export const createEmptyWorkflowSelectionSnapshot = () => ({
  mode: 'none',
  nodeIds: [],
  edgeIds: [],
})

const normalizeSelectionIds = (ids) => {
  return Array.from(
    new Set(
      (ids || []).filter((id) => {
        return typeof id === 'string' && id.trim().length > 0
      })
    )
  )
}

export const createWorkflowSelectionSnapshot = ({ nodeIds = [], edgeIds = [] } = {}) => {
  const normalizedNodeIds = normalizeSelectionIds(nodeIds)
  const normalizedEdgeIds = normalizeSelectionIds(edgeIds)
  const selectionSize = normalizedNodeIds.length + normalizedEdgeIds.length

  if (selectionSize === 0) {
    return createEmptyWorkflowSelectionSnapshot()
  }

  if (normalizedNodeIds.length === 1 && normalizedEdgeIds.length === 0) {
    return {
      mode: 'single-node',
      primaryTargetId: normalizedNodeIds[0],
      nodeIds: normalizedNodeIds,
      edgeIds: [],
    }
  }

  if (normalizedNodeIds.length === 0 && normalizedEdgeIds.length === 1) {
    return {
      mode: 'single-edge',
      primaryTargetId: normalizedEdgeIds[0],
      nodeIds: [],
      edgeIds: normalizedEdgeIds,
    }
  }

  return {
    mode: 'multi',
    nodeIds: normalizedNodeIds,
    edgeIds: normalizedEdgeIds,
  }
}

export const normalizeWorkflowSelectionSnapshot = (selection) => {
  if (!selection) {
    return createEmptyWorkflowSelectionSnapshot()
  }

  if (selection?.mode) {
    return createWorkflowSelectionSnapshot(selection)
  }

  if (Array.isArray(selection?.nodeIds) || Array.isArray(selection?.edgeIds)) {
    return createWorkflowSelectionSnapshot({
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds,
    })
  }

  if (Array.isArray(selection?.nodes) || Array.isArray(selection?.edges)) {
    return createWorkflowSelectionSnapshot({
      nodeIds: (selection.nodes || []).map((node) => node?.id),
      edgeIds: (selection.edges || []).map((edge) => edge?.id),
    })
  }

  if (!selection?.type || !selection?.data?.id) {
    return createEmptyWorkflowSelectionSnapshot()
  }

  if (selection.type === 'node') {
    return createWorkflowSelectionSnapshot({
      primaryTargetId: selection.data.id,
      nodeIds: [selection.data.id],
    })
  }

  if (selection.type === 'edge') {
    return createWorkflowSelectionSnapshot({
      primaryTargetId: selection.data.id,
      edgeIds: [selection.data.id],
    })
  }

  return createEmptyWorkflowSelectionSnapshot()
}

export const reconcileWorkflowSelectionSnapshot = (selection, nodes = [], edges = []) => {
  const normalizedSelection = normalizeWorkflowSelectionSnapshot(selection)
  const allowedNodeIds = new Set((nodes || []).map((node) => node?.id).filter(Boolean))
  const allowedEdgeIds = new Set((edges || []).map((edge) => edge?.id).filter(Boolean))

  return createWorkflowSelectionSnapshot({
    nodeIds: normalizedSelection.nodeIds.filter((nodeId) => allowedNodeIds.has(nodeId)),
    edgeIds: normalizedSelection.edgeIds.filter((edgeId) => allowedEdgeIds.has(edgeId)),
  })
}

export const createEmptyWorkflowDiagnosticsSnapshot = () => ({
  status: 'clean',
  items: [],
})

export const WORKFLOW_EDITOR_COMMAND_IDS = Object.freeze({
  UNDO: 'undo',
  REDO: 'redo',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  ZOOM_PERCENT: 'zoom-percent',
  FIT_GRAPH: 'fit-graph',
  CENTER_GRAPH: 'center-graph',
  DELETE_SELECTION: 'delete-selection',
})

export const WORKFLOW_EDITOR_COMMAND_ORDER = Object.freeze([
  WORKFLOW_EDITOR_COMMAND_IDS.UNDO,
  WORKFLOW_EDITOR_COMMAND_IDS.REDO,
  WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_OUT,
  WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_PERCENT,
  WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_IN,
  WORKFLOW_EDITOR_COMMAND_IDS.FIT_GRAPH,
  WORKFLOW_EDITOR_COMMAND_IDS.CENTER_GRAPH,
  WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION,
])

const createWorkflowEditorCommandState = ({
  commandId,
  visible,
  enabled,
  disabledReason,
  tooltip,
}) => ({
  commandId,
  visible,
  enabled,
  tooltip,
  disabledReason: enabled ? undefined : disabledReason,
})

export const buildWorkflowEditorCommandStates = ({
  readonly = false,
  coreCapabilities = null,
  selection = null,
  viewport = null,
  history = null,
} = {}) => {
  const normalizedSelection = normalizeWorkflowSelectionSnapshot(selection)
  const allowViewportCommands = coreCapabilities?.allowViewportCommands !== false
  const allowDeleteSelection =
    !readonly && coreCapabilities?.allowDeleteSelection !== false
  const allowHistoryCommands =
    !readonly &&
    coreCapabilities?.allowHistoryCommands === true &&
    history?.available === true
  const hasViewport = Number.isFinite(Number(viewport?.zoom))
  const hasSelection =
    normalizedSelection.mode !== 'none' &&
    (normalizedSelection.nodeIds.length > 0 || normalizedSelection.edgeIds.length > 0)
  const undoTooltip =
    history?.canUndo === true
      ? history?.undoLabel || '撤销'
      : history?.available === true
        ? '当前没有可撤销的操作'
        : '当前版本尚未接入撤销历史'
  const redoTooltip =
    history?.canRedo === true
      ? history?.redoLabel || '重做'
      : history?.available === true
        ? '当前没有可重做的操作'
        : '当前版本尚未接入重做历史'

  return WORKFLOW_EDITOR_COMMAND_ORDER.map((commandId) => {
    switch (commandId) {
      case WORKFLOW_EDITOR_COMMAND_IDS.UNDO:
        return createWorkflowEditorCommandState({
          commandId,
          visible: allowHistoryCommands,
          enabled: allowHistoryCommands && history?.canUndo === true,
          tooltip: undoTooltip,
          disabledReason:
            history?.available === true
              ? '当前没有可撤销的操作'
              : '当前版本尚未接入撤销历史',
        })
      case WORKFLOW_EDITOR_COMMAND_IDS.REDO:
        return createWorkflowEditorCommandState({
          commandId,
          visible: allowHistoryCommands,
          enabled: allowHistoryCommands && history?.canRedo === true,
          tooltip: redoTooltip,
          disabledReason:
            history?.available === true
              ? '当前没有可重做的操作'
              : '当前版本尚未接入重做历史',
        })
      case WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_IN:
      case WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_OUT:
      case WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_PERCENT:
      case WORKFLOW_EDITOR_COMMAND_IDS.FIT_GRAPH:
      case WORKFLOW_EDITOR_COMMAND_IDS.CENTER_GRAPH:
        return createWorkflowEditorCommandState({
          commandId,
          visible: allowViewportCommands,
          enabled: allowViewportCommands && hasViewport,
          disabledReason: '画布尚未完成初始化',
        })
      case WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION:
        return createWorkflowEditorCommandState({
          commandId,
          visible: allowDeleteSelection,
          enabled: allowDeleteSelection && hasSelection,
          disabledReason: '请先选择节点或连线',
        })
      default:
        return createWorkflowEditorCommandState({
          commandId,
          visible: false,
          enabled: false,
          disabledReason: '未实现的命令',
        })
    }
  })
}
