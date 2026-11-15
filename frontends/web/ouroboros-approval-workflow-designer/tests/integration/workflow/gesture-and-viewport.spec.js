const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('gesture contract keeps pan-first drag, shift marquee, scroll pan, ctrl-wheel zoom, and readonly navigation boundaries', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)
  const dispatchPaneWheel = async ({ deltaX = 0, deltaY = 0, ctrlKey = false } = {}) => {
    await page.evaluate(
      ({ nextDeltaX, nextDeltaY, nextCtrlKey }) => {
        const paneElement = document.querySelector('[data-testid="workflow-panel-center"] .react-flow__pane')
        if (!paneElement) {
          throw new Error('Missing workflow pane for wheel dispatch')
        }

        paneElement.dispatchEvent(
          new WheelEvent('wheel', {
            deltaX: nextDeltaX,
            deltaY: nextDeltaY,
            ctrlKey: nextCtrlKey,
            bubbles: true,
            cancelable: true,
          })
        )
      },
      {
        nextDeltaX: deltaX,
        nextDeltaY: deltaY,
        nextCtrlKey: ctrlKey,
      }
    )
  }
  const waitForViewportSettled = async () => {
    let previousViewport = await workflowHarnessPage.viewportTransform()
    let stableSamples = 0

    await expect.poll(async () => {
      await page.waitForTimeout(80)
      const currentViewport = await workflowHarnessPage.viewportTransform()
      const isStable =
        Math.abs(currentViewport.x - previousViewport.x) < 0.001 &&
        Math.abs(currentViewport.y - previousViewport.y) < 0.001 &&
        Math.abs(currentViewport.scale - previousViewport.scale) < 0.000001

      stableSamples = isStable ? stableSamples + 1 : 0
      previousViewport = currentViewport
      return stableSamples
    }).toBeGreaterThanOrEqual(2)
  }

  await workflowHarnessPage.gotoScenario('v2-editable')
  await waitForViewportSettled()

  const blankPoint = await workflowHarnessPage.blankCanvasPoint()
  const initialViewport = await workflowHarnessPage.viewportTransform()

  await page.mouse.move(blankPoint.x, blankPoint.y)
  await page.mouse.down()
  await page.mouse.move(blankPoint.x + 120, blankPoint.y + 60, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(initialViewport)

  const afterDefaultDragViewport = await workflowHarnessPage.viewportTransform()
  expect(afterDefaultDragViewport.scale).toBeCloseTo(initialViewport.scale, 6)
  expect(await workflowHarnessPage.selectedNodeIds()).toEqual([])

  let startNodeBox = await workflowHarnessPage.nodeBox('start-a')
  if (startNodeBox.x <= 320) {
    const additionalPanDeltaX = Math.ceil(320 - startNodeBox.x) + 40

    await page.mouse.move(blankPoint.x, blankPoint.y)
    await page.mouse.down()
    await page.mouse.move(blankPoint.x + additionalPanDeltaX, blankPoint.y + 60, { steps: 8 })
    await page.mouse.up()

    await expect.poll(async () => {
      return (await workflowHarnessPage.nodeBox('start-a')).x
    }).toBeGreaterThan(320)

    startNodeBox = await workflowHarnessPage.nodeBox('start-a')
  }

  const approvalNodeBox = await workflowHarnessPage.nodeBox('approve-a')
  const marqueeStart = {
    x: Math.min(startNodeBox.x, approvalNodeBox.x) - 24,
    y: Math.min(startNodeBox.y, approvalNodeBox.y) - 24,
  }
  const marqueeEnd = {
    x: Math.max(startNodeBox.x + startNodeBox.width, approvalNodeBox.x + approvalNodeBox.width) + 24,
    y: Math.max(startNodeBox.y + startNodeBox.height, approvalNodeBox.y + approvalNodeBox.height) + 24,
  }

  await page.keyboard.down('Shift')
  await page.mouse.move(marqueeStart.x, marqueeStart.y)
  await page.mouse.down()
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Shift')

  await expect.poll(async () => {
    return (await workflowHarnessPage.selectedNodeIds()).length
  }).toBeGreaterThan(1)

  const navigationPoint = await workflowHarnessPage.blankCanvasPoint()
  const beforeVerticalWheelViewport = await workflowHarnessPage.viewportTransform()
  await page.mouse.move(navigationPoint.x, navigationPoint.y)
  await dispatchPaneWheel({ deltaY: 240 })

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(beforeVerticalWheelViewport)

  const afterVerticalWheelViewport = await workflowHarnessPage.viewportTransform()
  expect(afterVerticalWheelViewport.scale).toBeCloseTo(beforeVerticalWheelViewport.scale, 6)
  expect(afterVerticalWheelViewport.y).not.toBe(beforeVerticalWheelViewport.y)

  const beforeHorizontalWheelViewport = await workflowHarnessPage.viewportTransform()
  await dispatchPaneWheel({ deltaX: 240 })

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(beforeHorizontalWheelViewport)

  const afterHorizontalWheelViewport = await workflowHarnessPage.viewportTransform()
  expect(afterHorizontalWheelViewport.scale).toBeCloseTo(beforeHorizontalWheelViewport.scale, 6)
  expect(afterHorizontalWheelViewport.x).not.toBe(beforeHorizontalWheelViewport.x)

  const beforeCtrlWheelViewport = await workflowHarnessPage.viewportTransform()
  await dispatchPaneWheel({ deltaY: -240, ctrlKey: true })

  await expect.poll(async () => {
    return (await workflowHarnessPage.viewportTransform()).scale
  }).not.toBe(beforeCtrlWheelViewport.scale)

  const afterCtrlWheelViewport = await workflowHarnessPage.viewportTransform()
  expect(afterCtrlWheelViewport.scale).not.toBe(beforeCtrlWheelViewport.scale)

  await workflowHarnessPage.gotoScenario('workflow-viewer')
  await waitForViewportSettled()

  const readonlyBlankPoint = await workflowHarnessPage.blankCanvasPoint()
  const readonlyInitialViewport = await workflowHarnessPage.viewportTransform()

  await page.mouse.move(readonlyBlankPoint.x, readonlyBlankPoint.y)
  await page.mouse.down()
  await page.mouse.move(readonlyBlankPoint.x + 120, readonlyBlankPoint.y + 60, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(readonlyInitialViewport)

  expect(await workflowHarnessPage.selectedNodeIds()).toEqual([])

  const readonlyStartNodeBox = await workflowHarnessPage.nodeBox('start-a')
  const readonlyApprovalNodeBox = await workflowHarnessPage.nodeBox('approve-a')
  const readonlyMarqueeStart = {
    x: Math.min(readonlyStartNodeBox.x, readonlyApprovalNodeBox.x) - 24,
    y: Math.min(readonlyStartNodeBox.y, readonlyApprovalNodeBox.y) - 24,
  }
  const readonlyMarqueeEnd = {
    x:
      Math.max(
        readonlyStartNodeBox.x + readonlyStartNodeBox.width,
        readonlyApprovalNodeBox.x + readonlyApprovalNodeBox.width
      ) + 24,
    y:
      Math.max(
        readonlyStartNodeBox.y + readonlyStartNodeBox.height,
        readonlyApprovalNodeBox.y + readonlyApprovalNodeBox.height
      ) + 24,
  }
  const beforeReadonlyShiftDragViewport = await workflowHarnessPage.viewportTransform()

  await page.keyboard.down('Shift')
  await page.mouse.move(readonlyMarqueeStart.x, readonlyMarqueeStart.y)
  await page.mouse.down()
  await page.mouse.move(readonlyMarqueeEnd.x, readonlyMarqueeEnd.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Shift')

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(beforeReadonlyShiftDragViewport)

  expect(await workflowHarnessPage.selectedNodeIds()).toEqual([])
})
