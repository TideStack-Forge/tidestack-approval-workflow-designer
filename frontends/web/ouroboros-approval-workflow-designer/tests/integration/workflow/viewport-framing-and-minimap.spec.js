const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('reopen still frames graph body and minimap stays numerically healthy', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)
  const readClusterSnapshot = async () => {
    return page.evaluate(() => {
      const cluster = document.querySelector('[data-testid="workflow-viewport-cluster"]')
      const minimap = document.querySelector('.workflow-canvas-minimap')
      const toolbar = document.querySelector('.workflow-viewport-toolbar')
      const toggle = document.querySelector('[data-control-id="toggle-minimap"]')
      const rightPanel = document.querySelector('[data-testid="workflow-panel-right"]')
      const clusterRect = cluster?.getBoundingClientRect()
      const minimapRect = minimap?.getBoundingClientRect()
      const toolbarRect = toolbar?.getBoundingClientRect()
      const toggleRect = toggle?.getBoundingClientRect()
      const rightPanelRect = rightPanel?.getBoundingClientRect()

      return {
        layout: cluster?.getAttribute('data-layout') || '',
        minimapState: cluster?.getAttribute('data-minimap-state') || '',
        dockingRightInset: Number(cluster?.getAttribute('data-docking-right-inset') || 0),
        clusterRight: clusterRect ? Math.round(clusterRect.right) : 0,
        clusterLeft: clusterRect ? Math.round(clusterRect.left) : 0,
        minimapVisible: Boolean(minimap),
        toolbarVisible: Boolean(toolbar),
        toggleVisible: Boolean(toggle),
        minimapWidth: minimapRect ? Math.round(minimapRect.width) : 0,
        toolbarWidth: toolbarRect ? Math.round(toolbarRect.width) : 0,
        toggleLeftInset: toggleRect && clusterRect ? Math.round(clusterRect.right - toggleRect.right) : 0,
        rightPanelVisible: (rightPanel?.getAttribute('data-panel-visible') || 'false') === 'true',
        rightPanelLeft: rightPanelRect ? Math.round(rightPanelRect.left) : 0,
      }
    })
  }
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
  const dragPropertyPanelResizeHandle = async (deltaX) => {
    await page.evaluate(async (nextDeltaX) => {
      const resizeHandle = document.querySelector('.resize-handle')
      if (!resizeHandle) {
        throw new Error('Missing property panel resize handle')
      }

      const rect = resizeHandle.getBoundingClientRect()
      const startX = rect.left + rect.width / 2
      const startY = rect.top + rect.height / 2

      resizeHandle.dispatchEvent(
        new MouseEvent('mousedown', {
          clientX: startX,
          clientY: startY,
          bubbles: true,
          cancelable: true,
        })
      )

      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))

      document.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: startX + nextDeltaX,
          clientY: startY,
          bubbles: true,
          cancelable: true,
        })
      )
      document.dispatchEvent(
        new MouseEvent('mouseup', {
          clientX: startX + nextDeltaX,
          clientY: startY,
          bubbles: true,
          cancelable: true,
        })
      )
    }, deltaX)
  }

  const readMinimapSnapshot = async () => {
    return page.evaluate(() => {
      const minimap = document.querySelector('.workflow-canvas-minimap')
      const svg = minimap?.querySelector('.react-flow__minimap-svg')
      const toolbar = document.querySelector('.workflow-viewport-toolbar')
      const cluster = document.querySelector('[data-testid="workflow-viewport-cluster"]')
      const toggle = document.querySelector('[data-control-id="toggle-minimap"]')
      const viewportMask = minimap?.querySelector('.react-flow__minimap-mask')
      const viewportChip = document.querySelector('.workflow-viewport-chip')

      if (!minimap || !svg || !toolbar || !cluster || !viewportMask || !viewportChip || !toggle) {
        throw new Error('viewport cluster surface is incomplete')
      }

      const minimapRect = minimap.getBoundingClientRect()
      const toolbarRect = toolbar.getBoundingClientRect()
      const clusterRect = cluster.getBoundingClientRect()
      const toggleRect = toggle.getBoundingClientRect()
      const startNode = document.querySelector('.react-flow__node[data-id="start-a"]')
      const approvalNode = document.querySelector('.react-flow__node[data-id="approve-a"]')
      const pane = document.querySelector('.react-flow__pane')

      if (!startNode || !approvalNode || !pane) {
        throw new Error('graph body nodes or pane are missing')
      }

      const startRect = startNode.getBoundingClientRect()
      const approvalRect = approvalNode.getBoundingClientRect()
      const paneRect = pane.getBoundingClientRect()
      const viewBox = svg.getAttribute('viewBox') || ''
      const numericViewBox = viewBox
        .split(/\s+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))

      return {
        viewBox,
        numericViewBoxLength: numericViewBox.length,
        maskPath: viewportMask.getAttribute('d') || '',
        minimapWidth: Math.round(minimapRect.width),
        toolbarWidth: Math.round(toolbarRect.width),
        clusterWidth: Math.round(clusterRect.width),
        toggleRightInset: Math.round(clusterRect.right - toggleRect.right),
        viewportChipText: viewportChip.textContent || '',
        minimapState: cluster.getAttribute('data-minimap-state') || '',
        layout: cluster.getAttribute('data-layout') || '',
        dockingRightInset: Number(cluster.getAttribute('data-docking-right-inset') || 0),
        startVisible: startRect.right > paneRect.left && startRect.left < paneRect.right,
        approvalVisible: approvalRect.right > paneRect.left && approvalRect.left < paneRect.right,
      }
    })
  }

  await workflowHarnessPage.gotoScenario('v2-editable')

  await expect.poll(readMinimapSnapshot).toMatchObject({
    numericViewBoxLength: 4,
    minimapState: 'expanded',
    layout: 'minimap-above-control-strip',
    startVisible: true,
    approvalVisible: true,
  })

  const firstOpenSnapshot = await readMinimapSnapshot()
  const firstOpenViewport = await workflowHarnessPage.viewportTransform()
  const firstClusterSnapshot = await readClusterSnapshot()
  expect(firstOpenSnapshot.viewBox).not.toContain('NaN')
  expect(firstOpenSnapshot.maskPath).not.toContain('NaN')
  expect(Math.abs(firstOpenSnapshot.minimapWidth - firstOpenSnapshot.toolbarWidth)).toBeLessThanOrEqual(1)
  expect(firstOpenSnapshot.clusterWidth).toBeGreaterThanOrEqual(firstOpenSnapshot.toolbarWidth)
  expect(firstOpenSnapshot.viewportChipText).toMatch(/%/)
  expect(firstOpenSnapshot.toggleRightInset).toBeGreaterThanOrEqual(0)
  expect(firstOpenSnapshot.dockingRightInset).toBe(firstClusterSnapshot.dockingRightInset)
  expect(firstClusterSnapshot.minimapVisible).toBe(true)
  expect(firstClusterSnapshot.toolbarVisible).toBe(true)
  expect(firstClusterSnapshot.toggleVisible).toBe(true)

  await page.locator('[data-control-id="toggle-minimap"]').click()

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const cluster = document.querySelector('[data-testid="workflow-viewport-cluster"]')
      const minimap = document.querySelector('.workflow-canvas-minimap')
      const toggle = document.querySelector('[data-control-id="toggle-minimap"]')
      const toolbar = document.querySelector('.workflow-viewport-toolbar')

      return {
        minimapState: cluster?.getAttribute('data-minimap-state') || '',
        layout: cluster?.getAttribute('data-layout') || '',
        minimapVisible: Boolean(minimap),
        toolbarVisible: Boolean(toolbar),
        togglePresent: Boolean(toggle),
      }
    })
  }).toMatchObject({
    minimapState: 'collapsed',
    layout: 'expand-button-only',
    minimapVisible: false,
    toolbarVisible: false,
    togglePresent: true,
  })

  await page.locator('[data-control-id="toggle-minimap"]').click()

  await expect.poll(readMinimapSnapshot).toMatchObject({
    numericViewBoxLength: 4,
    minimapState: 'expanded',
    layout: 'minimap-above-control-strip',
    startVisible: true,
    approvalVisible: true,
  })

  await expect.poll(readClusterSnapshot).toMatchObject({
    minimapVisible: true,
    toolbarVisible: true,
    toggleVisible: true,
  })

  const reopenedExpandedViewport = await workflowHarnessPage.viewportTransform()
  await page.locator('[data-command-id="zoom-in"]').click()
  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(reopenedExpandedViewport)

  await workflowHarnessPage.selectNode('approve-a')
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(true)
  const inspectorOpenClusterSnapshot = await readClusterSnapshot()
  expect(inspectorOpenClusterSnapshot.rightPanelVisible).toBe(true)
  expect(inspectorOpenClusterSnapshot.dockingRightInset).toBeGreaterThan(16)
  expect(inspectorOpenClusterSnapshot.clusterRight).toBeLessThanOrEqual(
    inspectorOpenClusterSnapshot.rightPanelLeft + 2
  )

  await dragPropertyPanelResizeHandle(-120)

  await expect.poll(readClusterSnapshot).toMatchObject({
    rightPanelVisible: true,
  })
  const resizedInspectorClusterSnapshot = await readClusterSnapshot()
  expect(resizedInspectorClusterSnapshot.dockingRightInset).toBeGreaterThan(
    inspectorOpenClusterSnapshot.dockingRightInset
  )
  expect(resizedInspectorClusterSnapshot.clusterLeft).toBeLessThan(
    inspectorOpenClusterSnapshot.clusterLeft
  )
  expect(resizedInspectorClusterSnapshot.clusterRight).toBeLessThanOrEqual(
    resizedInspectorClusterSnapshot.rightPanelLeft + 2
  )

  await page.getByTestId('workflow-right-panel-close').click()
  await expect.poll(readClusterSnapshot).toMatchObject({
    rightPanelVisible: false,
    dockingRightInset: 16,
  })

  const blankPoint = await workflowHarnessPage.blankCanvasPoint()
  await page.mouse.move(blankPoint.x, blankPoint.y)
  await dispatchPaneWheel({ deltaX: 180, deltaY: 140 })

  await expect.poll(async () => {
    return await workflowHarnessPage.viewportTransform()
  }).not.toEqual(firstOpenViewport)

  const movedViewport = await workflowHarnessPage.viewportTransform()

  await page.goto('playwright-harness.html?scenario=v2-editable', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(() => Boolean(window.__APPROVAL_WORKFLOW_HARNESS__))
  await page.getByTestId('workflow-editor-host').waitFor({ state: 'visible' })

  await expect.poll(async () => {
    const viewport = await workflowHarnessPage.viewportTransform()
    const minimap = await readMinimapSnapshot()

    return {
      viewport,
      minimap,
    }
  }).toMatchObject({
    minimap: {
      numericViewBoxLength: 4,
      startVisible: true,
      approvalVisible: true,
    },
  })

  const reopenedViewport = await workflowHarnessPage.viewportTransform()
  const reopenedMinimapSnapshot = await readMinimapSnapshot()
  const reopenedClusterSnapshot = await readClusterSnapshot()

  expect(reopenedViewport).not.toEqual(movedViewport)
  expect(reopenedMinimapSnapshot.viewBox).not.toContain('NaN')
  expect(reopenedMinimapSnapshot.maskPath).not.toContain('NaN')
  expect(Math.abs(reopenedMinimapSnapshot.minimapWidth - reopenedMinimapSnapshot.toolbarWidth)).toBeLessThanOrEqual(1)
  expect(reopenedMinimapSnapshot.startVisible).toBe(true)
  expect(reopenedMinimapSnapshot.approvalVisible).toBe(true)
  expect(reopenedClusterSnapshot.dockingRightInset).toBeGreaterThanOrEqual(16)
})
