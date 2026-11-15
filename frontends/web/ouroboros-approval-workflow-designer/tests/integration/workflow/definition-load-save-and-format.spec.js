const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('react flow contract: terminal path renders End node and save payload stays static metadata', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasEndNodeInCanvas
  }).toBe(true)

  await workflowHarnessPage.clickSave()

  await expect.poll(async () => {
    return await workflowHarnessPage.lastSavedDefinitionText()
  }).toContain('"formatVersion":1')
})

test('new-flow scenario exposes a static metadata definition', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')
  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition?.formatVersion || null
  }).toBe(1)
})

test('v1 upgrade notice renders inside the real workflow editor', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v1-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  await expect.poll(async () => {
    return (await workflowHarnessPage.notifications()).map((notification) => notification?.message || '')
  }).toContain('当前流程为旧版格式，保存后将自动升级为审批流元数据格式')
})

test('v2 editable scenario does not render the upgrade notice', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  await page.waitForTimeout(500)

  expect((await workflowHarnessPage.notifications()).some((notification) => {
    return `${notification?.message || ''}`.includes('旧版格式')
  })).toBe(false)
})

test('remote source scenario requests the definition without formatVersion negotiation', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('remote-v2-source')

  await expect.poll(async () => {
    const fetcherCalls = await workflowHarnessPage.fetcherCalls()
    const definitionRequest = fetcherCalls.find((request) => {
      const requestUrl = request?.url || request
      return requestUrl === '/api/approval-workflow/definition/remote-flow'
    })
    return definitionRequest?.url || definitionRequest || null
  }).toBe('/api/approval-workflow/definition/remote-flow')

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition && definition.formatVersion
  }).toBe(1)
})

test('session changes update both definition and canvas data', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  const initialCanvasData = await workflowHarnessPage.currentCanvasData()
  const initialApprovalNode = initialDefinition.nodes.find((node) => node.type === 'ApprovalNode')

  await workflowHarnessPage.invokeHarness('addNode', initialApprovalNode.id, {
    id: 'approval-smoke',
    name: '测试审批',
    type: 'ApprovalNode',
  })

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.nodes.some((node) => node.id === 'approval-smoke')
  }).toBe(true)

  await expect.poll(async () => {
    const nextCanvasData = await workflowHarnessPage.currentCanvasData()
    return nextCanvasData.nodes.length
  }).toBeGreaterThan(initialCanvasData.nodes.length)
})

test('session changes can create and save a HandleNode definition', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  const initialApprovalNode = initialDefinition.nodes.find((node) => node.type === 'ApprovalNode')

  await workflowHarnessPage.invokeHarness('addNode', initialApprovalNode.id, {
    id: 'handle-smoke',
    name: '测试办理',
    type: 'HandleNode',
  })
  await workflowHarnessPage.invokeHarness('updateNodeConfig', 'handle-smoke', {
    candidates: [{ type: 'UserSelect', mode: 'single' }],
    permission: [{ field: 'amount', permission: 'EDITABLE' }],
  })

  await expect.poll(async () => {
    const nextCanvasData = await workflowHarnessPage.currentCanvasData()
    return nextCanvasData.nodes.some((node) => node.id === 'handle-smoke' && node.type === 'handle')
  }).toBe(true)

  await workflowHarnessPage.clickSave()

  const lastSavedDefinition = await workflowHarnessPage.lastSavedDefinition()
  const handleNode = lastSavedDefinition.nodes.find((node) => node.id === 'handle-smoke')

  expect(handleNode).toEqual({
    type: 'HandleNode',
    name: '测试办理',
    id: 'handle-smoke',
    candidates: [{ type: 'UserSelect', mode: 'single' }],
    permission: [{ field: 'amount', permission: 'EDITABLE' }],
  })
  expect(handleNode.actions).toBeUndefined()
  expect(handleNode.subType).toBeUndefined()
  expect(handleNode.rejectAction).toBeUndefined()
})

test('save payload keeps FormField candidate field references', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')

  const initialDefinition = await workflowHarnessPage.currentDefinition()
  const initialApprovalNode = initialDefinition.nodes.find((node) => node.type === 'ApprovalNode')

  await workflowHarnessPage.invokeHarness('addNode', initialApprovalNode.id, {
    id: 'form-field-candidate-smoke',
    name: '字段指定处理人',
    type: 'HandleNode',
  })
  await workflowHarnessPage.invokeHarness('updateNodeConfig', 'form-field-candidate-smoke', {
    candidates: [{ type: 'FormField', field: 'managerId' }],
  })

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.nodes.find((node) => node.id === 'form-field-candidate-smoke')?.candidates
  }).toEqual([{ type: 'FormField', field: 'managerId' }])

  await workflowHarnessPage.clickSave()

  const lastSavedDefinition = await workflowHarnessPage.lastSavedDefinition()
  const handleNode = lastSavedDefinition.nodes.find((node) => node.id === 'form-field-candidate-smoke')

  expect(handleNode.candidates).toEqual([{ type: 'FormField', field: 'managerId' }])
})

test('save payload reflects the latest static metadata definition', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  await workflowHarnessPage.invokeHarness('updateWorkflowMeta', {
    name: '已更新审批流',
  })
  await workflowHarnessPage.invokeHarness('updateNodeConfig', 'approve-a', {
    name: '财务审批',
    candidates: [{ type: 'UserSelect', mode: 'single' }],
  })

  await expect.poll(async () => {
    const nextDefinition = await workflowHarnessPage.currentDefinition()
    return nextDefinition.title || nextDefinition.name
  }).toBe('已更新审批流')

  await workflowHarnessPage.clickSave()

  await expect.poll(async () => {
    return await workflowHarnessPage.lastSavedDefinitionText()
  }).toContain('"formatVersion":1')

  const lastSavedDefinition = await workflowHarnessPage.lastSavedDefinition()
  const approvalNode = lastSavedDefinition.nodes.find((node) => node.id === 'approve-a')

  expect(lastSavedDefinition.name).toBe('flow-v2')
  expect(lastSavedDefinition.title).toBe('已更新审批流')
  expect(approvalNode.name).toBe('财务审批')
  expect(approvalNode.candidates).toEqual([{ type: 'UserSelect', mode: 'single' }])
})

test('workflow editor stabilizes after a single meta update', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  const initialFetchCount = (await workflowHarnessPage.fetcherCalls()).length

  await workflowHarnessPage.invokeHarness('updateWorkflowMeta', {
    name: 'Loop Guard Smoke',
  })

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.title || definition.name
  }).toBe('Loop Guard Smoke')

  const stabilizedDefinitionText = await workflowHarnessPage.currentDefinitionText()
  const stabilizedFetchCount = (await workflowHarnessPage.fetcherCalls()).length

  await page.waitForTimeout(300)

  expect(await workflowHarnessPage.currentDefinitionText()).toBe(stabilizedDefinitionText)
  expect((await workflowHarnessPage.fetcherCalls()).length).toBe(stabilizedFetchCount)
  expect(stabilizedFetchCount).toBeGreaterThanOrEqual(initialFetchCount)
})

test('branch scenario save keeps conditional routes on sequence edges and updated node config', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('branch-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('updateWorkflowMeta', {
    name: '分支流程-已更新',
  })
  await workflowHarnessPage.invokeHarness('updateNodeConfig', 'branch-approve-b', {
    name: '条件审批-已更新',
    subType: '会签',
    candidates: [{ type: 'UserSelect', mode: 'multiple' }],
  })
  await workflowHarnessPage.invokeHarness('updateNodeConfig', 'after-b', {
    candidates: [{ type: 'UserSelect', mode: 'single' }],
  })

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition.title || definition.name
  }).toBe('分支流程-已更新')

  await workflowHarnessPage.clickSave()

  await expect.poll(async () => {
    return await workflowHarnessPage.lastSavedDefinitionText()
  }).toContain('"分支流程-已更新"')

  const lastSavedDefinition = await workflowHarnessPage.lastSavedDefinition()
  const branchApprovalNode = lastSavedDefinition.nodes.find((node) => node.id === 'branch-approve-b')
  const conditionalEdges = lastSavedDefinition.edges.filter(
    (edge) => edge.type === 'SEQUENCE' && edge.sourceId === 'start-b' && edge.condition
  )
  const highAmountEdge = lastSavedDefinition.edges.find((edge) => edge.id === 'edge-b-2')
  const lowAmountEdge = lastSavedDefinition.edges.find((edge) => edge.id === 'edge-b-3')

  expect(lastSavedDefinition.name).toBe('flow-v2-branch')
  expect(lastSavedDefinition.title).toBe('分支流程-已更新')
  expect(branchApprovalNode.name).toBe('条件审批-已更新')
  expect(branchApprovalNode.subType).toBe('会签')
  expect(branchApprovalNode.candidates).toEqual([{ type: 'UserSelect', mode: 'multiple' }])
  expect(conditionalEdges).toHaveLength(3)
  expect(lastSavedDefinition.edges.every((edge) => edge.type === 'SEQUENCE')).toBe(true)
  expect(lowAmountEdge.order).toBe(10)
  expect(highAmountEdge.order).toBe(20)
  expect(highAmountEdge.condition).toEqual({
    conjunction: 'and',
    children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000 }],
  })
})
