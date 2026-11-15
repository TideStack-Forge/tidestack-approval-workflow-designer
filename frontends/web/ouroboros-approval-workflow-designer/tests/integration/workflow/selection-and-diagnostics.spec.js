const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('clean diagnostics use the toolbar entry and only show summary content', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect.poll(async () => {
    const diagnosticsSnapshot = await workflowHarnessPage.diagnosticsSnapshot()
    return diagnosticsSnapshot.status
  }).toBe('clean')
  await expect(page.getByTestId('workflow-editor-diagnostics-trigger')).toHaveAttribute(
    'data-diagnostics-status',
    'clean'
  )

  await workflowHarnessPage.openDiagnosticsPopover()

  await expect(page.getByTestId('workflow-editor-diagnostics-summary')).toContainText(
    '当前未发现结构错误或警告'
  )
  await expect(page.locator('.workflow-editor-diagnostics-item')).toHaveCount(0)
})

test('toolbar view toggles own palette and inspector visibility state', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)
  const readToolbarPaletteGeometry = async () => {
    return page.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="workflow-editor-command-surface"]')
      const palette = document.querySelector('[data-testid="workflow-panel-left"]')
      const toolbarRect = toolbar?.getBoundingClientRect()
      const paletteRect = palette?.getBoundingClientRect()

      return {
        toolbarLeft: toolbarRect ? Math.round(toolbarRect.left) : 0,
        toolbarTop: toolbarRect ? Math.round(toolbarRect.top) : 0,
        paletteLeft: paletteRect ? Math.round(paletteRect.left) : 0,
        paletteRight: paletteRect ? Math.round(paletteRect.right) : 0,
        paletteTop: paletteRect ? Math.round(paletteRect.top) : 0,
        toolbarLeftInset: Number(toolbar?.getAttribute('data-toolbar-left-inset') || 0),
        toolbarTopInset: Number(toolbar?.getAttribute('data-toolbar-top-inset') || 0),
        paletteVisible: (toolbar?.getAttribute('data-palette-visible') || 'false') === 'true',
      }
    })
  }

  await workflowHarnessPage.gotoScenario('new-flow')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-palette')).toBe(true)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(false)
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('title', '隐藏节点面板')
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('data-workflow-tooltip', '隐藏节点面板')
  await expect(page.locator('[data-command-id="toggle-inspector"]').first()).toHaveAttribute('title', '显示属性面板')
  await expect(page.locator('[data-command-id="toggle-inspector"]').first()).toHaveAttribute('data-workflow-tooltip', '显示属性面板')
  await expect.poll(async () => workflowHarnessPage.leftPanelVisible()).toBe(true)
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)
  await expect.poll(readToolbarPaletteGeometry).toMatchObject({
    toolbarLeftInset: 272,
    toolbarTopInset: 16,
    paletteVisible: true,
  })
  const expandedGeometry = await readToolbarPaletteGeometry()
  expect(expandedGeometry.toolbarTop).toBe(expandedGeometry.paletteTop)
  expect(expandedGeometry.toolbarLeft - expandedGeometry.paletteRight).toBe(16)

  await workflowHarnessPage.togglePalettePanel()
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-palette')).toBe(false)
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('title', '显示节点面板')
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('data-workflow-tooltip', '显示节点面板')
  await expect.poll(async () => workflowHarnessPage.leftPanelVisible()).toBe(false)
  await expect.poll(readToolbarPaletteGeometry).toMatchObject({
    toolbarLeftInset: 16,
    toolbarTopInset: 16,
    paletteVisible: false,
  })

  await workflowHarnessPage.togglePalettePanel()
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-palette')).toBe(true)
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('title', '隐藏节点面板')
  await expect(page.locator('[data-command-id="toggle-palette"]').first()).toHaveAttribute('data-workflow-tooltip', '隐藏节点面板')
  await expect.poll(async () => workflowHarnessPage.leftPanelVisible()).toBe(true)
  await expect.poll(readToolbarPaletteGeometry).toMatchObject({
    toolbarLeftInset: 272,
    toolbarTopInset: 16,
    paletteVisible: true,
  })
})

test('readonly viewer still keeps diagnostics in the toolbar while edit-only commands stay hidden', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('workflow-viewer')

  await expect(page.getByTestId('workflow-editor-command-surface')).toBeVisible()
  await expect(page.getByTestId('workflow-editor-diagnostics-trigger')).toBeVisible()
  await expect(page.getByRole('button', { name: '流程信息', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '删除', exact: true })).toHaveCount(0)
  expect(await workflowHarnessPage.toolbarCommandCount('toggle-palette')).toBe(0)
  expect(await workflowHarnessPage.toolbarCommandCount('toggle-inspector')).toBe(1)
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const toolbar = document.querySelector('[data-testid="workflow-editor-command-surface"]')
        return {
          leftInset: Number(toolbar?.getAttribute('data-toolbar-left-inset') || 0),
          topInset: Number(toolbar?.getAttribute('data-toolbar-top-inset') || 0),
          paletteVisible: (toolbar?.getAttribute('data-palette-visible') || 'false') === 'true',
        }
      })
    })
    .toMatchObject({
      leftInset: 16,
      topInset: 16,
      paletteVisible: false,
    })

  await workflowHarnessPage.openDiagnosticsPopover()
  await expect(page.getByTestId('workflow-editor-diagnostics-summary')).toBeVisible()
})

test('diagnostics popover closes on escape and outside click without mutating selection', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-edge-diagnostic')
  const initialSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()

  await workflowHarnessPage.openDiagnosticsPopover()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)
  expect(await workflowHarnessPage.selectionSnapshot()).toEqual(initialSelectionSnapshot)

  await workflowHarnessPage.openDiagnosticsPopover()
  const blankPoint = await workflowHarnessPage.blankCanvasPoint()
  await page.mouse.click(blankPoint.x, blankPoint.y)
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)
  expect(await workflowHarnessPage.selectionSnapshot()).toEqual(initialSelectionSnapshot)
})

test('diagnostics navigation lands on the same single-node selection as direct selection', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)
  const waitForApprovalNodeInspector = async () => {
    await expect.poll(async () => {
      return await workflowHarnessPage.rightPanelText()
    }).toContain('节点属性')
    await expect.poll(async () => {
      return await workflowHarnessPage.rightPanelText()
    }).toContain('人员配置')
    await expect.poll(async () => {
      return await workflowHarnessPage.rightPanelText()
    }).toContain('审批配置')
  }

  await workflowHarnessPage.gotoScenario('new-flow')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const currentDefinition = await workflowHarnessPage.currentDefinition()
  const directSelectableNode = currentDefinition.nodes.find(
    (node) => node.type !== 'StartNode' && node.type !== 'EndNode'
  )

  expect(directSelectableNode).toBeTruthy()

  await workflowHarnessPage.selectNode(directSelectableNode.id)
  await waitForApprovalNodeInspector()
  await expect(page.getByRole('button', { name: '删除' })).toBeEnabled()
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)

  const directPanelText = await workflowHarnessPage.rightPanelText()
  const directSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const directSelectedNodeIds = await workflowHarnessPage.selectedNodeIds()
  expect(directSelectionSnapshot.mode).toBe('single-node')
  expect(directSelectionSnapshot.primaryTargetId).toBe(directSelectableNode.id)
  expect(directSelectionSnapshot.nodeIds).toEqual([directSelectableNode.id])
  expect(directSelectedNodeIds).toEqual([directSelectableNode.id])

  await workflowHarnessPage.clickFirstDiagnosticItem()

  await waitForApprovalNodeInspector()
  await expect(page.getByRole('button', { name: '删除' })).toBeEnabled()

  const diagnosticSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const diagnosticSelectedNodeIds = await workflowHarnessPage.selectedNodeIds()
  const diagnosticPanelText = await workflowHarnessPage.rightPanelText()

  expect(diagnosticSelectionSnapshot.mode).toBe('single-node')
  expect(diagnosticSelectionSnapshot.primaryTargetId).toBe(directSelectionSnapshot.primaryTargetId)
  expect(diagnosticSelectedNodeIds).toEqual(directSelectedNodeIds)
  expect(directPanelText).toContain('人员配置')
  expect(diagnosticPanelText).toContain('人员配置')
  expect(directPanelText).toContain('审批配置')
  expect(diagnosticPanelText).toContain('审批配置')
})

test('diagnostics navigation lands on the same single-edge selection as direct selection', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-edge-diagnostic')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.selectEdge('edge-1')
  await expect.poll(async () => {
    return await workflowHarnessPage.selectedEdgeIds()
  }).toEqual(['edge-1'])
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('连线属性')
  await expect(page.getByRole('button', { name: '删除' })).toBeEnabled()
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)

  const directSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const directSelectedEdgeIds = await workflowHarnessPage.selectedEdgeIds()
  const directPanelText = await workflowHarnessPage.rightPanelText()
  expect(directSelectionSnapshot.mode).toBe('single-edge')
  expect(directSelectionSnapshot.primaryTargetId).toBe('edge-1')

  await workflowHarnessPage.clickDiagnosticItemByMessage('条件不能为空')

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('连线属性')
  await expect(page.getByRole('button', { name: '删除' })).toBeEnabled()

  const diagnosticSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const diagnosticSelectedEdgeIds = await workflowHarnessPage.selectedEdgeIds()
  const diagnosticPanelText = await workflowHarnessPage.rightPanelText()

  expect(diagnosticSelectionSnapshot.mode).toBe('single-edge')
  expect(diagnosticSelectionSnapshot.primaryTargetId).toBe(directSelectionSnapshot.primaryTargetId)
  expect(diagnosticSelectedEdgeIds).toEqual(directSelectedEdgeIds)
  expect(diagnosticPanelText).toBe(directPanelText)
})

test('selection opens inspector by default and clearing selection closes it', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-edge-diagnostic')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.selectEdge('edge-1')
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(true)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(true)
  await expect.poll(async () => workflowHarnessPage.rightPanelText()).toContain('连线属性')

  await workflowHarnessPage.toggleInspectorPanel()
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(false)

  const currentDefinition = await workflowHarnessPage.currentDefinition()
  const selectableNode = currentDefinition.nodes.find(
    (node) => node.type !== 'StartNode' && node.type !== 'EndNode'
  )
  expect(selectableNode).toBeTruthy()

  await workflowHarnessPage.selectNode(selectableNode.id)
  await expect.poll(async () => {
    const selectionSnapshot = await workflowHarnessPage.selectionSnapshot()
    return selectionSnapshot.primaryTargetId
  }).toBe(selectableNode.id)
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(true)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(true)
  await expect.poll(async () => workflowHarnessPage.rightPanelText()).toContain('节点属性')

  const blankPoint = await workflowHarnessPage.blankCanvasPoint()
  await page.mouse.click(blankPoint.x, blankPoint.y)
  await expect.poll(async () => {
    const selectionSnapshot = await workflowHarnessPage.selectionSnapshot()
    return selectionSnapshot.mode
  }).toBe('none')
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(false)
})

test('diagnostics node or edge navigation explicitly opens inspector after manual close', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-edge-diagnostic')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.selectEdge('edge-1')
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(true)
  await workflowHarnessPage.toggleInspectorPanel()
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)

  await workflowHarnessPage.clickDiagnosticItemByMessage('条件不能为空')

  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(true)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(true)
  await expect.poll(async () => workflowHarnessPage.rightPanelText()).toContain('连线属性')
  await expect.poll(async () => workflowHarnessPage.selectedEdgeIds()).toEqual(['edge-1'])
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)
})

test('graph diagnostics fit the graph without fabricating node or edge selection', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('branch-missing-condition-source')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)

  await workflowHarnessPage.clickDiagnosticItemByMessage('未提供可用条件字段')

  await expect.poll(async () => {
    return await workflowHarnessPage.selectedNodeIds()
  }).toEqual([])
  await expect.poll(async () => {
    return await workflowHarnessPage.selectedEdgeIds()
  }).toEqual([])
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelIsEmpty()
  }).toBe(true)
  await expect.poll(async () => workflowHarnessPage.rightPanelVisible()).toBe(false)
  await expect.poll(async () => workflowHarnessPage.toolbarCommandPressed('toggle-inspector')).toBe(false)
  await expect(page.getByTestId('workflow-editor-diagnostics-popover')).toHaveCount(0)
})

test('box selection enters multi mode and diagnostics navigation collapses it back to single selection', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await page.setViewportSize({ width: 1400, height: 900 })
  await workflowHarnessPage.gotoScenario('new-flow')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const currentDefinition = await workflowHarnessPage.currentDefinition()
  const selectableNodes = currentDefinition.nodes.filter((node) => node.type !== 'EndNode')

  expect(selectableNodes).toHaveLength(2)

  await workflowHarnessPage.applySelectionSnapshot({
    nodeIds: selectableNodes.map((node) => node.id),
    edgeIds: [],
  })

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('多选摘要')

  const multiSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const multiSelectedNodeIds = await workflowHarnessPage.selectedNodeIds()
  expect(multiSelectionSnapshot.mode).toBe('multi')
  expect(multiSelectionSnapshot.nodeIds).toHaveLength(2)
  expect(multiSelectedNodeIds).toHaveLength(2)

  await workflowHarnessPage.clickFirstDiagnosticItem()

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('节点属性')

  const diagnosticSelectionSnapshot = await workflowHarnessPage.selectionSnapshot()
  const diagnosticSelectedNodeIds = await workflowHarnessPage.selectedNodeIds()

  expect(diagnosticSelectionSnapshot.mode).toBe('single-node')
  expect(diagnosticSelectedNodeIds).toHaveLength(1)
})
