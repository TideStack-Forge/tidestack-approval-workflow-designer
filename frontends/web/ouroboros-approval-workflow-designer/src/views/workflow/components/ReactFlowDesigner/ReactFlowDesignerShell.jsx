import { useLocale } from '../../../../useLocale.js'
import { t } from '../../../../i18n.js'
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { confirm } from 'ouroboros-sdk'
import LeftPanel from './LeftPanel'
import ReactFlowCanvas from './ReactFlowCanvas'
import RightPanel from './RightPanel'
import WorkflowEditorCommandSurface from './WorkflowEditorCommandSurface'
import WorkflowEditorDiagnosticsSurface from './WorkflowEditorDiagnosticsSurface'
import {
  buildWorkflowChromeCssVariables,
  createWorkflowChromeVisualContract,
} from './workflowChromeVisualContract'
import {
  createWorkflowToolbarDockingContext,
  resolveWorkflowToolbarDockingGeometry,
} from './workflowPaletteSurfaceContract'
import {
  buildWorkflowToolbarEntries,
  WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS,
  WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS,
} from './workflowToolbarSurfaceContract'
import {
  createWorkflowNavigatorDockingContext,
} from './workflowNavigatorSurfaceContract'
import {
  createWorkflowChromeVisibilityState,
  reconcileWorkflowChromeVisibilityAvailability,
  reduceWorkflowChromeVisibilityState,
  WORKFLOW_CHROME_VISIBILITY_ACTIONS,
  WORKFLOW_CHROME_VISIBILITY_REASONS,
} from './workflowChromeVisibilityContract'
import { useApprovalWorkflowEditorCoreBridge } from '../../../../editor-core/approvalWorkflowEditorCoreBridge'
import { buildWorkflowNodeCatalog } from '../../../../editor-core/workflowNodeCatalog'
import {
  createWorkflowInspectorTargetSnapshot,
  resolveWorkflowInspectorSelectionPayload,
} from './workflowInspectorTarget.js'
import { definitionToReactFlow } from '../../../../canvas-adapters/react-flow/index.js'
import { buildWorkflowValidationSnapshot } from '../../../../validation/validationEngine.js'
import {
  createEmptyWorkflowSelectionSnapshot,
  buildWorkflowEditorCommandStates,
  normalizeWorkflowSelectionSnapshot,
  reconcileWorkflowSelectionSnapshot,
  WORKFLOW_EDITOR_COMMAND_IDS,
} from '../../../../editor-core/coreContract'
import './styles.scss'

const WORKFLOW_DIAGNOSTICS_STATUS_META = Object.freeze({
  clean: {
    label: '正常',
    tone: 'clean',
    summary: '当前未发现结构错误或警告',
  },
  warning: {
    label: '警告',
    tone: 'warning',
    summary: '存在待确认的结构告警',
  },
  error: {
    label: '错误',
    tone: 'error',
    summary: '存在需要处理的结构错误',
  },
  'draft-invalid': {
    label: '存在错误',
    tone: 'draft-invalid',
    summary: '草稿存在阻塞性错误，请继续修正',
  },
})

const WORKFLOW_DIAGNOSTICS_INDICATOR_META = Object.freeze({
  clean: {
    iconClassName: 'fa-solid fa-check',
    ariaLabel: '流程诊断：正常',
  },
  warning: {
    iconClassName: 'fa-solid fa-triangle-exclamation',
    ariaLabel: '流程诊断：警告',
  },
  error: {
    iconClassName: 'fa-solid fa-xmark',
    ariaLabel: '流程诊断：错误',
  },
  'draft-invalid': {
    iconClassName: 'fa-solid fa-xmark',
    ariaLabel: '流程诊断：存在错误',
  },
})

const EMPTY_HISTORY_SNAPSHOT = Object.freeze({
  available: false,
  canUndo: false,
  canRedo: false,
  undoLabel: undefined,
  redoLabel: undefined,
})

const DEFAULT_WORKFLOW_CANVAS_ASSIST_STATE = Object.freeze({
  gridSnappingEnabled: true,
  nodeAlignmentEnabled: true,
})

const isSameSelectionSnapshot = (currentSelection, nextSelection) => {
  if ((currentSelection?.mode || 'none') !== (nextSelection?.mode || 'none')) {
    return false
  }

  if ((currentSelection?.primaryTargetId || null) !== (nextSelection?.primaryTargetId || null)) {
    return false
  }

  return (
    JSON.stringify(currentSelection?.nodeIds || []) === JSON.stringify(nextSelection?.nodeIds || []) &&
    JSON.stringify(currentSelection?.edgeIds || []) === JSON.stringify(nextSelection?.edgeIds || [])
  )
}

const ReactFlowDesignerShell = forwardRef(function ReactFlowDesignerShell(
  {
    session,
    onSessionChange,
    readonly,
    coreCapabilities,
    conditionFieldSource,
    onSelectionChange,
    onDiagnosticsChange,
  },
  ref
) {
  useLocale()
  const bridgeContext = useApprovalWorkflowEditorCoreBridge()
  const [selection, setSelection] = useState(() => createEmptyWorkflowSelectionSnapshot())
  const previousSelectionRef = useRef(createEmptyWorkflowSelectionSnapshot())
  const [mutationBridge, setMutationBridge] = useState(null)
  const [commandBridge, setCommandBridge] = useState(null)
  const [chromeVisibility, setChromeVisibility] = useState(() =>
    createWorkflowChromeVisibilityState({
      paletteAvailable: buildWorkflowNodeCatalog({ readonly, coreCapabilities }).length > 0,
      inspectorAvailable: true,
    })
  )
  const [propertyPanelOccupiedWidth, setPropertyPanelOccupiedWidth] = useState(0)
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const [canvasAssistState, setCanvasAssistState] = useState(() => ({
    ...DEFAULT_WORKFLOW_CANVAS_ASSIST_STATE,
  }))

  const workflow = session?.getWorkflow ? session.getWorkflow() : null
  const definition = session?.getDefinition ? session.getDefinition() : null
  const editorLayout = definition?.editorLayout || workflow?.editorLayout
  const nodeCatalog = useMemo(
    () => buildWorkflowNodeCatalog({ readonly, coreCapabilities }),
    [coreCapabilities, readonly]
  )
  const paletteAvailable = nodeCatalog.length > 0
  const inspectorAvailable = true
  const allowHistoryCommands = !readonly && coreCapabilities?.allowHistoryCommands === true
  const inspectorSelectionAutoSyncEnabled = !readonly && coreCapabilities?.allowInspectorEdit !== false
  const sessionRevision = session?.getRevision?.() || 0
  const toolbarDockingContext = useMemo(
    () =>
      createWorkflowToolbarDockingContext({
        paletteAvailable: chromeVisibility.palette.available,
        paletteVisible: chromeVisibility.palette.visible,
      }),
    [chromeVisibility.palette.available, chromeVisibility.palette.visible]
  )
  const chromeVisualContract = useMemo(() => {
    const toolbarGeometry = resolveWorkflowToolbarDockingGeometry(toolbarDockingContext)
    return createWorkflowChromeVisualContract({
      toolbar: toolbarGeometry,
    })
  }, [toolbarDockingContext])
  const chromeVisualStyle = useMemo(
    () => buildWorkflowChromeCssVariables(chromeVisualContract),
    [chromeVisualContract]
  )
  const navigatorDockingContext = useMemo(
    () =>
      createWorkflowNavigatorDockingContext({
        propertyPanelVisible: chromeVisibility.inspector.visible,
        propertyPanelOccupiedWidth,
      }),
    [chromeVisibility.inspector.visible, propertyPanelOccupiedWidth]
  )
  const historySnapshot = useMemo(() => {
    if (!allowHistoryCommands) {
      return EMPTY_HISTORY_SNAPSHOT
    }

    return (
      commandBridge?.getHistorySnapshot?.() ||
      session?.getHistorySnapshot?.() || {
        available: true,
        canUndo: false,
        canRedo: false,
        undoLabel: undefined,
        redoLabel: undefined,
      }
    )
  }, [allowHistoryCommands, commandBridge, session, sessionRevision])
  const commandStates = useMemo(() => {
    return buildWorkflowEditorCommandStates({
      readonly,
      coreCapabilities,
      selection,
      viewport,
      history: historySnapshot,
    })
  }, [coreCapabilities, historySnapshot, readonly, selection, viewport])
  const commandStateMap = useMemo(() => {
    return commandStates.reduce((result, commandState) => {
      result[commandState.commandId] = commandState
      return result
    }, {})
  }, [commandStates])
  const canvasAssistAvailability = useMemo(
    () => ({
      visible: true,
      enabled: !readonly,
    }),
    [readonly]
  )

  const externalCanvasData = useMemo(() => {
    if (!definition?.nodes?.length) {
      return { nodes: [], edges: [] }
    }

    return definitionToReactFlow(definition, editorLayout)
  }, [definition, editorLayout])

  const diagnosticsSnapshot = useMemo(() => {
    return buildWorkflowValidationSnapshot({
      nodes: externalCanvasData.nodes,
      edges: externalCanvasData.edges,
      conditionFieldSource,
    })
  }, [conditionFieldSource, externalCanvasData.edges, externalCanvasData.nodes])
  const diagnosticsStatusMeta =
    WORKFLOW_DIAGNOSTICS_STATUS_META[diagnosticsSnapshot.status] ||
    WORKFLOW_DIAGNOSTICS_STATUS_META.clean
  const diagnosticsBlockingCount = useMemo(() => {
    return diagnosticsSnapshot.items.filter((item) => item?.blocking).length
  }, [diagnosticsSnapshot.items])
  const diagnosticsIndicatorState = useMemo(() => {
    const indicatorMeta =
      WORKFLOW_DIAGNOSTICS_INDICATOR_META[diagnosticsSnapshot.status] ||
      WORKFLOW_DIAGNOSTICS_INDICATOR_META.clean
    const itemCount = diagnosticsSnapshot.items.length

    return {
      status: diagnosticsSnapshot.status,
      iconClassName: indicatorMeta.iconClassName,
      ariaLabel: indicatorMeta.ariaLabel,
      tooltip:
        itemCount > 0
          ? `${diagnosticsStatusMeta.summary}（共 ${itemCount} 项，阻塞项 ${diagnosticsBlockingCount} 个）`
          : diagnosticsStatusMeta.summary,
    }
  }, [
    diagnosticsBlockingCount,
    diagnosticsSnapshot.items.length,
    diagnosticsSnapshot.status,
    diagnosticsStatusMeta.summary,
  ])

  useEffect(() => {
    setSelection((currentSelection) => {
      const nextSelection = reconcileWorkflowSelectionSnapshot(
        currentSelection,
        externalCanvasData.nodes,
        externalCanvasData.edges
      )

      if (isSameSelectionSnapshot(currentSelection, nextSelection)) {
        return currentSelection
      }

      return nextSelection
    })
  }, [externalCanvasData.edges, externalCanvasData.nodes])

  useEffect(() => {
    if (!onSelectionChange) {
      return
    }

    onSelectionChange(selection)
  }, [onSelectionChange, selection])

  useEffect(() => {
    if (!onDiagnosticsChange) {
      return
    }

    onDiagnosticsChange(diagnosticsSnapshot)
  }, [diagnosticsSnapshot, onDiagnosticsChange])

  useEffect(() => {
    setChromeVisibility(
      createWorkflowChromeVisibilityState({
        paletteAvailable,
        inspectorAvailable,
      })
    )
  }, [inspectorAvailable, paletteAvailable, session])

  useEffect(() => {
    setChromeVisibility((currentVisibility) =>
      reconcileWorkflowChromeVisibilityAvailability(currentVisibility, {
        paletteAvailable,
        inspectorAvailable,
      })
    )
  }, [inspectorAvailable, paletteAvailable])

  const applyChromeVisibilityAction = useCallback((action) => {
    setChromeVisibility((currentVisibility) =>
      reduceWorkflowChromeVisibilityState(currentVisibility, action)
    )
  }, [])

  const togglePaletteVisibility = useCallback((reason = WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE) => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_PALETTE,
      reason,
    })
  }, [applyChromeVisibilityAction])

  const closePalettePanel = useCallback(() => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_PALETTE,
      reason: WORKFLOW_CHROME_VISIBILITY_REASONS.PANEL_CLOSE,
    })
  }, [applyChromeVisibilityAction])

  const toggleInspectorVisibility = useCallback(
    (reason = WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE) => {
      setChromeVisibility((currentVisibility) =>
        reduceWorkflowChromeVisibilityState(currentVisibility, currentVisibility.inspector.visible
          ? {
            type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR,
            reason,
          }
          : {
            type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.OPEN_INSPECTOR,
            reason: WORKFLOW_CHROME_VISIBILITY_REASONS.EXPLICIT_OPEN,
          })
      )
    },
    []
  )

  const openInspectorFromSelection = useCallback(() => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.OPEN_INSPECTOR,
      reason: WORKFLOW_CHROME_VISIBILITY_REASONS.SELECTION,
    })
  }, [applyChromeVisibilityAction])

  const openInspectorFromDiagnosticsNavigation = useCallback(() => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.OPEN_INSPECTOR,
      reason: WORKFLOW_CHROME_VISIBILITY_REASONS.DIAGNOSTICS_NAVIGATION,
    })
  }, [applyChromeVisibilityAction])

  const closeInspectorPanel = useCallback(() => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR,
      reason: WORKFLOW_CHROME_VISIBILITY_REASONS.PANEL_CLOSE,
    })
  }, [applyChromeVisibilityAction])

  const closeInspectorFromSelectionClear = useCallback(() => {
    applyChromeVisibilityAction({
      type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR,
      reason: WORKFLOW_CHROME_VISIBILITY_REASONS.SELECTION_CLEAR,
    })
  }, [applyChromeVisibilityAction])

  useEffect(() => {
    const previousSelection = previousSelectionRef.current
    const selectionChanged = !isSameSelectionSnapshot(previousSelection, selection)
    if (!selectionChanged) {
      return
    }

    const previousHadSelection = previousSelection.mode !== 'none'
    const nextHasSelection = selection.mode !== 'none'

    if (!nextHasSelection) {
      if (previousHadSelection && chromeVisibility.inspector.visible) {
        closeInspectorFromSelectionClear()
      }
      previousSelectionRef.current = selection
      return
    }

    if (inspectorSelectionAutoSyncEnabled && !chromeVisibility.inspector.visible) {
      openInspectorFromSelection()
    }

    previousSelectionRef.current = selection
  }, [
    chromeVisibility.inspector.visible,
    closeInspectorFromSelectionClear,
    inspectorSelectionAutoSyncEnabled,
    openInspectorFromSelection,
    selection.mode,
    selection.primaryTargetId,
    selection.nodeIds,
    selection.edgeIds,
    selection,
  ])

  const applySelectionSnapshot = useCallback((nextSelection) => {
    const normalizedSelection = normalizeWorkflowSelectionSnapshot(nextSelection)
    setSelection((currentSelection) => {
      if (isSameSelectionSnapshot(currentSelection, normalizedSelection)) {
        return currentSelection
      }

      return normalizedSelection
    })
  }, [])

  const handleSelectionChange = useCallback((newSelection) => {
    applySelectionSnapshot(newSelection || createEmptyWorkflowSelectionSnapshot())
  }, [applySelectionSnapshot])

  const handleRegisterMutationBridge = useCallback((nextBridge) => {
    setMutationBridge(nextBridge)
  }, [])

  const handleRegisterCommandBridge = useCallback((nextBridge) => {
    setCommandBridge(nextBridge)
  }, [])

  const handleViewportChange = useCallback((nextViewport) => {
    if (!nextViewport) {
      return
    }

    setViewport({
      x: nextViewport.x,
      y: nextViewport.y,
      zoom: nextViewport.zoom,
    })
  }, [])

  const handlePropertyChange = useCallback(
    (nodeId, properties) => {
      if (mutationBridge?.updateNode) {
        mutationBridge.updateNode(nodeId, properties)
      }
    },
    [mutationBridge]
  )

  const handleEdgePropertyChange = useCallback(
    (edgeId, properties) => {
      if (mutationBridge?.updateEdge) {
        mutationBridge.updateEdge(edgeId, properties)
      }
    },
    [mutationBridge]
  )

  const handlePropertyPanelOccupiedWidthChange = useCallback((nextOccupiedWidth) => {
    setPropertyPanelOccupiedWidth(Math.max(0, Number(nextOccupiedWidth) || 0))
  }, [])

  const getSession = useCallback(() => session || null, [session])

  const deleteNodeHandler = useCallback(
    async (model) => {
      if (readonly) {
        return false
      }

      const targetNodeId = model?.id
      if (!targetNodeId || !commandBridge?.deleteElements) {
        return false
      }

      const confirmed = await confirm(t('确认删除该节点？'), t('提示'))
      if (!confirmed) {
        return false
      }

      return commandBridge.deleteElements({
        source: 'node-action',
        nodeIds: [targetNodeId],
        edgeIds: [],
      })
    },
    [commandBridge, readonly]
  )

  const nodeSelectedHandler = useCallback(
    async (model) => {
      const targetNodeId = model?.id
      if (!targetNodeId) {
        return
      }

      const matchedNode = externalCanvasData.nodes.find((node) => node.id === targetNodeId)
      if (!matchedNode) {
        return
      }

      applySelectionSnapshot({
        nodeIds: [targetNodeId],
        edgeIds: [],
      })
    },
    [applySelectionSnapshot, externalCanvasData.nodes]
  )

  const edgeSelectedHandler = useCallback(
    async (model) => {
      const targetEdgeId = typeof model === 'string' ? model : model?.id
      if (!targetEdgeId) {
        return
      }

      const matchedEdge = externalCanvasData.edges.find((edge) => edge.id === targetEdgeId)
      if (!matchedEdge) {
        return
      }

      applySelectionSnapshot({
        nodeIds: [],
        edgeIds: [targetEdgeId],
      })
    },
    [applySelectionSnapshot, externalCanvasData.edges]
  )

  const navigateToTarget = useCallback(
    (targetId) => {
      if (!targetId) {
        return false
      }

      const matchedNode = externalCanvasData.nodes.find((node) => node.id === targetId)
      if (matchedNode) {
        nodeSelectedHandler({ id: targetId })
        if (commandBridge?.focusTarget) {
          void commandBridge.focusTarget(targetId)
        }
        return true
      }

      const matchedEdge = externalCanvasData.edges.find((edge) => edge.id === targetId)
      if (matchedEdge) {
        edgeSelectedHandler({ id: targetId })
        if (commandBridge?.focusTarget) {
          void commandBridge.focusTarget(targetId)
        }
        return true
      }

      return false
    },
    [commandBridge, edgeSelectedHandler, externalCanvasData.edges, externalCanvasData.nodes, nodeSelectedHandler]
  )

  const handleDiagnosticNavigation = useCallback(
    async (diagnosticItem) => {
      if (!diagnosticItem) {
        return false
      }

      if (diagnosticItem.targetType === 'graph' || !diagnosticItem.targetId) {
        if (commandBridge?.fitGraph) {
          return commandBridge.fitGraph()
        }

        return commandBridge?.centerGraph ? commandBridge.centerGraph() : false
      }

      const didNavigate = navigateToTarget(diagnosticItem.targetId)
      if (didNavigate) {
        openInspectorFromDiagnosticsNavigation()
      }

      return didNavigate
    },
    [commandBridge, navigateToTarget, openInspectorFromDiagnosticsNavigation]
  )
  const toolbarEntries = useMemo(() => {
    return buildWorkflowToolbarEntries({
      baseInfoEntry: bridgeContext?.toolbarSurface?.baseInfoEntry || null,
      canvasAssistAvailability,
      canvasAssistState,
      chromeVisibility,
      diagnosticsEntry: (
        <WorkflowEditorDiagnosticsSurface
          diagnosticsSnapshot={diagnosticsSnapshot}
          diagnosticsStatusMeta={diagnosticsStatusMeta}
          diagnosticsBlockingCount={diagnosticsBlockingCount}
          indicatorState={diagnosticsIndicatorState}
          onNavigate={handleDiagnosticNavigation}
          visualContract={chromeVisualContract}
        />
      ),
      commandStateMap,
    })
  }, [
    bridgeContext?.toolbarSurface?.baseInfoEntry,
    canvasAssistAvailability,
    canvasAssistState,
    chromeVisibility,
    commandStateMap,
    diagnosticsBlockingCount,
    diagnosticsIndicatorState,
    diagnosticsSnapshot,
    diagnosticsStatusMeta,
    handleDiagnosticNavigation,
    chromeVisualContract,
  ])

  const executeCommand = useCallback(
    async (commandId) => {
      switch (commandId) {
        case WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_PALETTE:
          togglePaletteVisibility(WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE)
          return true
        case WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_INSPECTOR:
          toggleInspectorVisibility(WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE)
          return true
        case WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_GRID_SNAPPING:
          if (!canvasAssistAvailability.visible || !canvasAssistAvailability.enabled) {
            return false
          }
          setCanvasAssistState((currentState) => ({
            ...currentState,
            gridSnappingEnabled: !currentState.gridSnappingEnabled,
          }))
          return true
        case WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_NODE_ALIGNMENT:
          if (!canvasAssistAvailability.visible || !canvasAssistAvailability.enabled) {
            return false
          }
          setCanvasAssistState((currentState) => ({
            ...currentState,
            nodeAlignmentEnabled: !currentState.nodeAlignmentEnabled,
          }))
          return true
        default:
          break
      }

      const commandState = commandStateMap[commandId]
      if (!commandState?.visible || !commandState.enabled) {
        return false
      }

      switch (commandId) {
        case WORKFLOW_EDITOR_COMMAND_IDS.UNDO:
          return commandBridge?.undo ? commandBridge.undo() : false
        case WORKFLOW_EDITOR_COMMAND_IDS.REDO:
          return commandBridge?.redo ? commandBridge.redo() : false
        case WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION:
          return commandBridge?.deleteSelection ? commandBridge.deleteSelection() : false
        default:
          return false
      }
    },
    [
      canvasAssistAvailability.enabled,
      canvasAssistAvailability.visible,
      commandBridge,
      commandStateMap,
      toggleInspectorVisibility,
      togglePaletteVisibility,
    ]
  )

  const inspectorSelectionPayload = useMemo(
    () =>
      resolveWorkflowInspectorSelectionPayload({
        selectionSnapshot: selection,
        nodes: externalCanvasData.nodes,
        edges: externalCanvasData.edges,
      }),
    [externalCanvasData.edges, externalCanvasData.nodes, selection]
  )
  const inspectorTargetSnapshot = useMemo(
    () =>
      createWorkflowInspectorTargetSnapshot({
        selectionMode: selection.mode,
        selectionSnapshot: selection,
        selectionPayload: inspectorSelectionPayload,
      }),
    [inspectorSelectionPayload, selection]
  )

  useImperativeHandle(
    ref,
    () => ({
      applySelectionSnapshot,
      deleteNodeHandler,
      edgeSelectedHandler,
      getSession,
      getSelectionSnapshot: () => selection,
      nodeSelectedHandler,
      navigateToDiagnosticTarget: navigateToTarget,
    }),
    [
      applySelectionSnapshot,
      deleteNodeHandler,
      edgeSelectedHandler,
      getSession,
      navigateToTarget,
      nodeSelectedHandler,
      selection,
    ]
  )

  return (
    <div className="react-flow-designer-container" style={chromeVisualStyle}>
      {chromeVisibility.palette.available ? (
        <LeftPanel
          readonly={readonly}
          coreCapabilities={coreCapabilities}
          visible={chromeVisibility.palette.visible}
          onRequestClose={closePalettePanel}
        />
      ) : null}
      <WorkflowEditorCommandSurface
        entries={toolbarEntries}
        onExecuteCommand={executeCommand}
        visualContract={chromeVisualContract}
        dockingContext={toolbarDockingContext}
      />
      <ReactFlowCanvas
        session={session}
        conditionFieldSource={conditionFieldSource}
        onSessionChange={onSessionChange}
        readonly={readonly}
        coreCapabilities={coreCapabilities}
        selectionSnapshot={selection}
        onSelectionChange={handleSelectionChange}
        externalCanvasData={externalCanvasData}
        diagnosticsSnapshot={diagnosticsSnapshot}
        onRegisterMutationBridge={handleRegisterMutationBridge}
        onRegisterCommandBridge={handleRegisterCommandBridge}
        onViewportChange={handleViewportChange}
        visualContract={chromeVisualContract}
        navigatorDockingContext={navigatorDockingContext}
        canvasAssistState={canvasAssistState}
      />
      <RightPanel
        selectionMode={selection.mode}
        selection={inspectorSelectionPayload}
        inspectorTargetSnapshot={inspectorTargetSnapshot}
        selectionSnapshot={selection}
        session={session}
        edges={externalCanvasData.edges}
        onPropertyChange={handlePropertyChange}
        onEdgePropertyChange={handleEdgePropertyChange}
        isReadonly={readonly}
        coreCapabilities={coreCapabilities}
        conditionFieldSource={conditionFieldSource}
        visible={chromeVisibility.inspector.visible}
        onRequestClose={closeInspectorPanel}
        onOccupiedWidthChange={handlePropertyPanelOccupiedWidthChange}
      />
    </div>
  )
})

export default ReactFlowDesignerShell
