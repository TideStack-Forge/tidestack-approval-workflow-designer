const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('dropping a node on blank canvas adds a detached node instead of rewriting an existing edge', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  expect(initialDefinition.nodes.map((node) => node.id)).not.toContain('blank-approval-smoke')
  expect(initialDefinition.edges).toHaveLength(2)

  await workflowHarnessPage.dropNodeTypeOnBlankCanvas('approval')

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(4)

  const nextDefinition = await workflowHarnessPage.currentDefinition()
  const insertedNode = nextDefinition.nodes.find((node) => node.type === 'ApprovalNode' && node.id !== 'approve-a')

  expect(insertedNode).toBeTruthy()
  expect(nextDefinition.edges).toHaveLength(2)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === 'start-a' && edge.targetId === 'approve-a')).toBe(true)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === 'approve-a' && edge.targetId === 'end-a')).toBe(true)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === insertedNode.id || edge.targetId === insertedNode.id)).toBe(false)
})

test('dropping a handle node on blank canvas adds a detached handle node', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  expect(initialDefinition.nodes.some((node) => node.type === 'HandleNode')).toBe(false)
  expect(initialDefinition.edges).toHaveLength(2)

  await workflowHarnessPage.dropNodeTypeOnBlankCanvas('handle')

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(4)

  const nextDefinition = await workflowHarnessPage.currentDefinition()
  const insertedNode = nextDefinition.nodes.find((node) => node.type === 'HandleNode')

  expect(insertedNode).toBeTruthy()
  expect(nextDefinition.edges).toHaveLength(2)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === insertedNode.id || edge.targetId === insertedNode.id)).toBe(false)
})

test('dropping a node on an edge inserts it between the original source and target', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  expect(initialDefinition.edges.some((edge) => edge.id === 'edge-1')).toBe(true)

  await workflowHarnessPage.dropNodeTypeOnEdge('approval', 'edge-1')

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.length
  }).toBe(4)

  const nextDefinition = await workflowHarnessPage.currentDefinition()
  const insertedNode = nextDefinition.nodes.find((node) => node.type === 'ApprovalNode' && node.id !== 'approve-a')

  expect(insertedNode).toBeTruthy()
  expect(nextDefinition.edges).toHaveLength(3)
  expect(nextDefinition.edges.some((edge) => edge.id === 'edge-1' && edge.sourceId === 'start-a' && edge.targetId === insertedNode.id)).toBe(true)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === insertedNode.id && edge.targetId === 'approve-a')).toBe(true)
  expect(nextDefinition.edges.some((edge) => edge.sourceId === 'start-a' && edge.targetId === 'approve-a')).toBe(false)
})
