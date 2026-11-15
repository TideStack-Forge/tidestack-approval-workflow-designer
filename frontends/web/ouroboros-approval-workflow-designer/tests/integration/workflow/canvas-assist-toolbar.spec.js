const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('canvas assist toolbar keeps editable defaults, readonly disabled state, and observable grid/alignment behavior', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toBeVisible()
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toBeVisible()
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toHaveAttribute('title', '关闭网格吸附')
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toHaveAttribute('data-workflow-tooltip', '关闭网格吸附')
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toHaveAttribute('title', '关闭节点对齐')
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toHaveAttribute('data-workflow-tooltip', '关闭节点对齐')

  expect(await workflowHarnessPage.toolbarCommandPressed('toggle-grid-snapping')).toBe(true)
  expect(await workflowHarnessPage.toolbarCommandPressed('toggle-node-alignment')).toBe(true)
  expect(await workflowHarnessPage.toolbarCommandEnabled('toggle-grid-snapping')).toBe(true)
  expect(await workflowHarnessPage.toolbarCommandEnabled('toggle-node-alignment')).toBe(true)

  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasGridBackground
  }).toBe(true)

  await workflowHarnessPage.clickToolbarCommand('toggle-grid-snapping')

  await expect.poll(async () => {
    return await workflowHarnessPage.toolbarCommandPressed('toggle-grid-snapping')
  }).toBe(false)
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toHaveAttribute('title', '开启网格吸附')
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toHaveAttribute('data-workflow-tooltip', '开启网格吸附')
  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasGridBackground
  }).toBe(false)
  expect(await workflowHarnessPage.toolbarCommandPressed('toggle-node-alignment')).toBe(true)

  await workflowHarnessPage.clickToolbarCommand('toggle-grid-snapping')
  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasGridBackground
  }).toBe(true)

  await workflowHarnessPage.clickToolbarCommand('toggle-node-alignment')
  await expect.poll(async () => {
    return await workflowHarnessPage.toolbarCommandPressed('toggle-node-alignment')
  }).toBe(false)
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toHaveAttribute('title', '开启节点对齐')
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toHaveAttribute('data-workflow-tooltip', '开启节点对齐')

  const approvePoint = await workflowHarnessPage.nodeScreenPoint('approve-a')
  await page.mouse.move(approvePoint.x, approvePoint.y)
  await page.mouse.down()
  await page.mouse.move(approvePoint.x + 60, approvePoint.y, { steps: 8 })
  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasAlignmentGuide
  }).toBe(false)
  await page.mouse.up()

  await workflowHarnessPage.clickToolbarCommand('toggle-node-alignment')
  await expect.poll(async () => {
    return await workflowHarnessPage.toolbarCommandPressed('toggle-node-alignment')
  }).toBe(true)

  const approvePointAgain = await workflowHarnessPage.nodeScreenPoint('approve-a')
  const approveBox = await workflowHarnessPage.nodeBox('approve-a')
  const endBox = await workflowHarnessPage.nodeBox('end-a')
  const alignLeftEdgeDeltaX = endBox.x - approveBox.x
  await page.mouse.move(approvePointAgain.x, approvePointAgain.y)
  await page.mouse.down()
  await page.mouse.move(approvePointAgain.x + alignLeftEdgeDeltaX, approvePointAgain.y, { steps: 8 })
  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasAlignmentGuide
  }).toBe(true)
  await page.mouse.up()

  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasAlignmentGuide
  }).toBe(false)
  const alignedApproveBox = await workflowHarnessPage.nodeBox('approve-a')
  const alignedEndBox = await workflowHarnessPage.nodeBox('end-a')
  expect(Math.abs(alignedApproveBox.x - alignedEndBox.x)).toBeLessThanOrEqual(2)

  const beforeDropDefinition = await workflowHarnessPage.currentDefinition()
  await workflowHarnessPage.clickToolbarCommand('toggle-grid-snapping')
  await expect.poll(async () => {
    return await workflowHarnessPage.toolbarCommandPressed('toggle-grid-snapping')
  }).toBe(false)
  await workflowHarnessPage.dropNodeTypeOnBlankCanvas('approval')
  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(beforeDropDefinition.nodes.length + 1)
  const afterAssistInteractionDefinition = await workflowHarnessPage.currentDefinition()
  expect(afterAssistInteractionDefinition.canvasAssistState).toBeUndefined()
  expect(afterAssistInteractionDefinition.editorLayout?.canvasAssistState).toBeUndefined()
  expect(await workflowHarnessPage.toolbarCommandPressed('toggle-node-alignment')).toBe(true)

  await workflowHarnessPage.gotoScenario('workflow-viewer')
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toBeVisible()
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toBeVisible()
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toHaveAttribute('title', '关闭网格吸附')
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toHaveAttribute('title', '关闭节点对齐')
  await expect(page.locator('[data-command-id="toggle-grid-snapping"]').first()).toBeDisabled()
  await expect(page.locator('[data-command-id="toggle-node-alignment"]').first()).toBeDisabled()
  expect(await workflowHarnessPage.toolbarCommandEnabled('toggle-grid-snapping')).toBe(false)
  expect(await workflowHarnessPage.toolbarCommandEnabled('toggle-node-alignment')).toBe(false)
})
