const assert = require('assert')
const fs = require('fs')
const path = require('path')
require('@babel/register')({
  extensions: ['.js', '.jsx'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})
require.extensions['.css'] = () => null
require.extensions['.scss'] = () => null

const {
  WORKFLOW_NODE_CATALOG,
  buildWorkflowNodeCatalog,
  isVisibleWorkflowNodeCatalogType,
} = require('../../../src/editor-core/workflowNodeCatalog.js')
const {
  WORKFLOW_INSPECTOR_REGISTRY,
  getWorkflowNodeTypeLabel,
  getWorkflowInspectorPanelTitle,
  resolveWorkflowInspectorTargetKind,
} = require('../../../src/editor-core/workflowInspectorRegistry.js')
const {
  getWorkflowNodeAppearance,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowNodeAppearance.js')
const {
  WORKFLOW_TOOLBAR_GROUP_ORDER,
  WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS,
  WORKFLOW_TOOLBAR_ENTRY_KINDS,
  WORKFLOW_TOOLBAR_PRESENTATIONS,
  WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS,
  buildWorkflowToolbarEntries,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowToolbarSurfaceContract.js')
const {
  WORKFLOW_PALETTE_SURFACE_CONTRACT,
  createWorkflowToolbarDockingContext,
  resolveWorkflowToolbarDockingGeometry,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowPaletteSurfaceContract.js')
const {
  WORKFLOW_NAVIGATOR_CONTROL_IDS,
  WORKFLOW_NAVIGATOR_LAYOUTS,
  WORKFLOW_NAVIGATOR_MINIMAP_STATES,
  WORKFLOW_NAVIGATOR_SURFACE_CONTRACT,
  WORKFLOW_VIEWPORT_CLUSTER_WIDTH,
  WORKFLOW_VIEWPORT_MINIMAP_HEIGHT,
  createWorkflowNavigatorDockingContext,
  createWorkflowNavigatorSurfaceState,
  isWorkflowNavigatorMinimapExpanded,
  toggleWorkflowNavigatorMinimapState,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowNavigatorSurfaceContract.js')
const {
  WORKFLOW_CHROME_VISIBILITY_ACTIONS,
  WORKFLOW_CHROME_VISIBILITY_REASONS,
  createWorkflowChromeVisibilityState,
  reduceWorkflowChromeVisibilityState,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowChromeVisibilityContract.js')
const {
  WORKFLOW_CHROME_TOOLTIP_PRIORITY,
  WORKFLOW_CHROME_VISUAL_CONTRACT,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowChromeVisualContract.js')

const readSource = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
const approvalWorkFlowEditorSource = readSource('src/editor-core/ApprovalWorkFlowEditor.jsx')

test('workflow node catalog becomes the single source of palette entries', () => {
  const editableCatalog = buildWorkflowNodeCatalog({
    readonly: false,
    coreCapabilities: {
      allowPaletteInsert: true,
    },
  })

  assert.deepStrictEqual(
    editableCatalog.map((entry) => entry.key),
    ['approval', 'handle', 'cc', 'subprocess', 'start', 'join-or', 'end']
  )
  assert.deepStrictEqual(
    WORKFLOW_NODE_CATALOG.hiddenEntries.map((entry) => entry.key),
    ['branch', 'condition', 'join-and']
  )
  assert.equal(editableCatalog.find((entry) => entry.key === 'start').enabled, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'start').draggable, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'start').label, '流程开始')
  assert.equal(editableCatalog.find((entry) => entry.key === 'join-or').enabled, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'join-or').draggable, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'join-or').label, '合并')
  assert.equal(editableCatalog.find((entry) => entry.key === 'handle').enabled, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'handle').draggable, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'handle').label, '办理')
  assert.equal(editableCatalog.find((entry) => entry.key === 'cc').label, '抄送')
  assert.equal(getWorkflowNodeAppearance('handle').label, '办理节点')
  assert.equal(getWorkflowNodeAppearance('cc').label, '抄送节点')
  assert.equal(getWorkflowNodeAppearance('join-or').label, '合并节点')
  assert.equal(getWorkflowNodeAppearance('start').label, '流程开始')
  assert.equal(getWorkflowNodeAppearance('end').label, '流程结束')
  assert.equal(editableCatalog.find((entry) => entry.key === 'end').enabled, true)
  assert.equal(editableCatalog.find((entry) => entry.key === 'end').label, '流程结束')
  assert.deepStrictEqual(buildWorkflowNodeCatalog({ readonly: true }), [])
  assert.equal(isVisibleWorkflowNodeCatalogType('start'), true)
  assert.equal(isVisibleWorkflowNodeCatalogType('approval'), true)
  assert.equal(isVisibleWorkflowNodeCatalogType('handle'), true)
  assert.equal(isVisibleWorkflowNodeCatalogType('cc'), true)
  assert.equal(isVisibleWorkflowNodeCatalogType('join-or'), true)
  assert.equal(isVisibleWorkflowNodeCatalogType('branch'), false)
  assert.equal(isVisibleWorkflowNodeCatalogType('condition'), false)
  assert.equal(isVisibleWorkflowNodeCatalogType('join-and'), false)
})

test('workflow inspector registry resolves stable and hidden legacy target kinds', () => {
  assert.deepStrictEqual(WORKFLOW_INSPECTOR_REGISTRY.targetKinds, [
    'selection:none',
    'selection:multi',
    'node:start',
    'node:approval',
    'node:handle',
    'node:cc',
    'node:subprocess',
    'node:end',
    'node:join-or',
    'edge:sequence',
  ])
  assert.deepStrictEqual(WORKFLOW_INSPECTOR_REGISTRY.hiddenLegacyTargetKinds, [
    'node:branch',
    'node:condition',
  ])
  assert.equal(resolveWorkflowInspectorTargetKind({ selectionMode: 'multi', selection: { id: 'x' } }), 'selection:multi')
  assert.equal(
    resolveWorkflowInspectorTargetKind({
      selectionMode: 'single-node',
      selection: { id: 'approve-a', type: 'approval' },
    }),
    'node:approval'
  )
  assert.equal(
    resolveWorkflowInspectorTargetKind({
      selectionMode: 'single-node',
      selection: { id: 'handle-a', type: 'handle' },
    }),
    'node:handle'
  )
  assert.equal(
    resolveWorkflowInspectorTargetKind({
      selectionMode: 'single-node',
      selection: { id: 'branch-a', type: 'branch' },
    }),
    'node:branch'
  )
  assert.equal(
    resolveWorkflowInspectorTargetKind({
      selectionMode: 'single-node',
      selection: { id: 'join-a', type: 'join-or' },
    }),
    'node:join-or'
  )
  assert.equal(getWorkflowNodeTypeLabel('join-or'), '合并节点')
  assert.equal(getWorkflowNodeTypeLabel('handle'), '办理节点')
  assert.equal(
    resolveWorkflowInspectorTargetKind({
      selectionMode: 'single-edge',
      selection: { id: 'edge-a' },
    }),
    'edge:sequence'
  )
  assert.equal(getWorkflowInspectorPanelTitle('edge:sequence'), '连线属性')
})

test('workflow toolbar information architecture stays shell-local and keeps viewport commands out of the top toolbar', () => {
  assert.deepStrictEqual(WORKFLOW_TOOLBAR_GROUP_ORDER, [
    'view',
    'canvas-assist',
    'history',
    'selection',
    'meta',
    'status',
  ])

  const descriptors = buildWorkflowToolbarEntries({
    baseInfoEntry: {
      key: 'workflow-base-info-entry',
      schema: { type: 'button', label: '流程信息' },
      props: {},
      env: {},
    },
    diagnosticsEntry: 'diagnostics-entry',
    commandStateMap: {
      undo: { visible: true, enabled: false, disabledReason: '当前版本尚未接入撤销历史' },
      redo: { visible: true, enabled: true, disabledReason: undefined },
      'delete-selection': { visible: true, enabled: false, disabledReason: '请先选择节点或连线' },
      'zoom-in': { visible: true, enabled: true, disabledReason: undefined },
    },
    chromeVisibility: {
      palette: { available: true, visible: true },
      inspector: { available: true, visible: false },
    },
    canvasAssistState: {
      gridSnappingEnabled: true,
      nodeAlignmentEnabled: true,
    },
    canvasAssistAvailability: {
      visible: true,
      enabled: true,
    },
  })

  assert.deepStrictEqual(
    descriptors.map((entry) => entry.id),
    [
      'toggle-palette',
      'toggle-inspector',
      'toggle-grid-snapping',
      'toggle-node-alignment',
      'undo',
      'redo',
      'delete-selection',
      'edit-base-info',
      'diagnostics',
    ]
  )
  assert.deepStrictEqual(
    descriptors.map((entry) => entry.group),
    [
      'view',
      'view',
      'canvas-assist',
      'canvas-assist',
      'history',
      'history',
      'selection',
      'meta',
      'meta',
    ]
  )
  assert.deepStrictEqual(
    descriptors.map((entry) => entry.kind),
    [
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.SCHEMA_ENTRY,
      WORKFLOW_TOOLBAR_ENTRY_KINDS.STATUS_ENTRY,
    ]
  )
  assert.deepStrictEqual(
    descriptors.map((entry) => entry.presentation),
    [
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
      WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND,
      WORKFLOW_TOOLBAR_PRESENTATIONS.TEXT_ONLY,
      WORKFLOW_TOOLBAR_PRESENTATIONS.STATUS_TRIGGER,
    ]
  )
  assert.ok(!descriptors.some((entry) => entry.payload?.commandId === 'zoom-in'))
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-palette')?.payload?.pressed,
    true
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-palette')?.payload?.tooltip,
    '隐藏节点面板'
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-inspector')?.payload?.pressed,
    false
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-inspector')?.payload?.tooltip,
    '显示属性面板'
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-grid-snapping')?.payload?.pressed,
    true
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-grid-snapping')?.payload?.tooltip,
    '关闭网格吸附'
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-node-alignment')?.payload?.pressed,
    true
  )
  assert.equal(
    descriptors.find((entry) => entry.id === 'toggle-node-alignment')?.payload?.tooltip,
    '关闭节点对齐'
  )
  assert.equal(WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_PALETTE, 'toggle-palette')
  assert.equal(WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS.TOGGLE_INSPECTOR, 'toggle-inspector')
  assert.equal(
    WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_GRID_SNAPPING,
    'toggle-grid-snapping'
  )
  assert.equal(
    WORKFLOW_TOOLBAR_CANVAS_ASSIST_COMMAND_IDS.TOGGLE_NODE_ALIGNMENT,
    'toggle-node-alignment'
  )

  const descriptorsWithIcon = buildWorkflowToolbarEntries({
    baseInfoEntry: {
      key: 'workflow-base-info-entry',
      schema: { type: 'button', label: '流程信息', icon: 'fa-solid fa-circle-info' },
      props: {},
      env: {},
    },
    diagnosticsEntry: 'diagnostics-entry',
    commandStateMap: {
      undo: { visible: false, enabled: false, disabledReason: undefined },
      redo: { visible: false, enabled: false, disabledReason: undefined },
      'delete-selection': { visible: false, enabled: false, disabledReason: undefined },
    },
    chromeVisibility: {
      palette: { available: false, visible: false },
      inspector: { available: false, visible: false },
    },
    canvasAssistAvailability: {
      visible: false,
      enabled: false,
    },
  })
  assert.equal(
    descriptorsWithIcon.find((entry) => entry.id === 'edit-base-info')?.presentation,
    WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_TEXT
  )

  const readonlyDescriptors = buildWorkflowToolbarEntries({
    diagnosticsEntry: 'diagnostics-entry',
    commandStateMap: {
      undo: { visible: false, enabled: false, disabledReason: undefined },
      redo: { visible: false, enabled: false, disabledReason: undefined },
      'delete-selection': { visible: false, enabled: false, disabledReason: undefined },
    },
    chromeVisibility: {
      palette: { available: false, visible: false },
      inspector: { available: true, visible: false },
    },
    canvasAssistState: {
      gridSnappingEnabled: true,
      nodeAlignmentEnabled: true,
    },
    canvasAssistAvailability: {
      visible: true,
      enabled: false,
    },
  })
  assert.ok(!readonlyDescriptors.some((entry) => entry.id === 'toggle-palette'))
  assert.ok(readonlyDescriptors.some((entry) => entry.id === 'toggle-inspector'))
  assert.deepStrictEqual(
    readonlyDescriptors
      .filter((entry) => entry.group === 'canvas-assist')
      .map((entry) => entry.id),
    ['toggle-grid-snapping', 'toggle-node-alignment']
  )
  assert.ok(
    readonlyDescriptors
      .filter((entry) => entry.group === 'canvas-assist')
      .every((entry) => entry.payload?.enabled === false)
  )
  assert.deepStrictEqual(
    readonlyDescriptors
      .filter((entry) => entry.group === 'canvas-assist')
      .map((entry) => entry.payload?.tooltip),
    ['关闭网格吸附', '关闭节点对齐']
  )
})

test('approval workflow editor keeps base info entry shell generation inside the editor adapter', () => {
  assert.ok(approvalWorkFlowEditorSource.includes("const BASIC_INFO_DEFAULT_LABEL = '流程信息'"))
  assert.ok(approvalWorkFlowEditorSource.includes("const BASIC_INFO_DEFAULT_TITLE = '流程信息'"))
  assert.ok(approvalWorkFlowEditorSource.includes("const BASIC_INFO_DEFAULT_ICON = 'fa-solid fa-circle-info'"))
  assert.ok(approvalWorkFlowEditorSource.includes("const BASIC_INFO_DEFAULT_OPEN_MODE = 'dialog'"))
  assert.ok(approvalWorkFlowEditorSource.includes("openMode === 'drawer' ? 'drawer' : BASIC_INFO_DEFAULT_OPEN_MODE"))
  assert.ok(approvalWorkFlowEditorSource.includes('actionType: resolvedOpenMode'))
  assert.ok(
    approvalWorkFlowEditorSource.includes('[resolvedOpenMode]: buildBasicInfoContainerSchema({')
  )
  assert.ok(approvalWorkFlowEditorSource.includes("'&': '$$'"))
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      "formType: '${flowDefinition.form.formType || flowDefinition.formType || \"\"}'"
    )
  )
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      "formId: '${flowDefinition.form.formId || flowDefinition.formKey || \"\"}'"
    )
  )
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      "const formItems = normalizeBasicInfoFormItems(this.props.basicInfoFormItems)"
    )
  )
  assert.ok(approvalWorkFlowEditorSource.includes('resolveDesignAppNameFromProps'))
  assert.ok(approvalWorkFlowEditorSource.includes('this.props.appName'))
  assert.ok(approvalWorkFlowEditorSource.includes('appName: resolvedAppName'))
  assert.ok(approvalWorkFlowEditorSource.includes('basicInfoData: {}'))
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      '!isEqual(prevProps.basicInfoDataSourceApi, this.props.basicInfoDataSourceApi)'
    )
  )
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      'ApprovalWorkflowEditorIntegrationAdapter.resolveBasicInfoData({'
    )
  )
  assert.ok(
    approvalWorkFlowEditorSource.includes('isEqual(this.state.basicInfoData, nextBasicInfoData)')
  )
  assert.ok(approvalWorkFlowEditorSource.includes('basicInfoData: nextBasicInfoData'))
  assert.ok(approvalWorkFlowEditorSource.includes('...(this.state.basicInfoData || {})'))
  assert.ok(
    approvalWorkFlowEditorSource.includes('if (readonly || formItems.length === 0) {')
  )
  assert.ok(approvalWorkFlowEditorSource.includes('buttonLabel: this.props.basicInfoButtonLabel'))
  assert.ok(approvalWorkFlowEditorSource.includes('buttonIcon: this.props.basicInfoButtonIcon'))
  assert.ok(approvalWorkFlowEditorSource.includes('openMode: this.props.basicInfoOpenMode'))
  assert.ok(
    approvalWorkFlowEditorSource.includes(
      "const resolvedIcon = normalizeBasicInfoButtonIcon(buttonIcon)"
    )
  )
  assert.ok(approvalWorkFlowEditorSource.includes('return BASIC_INFO_DEFAULT_ICON'))
  assert.ok(approvalWorkFlowEditorSource.includes('schema.icon = resolvedIcon'))
  assert.ok(approvalWorkFlowEditorSource.includes('label: normalizeBasicInfoButtonLabel(buttonLabel)'))
  assert.ok(approvalWorkFlowEditorSource.includes("'aria-label': normalizeBasicInfoButtonLabel(buttonLabel)"))
  assert.ok(!approvalWorkFlowEditorSource.includes('basicInfoSchema'))
})

test('workflow chrome visibility state owns palette and inspector visibility outside panels', () => {
  const initialState = createWorkflowChromeVisibilityState({
    paletteAvailable: true,
    inspectorAvailable: true,
  })

  assert.equal(initialState.palette.visible, true)
  assert.equal(initialState.inspector.visible, false)

  const paletteHidden = reduceWorkflowChromeVisibilityState(initialState, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_PALETTE,
  })
  assert.equal(paletteHidden.palette.visible, false)

  const inspectorOpened = reduceWorkflowChromeVisibilityState(paletteHidden, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.OPEN_INSPECTOR,
  })
  assert.equal(inspectorOpened.inspector.visible, true)

  const inspectorClosed = reduceWorkflowChromeVisibilityState(inspectorOpened, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR,
  })
  assert.equal(inspectorClosed.inspector.visible, false)

  const inspectorToggleReopened = reduceWorkflowChromeVisibilityState(inspectorClosed, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_INSPECTOR,
    reason: WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE,
  })
  assert.equal(inspectorToggleReopened.inspector.visible, true)

  const inspectorToggleClosed = reduceWorkflowChromeVisibilityState(inspectorToggleReopened, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_INSPECTOR,
    reason: WORKFLOW_CHROME_VISIBILITY_REASONS.TOOLBAR_TOGGLE,
  })
  assert.equal(inspectorToggleClosed.inspector.visible, false)

  const paletteClosed = reduceWorkflowChromeVisibilityState(inspectorToggleClosed, {
    type: WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_PALETTE,
    reason: WORKFLOW_CHROME_VISIBILITY_REASONS.PANEL_CLOSE,
  })
  assert.equal(paletteClosed.palette.visible, false)
})

test('workflow palette surface contract owns toolbar docking geometry beside the left palette', () => {
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.owner, 'left-panel')
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.width, 240)
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.topInset, 16)
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.leftInset, 16)
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.bottomInset, 16)
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.toolbarGap, 16)
  assert.equal(WORKFLOW_PALETTE_SURFACE_CONTRACT.collapsedTranslateGap, 24)

  const visibleDockingContext = createWorkflowToolbarDockingContext({
    paletteAvailable: true,
    paletteVisible: true,
  })
  assert.equal(visibleDockingContext.followsPalette, true)
  assert.equal(visibleDockingContext.paletteVisible, true)
  assert.equal(visibleDockingContext.paletteOccupiedWidth, 240)
  assert.equal(visibleDockingContext.topInset, 16)
  assert.equal(visibleDockingContext.leftInset, 272)
  assert.deepStrictEqual(resolveWorkflowToolbarDockingGeometry(visibleDockingContext), {
    top: 16,
    left: 272,
  })

  const hiddenDockingContext = createWorkflowToolbarDockingContext({
    paletteAvailable: true,
    paletteVisible: false,
  })
  assert.equal(hiddenDockingContext.paletteVisible, false)
  assert.equal(hiddenDockingContext.paletteOccupiedWidth, 0)
  assert.equal(hiddenDockingContext.leftInset, 16)
  assert.deepStrictEqual(resolveWorkflowToolbarDockingGeometry(hiddenDockingContext), {
    top: 16,
    left: 16,
  })

  const unavailableDockingContext = createWorkflowToolbarDockingContext({
    paletteAvailable: false,
    paletteVisible: true,
  })
  assert.equal(unavailableDockingContext.paletteAvailable, false)
  assert.equal(unavailableDockingContext.paletteVisible, false)
  assert.equal(unavailableDockingContext.leftInset, 16)
})

test('workflow navigator surface contract keeps minimap local to the viewport cluster', () => {
  assert.equal(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.owner, 'viewport-cluster')
  assert.equal(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.topToolbarToggle, false)
  assert.equal(
    WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.defaultMinimapState,
    WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED
  )
  assert.deepStrictEqual(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.states, [
    WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED,
    WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED,
  ])
  assert.equal(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.expandedLayout, WORKFLOW_NAVIGATOR_LAYOUTS.EXPANDED)
  assert.equal(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.collapsedLayout, WORKFLOW_NAVIGATOR_LAYOUTS.COLLAPSED)
  assert.equal(WORKFLOW_VIEWPORT_CLUSTER_WIDTH, 216)
  assert.equal(WORKFLOW_VIEWPORT_MINIMAP_HEIGHT, 116)
  assert.equal(
    WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.controls[
      WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.controls.length - 1
    ],
    WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP
  )
  assert.ok(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.controls.includes('zoom-in'))
  assert.ok(WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.controls.includes('fit-graph'))
  assert.ok(
    WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.controls.includes(WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP)
  )
  assert.equal(WORKFLOW_NAVIGATOR_LAYOUTS.EXPANDED, 'minimap-above-control-strip')
  assert.equal(WORKFLOW_NAVIGATOR_LAYOUTS.COLLAPSED, 'expand-button-only')

  const defaultState = createWorkflowNavigatorSurfaceState()
  assert.equal(defaultState.persisted, false)
  assert.equal(defaultState.minimapState, WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED)
  assert.equal(isWorkflowNavigatorMinimapExpanded(defaultState), true)

  const dockingContext = createWorkflowNavigatorDockingContext({
    propertyPanelVisible: true,
    propertyPanelOccupiedWidth: 450,
  })
  assert.equal(dockingContext.propertyPanelVisible, true)
  assert.equal(dockingContext.propertyPanelOccupiedWidth, 450)
  assert.equal(dockingContext.rightInset, 482)
  assert.equal(dockingContext.bottomInset, 16)

  const collapsedState = toggleWorkflowNavigatorMinimapState(defaultState)
  assert.equal(collapsedState.minimapState, WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED)
  assert.equal(collapsedState.persisted, false)
  assert.equal(isWorkflowNavigatorMinimapExpanded(collapsedState), false)

  const reexpandedState = toggleWorkflowNavigatorMinimapState(collapsedState)
  assert.equal(reexpandedState.minimapState, WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED)
  assert.equal(reexpandedState.persisted, false)
})

test('workflow chrome visual contract keeps shared geometry and tooltip priority shell-local', () => {
  assert.deepStrictEqual(WORKFLOW_CHROME_TOOLTIP_PRIORITY, ['tooltip', 'disabledReason', 'label'])
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.button.compactSize, 32)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.button.iconOnlyWidth, 32)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.button.iconSize, 14)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.toolbar.top, 16)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.toolbar.left, 272)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.toolbar.groupGap, 8)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.navigator.width, WORKFLOW_VIEWPORT_CLUSTER_WIDTH)
  assert.equal(WORKFLOW_CHROME_VISUAL_CONTRACT.navigator.minimapHeight, WORKFLOW_VIEWPORT_MINIMAP_HEIGHT)
})

test('formal editor surface no longer dispatches through branch-edge or legacy branch editors', () => {
  const leftPanelSource = readSource('src/views/workflow/components/ReactFlowDesigner/LeftPanel.jsx')
  const rightPanelSource = readSource('src/views/workflow/components/ReactFlowDesigner/RightPanel.jsx')
  const workflowEdgeInspectorSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowEdgeInspector.jsx'
  )
  const workflowEdgeInspectorContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowEdgeInspectorContract.js'
  )
  const propertyEditorSource = readSource('src/views/workflow/components/ReactFlowDesigner/PropertyEditor.jsx')
  const amisPropertyFormSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/AmisPropertyForm.jsx'
  )
  const propertyEditorContractsSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/propertyEditorContracts.js'
  )
  const reactFlowCanvasSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx'
  )

  assert.ok(leftPanelSource.includes('buildWorkflowNodeCatalog'))
  assert.ok(!leftPanelSource.includes("group: '基础节点'"))
  assert.ok(!leftPanelSource.includes('定时器节点'))

  assert.ok(rightPanelSource.includes('resolveWorkflowInspectorTargetKind'))
  assert.ok(!rightPanelSource.includes('isBranchEdge'))
  assert.ok(rightPanelSource.includes('WorkflowEdgeInspector'))
  assert.ok(rightPanelSource.includes('onEdgePropertyChange'))
  assert.ok(workflowEdgeInspectorSource.includes('edgeBelongsToConditionalRoute'))
  assert.ok(workflowEdgeInspectorSource.includes('resolveSplitEdgeContext'))
  assert.ok(workflowEdgeInspectorSource.includes('AmisPropertyForm'))
  assert.ok(!workflowEdgeInspectorSource.includes('编辑条件'))
  assert.ok(!rightPanelSource.includes('条件分支'))
  assert.ok(!rightPanelSource.includes('连线摘要'))
  assert.ok(!rightPanelSource.includes('源节点'))
  assert.ok(!rightPanelSource.includes('目标节点'))

  assert.ok(!propertyEditorSource.includes('BranchPropertyEditor'))
  assert.ok(!propertyEditorSource.includes("node.type === 'branch'"))
  assert.ok(propertyEditorSource.includes('buildNodeConfigSchemaDescriptor'))
  assert.ok(propertyEditorSource.includes('buildNodeConfigValueProjection'))
  assert.ok(!propertyEditorSource.includes('节点摘要'))
  assert.ok(!propertyEditorSource.includes('node-config-section-list'))
  assert.ok(!propertyEditorSource.includes('<h4 className="section-title">配置项</h4>'))
  assert.ok(!propertyEditorSource.includes('<label>ID</label>'))
  assert.ok(!propertyEditorSource.includes('<label>类型</label>'))
  assert.ok(!propertyEditorSource.includes('<label>节点名称</label>'))
  assert.ok(propertyEditorContractsSource.includes('buildWorkflowInspectorSchemaKey'))
  assert.ok(propertyEditorContractsSource.includes('buildNodeConfigValueProjection'))
  assert.ok(!propertyEditorContractsSource.includes('sectionTitles:'))
  assert.ok(workflowEdgeInspectorContractSource.includes('buildWorkflowEdgeInspectorSchemaDescriptor'))
  assert.ok(workflowEdgeInspectorContractSource.includes('buildWorkflowEdgeInspectorValueProjection'))
  assert.ok(workflowEdgeInspectorContractSource.includes('buildWorkflowEdgeConditionPatch'))
  assert.ok(amisPropertyFormSource.includes('applyAmisValueProjection'))
  assert.ok(amisPropertyFormSource.includes('schemaKey'))
  assert.ok(amisPropertyFormSource.includes('handleFormChange'))
  assert.ok(amisPropertyFormSource.includes('baseBody.onChange'))
  assert.ok(!amisPropertyFormSource.includes('handleManualSubmit'))
  assert.ok(!amisPropertyFormSource.includes('保存修改'))
  assert.ok(amisPropertyFormSource.includes('disableFeedbackSurface: true'))
  assert.ok(!propertyEditorContractsSource.includes('buildBranchEdgeDrawerRequest'))
  assert.ok(!propertyEditorContractsSource.includes('normalizeBranchEdgePatch'))
  assert.ok(!propertyEditorContractsSource.includes('isBranchEdge'))
  assert.ok(reactFlowCanvasSource.includes('isVisibleWorkflowNodeCatalogType'))
})

test('shell chrome wiring is split into dedicated surface components without changing overlay ownership', () => {
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const commandSurfaceSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowEditorCommandSurface.jsx'
  )
  const diagnosticsSurfaceSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowEditorDiagnosticsSurface.jsx'
  )
  const toolbarSchemaEntrySource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowToolbarSchemaEntry.jsx'
  )
  const toolbarSurfaceContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowToolbarSurfaceContract.js'
  )
  const leftPanelSource = readSource('src/views/workflow/components/ReactFlowDesigner/LeftPanel.jsx')
  const rightPanelSource = readSource('src/views/workflow/components/ReactFlowDesigner/RightPanel.jsx')

  assert.ok(shellSource.includes("import WorkflowEditorCommandSurface from './WorkflowEditorCommandSurface'"))
  assert.ok(shellSource.includes("import WorkflowEditorDiagnosticsSurface from './WorkflowEditorDiagnosticsSurface'"))
  assert.ok(shellSource.includes('buildWorkflowToolbarEntries'))
  assert.ok(shellSource.includes('WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS'))
  assert.ok(shellSource.includes("from './workflowToolbarSurfaceContract'"))
  assert.ok(shellSource.includes("from './workflowChromeVisibilityContract'"))
  assert.ok(shellSource.includes("from './workflowChromeVisualContract'"))
  assert.ok(shellSource.includes('useApprovalWorkflowEditorCoreBridge'))
  assert.ok(shellSource.includes("from './workflowInspectorTarget.js'"))
  assert.ok(shellSource.includes('const toolbarEntries = useMemo(() => {'))
  assert.ok(shellSource.includes("from './workflowPaletteSurfaceContract'"))
  assert.ok(shellSource.includes('const toolbarDockingContext = useMemo('))
  assert.ok(shellSource.includes('createWorkflowToolbarDockingContext({'))
  assert.ok(shellSource.includes('resolveWorkflowToolbarDockingGeometry(toolbarDockingContext)'))
  assert.ok(shellSource.includes('createWorkflowChromeVisualContract({'))
  assert.ok(shellSource.includes('toolbar: toolbarGeometry,'))
  assert.ok(shellSource.includes('buildWorkflowChromeCssVariables(chromeVisualContract)'))
  assert.ok(shellSource.includes('buildWorkflowToolbarEntries({'))
  assert.ok(shellSource.includes('chromeVisibility'))
  assert.ok(shellSource.includes('applyChromeVisibilityAction'))
  assert.ok(shellSource.includes('previousSelectionRef'))
  assert.ok(shellSource.includes('closePalettePanel'))
  assert.ok(shellSource.includes('closeInspectorPanel'))
  assert.ok(shellSource.includes('closeInspectorFromSelectionClear'))
  assert.ok(shellSource.includes('openInspectorFromSelection'))
  assert.ok(shellSource.includes('openInspectorFromDiagnosticsNavigation'))
  assert.ok(shellSource.includes('handleEdgePropertyChange'))
  assert.ok(shellSource.includes('mutationBridge?.updateEdge'))
  assert.ok(shellSource.includes('WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_PALETTE'))
  assert.ok(shellSource.includes('WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR'))
  assert.ok(shellSource.includes('WORKFLOW_CHROME_VISIBILITY_REASONS.EXPLICIT_OPEN'))
  assert.ok(shellSource.includes('WORKFLOW_CHROME_VISIBILITY_REASONS.PANEL_CLOSE'))
  assert.ok(shellSource.includes('WORKFLOW_CHROME_VISIBILITY_REASONS.SELECTION_CLEAR'))
  assert.ok(shellSource.includes('inspectorSelectionAutoSyncEnabled'))
  assert.ok(shellSource.includes('<WorkflowEditorCommandSurface'))
  assert.ok(shellSource.includes('entries={toolbarEntries}'))
  assert.ok(shellSource.includes('indicatorState={diagnosticsIndicatorState}'))
  assert.ok(shellSource.includes('inspectorTargetSnapshot={inspectorTargetSnapshot}'))

  const graphDiagnosticBranchIndex = shellSource.indexOf("diagnosticItem.targetType === 'graph'")
  const diagnosticOpenIndex = shellSource.indexOf('openInspectorFromDiagnosticsNavigation()', graphDiagnosticBranchIndex)
  const navigateDiagnosticIndex = shellSource.indexOf('const didNavigate = navigateToTarget', graphDiagnosticBranchIndex)
  assert.ok(graphDiagnosticBranchIndex > -1)
  assert.ok(navigateDiagnosticIndex > graphDiagnosticBranchIndex)
  assert.ok(diagnosticOpenIndex > navigateDiagnosticIndex)

  assert.ok(commandSurfaceSource.includes('data-testid="workflow-editor-command-surface"'))
  assert.ok(commandSurfaceSource.includes("data-toolbar-left-inset={dockingContext?.leftInset ?? ''}"))
  assert.ok(commandSurfaceSource.includes("data-toolbar-top-inset={dockingContext?.topInset ?? ''}"))
  assert.ok(commandSurfaceSource.includes("data-palette-visible={dockingContext?.paletteVisible ? 'true' : 'false'}"))
  assert.ok(commandSurfaceSource.includes('groupWorkflowToolbarEntries'))
  assert.ok(commandSurfaceSource.includes('WORKFLOW_TOOLBAR_ENTRY_KINDS'))
  assert.ok(commandSurfaceSource.includes('WORKFLOW_TOOLBAR_PRESENTATIONS'))
  assert.ok(commandSurfaceSource.includes('workflow-command-button-icon-only'))
  assert.ok(commandSurfaceSource.includes('workflow-command-button-pressed'))
  assert.ok(commandSurfaceSource.includes('aria-pressed'))
  assert.ok(commandSurfaceSource.includes('data-command-pressed'))
  assert.ok(commandSurfaceSource.includes('resolveWorkflowChromeTooltipText'))
  assert.ok(commandSurfaceSource.includes('buildWorkflowChromeVisualStateDataAttributes'))
  assert.ok(commandSurfaceSource.includes('WORKFLOW_CHROME_VISUAL_KINDS'))
  assert.ok(commandSurfaceSource.includes('buildEntryVisualStateDataAttributes'))
  assert.ok(commandSurfaceSource.includes('workflow-command-status-entry'))
  assert.ok(commandSurfaceSource.includes('WorkflowToolbarSchemaEntry'))
  assert.ok(commandSurfaceSource.includes("data-command-group={group.id}"))
  assert.ok(toolbarSchemaEntrySource.includes('visualStateDataAttributes'))
  assert.ok(toolbarSchemaEntrySource.includes('className={className}'))
  assert.ok(toolbarSchemaEntrySource.includes("import { renderAmisSchema } from 'ouroboros-sdk'"))
  assert.ok(toolbarSchemaEntrySource.includes('pendingHandlePromiseRef'))
  assert.ok(toolbarSchemaEntrySource.includes("typeof handle?.update === 'function'"))
  assert.ok(toolbarSchemaEntrySource.includes('disableFeedbackSurface: true'))
  assert.ok(!toolbarSchemaEntrySource.includes('destroyRenderHandleLater(previousHandle)'))
  assert.ok(toolbarSchemaEntrySource.includes('data-testid={entry.key}'))
  assert.ok(toolbarSurfaceContractSource.includes('WORKFLOW_TOOLBAR_GROUP_ORDER'))
  assert.ok(toolbarSurfaceContractSource.includes('WORKFLOW_TOOLBAR_VIEW_COMMAND_IDS'))
  assert.ok(toolbarSurfaceContractSource.includes('createWorkflowToolbarViewToggleEntryDescriptor'))
  assert.ok(toolbarSurfaceContractSource.includes('WORKFLOW_TOOLBAR_PRESENTATIONS'))
  assert.ok(toolbarSurfaceContractSource.includes('WORKFLOW_TOOLBAR_ENTRY_KINDS'))
  assert.ok(toolbarSurfaceContractSource.includes('buildWorkflowToolbarEntries'))
  assert.ok(diagnosticsSurfaceSource.includes('data-testid="workflow-editor-diagnostics-surface"'))
  assert.ok(diagnosticsSurfaceSource.includes('data-testid="workflow-editor-diagnostics-trigger"'))
  assert.ok(diagnosticsSurfaceSource.includes('data-testid="workflow-editor-diagnostics-popover"'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-item'))

  assert.ok(leftPanelSource.includes('visible = true'))
  assert.ok(
    leftPanelSource.includes('const [searchKeyword, setSearchKeyword] = useState')
  )
  assert.ok(leftPanelSource.includes('data-testid="workflow-node-search"'))
  assert.ok(leftPanelSource.includes('node-search-empty'))
  assert.ok(leftPanelSource.includes('无匹配节点'))
  assert.ok(leftPanelSource.includes('onRequestClose'))
  assert.ok(leftPanelSource.includes("data-panel-visible={visible ? 'true' : 'false'}"))
  assert.ok(leftPanelSource.includes('workflow-left-panel-close'))
  assert.ok(!leftPanelSource.includes('collapse-handle'))
  assert.ok(!leftPanelSource.includes('fa-angles-left'))
  assert.ok(!leftPanelSource.includes('setExpanded'))
  assert.ok(rightPanelSource.includes('visible = false'))
  assert.ok(rightPanelSource.includes('onRequestClose'))
  assert.ok(rightPanelSource.includes("data-panel-visible={visible ? 'true' : 'false'}"))
  assert.ok(rightPanelSource.includes('workflow-right-panel-close'))
  assert.ok(!rightPanelSource.includes('collapse-handle'))
  assert.ok(!rightPanelSource.includes('fa-angles-left'))
  assert.ok(!rightPanelSource.includes('useImperativeHandle'))
})

test('shell surface keeps the left palette as an overlay and frees canvas width', () => {
  const stylesSource = readSource('src/views/workflow/components/ReactFlowDesigner/styles.scss')

  assert.ok(stylesSource.includes('.react-flow-designer-container .left-panel'))
  assert.ok(stylesSource.includes('position: absolute;'))
  assert.ok(stylesSource.includes('.left-panel-header'))
  assert.ok(stylesSource.includes('.node-search-field'))
  assert.ok(stylesSource.includes('.node-search-empty'))
  assert.ok(stylesSource.includes('top: var(--workflow-chrome-palette-top);'))
  assert.ok(stylesSource.includes('left: var(--workflow-chrome-palette-left);'))
  assert.ok(stylesSource.includes('bottom: var(--workflow-chrome-palette-bottom);'))
  assert.ok(
    stylesSource.includes(
      'transform: translateX(calc(-100% - var(--workflow-chrome-palette-collapsed-translate-gap)));'
    )
  )
  assert.ok(stylesSource.includes('width: var(--workflow-chrome-palette-width);'))
  assert.ok(!stylesSource.includes('margin-left: 230px'))
  assert.ok(stylesSource.includes('.workflow-viewport-cluster'))
  assert.ok(stylesSource.includes('.workflow-viewport-minimap-shell'))
  assert.ok(stylesSource.includes('width: max-content;'))
  assert.ok(stylesSource.includes('padding: var(--workflow-chrome-navigator-padding);'))
  assert.ok(stylesSource.includes('border-radius: var(--workflow-chrome-navigator-radius);'))
  assert.ok(stylesSource.includes('margin-top: var(--workflow-chrome-navigator-control-margin-top);'))
  assert.ok(stylesSource.includes('border-top: 1px solid var(--workflow-chrome-navigator-divider-color);'))
  assert.ok(stylesSource.includes("&[data-minimap-state='collapsed']"))
  assert.ok(stylesSource.includes('.workflow-viewport-minimap-toggle'))
  assert.ok(stylesSource.includes('&--collapsed'))
  assert.ok(stylesSource.includes('align-self: flex-end;'))
  assert.ok(stylesSource.includes('.panel-close-button'))
})

test('right property panel surface is a floating shell without changing inspector content ownership', () => {
  const rightPanelSource = readSource('src/views/workflow/components/ReactFlowDesigner/RightPanel.jsx')
  const stylesSource = readSource('src/views/workflow/components/ReactFlowDesigner/styles.scss')
  const propertyPanelStyles = stylesSource.match(
    /\.react-flow-designer-container \.properties-panel \{[\s\S]*?\.panel-title \{/
  )?.[0]

  assert.ok(
    rightPanelSource.includes(
      "className={`properties-panel ${visible ? 'expanded' : 'collapsed'}`}"
    )
  )
  assert.ok(rightPanelSource.includes("data-panel-visible={visible ? 'true' : 'false'}"))
  assert.ok(!rightPanelSource.includes('setCollapsed'))
  assert.ok(rightPanelSource.includes('<PropertyEditor'))
  assert.ok(!rightPanelSource.includes('PropertiesPanel'))
  assert.ok(!rightPanelSource.includes('renderPropertyPanelSchema'))
  assert.ok(rightPanelSource.includes('const panelBody ='))
  assert.ok(rightPanelSource.includes('<div className="panel-header">'))
  assert.ok(rightPanelSource.includes('<div className="panel-body">'))

  assert.ok(propertyPanelStyles)
  assert.ok(propertyPanelStyles.includes('top: 16px;'))
  assert.ok(propertyPanelStyles.includes('right: 16px;'))
  assert.ok(propertyPanelStyles.includes('bottom: 16px;'))
  assert.ok(propertyPanelStyles.includes('height: auto;'))
  assert.ok(propertyPanelStyles.includes('border-radius: 14px;'))
  assert.ok(propertyPanelStyles.includes('overflow: hidden;'))
  assert.ok(propertyPanelStyles.includes('height: 28px;'))
  assert.ok(propertyPanelStyles.includes('padding: 16px 10px 16px 6px;'))
  assert.ok(propertyPanelStyles.includes('.panel-header {'))
  assert.ok(propertyPanelStyles.includes('justify-content: space-between;'))
  assert.ok(propertyPanelStyles.includes('.panel-body {'))
  assert.ok(propertyPanelStyles.includes('overflow-y: auto;'))
  assert.ok(propertyPanelStyles.includes('padding: 16px 0 0;'))
  assert.ok(!propertyPanelStyles.includes('top: 50%;'))
  assert.ok(!propertyPanelStyles.includes('border-radius: 50%;'))
  assert.ok(!propertyPanelStyles.includes('&.expanded {'))
})
