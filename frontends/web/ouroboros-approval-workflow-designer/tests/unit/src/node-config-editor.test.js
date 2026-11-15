const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})
const { nodeConfigForm } = require('../../../src/views/workflow/components/NodeConfigEditor/index.js')

const fetcher = async () => ({ data: { items: [] } })
const candidateSource = {
  revisionToken: 'candidate:3',
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
      valueKey: 'isChecked',
      disabledIn: ['会签'],
    },
    {
      name: 'User',
      label: '用户',
      configMode: 'SingleSelect',
      valueKey: 'value',
      items: [{ label: '张三', value: 'u1' }],
    },
  ],
}
const formPermissionFieldSource = {
  revisionToken: 'form-permission:1',
  fields: [{ label: '金额', value: 'amount' }],
}
const candidateFieldSource = {
  revisionToken: 'form-fields:manager',
  fields: [{ label: '直属主管', value: 'managerId' }],
}

const getFieldsetTitles = (form) => (form.body.body || []).map((item) => item && item.title).filter(Boolean)
const getFieldsetByTitle = (form, title) => (form.body.body || []).find((item) => item?.title === title)

test('node config editor builds expected fieldsets and candidate interactions', async () => {
  const hiddenPermissionForm = await nodeConfigForm({
    nodeType: 'StartNode',
    fetcher,
    isReadonly: false,
    formData: {},
    nodeConfig: { hideFormPermission: true },
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(hiddenPermissionForm), [])

  const visiblePermissionForm = await nodeConfigForm({
    nodeType: 'StartNode',
    fetcher,
    isReadonly: false,
    formData: {},
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(visiblePermissionForm), [])
  assert.deepEqual(visiblePermissionForm.body.body, [])

  const approvalFormData = {
    id: 'approve-a',
    type: 'ApprovalNode',
    name: '经理审批',
    subType: '单签',
    candidates: [],
    reAssignUsers: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: 'ApprovalNode',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(approvalConfigForm), ['基础信息', '人员配置', '审批配置', '表单权限配置'])
  assert.deepEqual(approvalFormData.candidates, [])
  assert.equal(approvalConfigForm.body.data, undefined)

  const basicInfoFieldset = getFieldsetByTitle(approvalConfigForm, '基础信息')
  assert.equal(basicInfoFieldset.body[0].name, 'name')
  assert.equal(basicInfoFieldset.body[0].label, '节点名称')

  const candidateFieldset = getFieldsetByTitle(approvalConfigForm, '人员配置')
  const candidateTypeControl = candidateFieldset.body[0].items[0]

  assert.deepEqual(candidateTypeControl.onEvent.changeSubType.actions, [
    {
      actionType: 'setValue',
      args: {
        value: '',
      },
      expression: "${subType === '会签' && ['Starter'].includes(type)}",
    },
  ])
})

test('node config editor exposes candidates and form permission for handle nodes only', async () => {
  const handleConfigForm = await nodeConfigForm({
    nodeType: 'HandleNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'handle-a',
      type: 'HandleNode',
      name: '办理节点',
      candidates: [],
      permission: [],
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(handleConfigForm), ['基础信息', '人员配置', '表单权限配置'])
  assert.equal(getFieldsetByTitle(handleConfigForm, '审批配置'), undefined)
})

test('node config editor exposes candidate selectors for cc nodes', async () => {
  const ccConfigForm = await nodeConfigForm({
    nodeType: 'CcNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'cc-a',
      type: 'CcNode',
      name: '抄送节点',
      candidates: [],
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(ccConfigForm), ['基础信息', '抄送人员'])
  const basicInfoFieldset = getFieldsetByTitle(ccConfigForm, '基础信息')
  const candidateFieldset = getFieldsetByTitle(ccConfigForm, '抄送人员')
  const candidateCombo = candidateFieldset.body[0]
  const candidateItems = candidateCombo.items

  assert.equal(basicInfoFieldset.body[0].name, 'name')
  assert.deepEqual(
    candidateItems[0].options.map((item) => item.name),
    ['UserSelect', 'Starter', 'User']
  )
  assert.equal(candidateItems.find((item) => item?.name === 'value')?.visibleOn, "${type === 'User'}")
})

test('node config editor fixes start node name as read-only in basic info', async () => {
  const startNodeForm = await nodeConfigForm({
    nodeType: 'StartNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'start-1',
      type: 'StartNode',
      name: '发起节点',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.ok(startNodeForm)
  assert.deepEqual(getFieldsetTitles(startNodeForm), [])
})

test('node config editor never exposes start node form permission in designer', async () => {
  const defaultStartNodeForm = await nodeConfigForm({
    nodeType: 'StartNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'start-1',
      type: 'StartNode',
      name: '发起节点',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
    formType: 'default',
  })

  assert.deepEqual(defaultStartNodeForm.body.body, [])

  const businessModelStartNodeForm = await nodeConfigForm({
    nodeType: 'StartNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'start-1',
      type: 'StartNode',
      name: '发起节点',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
    formType: 'business-model',
  })

  assert.deepEqual(businessModelStartNodeForm.body.body, [])
})

test('approval config hides reassignment mode when user selector source is unavailable', async () => {
  const approvalConfigForm = await nodeConfigForm({
    nodeType: 'ApprovalNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'approve-a',
      type: 'ApprovalNode',
      name: '经理审批',
      subType: '单签',
      candidates: [],
      reAssignUsers: [],
    },
    nodeConfig: {},
    candidateSource: {
      revisionToken: 'candidate:without-user',
      items: candidateSource.items.filter((item) => item.name !== 'User'),
    },
    formPermissionFieldSource,
  })

  const approvalFieldset = getFieldsetByTitle(approvalConfigForm, '审批配置')
  const approvalControls = approvalFieldset.body[0].body
  const noCandidateModeControl = approvalControls.find((item) => item?.name === 'noCandidateMode')
  const reAssignUsersControl = approvalControls.find((item) => item?.name === 'reAssignUsers')

  assert.deepEqual(
    noCandidateModeControl.options.map((item) => item.value),
    ['approved', 'rejected']
  )
  assert.equal(reAssignUsersControl, null)
})

test('node config editor injects explicit candidate source apis into schema-first selectors and keeps reassignment reuse', async () => {
  const schemaDrivenCandidateSource = {
    revisionToken: 'candidate:schema-driven',
    items: [
      {
        name: 'UserSelect',
        label: '用户自选',
        valueKey: 'mode',
        schema: {
          type: 'list-select',
          name: 'mode',
          label: '请选择用户自选',
          options: [
            { label: '单人', value: 'single' },
            { label: '多人', value: 'multiple' },
          ],
        },
      },
      {
        name: 'Starter',
        label: '流程发起人',
        valueKey: 'isChecked',
        disabledIn: ['会签'],
        schema: {
          type: 'hidden',
          name: 'isChecked',
          value: true,
        },
      },
      {
        name: 'User',
        label: '用户',
        valueKey: 'users',
        schema: {
          type: 'dynamic-tree-transfer-picker',
          name: 'users',
          label: '请选择用户',
          mode: 'normal',
          required: true,
          validateOnChange: true,
        },
        itemsSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/items',
        },
        categorySourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/category',
        },
      },
    ],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: 'ApprovalNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'approve-schema-a',
      type: 'ApprovalNode',
      name: '经理审批',
      subType: '单签',
      candidates: [],
      reAssignUsers: [],
    },
    nodeConfig: {},
    candidateSource: schemaDrivenCandidateSource,
    formPermissionFieldSource,
  })

  const candidateFieldset = getFieldsetByTitle(approvalConfigForm, '人员配置')
  const candidateItems = candidateFieldset.body[0].items
  const userSelector = candidateItems.find((item) => item?.name === 'users')

  assert.equal(userSelector.type, 'dynamic-tree-transfer-picker')
  assert.deepEqual(userSelector.leftTreeSource, {
    method: 'get',
    url: '/api/approval-workflow/candidate/User/category',
  })
  assert.deepEqual(userSelector.selectItemSource, {
    method: 'get',
    url: '/api/approval-workflow/candidate/User/items',
  })
  assert.equal(userSelector.visibleOn, '${ type ==="User" }')
  assert.equal(userSelector.clearValueOnHidden, true)

  const approvalFieldset = getFieldsetByTitle(approvalConfigForm, '审批配置')
  const approvalControls = approvalFieldset.body[0].body
  const noCandidateModeControl = approvalControls.find((item) => item?.name === 'noCandidateMode')
  const reAssignUsersControl = approvalControls.find((item) => item?.name === 'reAssignUsers')

  assert.deepEqual(
    noCandidateModeControl.options.map((item) => item.value),
    ['approved', 'rejected', 'reAssignUser']
  )
  assert.equal(reAssignUsersControl.type, 'dynamic-tree-transfer-picker')
  assert.deepEqual(reAssignUsersControl.leftTreeSource, {
    method: 'get',
    url: '/api/approval-workflow/candidate/User/category',
  })
  assert.deepEqual(reAssignUsersControl.selectItemSource, {
    method: 'get',
    url: '/api/approval-workflow/candidate/User/items',
  })
  assert.equal(reAssignUsersControl.clearValueOnHidden, true)
})

test('node config editor renders FormField candidate selector from candidate field source', async () => {
  const formFieldCandidateSource = {
    revisionToken: 'candidate:form-field',
    items: [
      {
        name: 'FormField',
        label: '表单字段',
        valueKey: 'field',
        schema: {
          type: 'select',
          name: 'field',
          label: '请选择处理人字段',
          source: '$candidateFieldSource.fields',
          labelField: 'label',
          valueField: 'value',
        },
      },
      {
        name: 'Starter',
        label: '流程发起人',
        configMode: 'Check',
        valueKey: 'isChecked',
      },
    ],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: 'ApprovalNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'approve-form-field-a',
      type: 'ApprovalNode',
      name: '经理审批',
      subType: '单签',
      candidates: [],
    },
    nodeConfig: {},
    candidateSource: formFieldCandidateSource,
    formPermissionFieldSource,
    candidateFieldSource,
  })

  const candidateFieldset = getFieldsetByTitle(approvalConfigForm, '人员配置')
  const candidateItems = candidateFieldset.body[0].items
  const typeControl = candidateItems.find((item) => item?.name === 'type')
  const fieldSelector = candidateItems.find((item) => item?.name === 'field')

  assert.deepEqual(
    typeControl.options.map((item) => item.name),
    ['FormField', 'Starter']
  )
  assert.equal(fieldSelector.type, 'select')
  assert.equal(fieldSelector.visibleOn, '${ type ==="FormField" }')
  assert.deepEqual(fieldSelector.options, [{ label: '直属主管', value: 'managerId' }])
  assert.equal(fieldSelector.source, undefined)
})

test('node config editor does not expose synthetic basic info for join nodes', async () => {
  const joinNodeForm = await nodeConfigForm({
    nodeType: 'JoinNode',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'join-1',
      type: 'JoinNode',
      name: '合并',
      joinType: 'OR',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.ok(joinNodeForm)
  assert.deepEqual(getFieldsetTitles(joinNodeForm), [])
  assert.deepEqual(joinNodeForm.body.body, [
    {
      type: 'input-text',
      name: 'name',
      label: '节点名称',
      required: true,
      disabled: false,
      clearable: true,
    },
  ])
})

test('node config editor tolerates unknown node type without throwing', async () => {
  const unknownNodeForm = await nodeConfigForm({
    nodeType: '未知节点',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'unknown-1',
      type: '未知节点',
      name: '未知节点',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.ok(unknownNodeForm)
  assert.deepEqual(unknownNodeForm.body.body, [])
})

test('node config editor normalizes legacy chinese node labels to canonical property sections', async () => {
  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'approve-legacy-a',
      type: '审批节点',
      name: '经理审批',
      subType: '单签',
      candidates: [],
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.deepEqual(getFieldsetTitles(approvalConfigForm), ['基础信息', '人员配置', '审批配置', '表单权限配置'])
})

test('node config editor hides legacy node types unless explicitly enabled', async () => {
  const timerNodeForm = await nodeConfigForm({
    nodeType: '结束节点',
    fetcher,
    isReadonly: false,
    formData: {
      id: 'timer-1',
      type: '结束节点',
      name: '结束节点',
    },
    nodeConfig: {},
    candidateSource,
    formPermissionFieldSource,
  })

  assert.ok(timerNodeForm)
  assert.deepEqual(timerNodeForm.body.body, [])
})
