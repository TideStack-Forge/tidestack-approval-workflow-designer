const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('development translations update editor chrome and node type captions while retaining business names', async ({
  page,
}) => {
  const harness = new WorkflowHarnessPage(page)
  await harness.gotoScenario('v2-editable')
  const start = page.locator('.react-flow__node[data-id="start-a"]')
  const approval = page.locator('.react-flow__node[data-id="approve-a"]')
  const end = page.locator('.react-flow__node[data-id="end-a"]')
  await expect(start).toContainText('流程开始')
  await expect(approval).toContainText('经理审批')
  await expect(approval).toContainText('审批节点')
  await expect(end).toContainText('流程结束')
  const definition = await harness.invokeHarness('readCurrentDefinition')

  await harness.invokeHarness('switchLanguage', 'en-US', {
    'workflow-editor': {
      流程开始: 'Start',
      流程结束: 'End',
      审批节点: 'Approval node',
      审批: 'Approve',
      经理审批: 'This business name must stay unchanged',
      搜索节点: 'Search nodes',
    },
  })
  await expect(start).toContainText('Start')
  await expect(end).toContainText('End')
  await expect(approval).toContainText('经理审批')
  await expect(approval).toContainText('Approval node')
  await expect(approval).not.toContainText('This business name must stay unchanged')
  const search = page.getByTestId('workflow-node-search')
  await expect(search).toHaveAttribute('placeholder', 'Search nodes')
  await search.fill('Approve')
  await expect(page.getByTestId('workflow-node-palette-item')).toHaveCount(1)
  await expect(page.getByTestId('workflow-node-palette-item')).toContainText('Approve')
  expect(await harness.invokeHarness('readCurrentDefinition')).toEqual(definition)

  await harness.invokeHarness('switchLanguage', 'zh-CN')
  await expect(start).toContainText('流程开始')
  await expect(approval).toContainText('审批节点')
  await expect(search).toHaveValue('Approve')
  await expect(page.getByTestId('workflow-node-palette-item')).toHaveCount(0)
})
