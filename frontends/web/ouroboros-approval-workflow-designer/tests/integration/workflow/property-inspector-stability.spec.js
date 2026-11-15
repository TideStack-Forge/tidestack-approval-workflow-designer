const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

const fetcherUrls = (fetcherCalls) =>
  fetcherCalls.map((request) => (typeof request === 'string' ? request : request?.url)).filter(Boolean)

test('designer node selection exposes legacy node sections in the right panel', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('openNodeConfigViaDesigner', 'approve-a')

  await expect.poll(async () => {
    return fetcherUrls(await workflowHarnessPage.fetcherCalls())
  }).toContain('/api/approval-workflow/base-info/form/customForm/purchase/workflow-field')

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('人员配置')
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('审批配置')
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('表单权限配置')
  const rightPanelText = await workflowHarnessPage.rightPanelText()
  expect(rightPanelText).not.toContain('ID')
  expect(rightPanelText).not.toContain('节点摘要')
  expect(rightPanelText).not.toContain('配置项')
  expect(rightPanelText).not.toMatch(/^名称配置\s+人员配置\s+审批配置\s+表单权限配置/m)
  expect(rightPanelText).not.toContain('源节点')
  expect(rightPanelText).not.toContain('目标节点')
  expect(fetcherUrls(await workflowHarnessPage.fetcherCalls())).not.toContain(
    '/api/approval-workflow/base-info/form/customForm/purchase/field'
  )
})

test('designer node selection no longer opens a competing drawer editor', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('openNodeConfigViaDesigner', 'approve-a')
  await page.waitForTimeout(300)

  expect(await workflowHarnessPage.lastDrawerRequest()).toBeNull()
})

test('sequence edge inspector keeps ordinary single-path edges read-only', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('selectEdge', 'edge-1')

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('连线属性')
  const rightPanelText = await workflowHarnessPage.rightPanelText()
  expect(rightPanelText).toContain('当前连线无需配置条件')
  expect(rightPanelText).not.toContain('编辑条件')
})

test('node inspector writes candidate changes immediately without a secondary save button', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('openNodeConfigViaDesigner', 'approve-a')

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('人员配置')
  await expect(page.getByRole('button', { name: '保存修改' })).toHaveCount(0)

  await page.locator('[data-amis-name="type"]').getByText('用户自选').click()
  await page.locator('[data-amis-name="mode"]').getByText('单人').click()

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    return definition?.nodes?.find((node) => node.id === 'approve-a')?.candidates || null
  }).toEqual([{ type: 'UserSelect', mode: 'single' }])
})

test('business model conditions display saved comparisons and update the canvas after editing', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)
  await workflowHarnessPage.gotoScenario('design-time-branch-editable')
  await workflowHarnessPage.selectEdge('edge-b-2')

  const conditionField = page.locator('[data-amis-name="condition"]')
  const conditionValueInput = conditionField.getByRole('spinbutton', { name: '请输入数字' })
  const edge = page.locator('.react-flow__edge[data-id="edge-b-2"]')

  await expect(conditionValueInput).toHaveValue('1000')
  await expect(edge).toContainText('金额 大于 1000')
  expect(await workflowHarnessPage.rightPanelText()).not.toContain('当前入口未提供可用条件字段')
  const diagnostics = await workflowHarnessPage.diagnosticsSnapshot()
  expect(diagnostics.items.map((item) => item.code)).not.toContain('CONDITION_FIELD_SOURCE_REQUIRED')
  const definitionBeforeEdit = await workflowHarnessPage.currentDefinition()
  expect(definitionBeforeEdit.edges.find((item) => item.id === 'edge-b-2').condition).toEqual({
    left: { type: 'field', field: 'amount' }, op: 'greater', right: 1000,
  })

  await conditionValueInput.fill('5000')
  await expect(edge).toContainText('金额 大于 5000')
  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    const condition = definition.edges.find((item) => item.id === 'edge-b-2').condition
    return condition.children?.[0]?.right ?? condition.right
  }).toBe(5000)

  const emptyEdge = (await workflowHarnessPage.currentCanvasData()).edges.find(
    (item) => item.source === 'start-b' && item.target === 'after-b'
  )
  await workflowHarnessPage.selectEdge(emptyEdge.id)
  await expect(conditionField).toContainText('条件表达式')
  await expect(conditionField.getByText('添加条件', { exact: true })).toBeVisible()
  expect(await workflowHarnessPage.rightPanelText()).not.toContain('当前入口未提供可用条件字段')
})

test('split edge inspector opens the route condition editor and writes back edge condition changes', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('branch-editable')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()

  await workflowHarnessPage.invokeHarness('selectEdge', 'edge-b-2')

  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('连线属性')

  await expect.poll(async () => {
    return fetcherUrls(await workflowHarnessPage.fetcherCalls())
  }).toContain('/api/approval-workflow/base-info/form/default/purchase/workflow-field')

  const conditionField = page.locator('[data-amis-name="condition"]')
  const conditionValueInput = conditionField.getByRole('spinbutton', { name: '请输入数字' })
  const orderInput = page.locator('[data-amis-name="order"] input')

  await expect(conditionField).toContainText('条件表达式')
  await expect(conditionField).toContainText('金额')
  await expect(conditionField).toContainText('大于')
  await expect(conditionValueInput).toHaveValue('1000')
  await expect(orderInput).toHaveValue('20')
  await expect(page.getByRole('button', { name: '保存修改' })).toHaveCount(0)
  expect(fetcherUrls(await workflowHarnessPage.fetcherCalls())).not.toContain(
    '/api/approval-workflow/base-info/form/default/purchase/expression-variable'
  )

  await conditionValueInput.fill('5000')

  await expect.poll(async () => {
    return await workflowHarnessPage.lastDrawerRequest()
  }).toBeNull()

  await expect.poll(async () => {
    const definition = await workflowHarnessPage.currentDefinition()
    const condition = definition?.edges?.find((edge) => edge.id === 'edge-b-2')?.condition || null
    if (!condition) {
      return null
    }

    return {
      conjunction: condition.conjunction,
      children: Array.isArray(condition.children)
        ? condition.children.map((item) => ({
            left: item?.left,
            op: item?.op,
            right: item?.right,
          }))
        : [],
    }
  }).toEqual({
    conjunction: 'and',
    children: [{ left: { type: 'field', field: 'amount' }, op: 'greater', right: 5000 }],
  })
})
