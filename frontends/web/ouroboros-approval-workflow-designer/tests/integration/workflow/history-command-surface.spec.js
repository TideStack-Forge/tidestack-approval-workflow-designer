const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('history toolbar commands replay a blank-canvas node insertion inside the current session baseline', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('history-editable')

  const undoButton = page.locator('[data-command-id="undo"]').first()
  const redoButton = page.locator('[data-command-id="redo"]').first()

  await expect(undoButton).toBeVisible()
  await expect(redoButton).toBeVisible()
  await expect(undoButton).toBeDisabled()
  await expect(redoButton).toBeDisabled()
  await expect(undoButton).toHaveAttribute('title', '当前没有可撤销的操作')
  await expect(redoButton).toHaveAttribute('title', '当前没有可重做的操作')

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  const initialNodeCount = initialDefinition.nodes.length

  await workflowHarnessPage.dropNodeTypeOnBlankCanvas('approval')

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(initialNodeCount + 1)

  await expect(undoButton).toBeEnabled()
  await expect(redoButton).toBeDisabled()

  let undoSteps = 0
  while (await undoButton.isEnabled()) {
    undoSteps += 1
    await workflowHarnessPage.clickToolbarCommand('undo')
  }

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(initialNodeCount)

  await expect(undoButton).toBeDisabled()
  await expect(redoButton).toBeEnabled()
  expect(undoSteps).toBeGreaterThan(0)

  let redoSteps = 0
  while (await redoButton.isEnabled()) {
    redoSteps += 1
    await workflowHarnessPage.clickToolbarCommand('redo')
  }

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(initialNodeCount + 1)

  await expect(undoButton).toBeEnabled()
  await expect(redoButton).toBeDisabled()
  expect(redoSteps).toBe(undoSteps)
})
