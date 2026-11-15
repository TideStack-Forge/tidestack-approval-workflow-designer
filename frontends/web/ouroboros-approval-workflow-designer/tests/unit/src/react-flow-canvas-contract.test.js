const assert = require('assert')
const fs = require('fs')
const path = require('path')

const readSource = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
const extractResolveDroppedEdgeId = (source) => {
  const match = source.match(
    /const resolveDroppedEdgeId = \(event, canvasElement\) => \{([\s\S]*?)\n\}\n\nconst ReactFlowSelectionBridge/
  )

  assert.ok(match, 'resolveDroppedEdgeId should remain locatable in ReactFlowCanvas.jsx')

  return new Function(
    'EDGE_INSERT_CONTAINER_SELECTOR',
    `return (event, canvasElement) => {${match[1]}\n}`
  )('.react-flow__edge[data-id]')
}

test('ReactFlowCanvas keeps explicit edge-hit insert and free-drop add contracts', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes('EDGE_INSERT_CONTAINER_SELECTOR'))
  assert.ok(source.includes("const edgeElement = hitElements"))
  assert.ok(source.includes("element?.closest?.(EDGE_INSERT_CONTAINER_SELECTOR)"))
  assert.ok(!source.includes('EDGE_INSERT_HIT_TARGET_SELECTOR'))
  assert.ok(!source.includes('.react-flow__edge-textwrapper'))
  assert.ok(source.includes('elementsFromPoint'))
  assert.ok(source.includes('if (!droppedEdge) {'))
  assert.ok(source.includes('targetNodeId: null'))
  assert.ok(source.includes('return buildReplacementSequenceEdges(edge, insertedNodeId)'))
  assert.ok(source.includes("label: resolvedEdge.label || '插入到此连线'"))
})

test('resolveDroppedEdgeId recognizes edge interaction overlay hits through the edge container', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const resolveDroppedEdgeId = extractResolveDroppedEdgeId(source)
  const edgeElement = {
    getAttribute(name) {
      return name === 'data-id' ? 'edge-1' : null
    },
  }
  const interactionElement = {
    closest(selector) {
      return selector === '.react-flow__edge[data-id]' ? edgeElement : null
    },
  }

  const resolvedEdgeId = resolveDroppedEdgeId(
    { clientX: 120, clientY: 48 },
    {
      ownerDocument: {
        elementsFromPoint() {
          return [interactionElement]
        },
        elementFromPoint() {
          return null
        },
      },
    }
  )

  assert.strictEqual(resolvedEdgeId, 'edge-1')
})

test('resolveDroppedEdgeId keeps blank canvas drops detached', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const resolveDroppedEdgeId = extractResolveDroppedEdgeId(source)
  const resolvedEdgeId = resolveDroppedEdgeId(
    { clientX: 12, clientY: 24 },
    {
      ownerDocument: {
        elementsFromPoint() {
          return [{}]
        },
        elementFromPoint() {
          return null
        },
      },
    }
  )

  assert.strictEqual(resolvedEdgeId, null)
})

test('ReactFlowCanvas exposes four-direction handles and always fits to the current graph on first render', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes('position: Position.Top'))
  assert.ok(source.includes('position: Position.Right'))
  assert.ok(source.includes('position: Position.Bottom'))
  assert.ok(source.includes('position: Position.Left'))
  assert.ok(source.includes('isConnectableStart={isConnectable && canConnectFrom}'))
  assert.ok(source.includes('isConnectableEnd={isConnectable && canConnectTo}'))
  assert.ok(source.includes('reactFlowInstance.viewportInitialized'))
  assert.ok(source.includes('fitView({ padding: DEFAULT_FIT_PADDING, duration: 200 })'))
  assert.ok(source.includes('snapToGrid={gridSnappingEnabled && !nodeAlignmentEnabled}'))
  assert.ok(source.includes('snapGrid={WORKFLOW_CANVAS_SNAP_GRID}'))
  assert.ok(source.includes('variant={BackgroundVariant.Dots}'))
  assert.ok(source.includes('gap={10}'))
  assert.ok(source.includes('color="#d0dae1"'))
  assert.ok(source.includes('bgColor="#F2F7FA"'))
  assert.ok(source.includes('canvasAssistState'))
  assert.ok(!source.includes('isPersistedViewportMostlyVisible'))
  assert.ok(!source.includes('defaultViewport={editorLayout?.viewport}'))
})

test('ReactFlowCanvas uses stable visible edge arrow markers', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes('MarkerType'))
  assert.ok(source.includes('type: MarkerType.ArrowClosed'))
  assert.ok(source.includes('strokeWidth: DEFAULT_EDGE_STROKE_WIDTH'))
  assert.ok(source.includes('markerEnd: buildEdgeMarkerConfig(DEFAULT_EDGE_STROKE)'))
})

test('ReactFlowCanvas keeps special node display names and text alignment stable', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes('minWidth: isSpecialNode ? 124 : 152'))
  assert.ok(source.includes('borderRadius: isSpecialNode ? 999 : 12'))
  assert.ok(source.includes("textAlign: 'left'"))
  assert.ok(!source.includes('borderRadius: isEnd ? 999 : 12'))
  assert.ok(!source.includes("textAlign: isEnd ? 'center' : 'left'"))
})

test('ReactFlowCanvas keeps selected node borders layout-stable', () => {
  const source = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(source.includes("const SELECTED_NODE_INNER_RING = 'inset 0 0 0 1px #2563eb'"))
  assert.ok(source.includes("border: `1px solid ${isActive ? '#2563eb' : appearance.borderColor}`"))
  assert.ok(source.includes('`${SELECTED_NODE_INNER_RING}, ${SELECTED_NODE_RING}, 0 8px 18px rgba(15, 23, 42, 0.08)`'))
  assert.ok(!source.includes('`${isActive ? 2 : 1}px solid'))
})

test('editor session supports detached handle nodes from blank canvas drops', () => {
  const source = readSource('src/editor-session/index.js')
  const mutationSource = readSource('src/canvas-adapters/react-flow/useSessionMutations.js')

  assert.ok(source.includes('V2StartNode'))
  assert.ok(source.includes("case 'StartNode':"))
  assert.ok(source.includes('return new V2StartNode(nodeData.name, nodeData.id, nodeData.candidates || [], nodeData.permission || [])'))
  assert.ok(mutationSource.includes("start: 'StartNode'"))
  assert.ok(source.includes('V2HandleNode'))
  assert.ok(source.includes("case 'HandleNode':"))
  assert.ok(source.includes('return new V2HandleNode(nodeData.name, nodeData.id, nodeData.candidates || [], nodeData.permission || [])'))
})

test('ReactFlowCanvas routes canvas assist state through React Flow grid, drop snapping, and alignment guides', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const assistContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowCanvasAssistContract.js'
  )

  assert.ok(canvasSource.includes("from './workflowCanvasAssistContract.js'"))
  assert.ok(canvasSource.includes('screenToFlowPosition('))
  assert.ok(canvasSource.includes('snapToGrid: gridSnappingEnabled'))
  assert.ok(canvasSource.includes('snapGrid: WORKFLOW_CANVAS_SNAP_GRID'))
  assert.ok(canvasSource.includes('snapWorkflowCanvasPositionToGrid(change.position)'))
  assert.ok(canvasSource.includes('resolveWorkflowNodeAlignmentGuides({'))
  assert.ok(canvasSource.includes('const nodeAlignmentEnabled = normalizedCanvasAssistState.nodeAlignmentEnabled === true'))
  assert.ok(canvasSource.includes('alignmentResult.snappedPosition'))
  assert.ok(canvasSource.includes('onNodeDrag={isReadonly ? undefined : (_event, node) => updateAlignmentGuide(node)}'))
  assert.ok(canvasSource.includes('onNodeDragStop={isReadonly ? undefined : clearAlignmentGuide}'))
  assert.ok(canvasSource.includes('workflow-canvas-alignment-guide'))
  assert.ok(canvasSource.includes('gridSnappingEnabled ? ('))
  assert.ok(shellSource.includes('const [canvasAssistState, setCanvasAssistState] = useState(() => ({'))
  assert.ok(shellSource.includes('canvasAssistAvailability'))
  assert.ok(shellSource.includes('canvasAssistState={canvasAssistState}'))
  assert.ok(shellSource.includes('case WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_GRID_SNAPPING'))
  assert.ok(shellSource.includes('case WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_NODE_ALIGNMENT'))
  assert.ok(assistContractSource.includes('WORKFLOW_CANVAS_SNAP_GRID = Object.freeze([20, 20])'))
  assert.ok(assistContractSource.includes('resolveWorkflowNodeAlignmentGuides'))
  assert.ok(assistContractSource.includes('snapWorkflowCanvasPositionToGrid'))
  assert.ok(assistContractSource.includes('projectFlowGuideToScreenStyle'))
})

test('edge deletion remains reachable from command surface for non-keyboard users', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const toolbarSurfaceContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowToolbarSurfaceContract.js'
  )

  assert.ok(canvasSource.includes('onBeforeDelete={!allowDeleteSelection ? undefined : handleBeforeDelete}'))
  assert.ok(canvasSource.includes('onDelete={!allowDeleteSelection ? undefined : handleDelete}'))
  assert.ok(canvasSource.includes('deleteSelection: handleDeleteSelectionCommand'))
  assert.ok(canvasSource.includes('deleteElements: executeGraphDeleteRequest'))
  assert.ok(canvasSource.includes('const { selectedNodeIdSet, selectedEdgeIdSet } = buildSelectionIdSets(selectionSnapshot)'))
  assert.ok(canvasSource.includes('const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id))'))
  assert.ok(canvasSource.includes('const selectedEdges = edges.filter((edge) => selectedEdgeIdSet.has(edge.id))'))
  assert.ok(shellSource.includes('<WorkflowEditorCommandSurface'))
  assert.ok(shellSource.includes('selectionSnapshot={selection}'))
  assert.ok(shellSource.includes('commandBridge?.deleteElements'))
  assert.ok(toolbarSurfaceContractSource.includes('WORKFLOW_EDITOR_COMMAND_IDS.DELETE_SELECTION'))
})

test('history commands are bridged from canvas session state into the shell toolbar surface', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const coreContractSource = readSource('src/editor-core/coreContract.js')
  const toolbarSurfaceContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowToolbarSurfaceContract.js'
  )

  assert.ok(shellSource.includes('commandBridge?.getHistorySnapshot?.()'))
  assert.ok(shellSource.includes('case WORKFLOW_EDITOR_COMMAND_IDS.UNDO'))
  assert.ok(shellSource.includes('case WORKFLOW_EDITOR_COMMAND_IDS.REDO'))
  assert.ok(shellSource.includes('commandBridge?.undo ? commandBridge.undo() : false'))
  assert.ok(shellSource.includes('commandBridge?.redo ? commandBridge.redo() : false'))
  assert.ok(canvasSource.includes('const getHistorySnapshot = useCallback(() => {'))
  assert.ok(canvasSource.includes('const handleHistoryCommand = useCallback('))
  assert.ok(canvasSource.includes("return handleHistoryCommand('undo')"))
  assert.ok(canvasSource.includes("return handleHistoryCommand('redo')"))
  assert.ok(canvasSource.includes('getHistorySnapshot,'))
  assert.ok(canvasSource.includes('undo: handleUndoCommand'))
  assert.ok(canvasSource.includes('redo: handleRedoCommand'))
  assert.ok(coreContractSource.includes('tooltip: undoTooltip'))
  assert.ok(coreContractSource.includes('tooltip: redoTooltip'))
  assert.ok(toolbarSurfaceContractSource.includes('tooltip: commandState.tooltip'))
})

test('viewport commands move into the canvas cluster instead of the shell toolbar', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const viewportClusterSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowViewportCluster.jsx'
  )
  const chromeVisualContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowChromeVisualContract.js'
  )
  const navigatorContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowNavigatorSurfaceContract.js'
  )

  assert.ok(canvasSource.includes("import WorkflowViewportCluster from './WorkflowViewportCluster'"))
  assert.ok(canvasSource.includes('<WorkflowViewportCluster'))
  assert.ok(viewportClusterSource.includes("from './workflowNavigatorSurfaceContract'"))
  assert.ok(viewportClusterSource.includes('data-testid="workflow-viewport-cluster"'))
  assert.ok(viewportClusterSource.includes('data-command-group="viewport"'))
  assert.ok(viewportClusterSource.includes('data-minimap-state={navigatorState.minimapState}'))
  assert.ok(viewportClusterSource.includes('data-layout={layout}'))
  assert.ok(viewportClusterSource.includes('resolveWorkflowChromeTooltipText'))
  assert.ok(viewportClusterSource.includes('buildWorkflowChromeVisualStateDataAttributes'))
  assert.ok(viewportClusterSource.includes('WORKFLOW_CHROME_VISUAL_KINDS'))
  assert.ok(viewportClusterSource.includes('createWorkflowChromeVisualState'))
  assert.ok(viewportClusterSource.includes('workflow-viewport-minimap-shell'))
  assert.ok(viewportClusterSource.includes('workflow-canvas-minimap'))
  assert.ok(viewportClusterSource.includes('createWorkflowNavigatorSurfaceState'))
  assert.ok(viewportClusterSource.includes('toggleWorkflowNavigatorMinimapState'))
  assert.ok(viewportClusterSource.includes('normalizeWorkflowNavigatorDockingContext'))
  assert.ok(viewportClusterSource.includes('WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP'))
  assert.ok(viewportClusterSource.includes('WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.width'))
  assert.ok(viewportClusterSource.includes('WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.minimapHeight'))
  assert.ok(viewportClusterSource.includes('visualContract?.navigator?.width'))
  assert.ok(viewportClusterSource.includes('visualContract?.navigator?.minimapHeight'))
  assert.ok(viewportClusterSource.includes('workflow-viewport-minimap-toggle'))
  assert.ok(viewportClusterSource.includes('data-docking-right-inset={navigatorDockingContext.rightInset}'))
  assert.ok(shellSource.includes('navigatorDockingContext={navigatorDockingContext}'))
  assert.ok(shellSource.includes('onOccupiedWidthChange={handlePropertyPanelOccupiedWidthChange}'))
  assert.ok(shellSource.includes('createWorkflowNavigatorDockingContext({'))
  assert.ok(chromeVisualContractSource.includes('WORKFLOW_VIEWPORT_CLUSTER_WIDTH'))
  assert.ok(chromeVisualContractSource.includes('WORKFLOW_VIEWPORT_MINIMAP_HEIGHT'))
  assert.ok(navigatorContractSource.includes('WORKFLOW_VIEWPORT_CLUSTER_WIDTH = 216'))
  assert.ok(navigatorContractSource.includes('WORKFLOW_VIEWPORT_MINIMAP_HEIGHT = 116'))
  assert.ok(navigatorContractSource.includes('topToolbarToggle: false'))
  assert.ok(
    navigatorContractSource.includes(
      'defaultMinimapState: WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED'
    )
  )
  assert.ok(navigatorContractSource.includes('collapsedLayout: WORKFLOW_NAVIGATOR_LAYOUTS.COLLAPSED'))
  assert.ok(navigatorContractSource.includes("TOGGLE_MINIMAP: 'toggle-minimap'"))
  assert.ok(!canvasSource.includes('<Controls'))
  assert.ok(!canvasSource.includes('showInteractive={!isReadonly}'))
  assert.ok(!shellSource.includes('data-command-group="viewport"'))
  assert.ok(!shellSource.includes('toggle-minimap'))
  assert.ok(shellSource.includes('<WorkflowEditorCommandSurface'))
})

test('canvas gesture contract is delegated through the dedicated helper instead of inline drag-selection toggles', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const gestureContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/canvasGestureContract.js'
  )

  assert.ok(canvasSource.includes("from './canvasGestureContract'"))
  assert.ok(canvasSource.includes('buildCanvasGestureInteractionProps'))
  assert.ok(canvasSource.includes('const canvasGestureInteractionProps = useMemo(() => {'))
  assert.ok(canvasSource.includes('{...canvasGestureInteractionProps}'))
  assert.ok(!canvasSource.includes('panOnDrag={!allowMultiSelect}'))
  assert.ok(!canvasSource.includes('selectionOnDrag={allowMultiSelect}'))
  assert.ok(gestureContractSource.includes("defaultPrimaryDragAction: 'pan-canvas'"))
  assert.ok(gestureContractSource.includes("marqueeSelectModifier: CANVAS_MARQUEE_MODIFIER_KEY"))
  assert.ok(gestureContractSource.includes('panOnDrag: true'))
  assert.ok(gestureContractSource.includes('selectionOnDrag: false'))
  assert.ok(gestureContractSource.includes('selectionKeyCode: canMultiSelect ? CANVAS_MARQUEE_MODIFIER_KEY : null'))
  assert.ok(gestureContractSource.includes('panOnScroll: true'))
  assert.ok(gestureContractSource.includes("panOnScrollMode: CANVAS_SCROLL_DIRECTION_MODE"))
  assert.ok(gestureContractSource.includes('zoomOnScroll: false'))
  assert.ok(gestureContractSource.includes('zoomOnPinch: false'))
  assert.ok(gestureContractSource.includes('panActivationKeyCode: null'))
  assert.ok(gestureContractSource.includes('zoomActivationKeyCode: CANVAS_ZOOM_MODIFIER_KEY'))
  assert.ok(gestureContractSource.includes('CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER = 1.03'))
  assert.ok(canvasSource.includes('CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER'))
})

test('react flow edge contract no longer auto-promotes second outgoing edges or exposes reconnect by default', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const coreContractSource = readSource('src/editor-core/coreContract.js')

  assert.ok(!canvasSource.includes('name: isBranchingEdge ?'))
  assert.ok(!canvasSource.includes('condition: isBranchingEdge ?'))
  assert.ok(coreContractSource.includes('allowEdgeReconnect: false'))
})

test('canvas selection and anchor contract stays explicit in shell and canvas layers', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')

  assert.ok(shellSource.includes('normalizeWorkflowSelectionSnapshot'))
  assert.ok(shellSource.includes('const applySelectionSnapshot = useCallback((nextSelection) => {'))
  assert.ok(canvasSource.includes('createWorkflowSelectionSnapshot({'))
  assert.ok(
    canvasSource.includes('showAnchors: !isReadonly && (isActive || hoveredNodeId === node.id || isConnecting)')
  )
  assert.ok(canvasSource.includes('const handleResolution = resolveRelativeHandlePair'))
  assert.ok(canvasSource.includes("sourceHandle: resolveHandleId(sourceNode, 'right')"))
  assert.ok(canvasSource.includes("targetHandle: resolveHandleId(targetNode, 'left')"))
})

test('node caption contract always shows type label for normal nodes but keeps start/end single-line', () => {
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')

  assert.ok(canvasSource.includes("const shouldShowNodeTypeLabel = !isStart && !isEnd"))
  assert.ok(canvasSource.includes(": ''"))
  assert.ok(canvasSource.includes('{secondaryText ? <div style={{ marginTop: 4, color: \'#6b7280\' }}>{secondaryText}</div> : null}'))
  assert.ok(!canvasSource.includes('secondaryText && secondaryText !== title'))
})

test('viewport layout debounce is cleared when the backing session changes', () => {
  const mutationSource = readSource('src/canvas-adapters/react-flow/useSessionMutations.js')

  assert.ok(mutationSource.includes('const activeSessionRef = useRef(session)'))
  assert.ok(mutationSource.includes('const clearPendingLayoutCommit = useCallback(() => {'))
  assert.ok(mutationSource.includes('activeSessionRef.current = session'))
  assert.ok(mutationSource.includes('clearPendingLayoutCommit()'))
  assert.ok(mutationSource.includes('if (onSessionChange && session && activeSessionRef.current === session)'))
  assert.ok(mutationSource.includes('if (!session || activeSessionRef.current !== session)'))
})
