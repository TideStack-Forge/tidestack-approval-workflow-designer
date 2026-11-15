const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})
const { nodeConfigForm } = require('../../../src/views/workflow/components/NodeConfigEditor/index.js')

const fetcher = async (request) => {
  if (request && typeof request === 'object' && request.url === '/api/approval-workflow/candidate') {
    return {
      data: {
        items: [
          {
            name: 'User',
            label: '用户',
            configMode: 'SingleSelect',
            valueKey: 'value',
            items: [{ label: '张三', value: 'u1' }],
          },
        ],
      },
    }
  }

  return {
    data: {
      items: [],
    },
  }
}

const findFieldByName = (form, fieldName) => {
  const findInBody = (body) => {
    if (!body) return null
    if (Array.isArray(body)) {
      for (const item of body) {
        const found = findInBody(item)
        if (found) return found
      }
    } else if (typeof body === 'object') {
      if (body.name === fieldName) return body
      if (body.body) return findInBody(body.body)
      if (body.items) return findInBody(body.items)
    }
    return null
  }
  return findInBody(form.body.body)
}

test('approval panel exposes transfer action option', async () => {
  const approvalFormData = {
    id: 'approve-1',
    type: '审批节点',
    name: '审批',
    subType: '单签',
    candidates: [],
    actions: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const actionsField = findFieldByName(approvalConfigForm, 'actions')
  assert.ok(actionsField, 'actions field should exist')
  
  const transferOption = actionsField.options.find(opt => opt.value === 'transfer')
  assert.ok(transferOption, 'transfer action should be available as an option')
  assert.strictEqual(transferOption.label, '转办', 'transfer action label should be 转办')
})

test('approval panel exposes addSign action option', async () => {
  const approvalFormData = {
    id: 'approve-1',
    type: '审批节点',
    name: '审批',
    subType: '单签',
    candidates: [],
    actions: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const actionsField = findFieldByName(approvalConfigForm, 'actions')
  assert.ok(actionsField, 'actions field should exist')
  
  const addSignOption = actionsField.options.find(opt => opt.value === 'addSign')
  assert.ok(addSignOption, 'addSign action should be available as an option')
  assert.strictEqual(addSignOption.label, '加签', 'addSign action label should be 加签')
})

test('approval panel exposes freeReject action option', async () => {
  const approvalFormData = {
    id: 'approve-1',
    type: '审批节点',
    name: '审批',
    subType: '单签',
    candidates: [],
    actions: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const actionsField = findFieldByName(approvalConfigForm, 'actions')
  assert.ok(actionsField, 'actions field should exist')
  
  const freeRejectOption = actionsField.options.find(opt => opt.value === 'freeReject')
  assert.ok(freeRejectOption, 'freeReject action should be available as an option')
  assert.strictEqual(freeRejectOption.label, '自由驳回', 'freeReject action label should be 自由驳回')
})

test('approval panel exposes freeApproval action option', async () => {
  const approvalFormData = {
    id: 'approve-1',
    type: '审批节点',
    name: '审批',
    subType: '单签',
    candidates: [],
    actions: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const actionsField = findFieldByName(approvalConfigForm, 'actions')
  assert.ok(actionsField, 'actions field should exist')
  
  const freeApprovalOption = actionsField.options.find(opt => opt.value === 'freeApproval')
  assert.ok(freeApprovalOption, 'freeApproval action should be available as an option')
  assert.strictEqual(freeApprovalOption.label, '自由审批', 'freeApproval action label should be 自由审批')
})

test('approval panel includes all 6 action options', async () => {
  const approvalFormData = {
    id: 'approve-1',
    type: '审批节点',
    name: '审批',
    subType: '单签',
    candidates: [],
    actions: [],
  }

  const approvalConfigForm = await nodeConfigForm({
    nodeType: '审批节点',
    fetcher,
    isReadonly: false,
    formData: approvalFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const actionsField = findFieldByName(approvalConfigForm, 'actions')
  assert.ok(actionsField, 'actions field should exist')
  
  const expectedActions = ['rollback', 'reject', 'transfer', 'addSign', 'freeReject', 'freeApproval']
  const actualActionValues = actionsField.options.map(opt => opt.value)
  
  expectedActions.forEach(action => {
    assert.ok(
      actualActionValues.includes(action),
      `actions should include ${action}, but got: ${actualActionValues.join(', ')}`
    )
  })
  
  assert.strictEqual(
    actionsField.options.length,
    6,
    `actions should have exactly 6 options, but got ${actionsField.options.length}`
  )
})
