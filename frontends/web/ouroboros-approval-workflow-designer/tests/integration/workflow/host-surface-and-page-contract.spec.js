const { test, expect } = require('@playwright/test')
const { WorkflowHarnessPage } = require('./helpers/workflowHarnessPage')

test('base info entry lives in the editor command surface while legacy host chrome stays hidden', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  await expect(page.getByTestId('workflow-page-actions')).toContainText('保存')
  await expect(
    page
      .getByTestId('workflow-editor-command-surface')
      .getByRole('button', { name: /流程信息/ })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /流程信息/ })).toHaveCount(1)
  await expect(page.getByTestId('workflow-editor-host')).not.toContainText('流程ID')
  await expect(page.getByTestId('workflow-editor-host')).not.toContainText('流程设计')
})

test('base info dialog confirm patches the editor value and closes the dialog', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')
  await page
    .getByTestId('workflow-editor-command-surface')
    .getByRole('button', { name: /流程信息/ })
    .click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.locator('input[name="name"]').fill('流程信息确认回写')
  await dialog.locator('textarea[name="description"]').fill('确认按钮应回写编辑器 value')
  await dialog.getByRole('button', { name: '确认' }).click()

  await expect(dialog).toHaveCount(0)

  const definition = await workflowHarnessPage.currentDefinition()
  expect(definition.name).toBe('流程信息确认回写')
  expect(definition.description).toBe('确认按钮应回写编辑器 value')
})

test('outer page actions and explicit editor inputs stay separated', async ({ page }) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')
  const designTimeContract = await workflowHarnessPage.editorInputContract()
  expect(designTimeContract.basicInfoFormItems?.map((item) => item.name)).toEqual([
    'name',
    'title',
    'description',
    undefined,
    'formType',
    'formId',
  ])
  expect(designTimeContract.basicInfoFormItems?.find((item) => item.name === 'formId')).toMatchObject({
    type: 'select',
    label: '表单标识',
    labelField: 'title',
    valueField: 'fullName',
    searchable: true,
    clearable: true,
  })
  expect(
    designTimeContract.basicInfoFormItems?.find((item) => item.name === 'formId')?.source?.url
  ).toBe('/api/dev/${appName}/business-model/list')
  expect(designTimeContract.basicInfoButtonLabel).toBeNull()
  expect(designTimeContract.basicInfoButtonIcon).toBeNull()
  expect(designTimeContract.basicInfoOpenMode).toBeNull()
  expect(designTimeContract.conditionFieldSource).toBeNull()
  expect(designTimeContract.candidateSourceApi?.list?.url).toBe('/api/approval-workflow/candidate')
  expect(designTimeContract.conditionFieldSourceApi).toBeNull()
  expect(designTimeContract.formPermissionFieldSourceApi).toBeNull()
  expect(designTimeContract.candidateFieldSourceApi).toBeUndefined()
  expect(designTimeContract.assigneeFieldSourceApi).toBeUndefined()
  expect(designTimeContract.formFieldSourceApi?.data?.formType).toBe(
    '${flowDefinition.form.formType}'
  )
  expect(designTimeContract.formFieldSourceApi?.data?.formKey).toBe('${flowDefinition.form.formId}')
  expect(designTimeContract.formFieldSourceApi?.data?.definitionId).toBe('${flowDefinition.name}')
  expect(designTimeContract.formFieldSourceApi?.url).toBe(
    '/api/dev/${appName}/business-model-helper/approval-workflow-fields'
  )
  expect(designTimeContract.basicInfoDataSourceApi?.url).toBe(
    '/api/dev/${appName}/business-model-helper/approval-workflow-fields'
  )
  expect(designTimeContract.basicInfoDataSourceApi?.data?.formType).toBe(
    '${flowDefinition.form.formType}'
  )
  expect(designTimeContract.basicInfoDataSourceApi?.data?.formKey).toBe('${flowDefinition.form.formId}')
  expect(designTimeContract.basicInfoDataSourceApi?.data?.definitionId).toBe('${flowDefinition.name}')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: '发布' })).toHaveCount(0)

  await workflowHarnessPage.gotoScenario('application-definition-management')
  const applicationManagementContract = await workflowHarnessPage.editorInputContract()
  expect(applicationManagementContract.conditionFieldSourceApi).toBeNull()
  expect(applicationManagementContract.formPermissionFieldSourceApi).toBeNull()
  expect(applicationManagementContract.candidateFieldSourceApi).toBeUndefined()
  expect(applicationManagementContract.assigneeFieldSourceApi).toBeUndefined()
  expect(applicationManagementContract.formFieldSourceApi?.data?.formType).toBe(undefined)
  expect(applicationManagementContract.formFieldSourceApi?.data?.formKey).toBe(undefined)
  expect(applicationManagementContract.formFieldSourceApi?.url).toBe(
    '/api/approval-workflow/base-info/form/${flowDefinition.form.formType}/${flowDefinition.form.formId}/workflow-field'
  )
  expect(applicationManagementContract.basicInfoFormItems?.map((item) => item.name)).toEqual([
    'name',
    'title',
    'description',
    undefined,
    'formType',
    'formId',
  ])
  expect(applicationManagementContract.basicInfoButtonLabel).toBeNull()
  expect(applicationManagementContract.basicInfoButtonIcon).toBeNull()
  expect(applicationManagementContract.basicInfoOpenMode).toBeNull()
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: '发布' })).toBeVisible()

  await workflowHarnessPage.gotoScenario('workflow-viewer')
  const readonlyContract = await workflowHarnessPage.editorInputContract()
  expect(readonlyContract.basicInfoFormItems).toBeNull()
  expect(readonlyContract.basicInfoButtonLabel).toBeNull()
  expect(readonlyContract.basicInfoButtonIcon).toBeNull()
  expect(readonlyContract.basicInfoOpenMode).toBeNull()
  await expect(page.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发布' })).toHaveCount(0)

  const readonlySnapshot = await workflowHarnessPage.reactFlowContractSnapshot()
  expect(readonlySnapshot.paletteNodeTypes).toEqual([])
})

test('design-time draft resolves field sources from the initialized flow definition binding', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')

  await expect.poll(async () => {
    return (await workflowHarnessPage.fetcherCalls()).filter((call) =>
      call?.url?.includes('/business-model-helper/approval-workflow-fields')
    ).length
  }).toBeGreaterThan(0)

  const fieldSourceCalls = (await workflowHarnessPage.fetcherCalls()).filter((call) =>
    call?.url?.includes('/business-model-helper/approval-workflow-fields')
  )
  expect(fieldSourceCalls.every((call) => call.data?.formType === 'business-model')).toBe(true)
  expect(fieldSourceCalls.every((call) => call.data?.formKey === 'demo.order')).toBe(true)
  expect(fieldSourceCalls.every((call) => call.data?.definitionId === 'demo-order-approval')).toBe(true)

  const definition = await workflowHarnessPage.currentDefinition()
  expect(definition.form.formType).toBe('business-model')
  expect(definition.form.formId).toBe('demo.order')
})

test('design-time flow info switch re-resolves field sources from the updated form binding', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('new-flow')

  await expect.poll(async () => {
    return (await workflowHarnessPage.fetcherCalls()).filter(
      (call) =>
        call?.url?.includes('/business-model-helper/approval-workflow-fields') &&
        call.data?.formKey === 'demo.order'
    ).length
  }).toBeGreaterThan(0)

  const submitted = await workflowHarnessPage.invokeHarness('submitBasicInfo', {
    formId: 'demo.invoice',
  })
  expect(submitted).toBe(true)

  await expect.poll(async () => {
    return (await workflowHarnessPage.fetcherCalls()).filter(
      (call) =>
        call?.url?.includes('/business-model-helper/approval-workflow-fields') &&
        call.data?.formType === 'business-model' &&
        call.data?.formKey === 'demo.invoice' &&
        call.data?.definitionId === 'demo-order-approval'
    ).length
  }).toBeGreaterThan(0)

  const definition = await workflowHarnessPage.currentDefinition()
  expect(definition.form.formType).toBe('business-model')
  expect(definition.form.formId).toBe('demo.invoice')
})

test('design-time split edge inspector follows the refreshed condition field source and blocks after clearing the binding', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('design-time-branch-editable')

  await workflowHarnessPage.selectEdge('edge-b-2')
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('条件表达式')

  await expect.poll(async () => {
    return (await workflowHarnessPage.fetcherCalls()).filter(
      (call) =>
        call?.url?.includes('/business-model-helper/approval-workflow-fields') &&
        call.data?.formType === 'business-model' &&
        call.data?.formKey === 'demo.order' &&
        call.data?.definitionId === 'demo-order-branch-approval'
    ).length
  }).toBeGreaterThan(0)

  const initialPanelText = await workflowHarnessPage.rightPanelText()
  expect(initialPanelText).toContain('金额')
  expect(initialPanelText).not.toContain('当前入口未提供可用条件字段')

  const submitted = await workflowHarnessPage.invokeHarness('submitBasicInfo', {
    formId: '',
  })
  expect(submitted).toBe(true)

  await expect.poll(async () => {
    return (await workflowHarnessPage.fetcherCalls()).filter(
      (call) =>
        call?.url?.includes('/business-model-helper/approval-workflow-fields') &&
        call.data?.formType === 'business-model' &&
        call.data?.formKey === '' &&
        call.data?.definitionId === 'demo-order-branch-approval'
    ).length
  }).toBeGreaterThan(0)

  await workflowHarnessPage.selectEdge('edge-b-2')
  await expect.poll(async () => {
    return await workflowHarnessPage.rightPanelText()
  }).toContain('当前入口未提供可用条件字段')
})

test('base info entry contract supports customized label/icon and hides itself when form items are absent', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('basic-info-customized')
  const customizedContract = await workflowHarnessPage.editorInputContract()
  expect(customizedContract.basicInfoButtonLabel).toBe('流程信息')
  expect(customizedContract.basicInfoButtonIcon).toBe('fa-solid fa-circle-info')
  expect(customizedContract.basicInfoOpenMode).toBeNull()
  await expect(
    page
      .getByTestId('workflow-editor-command-surface')
      .getByRole('button', { name: /流程信息/ })
  ).toBeVisible()

  await workflowHarnessPage.gotoScenario('basic-info-drawer')
  const drawerContract = await workflowHarnessPage.editorInputContract()
  expect(drawerContract.basicInfoOpenMode).toBe('drawer')
  await page
    .getByTestId('workflow-editor-command-surface')
    .getByRole('button', { name: /流程信息/ })
    .click()
  await expect(page.getByRole('dialog')).toContainText('流程信息')

  await workflowHarnessPage.gotoScenario('branch-editable')
  await expect(
    page
      .getByTestId('workflow-editor-command-surface')
      .getByRole('button', { name: /流程信息/ })
  ).toHaveCount(0)
})

test('react flow contract: designer shell has three panels and palette omits synthetic nodes', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('v2-editable')

  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasThreePanelShell
  }).toBe(true)

  const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
  expect(snapshot.paletteIncludesEnd).toBe(true)
  expect(snapshot.paletteIncludesCondition).toBe(false)
})

test('react flow contract: branch scenario does not render condition pseudo nodes in canvas', async ({
  page,
}) => {
  const workflowHarnessPage = new WorkflowHarnessPage(page)

  await workflowHarnessPage.gotoScenario('branch-editable')

  await expect.poll(async () => {
    const snapshot = await workflowHarnessPage.reactFlowContractSnapshot()
    return snapshot.hasConditionPseudoNodeInCanvas
  }).toBe(false)
})
