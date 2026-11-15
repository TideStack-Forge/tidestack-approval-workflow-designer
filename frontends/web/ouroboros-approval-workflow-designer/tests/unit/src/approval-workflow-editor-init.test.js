const assert = require('assert')
const Module = require('module')
const path = require('path')

require.extensions['.css'] = () => null
require.extensions['.scss'] = () => null

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}

require('@babel/register')({
  extensions: ['.js', '.jsx'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  presets: ['@babel/preset-react'],
})

const {
  ApprovalWorkFlowEditor,
} = require('../../../src/editor-core/ApprovalWorkFlowEditor.jsx')
const {
  EditorSession,
} = require('../../../src/editor-session/index.js')
const {
  v2DefinitionFixture,
} = require('../../integration/workflow/harness/fixtures.js')

const cloneFixture = (fixture) => JSON.parse(JSON.stringify(fixture))

const createMountedEditor = (props) => {
  const editor = new ApprovalWorkFlowEditor(props)
  editor.setState = (nextState, callback) => {
    const resolvedState =
      typeof nextState === 'function' ? nextState(editor.state, editor.props) : nextState
    editor.state = {
      ...editor.state,
      ...resolvedState,
    }
    callback?.()
  }
  return editor
}

test('initFlowDefinition still synchronizes external sources when preloaded value already matches the loaded definition', async () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'
  definition.formType = 'business-model'
  definition.formKey = 'a'

  const editor = createMountedEditor({
    value: cloneFixture(definition),
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      notify() {},
    },
    onChange() {},
  })

  editor.generateFlowDefinition = async () => cloneFixture(definition)

  let syncCalls = 0
  editor.syncExternalSources = async () => {
    syncCalls += 1
  }

  await editor.initFlowDefinition()

  assert.strictEqual(syncCalls, 1)
  assert.ok(editor.state.session, 'session should still be hydrated from the loaded definition')
  assert.strictEqual(editor.state.value.form.formId, 'a')
  assert.strictEqual(editor.state.sourceFormatVersion, 2)
})

test('initFlowDefinition synchronizes external sources with the freshly loaded definition', async () => {
  const staleDefinition = cloneFixture(v2DefinitionFixture)
  staleDefinition.id = 'approval_accept_20260609_d1'
  staleDefinition.formType = 'business-model'
  staleDefinition.formKey = 'demo.order'

  const nextDefinition = cloneFixture(staleDefinition)
  nextDefinition.formKey = 'demo.invoice'

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
  const fetchCalls = []

  const editor = createMountedEditor({
    value: cloneFixture(staleDefinition),
    formFieldSourceApi: sourceApi,
    data: {
      id: staleDefinition.id,
      flowKey: staleDefinition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      async fetcher(request) {
        fetchCalls.push(request)
        return {
          status: 0,
          data: {
            sourceKind: 'form-fields',
            revisionToken: 'form-fields:demo.invoice:1',
            fields: [{ name: 'invoiceAmount', label: '发票金额', type: 'number' }],
          },
        }
      },
      notify() {},
    },
    onChange() {},
  })

  editor.coreRef.current = {
    readDefinition: () => cloneFixture(staleDefinition),
  }
  editor.generateFlowDefinition = async () => cloneFixture(nextDefinition)

  await editor.initFlowDefinition()

  assert.deepStrictEqual(fetchCalls.map((request) => request?.data?.formKey), ['demo.invoice'])
  assert.strictEqual(editor.state.value.form.formId, 'demo.invoice')
})

test('buildExternalSourceResolveData keeps persisted definition meta when core definition is temporarily partial', () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'
  definition.formType = 'business-model'
  definition.formKey = 'a'

  const editor = createMountedEditor({
    value: cloneFixture(definition),
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      notify() {},
    },
    onChange() {},
  })

  const resolveData = editor.buildExternalSourceResolveData({
    id: '',
    name: definition.name,
    formType: undefined,
    formKey: undefined,
    nodes: definition.nodes,
    edges: definition.edges,
  })

  assert.strictEqual(resolveData.flowDefinition.id, definition.id)
  assert.strictEqual(resolveData.flowDefinition.form.formType, 'business-model')
  assert.strictEqual(resolveData.flowDefinition.form.formId, 'a')
  assert.strictEqual(resolveData.flowDefinition.formType, 'business-model')
  assert.strictEqual(resolveData.flowDefinition.formKey, 'a')
  assert.strictEqual(resolveData.formType, 'business-model')
  assert.strictEqual(resolveData.formKey, 'a')
})

test('AMIS static mode drives the editor readonly state', () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'

  const editor = createMountedEditor({
    value: cloneFixture(definition),
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      notify() {},
    },
    onChange() {},
  })

  assert.strictEqual(editor.isReadonly(), false)
  assert.strictEqual(editor.isReadonly({ ...editor.props, static: true }), true)
  assert.strictEqual(editor.isReadonly({ ...editor.props, data: { mode: 'preview' } }), true)
  assert.strictEqual(
    editor.shouldComponentUpdate({ ...editor.props, static: true }, editor.state),
    true
  )
})

test('syncExternalSources keeps the latest field source when older requests resolve later', async () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'
  definition.formType = 'business-model'
  definition.formKey = 'demo.order'

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

  const fetchCalls = []
  const buildFieldsResponse = (formKey, fields, formTitle) => ({
    status: 0,
    data: {
      sourceKind: 'form-fields',
      revisionToken: `form-fields:${formKey}:${fields.length}`,
      fields,
      boundForm: {
        formType: 'business-model',
        formKey,
        formTitle,
      },
      boundFormSummary: `${formTitle}（${formKey}）`,
    },
  })

  const editor = createMountedEditor({
    value: cloneFixture(definition),
    conditionFieldSourceApi: sourceApi,
    formPermissionFieldSourceApi: sourceApi,
    basicInfoDataSourceApi: sourceApi,
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      async fetcher(request) {
        fetchCalls.push(request)
        const formKey = request?.data?.formKey
        const waitMs = formKey === 'demo.order' ? 80 : 5
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        if (formKey === 'demo.invoice') {
          return buildFieldsResponse(
            formKey,
            [
              { name: 'invoiceAmount', label: '发票金额', value: 'invoiceAmount', type: 'number' },
              { name: 'invoiceDepartment', label: '开票部门', value: 'invoiceDepartment', type: 'text' },
            ],
            '发票'
          )
        }
        return buildFieldsResponse(
          formKey,
          [
            { name: 'amount', label: '金额', value: 'amount', type: 'number' },
            { name: 'department', label: '申请部门', value: 'department', type: 'text' },
          ],
          '订单'
        )
      },
      notify() {},
    },
    onChange() {},
  })

  const session = EditorSession.createFromDefinition(cloneFixture(definition))
  editor.state.session = session
  editor.state.value = session.getDefinition()
  editor.state.sourceFormatVersion = session.getSourceFormatVersion()

  const staleSyncPromise = editor.syncExternalSources()
  session.updateWorkflowMeta({ formKey: 'demo.invoice' }, { recordHistory: false })
  editor.state.value = session.getDefinition()
  const latestSyncPromise = editor.syncExternalSources()

  await Promise.all([staleSyncPromise, latestSyncPromise])

  assert.deepStrictEqual(
    editor.state.formPermissionFieldSource.fields.map((field) => field.value),
    ['invoiceAmount', 'invoiceDepartment']
  )
  assert.deepStrictEqual(
    editor.state.conditionFieldSource.fields.map((field) => field.value),
    ['invoiceAmount', 'invoiceDepartment']
  )
  assert.strictEqual(editor.state.basicInfoData?.boundForm?.formKey, 'demo.invoice')
  assert(fetchCalls.some((request) => request?.data?.formKey === 'demo.order'))
  assert(fetchCalls.some((request) => request?.data?.formKey === 'demo.invoice'))
})

test('syncExternalSources clears stale field source when the latest binding refresh fails', async () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'
  definition.formType = 'business-model'
  definition.formKey = 'demo.order'

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

  const fetchCalls = []
  const notifications = []
  const buildFieldsResponse = (formKey, fields, formTitle) => ({
    status: 0,
    data: {
      sourceKind: 'form-fields',
      revisionToken: `form-fields:${formKey}:${fields.length}`,
      fields,
      boundForm: {
        formType: 'business-model',
        formKey,
        formTitle,
      },
      boundFormSummary: `${formTitle}（${formKey}）`,
    },
  })

  const editor = createMountedEditor({
    value: cloneFixture(definition),
    conditionFieldSourceApi: sourceApi,
    formPermissionFieldSourceApi: sourceApi,
    basicInfoDataSourceApi: sourceApi,
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      async fetcher(request) {
        fetchCalls.push(request)
        const formKey = request?.data?.formKey
        if (formKey === 'demo.invoice') {
          throw new Error('field source unavailable')
        }
        return buildFieldsResponse(
          formKey,
          [
            { name: 'amount', label: '金额', value: 'amount', type: 'number' },
            { name: 'department', label: '申请部门', value: 'department', type: 'text' },
          ],
          '订单'
        )
      },
      notify(type, message) {
        notifications.push({ type, message })
      },
    },
    onChange() {},
  })

  const session = EditorSession.createFromDefinition(cloneFixture(definition))
  editor.state.session = session
  editor.state.value = session.getDefinition()
  editor.state.sourceFormatVersion = session.getSourceFormatVersion()

  await editor.syncExternalSources()
  assert.deepStrictEqual(
    editor.state.formPermissionFieldSource.fields.map((field) => field.value),
    ['amount', 'department']
  )
  assert.strictEqual(editor.state.basicInfoData?.boundForm?.formKey, 'demo.order')

  session.updateWorkflowMeta({ formKey: 'demo.invoice' }, { recordHistory: false })
  editor.state.value = session.getDefinition()

  await editor.syncExternalSources()

  assert.deepStrictEqual(editor.state.formPermissionFieldSource.fields, [])
  assert.deepStrictEqual(editor.state.conditionFieldSource.fields, [])
  assert.deepStrictEqual(editor.state.basicInfoData, {})
  assert.deepStrictEqual(notifications, [
    {
      type: 'warning',
      message: '审批流外部数据源加载失败，已使用空数据源刷新',
    },
  ])
  assert(fetchCalls.some((request) => request?.data?.formKey === 'demo.order'))
  assert(fetchCalls.some((request) => request?.data?.formKey === 'demo.invoice'))
})

test('handleBasicInfoSubmit refreshes field sources from the selected business model', async () => {
  const definition = cloneFixture(v2DefinitionFixture)
  definition.id = 'approval_accept_20260609_d1'
  definition.formType = 'business-model'
  definition.formKey = 'a'

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

  const fetchCalls = []
  const editor = createMountedEditor({
    value: cloneFixture(definition),
    conditionFieldSourceApi: sourceApi,
    formPermissionFieldSourceApi: sourceApi,
    basicInfoDataSourceApi: sourceApi,
    data: {
      id: definition.id,
      flowKey: definition.id,
      appName: 'logicflowsmoke',
    },
    env: {
      async fetcher(request) {
        fetchCalls.push(request)
        const formKey = request?.data?.formKey
        const fields =
          formKey === 'qaApprovalFieldSource'
            ? [
                { name: 'qaId', label: 'QA ID', value: 'qaId', type: 'text' },
                { name: 'qaName', label: 'QA姓名', value: 'qaName', type: 'text' },
                { name: 'qaStatus', label: 'QA状态', value: 'qaStatus', type: 'text' },
              ]
            : [
                { name: 'id', label: 'ID', value: 'id', type: 'text' },
                { name: 'name', label: '姓名', value: 'name', type: 'text' },
              ]

        return {
          status: 0,
          data: {
            sourceKind: 'form-fields',
            revisionToken: `form-fields:${formKey}:${fields.length}`,
            fields,
            boundForm: {
              formType: 'business-model',
              formKey,
              formTitle: formKey === 'qaApprovalFieldSource' ? 'QA审批字段源' : '默认模型',
            },
            boundFormSummary:
              formKey === 'qaApprovalFieldSource'
                ? 'QA审批字段源（qaApprovalFieldSource）'
                : `默认模型（${formKey}）`,
          },
        }
      },
      notify() {},
    },
    onChange() {},
  })

  const session = EditorSession.createFromDefinition(cloneFixture(definition))
  editor.state.session = session
  editor.state.value = session.getDefinition()
  editor.state.sourceFormatVersion = session.getSourceFormatVersion()

  const staleDefinition = cloneFixture(session.getDefinition())
  editor.coreRef.current = {
    session,
    readDefinition: () => staleDefinition,
  }

  const submitted = editor.handleBasicInfoSubmit({
    ...session.getDefinition(),
    formKey: {
      fullName: 'qaApprovalFieldSource',
      title: 'QA审批字段源',
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.strictEqual(submitted, true)
  assert.strictEqual(session.getDefinition().formKey, 'qaApprovalFieldSource')
  assert(fetchCalls.some((request) => request?.data?.formKey === 'qaApprovalFieldSource'))
  assert.deepStrictEqual(
    editor.state.formPermissionFieldSource.fields.map((field) => field.label),
    ['QA ID', 'QA姓名', 'QA状态']
  )
  assert.deepStrictEqual(
    editor.state.conditionFieldSource.fields.map((field) => field.label),
    ['QA ID', 'QA姓名', 'QA状态']
  )
  assert.strictEqual(editor.state.basicInfoData?.boundForm?.formKey, 'qaApprovalFieldSource')
})
