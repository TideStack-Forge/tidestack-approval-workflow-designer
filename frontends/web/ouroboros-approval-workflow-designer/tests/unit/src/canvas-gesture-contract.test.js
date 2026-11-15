const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  CANVAS_GESTURE_CONTRACT,
  CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER,
  CANVAS_MARQUEE_MODIFIER_KEY,
  CANVAS_SCROLL_DIRECTION_MODE,
  CANVAS_ZOOM_MODIFIER_KEY,
  buildCanvasGestureInteractionProps,
  buildCanvasSelectionScreenRect,
  isCanvasMarqueeModifierPressed,
  resolveCanvasWheelGestureIntent,
  shouldStartCanvasMarqueeSelection,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/canvasGestureContract.js')

test('canvas gesture contract pins the approved editor interaction semantics', () => {
  assert.deepStrictEqual(CANVAS_GESTURE_CONTRACT, {
    defaultPrimaryDragAction: 'pan-canvas',
    marqueeSelectModifier: 'Shift',
    wheelWithoutModifier: 'pan-viewport',
    wheelWithCtrl: 'zoom-viewport',
    trackpadHorizontalScroll: 'pan-x',
    trackpadVerticalScroll: 'pan-y',
  })
  assert.strictEqual(CANVAS_MARQUEE_MODIFIER_KEY, 'Shift')
  assert.strictEqual(CANVAS_ZOOM_MODIFIER_KEY, 'Control')
  assert.strictEqual(CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER, 1.03)
  assert.strictEqual(CANVAS_SCROLL_DIRECTION_MODE, 'free')
})

test('editable canvas interaction props default to pan-first with shift marquee and ctrl zoom gates', () => {
  const interactionProps = buildCanvasGestureInteractionProps({
    allowMultiSelect: true,
    isReadonly: false,
  })

  assert.strictEqual(interactionProps.panOnDrag, true)
  assert.strictEqual(interactionProps.selectionOnDrag, false)
  assert.strictEqual(interactionProps.selectionKeyCode, 'Shift')
  assert.strictEqual(interactionProps.multiSelectionKeyCode, undefined)
  assert.strictEqual(interactionProps.panOnScroll, true)
  assert.strictEqual(interactionProps.panOnScrollMode, 'free')
  assert.strictEqual(interactionProps.zoomOnScroll, false)
  assert.strictEqual(interactionProps.zoomOnPinch, false)
  assert.strictEqual(interactionProps.zoomOnDoubleClick, false)
  assert.strictEqual(interactionProps.panActivationKeyCode, null)
  assert.strictEqual(interactionProps.zoomActivationKeyCode, 'Control')
})

test('readonly or multi-select-disabled canvas interaction props close selection modifiers but keep viewport navigation', () => {
  const readonlyInteractionProps = buildCanvasGestureInteractionProps({
    allowMultiSelect: true,
    isReadonly: true,
  })
  const singleSelectInteractionProps = buildCanvasGestureInteractionProps({
    allowMultiSelect: false,
    isReadonly: false,
  })

  assert.strictEqual(readonlyInteractionProps.selectionKeyCode, null)
  assert.strictEqual(readonlyInteractionProps.multiSelectionKeyCode, null)
  assert.strictEqual(readonlyInteractionProps.panOnScroll, true)
  assert.strictEqual(readonlyInteractionProps.zoomActivationKeyCode, 'Control')

  assert.strictEqual(singleSelectInteractionProps.selectionKeyCode, null)
  assert.strictEqual(singleSelectInteractionProps.multiSelectionKeyCode, null)
  assert.strictEqual(singleSelectInteractionProps.panOnDrag, true)
})

test('canvas gesture helpers normalize shift marquee gating and ctrl wheel intent explicitly', () => {
  assert.strictEqual(isCanvasMarqueeModifierPressed({ shiftKey: true }), true)
  assert.strictEqual(isCanvasMarqueeModifierPressed({ shiftKey: false }), false)
  assert.strictEqual(isCanvasMarqueeModifierPressed(null), false)

  assert.deepStrictEqual(resolveCanvasWheelGestureIntent({ deltaX: 0, deltaY: 32, ctrlKey: false }), {
    kind: 'pan-y',
    deltaX: 0,
    deltaY: 32,
    ctrlKey: false,
  })
  assert.deepStrictEqual(resolveCanvasWheelGestureIntent({ deltaX: 24, deltaY: 0, ctrlKey: false }), {
    kind: 'pan-x',
    deltaX: 24,
    deltaY: 0,
    ctrlKey: false,
  })
  assert.deepStrictEqual(resolveCanvasWheelGestureIntent({ deltaX: 0, deltaY: -16, ctrlKey: true }), {
    kind: 'zoom-viewport',
    deltaX: 0,
    deltaY: -16,
    ctrlKey: true,
  })
  assert.strictEqual(resolveCanvasWheelGestureIntent({ deltaX: 0, deltaY: 0, ctrlKey: false }), null)
})

test('canvas marquee helpers only open shift-gated pane selections and normalize selection bounds', () => {
  const paneElement = { id: 'pane' }

  assert.strictEqual(
    shouldStartCanvasMarqueeSelection({
      event: {
        button: 0,
        isPrimary: true,
        shiftKey: true,
        target: paneElement,
      },
      allowMultiSelect: true,
      isReadonly: false,
      paneElement,
    }),
    true
  )

  assert.strictEqual(
    shouldStartCanvasMarqueeSelection({
      event: {
        button: 0,
        isPrimary: true,
        shiftKey: false,
        target: paneElement,
      },
      allowMultiSelect: true,
      isReadonly: false,
      paneElement,
    }),
    false
  )

  assert.strictEqual(
    shouldStartCanvasMarqueeSelection({
      event: {
        button: 0,
        isPrimary: true,
        shiftKey: true,
        target: {},
      },
      allowMultiSelect: true,
      isReadonly: false,
      paneElement,
    }),
    false
  )

  assert.deepStrictEqual(
    buildCanvasSelectionScreenRect({
      startPoint: { x: 320, y: 280 },
      currentPoint: { x: 120, y: 160 },
    }),
    {
      left: 120,
      top: 160,
      right: 320,
      bottom: 280,
      width: 200,
      height: 120,
    }
  )

  assert.strictEqual(buildCanvasSelectionScreenRect({ startPoint: null, currentPoint: { x: 1, y: 2 } }), null)
})
