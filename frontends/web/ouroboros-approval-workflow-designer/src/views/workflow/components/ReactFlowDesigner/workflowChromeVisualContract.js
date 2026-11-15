import {
  WORKFLOW_VIEWPORT_CLUSTER_WIDTH,
  WORKFLOW_VIEWPORT_MINIMAP_HEIGHT,
} from './workflowNavigatorSurfaceContract'
import {
  WORKFLOW_PALETTE_COLLAPSED_TRANSLATE_GAP,
  WORKFLOW_PALETTE_SURFACE_CONTRACT,
} from './workflowPaletteSurfaceContract'

export const WORKFLOW_CHROME_VISUAL_KINDS = Object.freeze({
  COMMAND: 'command',
  TOGGLE: 'toggle',
  STATUS: 'status',
  CHIP: 'chip',
  NAVIGATOR_CONTROL: 'navigator-control',
  SCHEMA_ENTRY: 'schema-entry',
})

export const WORKFLOW_CHROME_VISUAL_TONES = Object.freeze({
  DEFAULT: 'default',
  CLEAN: 'clean',
  WARNING: 'warning',
  ERROR: 'error',
  DRAFT_INVALID: 'draft-invalid',
})

export const WORKFLOW_CHROME_TOOLTIP_PRIORITY = Object.freeze(['tooltip', 'disabledReason', 'label'])

export const WORKFLOW_CHROME_VISUAL_CONTRACT = Object.freeze({
  button: Object.freeze({
    compactSize: 32,
    compactRadius: 8,
    iconSize: 14,
    gap: 6,
    paddingX: 10,
    iconOnlyWidth: 32,
    chipMinWidth: 56,
    fontSize: 12,
    lineHeight: 1,
  }),
  toolbar: Object.freeze({
    top: WORKFLOW_PALETTE_SURFACE_CONTRACT.topInset,
    left:
      WORKFLOW_PALETTE_SURFACE_CONTRACT.leftInset +
      WORKFLOW_PALETTE_SURFACE_CONTRACT.width +
      WORKFLOW_PALETTE_SURFACE_CONTRACT.toolbarGap,
    outerGap: 10,
    outerPaddingY: 10,
    outerPaddingX: 12,
    groupGap: 8,
    dividerInset: 12,
    surfaceRadius: 10,
    borderColor: '#e5e7eb',
    surfaceBackground: 'rgba(255, 255, 255, 0.96)',
    surfaceShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    backdropFilter: 'blur(6px)',
    maxWidthPolicy: 'content-fit-single-row',
  }),
  navigator: Object.freeze({
    width: WORKFLOW_VIEWPORT_CLUSTER_WIDTH,
    minimapHeight: WORKFLOW_VIEWPORT_MINIMAP_HEIGHT,
    outerPadding: 8,
    surfaceRadius: 14,
    minimapRadius: 10,
    surfaceBorderColor: '#dbe3ef',
    surfaceBackground: 'rgba(255, 255, 255, 0.96)',
    surfaceShadow: '0 10px 26px rgba(15, 23, 42, 0.12)',
    backdropFilter: 'blur(8px)',
    controlGap: 6,
    controlMarginTop: 8,
    controlPaddingTop: 8,
    dividerColor: 'rgba(219, 227, 239, 0.96)',
    toggleSize: 32,
    toggleInset: 8,
  }),
  states: Object.freeze({
    default: Object.freeze({
      borderColor: '#d1d5db',
      background: '#fff',
      color: '#1f2937',
    }),
    hover: Object.freeze({
      borderColor: '#409eff',
      color: '#409eff',
    }),
    pressed: Object.freeze({
      borderColor: '#409eff',
      background: '#ecf5ff',
      color: '#1677ff',
    }),
    disabled: Object.freeze({
      opacity: 0.5,
    }),
    clean: Object.freeze({
      borderColor: '#86efac',
      background: '#ecfdf5',
      color: '#047857',
      hoverBorderColor: '#10b981',
      hoverColor: '#047857',
    }),
    warning: Object.freeze({
      borderColor: '#fdba74',
      background: '#fff7ed',
      color: '#b45309',
      hoverBorderColor: '#f59e0b',
      hoverColor: '#b45309',
    }),
    error: Object.freeze({
      borderColor: '#fca5a5',
      background: '#fef2f2',
      color: '#b91c1c',
      hoverBorderColor: '#ef4444',
      hoverColor: '#b91c1c',
    }),
    'draft-invalid': Object.freeze({
      borderColor: '#fca5a5',
      background: '#fef2f2',
      color: '#b91c1c',
      hoverBorderColor: '#ef4444',
      hoverColor: '#b91c1c',
    }),
  }),
  tooltipPriority: WORKFLOW_CHROME_TOOLTIP_PRIORITY,
})

const mergeNestedContractSection = (baseSection, nextSection) => {
  return Object.freeze({
    ...baseSection,
    ...(nextSection || {}),
  })
}

export const createWorkflowChromeVisualContract = (overrides = {}) => {
  return Object.freeze({
    ...WORKFLOW_CHROME_VISUAL_CONTRACT,
    ...overrides,
    button: mergeNestedContractSection(WORKFLOW_CHROME_VISUAL_CONTRACT.button, overrides.button),
    toolbar: mergeNestedContractSection(WORKFLOW_CHROME_VISUAL_CONTRACT.toolbar, overrides.toolbar),
    navigator: mergeNestedContractSection(WORKFLOW_CHROME_VISUAL_CONTRACT.navigator, overrides.navigator),
    states: mergeNestedContractSection(WORKFLOW_CHROME_VISUAL_CONTRACT.states, overrides.states),
    tooltipPriority: Object.freeze(overrides.tooltipPriority || WORKFLOW_CHROME_TOOLTIP_PRIORITY),
  })
}

export const normalizeWorkflowChromeVisualContract = (visualContract) => {
  return visualContract || WORKFLOW_CHROME_VISUAL_CONTRACT
}

export const createWorkflowChromeTooltipMeta = ({
  label = '',
  tooltip,
  disabledReason,
} = {}) => ({
  label,
  tooltip,
  disabledReason,
})

export const resolveWorkflowChromeTooltipText = (tooltipMeta, visualContract) => {
  const normalizedVisualContract = normalizeWorkflowChromeVisualContract(visualContract)
  const normalizedTooltipMeta = tooltipMeta || {}

  for (const fieldName of normalizedVisualContract.tooltipPriority) {
    const candidateValue = normalizedTooltipMeta[fieldName]
    if (typeof candidateValue === 'string' && candidateValue.trim().length > 0) {
      return candidateValue
    }
  }

  return ''
}

export const createWorkflowChromeVisualState = ({
  kind = WORKFLOW_CHROME_VISUAL_KINDS.COMMAND,
  pressed = false,
  disabled = false,
  tone = WORKFLOW_CHROME_VISUAL_TONES.DEFAULT,
} = {}) => ({
  kind,
  pressed,
  disabled,
  tone,
})

export const buildWorkflowChromeVisualStateDataAttributes = (visualState) => {
  const normalizedVisualState = createWorkflowChromeVisualState(visualState)

  return {
    'data-visual-kind': normalizedVisualState.kind,
    'data-visual-tone': normalizedVisualState.tone,
    'data-visual-pressed': normalizedVisualState.pressed ? 'true' : 'false',
    'data-visual-disabled': normalizedVisualState.disabled ? 'true' : 'false',
  }
}

export const buildWorkflowChromeCssVariables = (visualContract) => {
  const normalizedVisualContract = normalizeWorkflowChromeVisualContract(visualContract)

  return {
    '--workflow-chrome-button-size': `${normalizedVisualContract.button.compactSize}px`,
    '--workflow-chrome-button-radius': `${normalizedVisualContract.button.compactRadius}px`,
    '--workflow-chrome-button-gap': `${normalizedVisualContract.button.gap}px`,
    '--workflow-chrome-button-padding-x': `${normalizedVisualContract.button.paddingX}px`,
    '--workflow-chrome-button-icon-only-width': `${normalizedVisualContract.button.iconOnlyWidth}px`,
    '--workflow-chrome-chip-min-width': `${normalizedVisualContract.button.chipMinWidth}px`,
    '--workflow-chrome-icon-size': `${normalizedVisualContract.button.iconSize}px`,
    '--workflow-chrome-font-size': `${normalizedVisualContract.button.fontSize}px`,
    '--workflow-chrome-line-height': `${normalizedVisualContract.button.lineHeight}`,
    '--workflow-chrome-toolbar-top': `${normalizedVisualContract.toolbar.top}px`,
    '--workflow-chrome-toolbar-left': `${normalizedVisualContract.toolbar.left}px`,
    '--workflow-chrome-toolbar-surface-gap': `${normalizedVisualContract.toolbar.outerGap}px`,
    '--workflow-chrome-toolbar-padding-y': `${normalizedVisualContract.toolbar.outerPaddingY}px`,
    '--workflow-chrome-toolbar-padding-x': `${normalizedVisualContract.toolbar.outerPaddingX}px`,
    '--workflow-chrome-toolbar-group-gap': `${normalizedVisualContract.toolbar.groupGap}px`,
    '--workflow-chrome-toolbar-divider-inset': `${normalizedVisualContract.toolbar.dividerInset}px`,
    '--workflow-chrome-toolbar-radius': `${normalizedVisualContract.toolbar.surfaceRadius}px`,
    '--workflow-chrome-toolbar-border-color': normalizedVisualContract.toolbar.borderColor,
    '--workflow-chrome-toolbar-background': normalizedVisualContract.toolbar.surfaceBackground,
    '--workflow-chrome-toolbar-shadow': normalizedVisualContract.toolbar.surfaceShadow,
    '--workflow-chrome-toolbar-backdrop-filter': normalizedVisualContract.toolbar.backdropFilter,
    '--workflow-chrome-palette-width': `${WORKFLOW_PALETTE_SURFACE_CONTRACT.width}px`,
    '--workflow-chrome-palette-top': `${WORKFLOW_PALETTE_SURFACE_CONTRACT.topInset}px`,
    '--workflow-chrome-palette-left': `${WORKFLOW_PALETTE_SURFACE_CONTRACT.leftInset}px`,
    '--workflow-chrome-palette-bottom': `${WORKFLOW_PALETTE_SURFACE_CONTRACT.bottomInset}px`,
    '--workflow-chrome-palette-toolbar-gap': `${WORKFLOW_PALETTE_SURFACE_CONTRACT.toolbarGap}px`,
    '--workflow-chrome-palette-collapsed-translate-gap': `${WORKFLOW_PALETTE_COLLAPSED_TRANSLATE_GAP}px`,
    '--workflow-chrome-navigator-width': `${normalizedVisualContract.navigator.width}px`,
    '--workflow-chrome-navigator-minimap-height': `${normalizedVisualContract.navigator.minimapHeight}px`,
    '--workflow-chrome-navigator-padding': `${normalizedVisualContract.navigator.outerPadding}px`,
    '--workflow-chrome-navigator-radius': `${normalizedVisualContract.navigator.surfaceRadius}px`,
    '--workflow-chrome-navigator-minimap-radius': `${normalizedVisualContract.navigator.minimapRadius}px`,
    '--workflow-chrome-navigator-border-color': normalizedVisualContract.navigator.surfaceBorderColor,
    '--workflow-chrome-navigator-background': normalizedVisualContract.navigator.surfaceBackground,
    '--workflow-chrome-navigator-shadow': normalizedVisualContract.navigator.surfaceShadow,
    '--workflow-chrome-navigator-backdrop-filter': normalizedVisualContract.navigator.backdropFilter,
    '--workflow-chrome-navigator-control-gap': `${normalizedVisualContract.navigator.controlGap}px`,
    '--workflow-chrome-navigator-control-margin-top': `${normalizedVisualContract.navigator.controlMarginTop}px`,
    '--workflow-chrome-navigator-control-padding-top': `${normalizedVisualContract.navigator.controlPaddingTop}px`,
    '--workflow-chrome-navigator-divider-color': normalizedVisualContract.navigator.dividerColor,
    '--workflow-chrome-navigator-toggle-size': `${normalizedVisualContract.navigator.toggleSize}px`,
    '--workflow-chrome-navigator-toggle-inset': `${normalizedVisualContract.navigator.toggleInset}px`,
    '--workflow-chrome-button-border-color': normalizedVisualContract.states.default.borderColor,
    '--workflow-chrome-button-background': normalizedVisualContract.states.default.background,
    '--workflow-chrome-button-color': normalizedVisualContract.states.default.color,
    '--workflow-chrome-hover-border-color': normalizedVisualContract.states.hover.borderColor,
    '--workflow-chrome-hover-color': normalizedVisualContract.states.hover.color,
    '--workflow-chrome-pressed-border-color': normalizedVisualContract.states.pressed.borderColor,
    '--workflow-chrome-pressed-background': normalizedVisualContract.states.pressed.background,
    '--workflow-chrome-pressed-color': normalizedVisualContract.states.pressed.color,
    '--workflow-chrome-disabled-opacity': `${normalizedVisualContract.states.disabled.opacity}`,
    '--workflow-chrome-tone-clean-border-color': normalizedVisualContract.states.clean.borderColor,
    '--workflow-chrome-tone-clean-background': normalizedVisualContract.states.clean.background,
    '--workflow-chrome-tone-clean-color': normalizedVisualContract.states.clean.color,
    '--workflow-chrome-tone-clean-hover-border-color':
      normalizedVisualContract.states.clean.hoverBorderColor,
    '--workflow-chrome-tone-clean-hover-color': normalizedVisualContract.states.clean.hoverColor,
    '--workflow-chrome-tone-warning-border-color': normalizedVisualContract.states.warning.borderColor,
    '--workflow-chrome-tone-warning-background': normalizedVisualContract.states.warning.background,
    '--workflow-chrome-tone-warning-color': normalizedVisualContract.states.warning.color,
    '--workflow-chrome-tone-warning-hover-border-color':
      normalizedVisualContract.states.warning.hoverBorderColor,
    '--workflow-chrome-tone-warning-hover-color': normalizedVisualContract.states.warning.hoverColor,
    '--workflow-chrome-tone-error-border-color': normalizedVisualContract.states.error.borderColor,
    '--workflow-chrome-tone-error-background': normalizedVisualContract.states.error.background,
    '--workflow-chrome-tone-error-color': normalizedVisualContract.states.error.color,
    '--workflow-chrome-tone-error-hover-border-color':
      normalizedVisualContract.states.error.hoverBorderColor,
    '--workflow-chrome-tone-error-hover-color': normalizedVisualContract.states.error.hoverColor,
    '--workflow-chrome-tone-draft-invalid-border-color':
      normalizedVisualContract.states['draft-invalid'].borderColor,
    '--workflow-chrome-tone-draft-invalid-background':
      normalizedVisualContract.states['draft-invalid'].background,
    '--workflow-chrome-tone-draft-invalid-color':
      normalizedVisualContract.states['draft-invalid'].color,
    '--workflow-chrome-tone-draft-invalid-hover-border-color':
      normalizedVisualContract.states['draft-invalid'].hoverBorderColor,
    '--workflow-chrome-tone-draft-invalid-hover-color':
      normalizedVisualContract.states['draft-invalid'].hoverColor,
  }
}
