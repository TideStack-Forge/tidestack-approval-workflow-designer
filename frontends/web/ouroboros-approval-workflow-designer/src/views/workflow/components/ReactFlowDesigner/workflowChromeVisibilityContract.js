export const WORKFLOW_CHROME_VISIBILITY_ACTIONS = Object.freeze({
  TOGGLE_PALETTE: 'toggle-palette',
  CLOSE_PALETTE: 'close-palette',
  TOGGLE_INSPECTOR: 'toggle-inspector',
  OPEN_INSPECTOR: 'open-inspector',
  CLOSE_INSPECTOR: 'close-inspector',
})

export const WORKFLOW_CHROME_VISIBILITY_REASONS = Object.freeze({
  TOOLBAR_TOGGLE: 'toolbar-toggle',
  PANEL_CLOSE: 'panel-close',
  SELECTION: 'selection',
  SELECTION_CLEAR: 'selection-clear',
  DIAGNOSTICS_NAVIGATION: 'diagnostics-navigation',
  EXPLICIT_OPEN: 'explicit-open',
})

export const createWorkflowChromeVisibilityState = ({
  paletteAvailable = true,
  inspectorAvailable = true,
} = {}) => ({
  palette: {
    available: paletteAvailable,
    visible: paletteAvailable,
  },
  inspector: {
    available: inspectorAvailable,
    visible: false,
  },
})

export const reconcileWorkflowChromeVisibilityAvailability = (state, {
  paletteAvailable = true,
  inspectorAvailable = true,
} = {}) => ({
  palette: {
    ...state.palette,
    available: paletteAvailable,
    visible: paletteAvailable ? state.palette.visible : false,
  },
  inspector: {
    ...state.inspector,
    available: inspectorAvailable,
    visible: inspectorAvailable ? state.inspector.visible : false,
  },
})

export const reduceWorkflowChromeVisibilityState = (state, action = {}) => {
  switch (action.type) {
    case WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_PALETTE:
      return {
        ...state,
        palette: {
          ...state.palette,
          visible: state.palette.available ? !state.palette.visible : false,
        },
      }

    case WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_PALETTE:
      return {
        ...state,
        palette: {
          ...state.palette,
          visible: false,
        },
      }

    case WORKFLOW_CHROME_VISIBILITY_ACTIONS.TOGGLE_INSPECTOR: {
      const nextVisible = state.inspector.available ? !state.inspector.visible : false
      return {
        ...state,
        inspector: {
          ...state.inspector,
          visible: nextVisible,
        },
      }
    }

    case WORKFLOW_CHROME_VISIBILITY_ACTIONS.OPEN_INSPECTOR:
      return {
        ...state,
        inspector: {
          ...state.inspector,
          visible: state.inspector.available,
        },
      }

    case WORKFLOW_CHROME_VISIBILITY_ACTIONS.CLOSE_INSPECTOR:
      return {
        ...state,
        inspector: {
          ...state.inspector,
          visible: false,
        },
      }

    default:
      return state
  }
}
