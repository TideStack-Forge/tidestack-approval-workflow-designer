export const WORKFLOW_PALETTE_SURFACE_OWNERS = Object.freeze({
  LEFT_PANEL: 'left-panel',
})

export const WORKFLOW_PALETTE_WIDTH = 240
export const WORKFLOW_PALETTE_TOP_INSET = 16
export const WORKFLOW_PALETTE_LEFT_INSET = 16
export const WORKFLOW_PALETTE_BOTTOM_INSET = 16
export const WORKFLOW_PALETTE_TOOLBAR_GAP = 16
export const WORKFLOW_PALETTE_COLLAPSED_TRANSLATE_GAP = 24

export const WORKFLOW_PALETTE_SURFACE_CONTRACT = Object.freeze({
  owner: WORKFLOW_PALETTE_SURFACE_OWNERS.LEFT_PANEL,
  width: WORKFLOW_PALETTE_WIDTH,
  topInset: WORKFLOW_PALETTE_TOP_INSET,
  leftInset: WORKFLOW_PALETTE_LEFT_INSET,
  bottomInset: WORKFLOW_PALETTE_BOTTOM_INSET,
  toolbarGap: WORKFLOW_PALETTE_TOOLBAR_GAP,
  collapsedTranslateGap: WORKFLOW_PALETTE_COLLAPSED_TRANSLATE_GAP,
})

export const createWorkflowToolbarDockingContext = ({
  paletteAvailable = true,
  paletteVisible = true,
  paletteOccupiedWidth,
  topInset = WORKFLOW_PALETTE_SURFACE_CONTRACT.topInset,
  leftInset,
} = {}) => {
  const normalizedPaletteAvailable = Boolean(paletteAvailable)
  const normalizedPaletteVisible = normalizedPaletteAvailable && Boolean(paletteVisible)
  const normalizedPaletteOccupiedWidth = Math.max(
    0,
    Number.isFinite(Number(paletteOccupiedWidth))
      ? Number(paletteOccupiedWidth)
      : normalizedPaletteVisible
        ? WORKFLOW_PALETTE_SURFACE_CONTRACT.width
        : 0
  )
  const defaultLeftInset = normalizedPaletteVisible
    ? WORKFLOW_PALETTE_SURFACE_CONTRACT.leftInset +
      normalizedPaletteOccupiedWidth +
      WORKFLOW_PALETTE_SURFACE_CONTRACT.toolbarGap
    : WORKFLOW_PALETTE_SURFACE_CONTRACT.leftInset

  return {
    followsPalette: true,
    paletteAvailable: normalizedPaletteAvailable,
    paletteVisible: normalizedPaletteVisible,
    paletteOccupiedWidth: normalizedPaletteOccupiedWidth,
    topInset: Number.isFinite(Number(topInset))
      ? Number(topInset)
      : WORKFLOW_PALETTE_SURFACE_CONTRACT.topInset,
    leftInset: Number.isFinite(Number(leftInset)) ? Number(leftInset) : defaultLeftInset,
  }
}

export const resolveWorkflowToolbarDockingGeometry = (dockingContext) => {
  const normalizedDockingContext = createWorkflowToolbarDockingContext(dockingContext)

  return {
    top: normalizedDockingContext.topInset,
    left: normalizedDockingContext.leftInset,
  }
}

