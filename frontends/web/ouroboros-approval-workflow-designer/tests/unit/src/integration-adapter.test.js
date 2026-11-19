const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  ApprovalWorkflowEditorIntegrationAdapter,
} = require('../../../src/editor-integration/approvalWorkflowEditorIntegrationAdapter.js')

test('integration adapter unwraps http-style definition payloads from the outer page fetcher', async () => {
  const definition = await ApprovalWorkflowEditorIntegrationAdapter.loadDefinition({
    flowKey: 'approval_accept_20260609_b1',
    env: {
      fetcher: async () => ({
        status: 200,
        data: {
          code: 0,
          data: {
            id: 'approval_accept_20260609_b1',
            name: '验收流程B1',
            description: '用于验收基础信息弹窗绑定',
          },
        },
      }),
    },
  })

  assert.deepStrictEqual(definition, {
    id: 'approval_accept_20260609_b1',
    name: '验收流程B1',
    description: '用于验收基础信息弹窗绑定',
  })
})

test('integration adapter resolves template variables in definition sources before fetching', async () => {
  const fetchCalls = []
  const definition = await ApprovalWorkflowEditorIntegrationAdapter.loadDefinition({
    props: {
      source: {
        method: 'get',
        url: '/api/approval-workflow/definition/${id}',
      },
      data: {
        id: 'approval_accept_20260609_b1',
      },
    },
    flowKey: 'approval_accept_20260609_b1',
    env: {
      fetcher: async (request) => {
        fetchCalls.push(request)
        return {
          status: 0,
          data: {
            id: 'approval_accept_20260609_b1',
            name: '验收流程B1',
          },
        }
      },
    },
  })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/approval-workflow/definition/approval_accept_20260609_b1',
    },
  ])
  assert.deepStrictEqual(definition, {
    id: 'approval_accept_20260609_b1',
    name: '验收流程B1',
  })
})

test('integration adapter resolves condition fields from explicit source api', async () => {
  const fetchCalls = []
  const conditionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveConditionFieldSource({
      props: {
        conditionFieldSourceApi: {
          method: 'get',
          url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
          data: {
            formType: '${flowDefinition.form.formType}',
            formKey: '${flowDefinition.form.formId}',
            definitionId: '${flowDefinition.name}',
          },
          cache: 3000,
        },
      },
      data: {
        appName: 'crm',
        flowDefinition: {
          name: 'order-approval',
          form: {
            formType: 'business-model',
            formId: 'demo.order',
          },
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 0,
            data: {
              sourceKind: 'form-fields',
              revisionToken: 'form-fields:demo.order:2',
              fields: [
                {
                  name: 'amount',
                  label: '金额',
                },
                {
                  name: 'department',
                  label: '申请部门',
                },
              ],
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: 'demo.order',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
  ])
  assert.strictEqual(conditionFieldSource.sourceKind, 'form-fields')
  assert.strictEqual(conditionFieldSource.revisionToken, 'form-fields:demo.order:2')
  assert.deepStrictEqual(conditionFieldSource.fields, [
    {
      label: '金额',
      name: 'amount',
      type: 'text',
      value: 'amount',
    },
    {
      label: '申请部门',
      name: 'department',
      type: 'text',
      value: 'department',
    },
  ])
})

test('integration adapter resolves design-time workflow fields from current flow definition data', async () => {
  const fetchCalls = []
  const sourceApi = {
    method: 'get',
    url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
    data: {
      formType: '${flowDefinition.form.formType}',
      formKey: '${flowDefinition.form.formId}',
      definitionId: '${flowDefinition.name}',
    },
    cache: 3000,
  }
  const data = {
    appName: 'crm',
    formType: 'business-model',
    formKey: 'stale.order',
    id: 'stale-approval',
    flowDefinition: {
      name: 'order-approval',
      form: {
        formType: 'business-model',
        formId: 'demo.order',
      },
    },
  }
  const env = {
    fetcher: async (request) => {
      fetchCalls.push(request)
      return {
        status: 0,
        data: {
          sourceKind: 'form-fields',
          revisionToken: 'form-fields:demo.order:2',
          fields: [
            {
              name: 'amount',
              label: '金额',
              type: 'number',
            },
            {
              name: 'department',
              label: '申请部门',
              type: 'text',
            },
          ],
        },
      }
    },
  }

  const conditionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveConditionFieldSource({
      props: {
        conditionFieldSourceApi: sourceApi,
      },
      data,
      env,
    })
  const formPermissionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormPermissionFieldSource({
      props: {
        formPermissionFieldSourceApi: sourceApi,
      },
      data,
      env,
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: 'demo.order',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: 'demo.order',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
  ])
  assert.strictEqual(conditionFieldSource.revisionToken, 'form-fields:demo.order:2')
  assert.deepStrictEqual(
    conditionFieldSource.fields.map((field) => field.value),
    ['amount', 'department']
  )
  assert.strictEqual(formPermissionFieldSource.revisionToken, 'form-fields:demo.order:2')
  assert.deepStrictEqual(
    formPermissionFieldSource.fields.map((field) => field.value),
    ['amount', 'department']
  )
})

test('integration adapter keeps legacy condition and permission source APIs in separate field views', async () => {
  const fetchCalls = []
  const fieldSources =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormFieldSources({
      props: {
        conditionFieldSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/base-info/form/${flowDefinition.formType}/${flowDefinition.formKey}/expression-variable',
        },
        formPermissionFieldSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/base-info/form/${flowDefinition.formType}/${flowDefinition.formKey}/field',
        },
      },
      data: {
        flowDefinition: {
          formType: 'customForm',
          formKey: 'purchase',
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          if (request.url.endsWith('/expression-variable')) {
            return {
              status: 0,
              data: {
                items: [
                  {
                    label: '金额',
                    value: 'amount',
                    type: 'number',
                  },
                ],
              },
            }
          }

          return {
            status: 0,
            data: {
              items: [
                {
                  label: '申请部门',
                  value: 'department',
                },
              ],
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/approval-workflow/base-info/form/customForm/purchase/expression-variable',
    },
    {
      method: 'get',
      url: '/api/approval-workflow/base-info/form/customForm/purchase/field',
    },
  ])
  assert.deepStrictEqual(
    fieldSources.conditionFieldSource.fields.map((field) => field.value),
    ['amount']
  )
  assert.deepStrictEqual(
    fieldSources.formPermissionFieldSource.fields.map((field) => field.value),
    ['department']
  )
  assert.deepStrictEqual(fieldSources.candidateFieldSource.fields, [])
})

test('integration adapter resolves unified form field source into all field views', async () => {
  const fetchCalls = []
  const sourceApi = {
    method: 'get',
    url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
    data: {
      formType: '${flowDefinition.form.formType}',
      formKey: '${flowDefinition.form.formId}',
      definitionId: '${flowDefinition.name}',
    },
    cache: 3000,
  }
  const fieldSources =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormFieldSources({
      props: {
        formFieldSourceApi: sourceApi,
      },
      data: {
        appName: 'crm',
        flowDefinition: {
          name: 'order-approval',
          form: {
            formType: 'business-model',
            formId: 'demo.order',
          },
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 0,
            data: {
              sourceKind: 'form-fields',
              revisionToken: 'form-fields:demo.order:3',
              fields: [
                {
                  name: 'managerId',
                  label: '直属主管',
                  type: '员工',
                  usages: ['candidate', 'permission'],
                },
                {
                  name: 'amount',
                  label: '金额',
                  type: 'number',
                  usages: ['condition', 'permission'],
                },
                {
                  name: 'createdAt',
                  label: '创建时间',
                  type: 'datetime',
                },
              ],
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: 'demo.order',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
  ])
  assert.deepStrictEqual(
    fieldSources.conditionFieldSource.fields.map((field) => field.value),
    ['amount', 'createdAt']
  )
  assert.deepStrictEqual(
    fieldSources.formPermissionFieldSource.fields.map((field) => field.value),
    ['managerId', 'amount', 'createdAt']
  )
  assert.deepStrictEqual(
    fieldSources.candidateFieldSource.fields.map((field) => field.value),
    ['managerId']
  )
})

test('integration adapter uses returned value types for business model condition fields', async () => {
  const fieldSources =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormFieldSources({
      props: {
        formFieldSourceApi: {
          method: 'get',
          url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
        },
      },
      env: {
        fetcher: async () => ({
          status: 200,
          data: {
            code: 0,
            data: {
              sourceKind: 'form-fields',
              fields: [
                {
                  name: 'amount',
                  label: '金额',
                  type: '自定义金额',
                  valueType: 'Decimal',
                },
                {
                  name: 'quantity',
                  label: '数量',
                  type: '整数数字',
                  valueType: 'Integer',
                },
                { name: 'title', label: '标题', type: '单行文本', valueType: 'String' },
                { name: 'date', label: '日期', type: '日期', valueType: 'Date' },
                {
                  name: 'status',
                  label: '状态',
                  type: '单选',
                  valueType: 'String',
                  options: [{ label: '通过', value: 'approved' }],
                },
                { name: 'manager', label: '主管', type: '员工' },
                {
                  name: 'metadata',
                  label: '附加信息',
                  type: '自定义对象',
                  valueType: 'Json',
                },
              ],
            },
          },
        }),
      },
    })

  assert.deepStrictEqual(
    fieldSources.conditionFieldSource.fields.map(({ name, type }) => ({ name, type })),
    [
      { name: 'amount', type: 'number' },
      { name: 'quantity', type: 'number' },
      { name: 'title', type: 'text' },
      { name: 'date', type: 'date' },
      { name: 'status', type: 'select' },
      { name: 'metadata', type: 'text' },
    ]
  )
  assert.deepStrictEqual(
    fieldSources.candidateFieldSource.fields.map((field) => field.name),
    ['manager']
  )
  assert.strictEqual(fieldSources.formFieldSource.fields[0].type, '自定义金额')
  assert.deepStrictEqual(fieldSources.conditionFieldSource.fields[4].options, [
    { label: '通过', value: 'approved' },
  ])
  assert.deepStrictEqual(fieldSources.conditionFieldSource.fields[5].operators, [
    'equal',
    'not_equal',
  ])
})

test('integration adapter resolves condition fields when the source api returns items payloads', async () => {
  const conditionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveConditionFieldSource({
      props: {
        conditionFieldSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/base-info/form/${flowDefinition.form.formType}/${flowDefinition.form.formId}/expression-variable',
        },
      },
      data: {
        flowDefinition: {
          form: {
            formType: 'default',
            formId: 'purchase',
          },
        },
      },
      env: {
        fetcher: async () => ({
          status: 0,
          data: {
            items: [
              {
                label: '金额',
                value: 'amount',
              },
            ],
          },
        }),
      },
    })

  assert.strictEqual(conditionFieldSource.sourceKind, 'definition-bound-form')
  assert.strictEqual(conditionFieldSource.revisionToken, 'definition-bound-form:1')
  assert.deepStrictEqual(conditionFieldSource.fields, [
    {
      label: '金额',
      name: 'amount',
      type: 'text',
      value: 'amount',
    },
  ])
})

test('integration adapter resolves candidate source from explicit list api and attaches per-type api config', async () => {
  const fetchCalls = []
  const candidateSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveCandidateSource({
      props: {
        candidateSourceApi: {
          list: {
            method: 'get',
            url: '/api/approval-workflow/candidate',
            data: {
              appName: '${appName}',
            },
          },
          items: {
            method: 'get',
            url: '/api/approval-workflow/candidate/${candidateName}/items',
            data: {
              appName: '${appName}',
              category: '${category}',
              value: '${value}',
            },
          },
          category: {
            method: 'get',
            url: '/api/approval-workflow/candidate/${candidateName}/category',
            data: {
              appName: '${appName}',
            },
          },
        },
      },
      data: {
        appName: 'crm',
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 0,
            data: {
              items: [
                {
                  name: 'User',
                  label: '指定成员',
                  configMode: 'Pick',
                  valueKey: 'users',
                },
              ],
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/approval-workflow/candidate',
      data: {
        appName: 'crm',
      },
    },
  ])
  assert.deepStrictEqual(candidateSource, {
    revisionToken: 'candidate:1',
    items: [
      {
        name: 'User',
        label: '指定成员',
        configMode: 'Pick',
        valueKey: 'users',
        items: [],
        disabledIn: [],
        itemsSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/items',
          data: {
            appName: 'crm',
            category: '${category}',
            value: '${value}',
          },
        },
        categorySourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/category',
          data: {
            appName: 'crm',
          },
        },
      },
    ],
  })
})

test('integration adapter resolves form permission fields from explicit api using current definition data', async () => {
  const fetchCalls = []
  const formPermissionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormPermissionFieldSource({
      props: {
        formPermissionFieldSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/base-info/form/${flowDefinition.form.formType}/${flowDefinition.form.formId}/field',
        },
      },
      data: {
        flowDefinition: {
          form: {
            formType: 'customForm',
            formId: 'purchase',
          },
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 200,
            data: {
              code: 0,
              data: {
                items: [
                  {
                    label: '申请金额',
                    value: 'amount',
                  },
                ],
              },
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/approval-workflow/base-info/form/customForm/purchase/field',
    },
  ])
  assert.strictEqual(formPermissionFieldSource.revisionToken, 'form-permission:1')
  assert.deepStrictEqual(formPermissionFieldSource.fields, [
    {
      label: '申请金额',
      value: 'amount',
    },
  ])
})

test('integration adapter skips form permission fetch when design-time source params are incomplete', async () => {
  let fetchCalled = false
  const formPermissionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormPermissionFieldSource({
      props: {
        formPermissionFieldSourceApi: {
          method: 'get',
          url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
          data: {
            formType: '${flowDefinition.form.formType}',
            formKey: '${flowDefinition.form.formId}',
            definitionId: '${flowDefinition.name}',
          },
          cache: 3000,
        },
      },
      data: {
        appName: 'crm',
      },
      env: {
        fetcher: async () => {
          fetchCalled = true
          return {
            status: 0,
            data: {
              fields: [],
            },
          }
        },
      },
    })

  assert.strictEqual(fetchCalled, false)
  assert.strictEqual(formPermissionFieldSource.revisionToken, '__empty__')
  assert.deepStrictEqual(formPermissionFieldSource.fields, [])
})

test('integration adapter allows empty flow definition formId to resolve explicit empty workflow fields', async () => {
  const fetchCalls = []
  const formPermissionFieldSource =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveFormPermissionFieldSource({
      props: {
        formPermissionFieldSourceApi: {
          method: 'get',
          url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
          data: {
            formType: '${flowDefinition.form.formType}',
            formKey: '${flowDefinition.form.formId}',
            definitionId: '${flowDefinition.name}',
          },
          cache: 3000,
        },
      },
      data: {
        appName: 'crm',
        flowDefinition: {
          name: 'order-approval',
          form: {
            formType: 'business-model',
            formId: '',
          },
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 0,
            data: {
              sourceKind: 'form-fields',
              revisionToken: 'form-fields:__empty__:0',
              fields: [],
              boundForm: null,
              boundFormSummary: '',
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: '',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
  ])
  assert.strictEqual(formPermissionFieldSource.sourceKind, 'form-fields')
  assert.strictEqual(formPermissionFieldSource.revisionToken, 'form-fields:__empty__:0')
  assert.deepStrictEqual(formPermissionFieldSource.fields, [])
})

test('integration adapter resolves basic info data from explicit source api', async () => {
  const fetchCalls = []
  const basicInfoData =
    await ApprovalWorkflowEditorIntegrationAdapter.resolveBasicInfoData({
      props: {
        basicInfoDataSourceApi: {
          method: 'get',
          url: '/api/dev/${appName}/business-model-helper/approval-workflow-fields',
          data: {
            formType: '${flowDefinition.form.formType}',
            formKey: '${flowDefinition.form.formId}',
            definitionId: '${flowDefinition.name}',
          },
          cache: 3000,
        },
      },
      data: {
        appName: 'crm',
        flowDefinition: {
          name: 'order-approval',
          form: {
            formType: 'business-model',
            formId: 'demo.order',
          },
        },
      },
      env: {
        fetcher: async (request) => {
          fetchCalls.push(request)
          return {
            status: 0,
            data: {
              boundFormSummary: '采购申请（demo.order）',
              boundForm: {
                formType: 'business-model',
                formKey: 'demo.order',
                formTitle: '采购申请',
              },
            },
          }
        },
      },
    })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/dev/crm/business-model-helper/approval-workflow-fields',
      data: {
        formType: 'business-model',
        formKey: 'demo.order',
        definitionId: 'order-approval',
      },
      cache: 3000,
    },
  ])
  assert.deepStrictEqual(basicInfoData, {
    boundFormSummary: '采购申请（demo.order）',
    boundForm: {
      formType: 'business-model',
      formKey: 'demo.order',
      formTitle: '采购申请',
    },
  })
})

test('integration adapter keeps bridge context focused on editor core data only', () => {
  const bridgeContext = ApprovalWorkflowEditorIntegrationAdapter.resolveCoreBridgeContext(
    {
      props: {
        env: {
          fetcher: async () => ({}),
        },
      },
      flowKey: 'order-approval',
      readonly: false,
      coreCapabilities: null,
      candidateSource: {
        revisionToken: 'candidate:1',
        items: [{ name: 'User', label: '用户', valueKey: 'users', configMode: 'Pick' }],
      },
      formPermissionFieldSource: {
        revisionToken: 'form-permission:1',
        fields: [{ label: '金额', value: 'amount' }],
      },
    }
  )

  assert.strictEqual(bridgeContext.flowKey, 'order-approval')
  assert.deepStrictEqual(bridgeContext.candidateSource, {
    revisionToken: 'candidate:1',
    items: [{ name: 'User', label: '用户', valueKey: 'users', configMode: 'Pick' }],
  })
  assert.deepStrictEqual(bridgeContext.formPermissionFieldSource, {
    revisionToken: 'form-permission:1',
    fields: [{ label: '金额', value: 'amount' }],
  })
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(bridgeContext, 'formKey'),
    false
  )
})
