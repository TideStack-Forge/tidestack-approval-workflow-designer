import { WORKFLOW_EDITOR_COMMAND_IDS } from '../../../../editor-core/coreContract'

export const WORKFLOW_TOOLBAR_GROUPS = Object.freeze({
  META: 'meta',
  VIEW: 'view',
  CANVAS_ASSIST: 'canvas-assist',
  HISTORY: 'history',
  SELECTION: 'selection',
  STATUS: 'status',
})

export const WORKFLOW_TOOLBAR_GROUP_ORDER = Object.freeze([
  WORKFLOW_TOOLBAR_GROUPS.VIEW,
  WORKFLOW_TOOLBAR_GROUPS.CANVAS_ASSIST,
  WORKFLOW_TOOLBAR_GROUPS.HISTORY,
  WORKFLOW_TOOLBAR_GROUPS.SELECTION,
  WORKFLOW_TOOLBAR_GROUPS.META,
  WORKFLOW_TOOLBAR_GROUPS.STATUS,
])

export const WORKFLOW_TOOLBAR_ENTRY_KINDS = Object.freeze({
  SCHEMA_ENTRY: 'schema-entry',
  COMMAND_BUTTON: 'command-button',
  STATUS_ENTRY: 'status-entry',
})

export const WORKFLOW_TOOLBAR_PRESENTATIONS = Object.freeze({
  ICON_TEXT: 'icon-text',
  TEXT_ONLY: 'text-only',
  ICON_ONLY_COMMAND: 'icon-only-command',
  ICON_ONLY_TOGGLE: 'icon-only-toggle',
  STATUS_TRIGGER: 'status-trigger',
})

export const WORKFLOW_TOOLBAR_ENTRY_ORDER = Object.freeze({
  TOGGLE_PALETTE: 10,
  TOGGLE_INSPECTOR: 11,
  TOGGLE_GRID_SNAPPING: 15,
  TOGGLE_NODE_ALIGNMENT: 17,
  UNDO: 20,
  REDO: 21,
  DELETE_SELECTION: 30,
  EDIT_BASE_INFO: 40,
  DIAGNOSTICS: 90,
})

export const WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS = Object.freeze({
  TOGGLE_PALETTE: 'toggle-palette',
  TOGGLE_INSPECTOR: 'toggle-inspector',
})

export const WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS = Object.freeze({
  TOGGLE_GRID_SNAPPING: 'toggle-grid-snapping',
  TOGGLE_NODE_ALIGNMENT: 'toggle-node-alignment',
})

const WORKFLOW_TOOLBAR_COMMAND_ENTRY_META = Object.freeze({
  [WORKFLOW_EDITOR_COMMAND_IDS.UNDO]: {
    id: 'undo',
    group: WORKFLOW_TOOLBAR_GROUPS.HISTORY,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.UNDO,
    label: '撤销',
    iconClassName: 'fa-solid fa-rotate-left',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
  },
  [WORKFLOW_EDITOR_COMMAND_IDS.REDO]: {
    id: 'redo',
    group: WORKFLOW_TOOLBAR_GROUPS.HISTORY,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.REDO,
    label: '重做',
    iconClassName: 'fa-solid fa-rotate-right',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
  },
  [WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION]: {
    id: 'delete-selection',
    group: WORKFLOW_TOOLBAR_GROUPS.SELECTION,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.DELETE_SELECTION,
    label: '删除',
    iconClassName: 'fa-solid fa-trash',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
  },
})

const WORKFLOW_TOOLBAR_VIEW_ENTRY_META = Object.freeze({
  [WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_PALETTE]: {
    id: 'toggle-palette',
    group: WORKFLOW_TOOLBAR_GROUPS.VIEW,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.TOGGLE_PALETTE,
    label: '节点面板',
    iconClassName: 'fa-solid fa-table-columns',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
    tooltip: {
      pressed: '隐藏节点面板',
      unpressed: '显示节点面板',
    },
  },
  [WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_INSPECTOR]: {
    id: 'toggle-inspector',
    group: WORKFLOW_TOOLBAR_GROUPS.VIEW,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.TOGGLE_INSPECTOR,
    label: '属性面板',
    iconClassName: 'fa-solid fa-sliders',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
    tooltip: {
      pressed: '隐藏属性面板',
      unpressed: '显示属性面板',
    },
  },
})

const WORKFLOW_TOOLBAR_CANVAS_ASSIST_ENTRY_META = Object.freeze({
  [WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_GRID_SNAPPING]: {
    id: 'toggle-grid-snapping',
    group: WORKFLOW_TOOLBAR_GROUPS.CANVAS_ASSIST,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.TOGGLE_GRID_SNAPPING,
    label: '网格吸附',
    iconClassName: 'fa-solid fa-border-all',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
    tooltip: {
      pressed: '关闭网格吸附',
      unpressed: '开启网格吸附',
    },
  },
  [WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_NODE_ALIGNMENT]: {
    id: 'toggle-node-alignment',
    group: WORKFLOW_TOOLBAR_GROUPS.CANVAS_ASSIST,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.TOGGLE_NODE_ALIGNMENT,
    label: '节点对齐',
    iconClassName: 'fa-solid fa-magnet',
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
    tooltip: {
      pressed: '关闭节点对齐',
      unpressed: '开启节点对齐',
    },
  },
})

const resolveWorkflowToolbarToggleTooltip = (commandMeta, pressed) => {
  if (!commandMeta?.tooltip) {
    return commandMeta?.label
  }

  return pressed ? commandMeta.tooltip.pressed : commandMeta.tooltip.unpressed
}

const groupRank = (group) => {
  const rank = WORKFLOW_TOOLBAR_GROUP_ORDER.indexOf(group)
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank
}

const entrySort = (leftEntry, rightEntry) => {
  const groupOrderDelta = groupRank(leftEntry.group) - groupRank(rightEntry.group)
  if (groupOrderDelta !== 0) {
    return groupOrderDelta
  }

  return (leftEntry.order || 0) - (rightEntry.order || 0)
}

export const createWorkflowToolbarSchemaEntryDescriptor = (entry) => {
  if (!entry) {
    return null
  }

  const hasIcon =
    typeof entry?.schema?.icon === 'string' && entry.schema.icon.trim().length > 0

  return {
    id: 'edit-base-info',
    group: WORKFLOW_TOOLBAR_GROUPS.META,
    kind: WORKFLOW_TOOLBAR_ENTRY_KINDS.SCHEMA_ENTRY,
    presentation: hasIcon
      ? WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_TEXT
      : WORKFLOW_TOOLBAR_PRESENTATIONS.TEXT_ONLY,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.EDIT_BASE_INFO,
    visible: true,
    payload: {
      entry,
    },
  }
}

export const createWorkflowToolbarStatusEntryDescriptor = (element) => {
  if (!element) {
    return null
  }

  return {
    id: 'diagnostics',
    group: WORKFLOW_TOOLBAR_GROUPS.META,
    kind: WORKFLOW_TOOLBAR_ENTRY_KINDS.STATUS_ENTRY,
    presentation: WORKFLOW_TOOLBAR_PRESENTATIONS.STATUS_TRIGGER,
    order: WORKFLOW_TOOLBAR_ENTRY_ORDER.DIAGNOSTICS,
    visible: true,
    payload: {
      element,
    },
  }
}

export const createWorkflowToolbarCommandEntryDescriptor = ({
  commandId,
  commandStateMap,
} = {}) => {
  const commandMeta = WORKFLOW_TOOLBAR_COMMAND_ENTRY_META[commandId]
  const commandState = commandStateMap?.[commandId]
  if (!commandMeta || !commandState?.visible) {
    return null
  }

  return {
    id: commandMeta.id,
    group: commandMeta.group,
    kind: WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
    presentation: commandMeta.presentation,
    order: commandMeta.order,
    visible: true,
    payload: {
      commandId,
      label: commandMeta.label,
      iconClassName: commandMeta.iconClassName,
      enabled: commandState.enabled,
      tooltip: commandState.tooltip,
      disabledReason: commandState.disabledReason,
    },
  }
}

export const createWorkflowToolbarViewToggleEntryDescriptor = ({
  commandId,
  available,
  pressed,
} = {}) => {
  const commandMeta = WORKFLOW_TOOLBAR_VIEW_ENTRY_META[commandId]
  if (!commandMeta || !available) {
    return null
  }

  return {
    id: commandMeta.id,
    group: commandMeta.group,
    kind: WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
    presentation: commandMeta.presentation,
    order: commandMeta.order,
    visible: true,
    payload: {
      commandId,
      label: commandMeta.label,
      iconClassName: commandMeta.iconClassName,
      enabled: true,
      pressed: Boolean(pressed),
      tooltip: resolveWorkflowToolbarToggleTooltip(commandMeta, Boolean(pressed)),
    },
  }
}

export const createWorkflowToolbarCanvasAssistEntryDescriptor = ({
  commandId,
  available,
  enabled,
  pressed,
} = {}) => {
  const commandMeta = WORKFLOW_TOOLBAR_CANVAS_ASSIST_ENTRY_META[commandId]
  if (!commandMeta || !available) {
    return null
  }

  return {
    id: commandMeta.id,
    group: commandMeta.group,
    kind: WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
    presentation: commandMeta.presentation,
    order: commandMeta.order,
    visible: true,
    payload: {
      commandId,
      label: commandMeta.label,
      iconClassName: commandMeta.iconClassName,
      enabled: enabled !== false,
      pressed: Boolean(pressed),
      tooltip: resolveWorkflowToolbarToggleTooltip(commandMeta, Boolean(pressed)),
    },
  }
}

export const buildWorkflowToolbarEntries = ({
  baseInfoEntry = null,
  diagnosticsEntry = null,
  commandStateMap = null,
  chromeVisibility = null,
  canvasAssistState = null,
  canvasAssistAvailability = null,
} = {}) => {
  return [
    createWorkflowToolbarSchemaEntryDescriptor(baseInfoEntry),
    createWorkflowToolbarViewToggleEntryDescriptor({
      commandId: WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_PALETTE,
      available: chromeVisibility?.palette?.available,
      pressed: chromeVisibility?.palette?.visible,
    }),
    createWorkflowToolbarViewToggleEntryDescriptor({
      commandId: WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_INSPECTOR,
      available: chromeVisibility?.inspector?.available,
      pressed: chromeVisibility?.inspector?.visible,
    }),
    createWorkflowToolbarCanvasAssistEntryDescriptor({
      commandId: WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_GRID_SNAPPING,
      available: canvasAssistAvailability?.visible,
      enabled: canvasAssistAvailability?.enabled,
      pressed: canvasAssistState?.gridSnappingEnabled,
    }),
    createWorkflowToolbarCanvasAssistEntryDescriptor({
      commandId: WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_NODE_ALIGNMENT,
      available: canvasAssistAvailability?.visible,
      enabled: canvasAssistAvailability?.enabled,
      pressed: canvasAssistState?.nodeAlignmentEnabled,
    }),
    createWorkflowToolbarCommandEntryDescriptor({
      commandId: WORKFLOW_EDITOR_COMMAND_IDS.UNDO,
      commandStateMap,
    }),
    createWorkflowToolbarCommandEntryDescriptor({
      commandId: WORKFLOW_EDITOR_COMMAND_IDS.REDO,
      commandStateMap,
    }),
    createWorkflowToolbarCommandEntryDescriptor({
      commandId: WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION,
      commandStateMap,
    }),
    createWorkflowToolbarStatusEntryDescriptor(diagnosticsEntry),
  ]
    .filter(Boolean)
    .sort(entrySort)
}

export const groupWorkflowToolbarEntries = (entries = []) => {
  const groupedEntries = entries
    .filter((entry) => entry?.visible)
    .sort(entrySort)
    .reduce((result, entry) => {
      if (!result[entry.group]) {
        result[entry.group] = []
      }
      result[entry.group].push(entry)
      return result
    }, {})

  return WORKFLOW_TOOLBAR_GROUP_ORDER.map((groupId) => {
    const groupEntries = groupedEntries[groupId] || []
    if (groupEntries.length === 0) {
      return null
    }

    return {
      id: groupId,
      entries: groupEntries,
    }
  }).filter(Boolean)
}
