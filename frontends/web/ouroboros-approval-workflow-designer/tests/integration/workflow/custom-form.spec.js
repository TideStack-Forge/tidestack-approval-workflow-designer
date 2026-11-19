const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')
const path = require('path')
const fs = require('node:fs')

const evidence = path.resolve(
  __dirname,
  '../../../../../../tmp/testing-evidence/approval-custom-form/browser'
)

test('custom form fields are visible and permissions survive saving and reopening', async ({
  page,
}) => {
  const harness = new WorkflowHarnessPage(page)
  await harness.gotoScenario('custom-form')
  await page.getByRole('button', { name: /流程信息/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('自定义表单', { exact: true })).toBeVisible()
  await expect(dialog.getByText('采购金额', { exact: true })).toBeVisible()
  await expect(dialog.getByText('金额含税', { exact: true })).toBeVisible()
  await page.screenshot({
    path: path.join(evidence, 'custom-fields.png'),
    fullPage: true,
  })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await harness.selectNode('branch-approve-b')
  await expect.poll(() => harness.rightPanelText()).toContain('采购金额')
  const amountRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: '采购金额', exact: true }) })
  await amountRow.locator('input[name="writable"]').check()
  await amountRow.locator('input[name="required"]').check()
  await expect
    .poll(
      async () =>
        (await harness.currentDefinition()).nodes.find(
          (node) => node.id === 'branch-approve-b'
        ).permission
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'amount', required: true }),
      ])
    )
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const saved = await harness.invokeHarness('readLastSavedDefinition')
  fs.writeFileSync(
    path.join(evidence, 'saved-permissions.json'),
    JSON.stringify(saved, null, 2)
  )
  expect(saved.form).toEqual({ formType: 'custom', formId: 'purchase' })
  const permission = saved.nodes
    .find((node) => node.id === 'branch-approve-b')
    .permission.find((field) => field.name === 'amount')
  expect(permission).toMatchObject({ visible: true, writable: true, required: true })
  await harness.invokeHarness('reloadDefinition', saved)
  await harness.selectNode('branch-approve-b')
  await expect(amountRow.locator('input[name="required"]')).toBeChecked()
  await page.screenshot({
    path: path.join(evidence, 'custom-permissions.png'),
    fullPage: true,
  })
})

test('binding switch clears the old fields while loading and distinguishes missing and empty descriptions', async ({
  page,
}) => {
  const harness = new WorkflowHarnessPage(page)
  await harness.gotoScenario('custom-form')
  await harness.invokeHarness('submitBasicInfo', { formType: 'custom', formId: 'slow' })
  await page.getByRole('button', { name: /流程信息/ }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('正在加载表单字段…')).toBeVisible()
  await expect(dialog.getByText('采购金额', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('采购金额', { exact: true })).toBeVisible()
  await expect(dialog.getByText('正在加载表单字段…')).toHaveCount(0)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await harness.invokeHarness('submitBasicInfo', {
    formType: 'custom',
    formId: 'expense',
  })
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: /流程信息/ }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('报销金额', { exact: true })).toBeVisible()
  await expect(dialog.getByText('采购金额', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await harness.invokeHarness('submitBasicInfo', {
    formType: 'custom',
    formId: 'missing',
  })
  await page.getByRole('button', { name: /流程信息/ }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('表单字段加载失败，请检查关联表单后重试。')).toBeVisible()
  await page.screenshot({
    path: path.join(evidence, 'missing-description.png'),
    fullPage: true,
  })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await harness.invokeHarness('submitBasicInfo', { formType: 'custom', formId: 'empty' })
  await page.getByRole('button', { name: /流程信息/ }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('此表单未声明字段')).toBeVisible()
  await expect(dialog.getByText('表单字段加载失败，请检查关联表单后重试。')).toHaveCount(
    0
  )
})

test('custom numeric and option conditions persist actual values and reopen correctly', async ({
  page,
}) => {
  const harness = new WorkflowHarnessPage(page)
  await harness.gotoScenario('custom-form')
  await harness.selectEdge('edge-b-2')
  const conditionField = page.locator('[data-amis-name="condition"]')
  const number = conditionField.getByRole('spinbutton', { name: '请输入数字' })
  await expect(number).toHaveValue('1000')
  await number.fill('50000')
  await expect
    .poll(async () => {
      const condition = (await harness.currentDefinition()).edges.find(
        (edge) => edge.id === 'edge-b-2'
      ).condition
      return condition.children?.[0]?.right ?? condition.right
    })
    .toBe(50000)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  let saved = await harness.invokeHarness('readLastSavedDefinition')
  fs.writeFileSync(
    path.join(evidence, 'saved-numeric.json'),
    JSON.stringify(saved, null, 2)
  )
  const numeric = saved.edges.find((edge) => edge.id === 'edge-b-2').condition
  expect(numeric.children?.[0]?.right ?? numeric.right).toBe(50000)
  const enumDefinition = JSON.parse(JSON.stringify(saved))
  enumDefinition.edges.find((edge) => edge.id === 'edge-b-2').condition = {
    left: { type: 'field', field: 'purchaseType' },
    op: 'select_equals',
    right: 'equipment',
  }
  await harness.invokeHarness('reloadDefinition', enumDefinition)
  await harness.selectEdge('edge-b-2')
  await expect(conditionField).toContainText('设备')
  await conditionField.getByText('设备', { exact: true }).click()
  await page.getByText('服务', { exact: true }).click()
  await expect
    .poll(async () => {
      const value = (await harness.currentDefinition()).edges.find(
        (edge) => edge.id === 'edge-b-2'
      ).condition
      return value.children?.[0]?.right ?? value.right
    })
    .toBe('service')
  await expect(page.locator('.react-flow__edge[data-id="edge-b-2"]')).toContainText(
    '采购类型'
  )
  await page.getByRole('button', { name: '保存', exact: true }).click()
  saved = await harness.invokeHarness('readLastSavedDefinition')
  const option = saved.edges.find((edge) => edge.id === 'edge-b-2').condition
  expect(option.children?.[0]?.right ?? option.right).toBe('service')
  fs.writeFileSync(
    path.join(evidence, 'saved-option.json'),
    JSON.stringify(saved, null, 2)
  )
  await page.screenshot({
    path: path.join(evidence, 'custom-condition.png'),
    fullPage: true,
  })
})
