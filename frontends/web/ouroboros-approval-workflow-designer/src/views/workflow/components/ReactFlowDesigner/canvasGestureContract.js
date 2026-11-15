export const CANVAS_MARQUEE_MODIFIER_KEY = 'Shift'
export const CANVAS_ZOOM_MODIFIER_KEY = 'Control'
export const CANVAS_SCROLL_DIRECTION_MODE = 'free'
export const CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER = 1.03

export const CANVAS_GESTURE_CONTRACT = Object.freeze({
  defaultPrimaryDragAction: 'pan-canvas',
  marqueeSelectModifier: CANVAS_MARQUEE_MODIFIER_KEY,
  wheelWithoutModifier: 'pan-viewport',
  wheelWithCtrl: 'zoom-viewport',
  trackpadHorizontalScroll: 'pan-x',
  trackpadVerticalScroll: 'pan-y',
})

export const buildCanvasGestureInteractionProps = ({ allowMultiSelect, isReadonly }) => {
  const canMultiSelect = allowMultiSelect && !isReadonly

  return {
    panOnDrag: true,
    selectionOnDrag: false,
    selectionKeyCode: canMultiSelect ? CANVAS_MARQUEE_MODIFIER_KEY : null,
    multiSelectionKeyCode: canMultiSelect ? undefined : null,
    panOnScroll: true,
    panOnScrollMode: CANVAS_SCROLL_DIRECTION_MODE,
    zoomOnScroll: false,
    zoomOnPinch: false,
    zoomOnDoubleClick: false,
    panActivationKeyCode: null,
    zoomActivationKeyCode: CANVAS_ZOOM_MODIFIER_KEY,
  }
}

export const isCanvasMarqueeModifierPressed = (event) => {
  return event?.shiftKey === true
}

export const shouldStartCanvasMarqueeSelection = ({ event, allowMultiSelect, isReadonly, paneElement }) => {
  if (!allowMultiSelect || isReadonly || !paneElement) {
    return false
  }

  if (event?.button !== 0 || event?.isPrimary === false) {
    return false
  }

  if (!isCanvasMarqueeModifierPressed(event)) {
    return false
  }

  return event?.target === paneElement
}

export const buildCanvasSelectionScreenRect = ({ startPoint, currentPoint }) => {
  if (!startPoint || !currentPoint) {
    return null
  }

  const left = Math.min(startPoint.x, currentPoint.x)
  const top = Math.min(startPoint.y, currentPoint.y)
  const right = Math.max(startPoint.x, currentPoint.x)
  const bottom = Math.max(startPoint.y, currentPoint.y)

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export const resolveCanvasWheelGestureIntent = ({ deltaX = 0, deltaY = 0, ctrlKey = false } = {}) => {
  if (ctrlKey) {
    return {
      kind: 'zoom-viewport',
      deltaX,
      deltaY,
      ctrlKey: true,
    }
  }

  if (deltaX !== 0 && deltaY === 0) {
    return {
      kind: 'pan-x',
      deltaX,
      deltaY,
      ctrlKey: false,
    }
  }

  if (deltaY !== 0) {
    return {
      kind: 'pan-y',
      deltaX,
      deltaY,
      ctrlKey: false,
    }
  }

  if (deltaX !== 0) {
    return {
      kind: 'pan-x',
      deltaX,
      deltaY,
      ctrlKey: false,
    }
  }

  return null
}
