import devEditPage from '../../../../../../../core/ouroboros-approval-workflow/ouroboros-approval-workflow-dev/src/main/metadata/dev/{appName}/approval-workflow-definition/{id}.ui-schema.json'

import {
  v1DefinitionFixture,
  v2DefinitionFixture,
  v2BranchDefinitionFixture,
} from './fixtures.js'

const cloneFixture = (fixture) => JSON.parse(JSON.stringify(fixture))

const createBasicInfoFormItems = () => [
  {
    type: 'input-text',
    name: 'name',
    label: '流程标识',
    required: true,
  },
  {
    type: 'input-text',
    name: 'title',
    label: '流程名称',
    required: true,
  },
  {
    type: 'textarea',
    name: 'description',
    label: '流程描述',
    minRows: 3,
    maxRows: 6,
  },
  {
    type: 'divider',
  },
  {
    type: 'input-text',
    name: 'formType',
    label: '表单类型',
    required: true,
  },
  {
    type: 'select',
    name: 'formId',
    label: '关联表单',
    source: {
      method: 'get',
      url: '/api/dev/${appName}/approval-workflow/base-info/form/${formType}',
      cache: 2000,
    },
    labelField: 'title',
    valueField: 'name',
    searchable: true,
    clearable: true,
  },
]

const createBasicInfoEntryContract = (overrides = {}) => ({
  basicInfoFormItems: createBasicInfoFormItems(),
  ...overrides,
})

const createOuterPageActions = ({
  allowDefinitionSave = true,
  allowReturnNavigation = false,
  allowPublishAction = false,
} = {}) => ({
  allowDefinitionSave,
  allowReturnNavigation,
  allowPublishAction,
})

const createCandidateSourceApi = ({ includeAppName = false } = {}) => ({
  list: {
    method: 'get',
    url: '/api/approval-workflow/candidate',
    ...(includeAppName
      ? {
          data: {
            appName: '${appName}',
          },
        }
      : {}),
  },
  items: {
    method: 'get',
    url: '/api/approval-workflow/candidate/${candidateName}/items',
    data: {
      ...(includeAppName
        ? {
            appName: '${appName}',
          }
        : {}),
      category: '${category}',
      value: '${value}',
    },
  },
  category: {
    method: 'get',
    url: '/api/approval-workflow/candidate/${candidateName}/category',
    ...(includeAppName
      ? {
          data: {
            appName: '${appName}',
          },
        }
      : {}),
  },
})

const createDefinitionBoundWorkflowFieldSourceApi = () => ({
  method: 'get',
  url: '/api/approval-workflow/base-info/form/${flowDefinition.form.formType}/${flowDefinition.form.formId}/workflow-field',
})

const createBusinessModelWorkflowFieldSourceApi = () => ({
  method: 'get',
  url: '/api/dev/${appName}/approval-workflow/base-info/workflow-field',
  data: {
    formType: '${flowDefinition.form.formType}',
    formKey: '${flowDefinition.form.formId}',
    definitionId: '${flowDefinition.name}',
  },
  cache: 3000,
})

const createCandidateListResponse = () => ({
  status: 0,
  data: {
    items: [
      {
        name: 'UserSelect',
        label: '用户自选',
        configMode: 'Enum',
        valueKey: 'mode',
        items: [
          { label: '单人', value: 'single' },
          { label: '多人', value: 'multiple' },
        ],
      },
      {
        name: 'Starter',
        label: '流程发起人',
        configMode: 'Check',
        valueKey: 'enabled',
        disabledIn: ['会签'],
      },
      {
        name: 'User',
        label: '用户',
        configMode: 'SingleSelect',
        valueKey: 'users',
        items: [{ label: '张三', value: 'u1' }],
      },
    ],
  },
})

const createFieldResponse = (items) => ({
  status: 0,
  data: {
    items,
  },
})

const createBusinessModelWorkflowFieldsResponse = ({
  formKey = '',
  formTitle = '',
  fields = [],
} = {}) => {
  const normalizedFields = (fields || []).map((field) => ({
    ...field,
    value: field.name,
  }))
  const normalizedFormKey = typeof formKey === 'string' ? formKey : ''

  return {
    status: 0,
    data: {
      sourceKind: 'form-fields',
      revisionToken: `form-fields:${normalizedFormKey || '__empty__'}:${normalizedFields.length}`,
      fields: normalizedFields,
      boundForm:
        normalizedFormKey && formTitle
          ? {
              formType: 'business-model',
              formKey: normalizedFormKey,
              formTitle,
            }
          : null,
      boundFormSummary:
        normalizedFormKey && formTitle ? `${formTitle}（${normalizedFormKey}）` : '',
    },
  }
}

const createBusinessModelWorkflowFieldsResolver = (modelEntries = {}) => {
  return (request) => {
    const formKey = typeof request?.data?.formKey === 'string' ? request.data.formKey : ''
    const matchedModel = formKey ? modelEntries[formKey] : null

    if (!matchedModel) {
      return createBusinessModelWorkflowFieldsResponse({
        formKey,
        fields: [],
      })
    }

    return createBusinessModelWorkflowFieldsResponse({
      formKey,
      formTitle: matchedModel.formTitle,
      fields: matchedModel.fields,
    })
  }
}

const createCommonCandidateFetcherResponses = () => ({
  '/api/dev/workflow-harness/approval-workflow/base-info/form/business-model': {
    status: 0,
    data: {
      items: [
        { name: 'demo.order', title: '订单' },
        { name: 'demo.invoice', title: '发票' },
      ],
    },
  },
  '/api/approval-workflow/candidate': createCandidateListResponse(),
})

const createDefinitionManagementPageConfig = () => ({
  outerPageActions: createOuterPageActions({
    allowDefinitionSave: true,
  }),
  formFieldSourceApi: createDefinitionBoundWorkflowFieldSourceApi(),
  candidateSourceApi: createCandidateSourceApi(),
})

const createDefaultFlowDesignPageConfig = () => ({
  outerPageActions: createOuterPageActions({
    allowDefinitionSave: true,
    allowReturnNavigation: true,
  }),
  formFieldSourceApi: createBusinessModelWorkflowFieldSourceApi(),
  candidateSourceApi: createCandidateSourceApi({ includeAppName: true }),
  basicInfoDataSourceApi: createBusinessModelWorkflowFieldSourceApi(),
})

const createApplicationDefinitionManagementPageConfig = () => ({
  outerPageActions: createOuterPageActions({
    allowDefinitionSave: true,
    allowReturnNavigation: true,
    allowPublishAction: true,
  }),
  formFieldSourceApi: createDefinitionBoundWorkflowFieldSourceApi(),
  candidateSourceApi: createCandidateSourceApi(),
})

const v2EdgeDiagnosticDefinitionFixture = (() => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'flow-v2-edge-diagnostic'
  definition.name = '基础流程-连线诊断'
  const targetEdge = definition.edges.find((edge) => edge.id === 'edge-1')
  if (targetEdge) {
    targetEdge.condition = {}
  }
  return definition
})()

const branchMissingConditionSourceDefinitionFixture = (() => {
  const definition = cloneFixture(v2BranchDefinitionFixture)
  definition.id = 'flow-v2-branch-missing-condition-source'
  definition.name = '分支流程-缺少条件字段'
  return definition
})()

const designTimeBranchDefinitionFixture = (() => {
  const definition = cloneFixture(v2BranchDefinitionFixture)
  const amountEdge = definition.edges.find((edge) => edge.id === 'edge-b-2')
  amountEdge.condition = amountEdge.condition.children[0]
  return {
    formatVersion: 1,
    name: 'demo-order-branch-approval',
    title: '设计时分支流程',
    description: definition.description || '',
    version: 1,
    enabled: true,
    form: {
      formType: 'business-model',
      formId: 'demo.order',
    },
    nodes: definition.nodes,
    edges: definition.edges,
  }
})()

const businessModelWorkflowFieldModels = {
  'demo.order': {
    formTitle: '订单',
    fields: [
      {
        label: '金额',
        name: 'amount',
        type: '货币',
        valueType: 'Decimal',
      },
      {
        label: '申请部门',
        name: 'department',
        type: '单选',
        valueType: 'String',
        options: [{ label: '兜底', value: 'fallback' }],
      },
    ],
  },
  'demo.invoice': {
    formTitle: '发票',
    fields: [
      {
        label: '发票金额',
        name: 'invoiceAmount',
        type: '定点数字',
        valueType: 'Decimal',
      },
      {
        label: '开票部门',
        name: 'invoiceDepartment',
        type: '单行文本',
        valueType: 'String',
      },
    ],
  },
}

export const harnessScenarios = {
  'v1-editable': {
    definition: v1DefinitionFixture,
    flowKey: v1DefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/default/purchase/workflow-field':
        createFieldResponse([
          {
            label: '申请金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'v2-editable': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    ...createBasicInfoEntryContract(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
          {
            label: '申请部门',
            value: 'department',
            type: 'text',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'history-editable': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    ...createBasicInfoEntryContract(),
    coreCapabilities: {
      allowHistoryCommands: true,
    },
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'branch-editable': {
    definition: v2BranchDefinitionFixture,
    flowKey: v2BranchDefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/default/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: '货币',
            valueType: 'Decimal',
            usages: ['condition', 'permission'],
          },
          {
            label: '申请部门',
            value: 'department',
            type: 'select',
            usages: ['condition', 'permission'],
            options: [{ label: '兜底', value: 'fallback' }],
          },
        ]),
    },
  },
  'v2-edge-diagnostic': {
    definition: v2EdgeDiagnosticDefinitionFixture,
    flowKey: v2EdgeDiagnosticDefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'branch-missing-condition-source': {
    definition: branchMissingConditionSourceDefinitionFixture,
    flowKey: branchMissingConditionSourceDefinitionFixture.id,
    outerPageActions: createOuterPageActions({
      allowDefinitionSave: true,
    }),
    candidateSourceApi: createCandidateSourceApi(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/default/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            usages: ['permission'],
          },
        ]),
    },
  },
  'remote-v2-source': {
    definition: null,
    flowKey: 'remote-flow',
    ...createDefinitionManagementPageConfig(),
    source: {
      method: 'get',
      url: '/api/approval-workflow/definition/remote-flow',
    },
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/definition/remote-flow': {
        status: 0,
        data: {
          ...v2DefinitionFixture,
          id: 'remote-flow',
        },
      },
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'new-flow': {
    definition: null,
    flowKey: null,
    definitionId: 'demo-order-approval',
    ...createDefaultFlowDesignPageConfig(),
    formType: 'business-model',
    formKey: 'demo.order',
    fullName: 'demo.order',
    modelName: '订单',
    sourceLayer: 'default',
    returnTarget: '/dev/demo/business-model/demo.order',
    ...createBasicInfoEntryContract(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/dev/workflow-harness/approval-workflow/base-info/workflow-field':
        createBusinessModelWorkflowFieldsResolver(businessModelWorkflowFieldModels),
    },
  },
  'design-time-branch-editable': {
    definition: designTimeBranchDefinitionFixture,
    flowKey: designTimeBranchDefinitionFixture.name,
    ...createDefaultFlowDesignPageConfig(),
    formType: 'business-model',
    formKey: 'demo.order',
    fullName: 'demo.order',
    modelName: '订单',
    sourceLayer: 'default',
    returnTarget: '/dev/demo/business-model/demo.order',
    ...createBasicInfoEntryContract(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/dev/workflow-harness/approval-workflow/base-info/workflow-field':
        createBusinessModelWorkflowFieldsResolver(businessModelWorkflowFieldModels),
    },
  },
  'application-definition-management': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    ...createApplicationDefinitionManagementPageConfig(),
    formType: 'business-model',
    formKey: 'demo.order',
    fullName: 'demo.order',
    ...createBasicInfoEntryContract(),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'workflow-viewer': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    mode: 'preview',
  },
  'basic-info-customized': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    ...createBasicInfoEntryContract({
      basicInfoButtonLabel: '流程信息',
      basicInfoButtonIcon: 'fa-solid fa-circle-info',
    }),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
  'basic-info-drawer': {
    definition: v2DefinitionFixture,
    flowKey: v2DefinitionFixture.id,
    ...createDefinitionManagementPageConfig(),
    ...createBasicInfoEntryContract({
      basicInfoOpenMode: 'drawer',
    }),
    fetcherResponses: {
      ...createCommonCandidateFetcherResponses(),
      '/api/approval-workflow/base-info/form/customForm/purchase/workflow-field':
        createFieldResponse([
          {
            label: '金额',
            value: 'amount',
            type: 'number',
            usages: ['condition', 'permission'],
          },
        ]),
    },
  },
}

const findWorkflowEditor = (value) => {
  if (!value || typeof value !== 'object') return null
  if (value.type === 'workflow-editor') return value
  for (const child of Object.values(value)) {
    const found = findWorkflowEditor(child)
    if (found) return found
  }
  return null
}
const productionEditor = findWorkflowEditor(devEditPage)
const customDefinition = cloneFixture(v2BranchDefinitionFixture)
customDefinition.formType = 'custom'
customDefinition.formKey = 'purchase'
const customFields = [
  {
    name: 'amount',
    label: '采购金额',
    type: 'input-number',
    fieldType: '定点数字',
    valueType: 'Decimal',
    description: '金额含税',
    operators: ['greater', 'equal', 'between'],
    usages: ['condition', 'permission'],
  },
  {
    name: 'purchaseType',
    label: '采购类型',
    type: 'select',
    fieldType: '单选',
    valueType: 'String',
    options: [
      { value: 'equipment', label: '设备' },
      { value: 'service', label: '服务' },
    ],
    operators: ['select_equals', 'select_not_equals'],
    usages: ['condition', 'permission'],
  },
]
const customResponses = {
  ...createCommonCandidateFetcherResponses(),
  '/api/dev/workflow-harness/approval-workflow/base-info/form-types': {
    status: 0,
    data: {
      items: [
        { value: 'business-model', label: '业务模型' },
        { value: 'custom', label: '自定义表单' },
      ],
    },
  },
  '/api/dev/workflow-harness/approval-workflow/base-info/form/custom': {
    status: 0,
    data: {
      items: [
        { name: 'purchase', title: '采购申请' },
        { name: 'expense', title: '费用报销' },
      ],
    },
  },
  '/api/dev/workflow-harness/approval-workflow/base-info/workflow-field': async (
    request
  ) => {
    const key = request.data?.formKey
    if (key === 'slow') await new Promise((resolve) => setTimeout(resolve, 1000))
    if (key === 'missing') return { status: -1, msg: '自定义审批表单不存在' }
    return {
      status: 0,
      data: {
        sourceKind: 'form-fields',
        revisionToken: `custom:${key}`,
        fields:
          key === 'empty'
            ? []
            : key === 'expense'
              ? [{ ...customFields[0], name: 'expenseAmount', label: '报销金额' }]
              : customFields,
      },
    }
  },
}
harnessScenarios['custom-form'] = {
  definition: customDefinition,
  flowKey: customDefinition.id,
  ...createDefaultFlowDesignPageConfig(),
  basicInfoFormItems: productionEditor.basicInfoFormItems,
  fetcherResponses: customResponses,
}

export function resolveScenario(name) {
  return harnessScenarios[name] || harnessScenarios['new-flow']
}
