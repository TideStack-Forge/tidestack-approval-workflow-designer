const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('designer delete handler updates the V2 definition after confirmation', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('addNode', 'approve-a', {
    id: 'approval-delete-smoke',
    name: '后续审批',
    type: 'ApprovalNode',
  })

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.nodes.some((node) => node.id === 'approval-delete-smoke')
  }).toBe(true)

  await workflowHarnessPage.invokeHarness('enqueueConfirmResponse', true)
  await workflowHarnessPage.invokeHarness('deleteNodeViaDesigner', 'approve-a')

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.nodes.some((node) => node.id === 'approve-a')
  }).toBe(false)

  const nextDefinition = await workflowHarnessPage.currentDefinition()
  expect(nextDefinition.nodes.map((node) => node.id)).toContain('approval-delete-smoke')
  expect(
    nextDefinition.edges.some(
      (edge) => edge.sourceId === 'start-a' && edge.targetId === 'approval-delete-smoke'
    )
  ).toBe(true)
})

test('designer delete handler routes missing start-node protection through blocking diagnostics', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('enqueueConfirmResponse', true)
  await workflowHarnessPage.invokeHarness('deleteNodeViaDesigner', 'start-a')

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.nodes.some((node) => node.id === 'start-a')
  }).toBe(false)

  await expect.poll(async () => {
    return await workflowHarnessPage.diagnosticMessages()
  }).toContain('画布必须包含一个流程开始节点')
})

test('designer delete handler allows deleting the end node without runtime failure', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('enqueueConfirmResponse', true)
  await workflowHarnessPage.invokeHarness('deleteNodeViaDesigner', 'end-a')

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.nodes.some((node) => node.id === 'end-a')
  }).toBe(false)

  await expect.poll(async () => {
    return (await workflowHarnessPage.diagnosticMessages()).some((message) => {
      return `${message || ''}`.includes('至少需要一条出边')
    })
  }).toBe(true)
})

test('selected edge can be deleted from the command surface', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('branch-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  expect(initialDefinition.edges.some((edge) => edge.id === 'edge-b-2')).toBe(true)

  await workflowHarnessPage.invokeHarness('selectEdge', 'edge-b-2')
  await page.getByRole('button', { name: '删除' }).click()

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.edges.some((edge) => edge.id === 'edge-b-2')
  }).toBe(false)
})
