export const WORKFLOW_NAVIGATOR_SURFACE_OWNERS = Object.freeze({
  VIEWPORT_CLUSTER: 'viewport-cluster',
})

export const WORKFLOW_NAVIGATOR_MINIMAP_STATES = Object.freeze({
  EXPANDED: 'expanded',
  COLLAPSED: 'collapsed',
})

export const WORKFLOW_NAVIGATOR_LAYOUTS = Object.freeze({
  EXPANDED: 'minimap-above-control-strip',
  COLLAPSED: 'expand-button-only',
})

export const WORKFLOW_NAVIGATOR_CONTROL_IDS = Object.freeze({
  TOGGLE_MINIMAP: 'toggle-minimap',
})

export const WORKFLOW_VIEWPORT_CLUSTER_WIDTH = 216
export const WORKFLOW_VIEWPORT_MINIMAP_HEIGHT = 116
export const WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_RIGHT_INSET = 16
export const WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_BOTTOM_INSET = 16
export const WORKFLOW_VIEWPORT_CLUSTER_PROPERTY_PANEL_GAP = 16

export const WORKFLOW_NAVIGATOR_MINIMAP_TOGGLE_META = Object.freeze({
  [WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED]: {
    label: '收起小地图',
    iconClassName: 'fa-solid fa-chevron-down',
  },
  [WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED]: {
    label: '展开小地图',
    iconClassName: 'fa-solid fa-chevron-up',
  },
})

export const WORKFLOW_NAVIGATOR_SURFACE_CONTRACT = Object.freeze({
  owner: WORKFLOW_NAVIGATOR_SURFACE_OWNERS.VIEWPORT_CLUSTER,
  topToolbarToggle: false,
  defaultMinimapState: WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED,
  states: Object.freeze([
    WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED,
    WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED,
  ]),
  expandedLayout: WORKFLOW_NAVIGATOR_LAYOUTS.EXPANDED,
  collapsedLayout: WORKFLOW_NAVIGATOR_LAYOUTS.COLLAPSED,
  width: WORKFLOW_VIEWPORT_CLUSTER_WIDTH,
  minimapHeight: WORKFLOW_VIEWPORT_MINIMAP_HEIGHT,
  controls: Object.freeze([
    'zoom-out',
    'zoom-percent',
    'zoom-in',
    'fit-graph',
    'center-graph',
    WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP,
  ]),
})

export const createWorkflowNavigatorSurfaceState = ({
  minimapState = WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.defaultMinimapState,
} = {}) => ({
  minimapState,
  persisted: false,
})

export const createWorkflowNavigatorDockingContext = ({
  propertyPanelVisible = false,
  propertyPanelOccupiedWidth = 0,
  rightInset,
  bottomInset = WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_BOTTOM_INSET,
} = {}) => {
  const normalizedPropertyPanelOccupiedWidth = Math.max(
    0,
    Number(propertyPanelOccupiedWidth) || 0
  )
  const normalizedPropertyPanelVisible = Boolean(propertyPanelVisible)

  return {
    followsPropertyPanel: true,
    propertyPanelVisible: normalizedPropertyPanelVisible,
    propertyPanelOccupiedWidth: normalizedPropertyPanelOccupiedWidth,
    rightInset:
      Number.isFinite(Number(rightInset))
        ? Number(rightInset)
        : normalizedPropertyPanelVisible
          ? WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_RIGHT_INSET +
            normalizedPropertyPanelOccupiedWidth +
            WORKFLOW_VIEWPORT_CLUSTER_PROPERTY_PANEL_GAP
          : WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_RIGHT_INSET,
    bottomInset:
      Number.isFinite(Number(bottomInset))
        ? Number(bottomInset)
        : WORKFLOW_VIEWPORT_CLUSTER_DEFAULT_BOTTOM_INSET,
  }
}

export const isWorkflowNavigatorMinimapExpanded = (state) =>
  (state?.minimapState || WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.defaultMinimapState) ===
  WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED

export const toggleWorkflowNavigatorMinimapState = (state) => {
  const expanded = isWorkflowNavigatorMinimapExpanded(state)

  return createWorkflowNavigatorSurfaceState({
    minimapState: expanded
      ? WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED
      : WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED,
  })
}

export const normalizeWorkflowNavigatorDockingContext = (dockingContext) =>
  createWorkflowNavigatorDockingContext(dockingContext)
