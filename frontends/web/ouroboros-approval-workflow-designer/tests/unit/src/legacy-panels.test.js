const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})
const { nodeConfigForm } = require('../../../src/views/workflow/components/NodeConfigEditor/index.js')

const fetcher = async () => {
  return {
    data: {
      items: [],
    },
  }
}

const getFieldsetTitles = (form) => (form.body.body || []).map((item) => item && item.title).filter(Boolean)
const hasNestedField = (items, fieldName) => {
  return (items || []).some((item) => {
    if (item?.name === fieldName) {
      return true
    }
    if (Array.isArray(item?.body)) {
      return hasNestedField(item.body, fieldName)
    }
    return false
  })
}

test('subflow node panel is registered and renders', async () => {
  const subflowFormData = {
    id: 'subflow-1',
    type: '子流程节点',
    name: '子流程',
    subProcessId: '',
    inParameters: [],
    outParameters: [],
  }

  const subflowConfigForm = await nodeConfigForm({
    nodeType: '子流程节点',
    fetcher,
    isReadonly: false,
    formData: subflowFormData,
    nodeConfig: {},
    formType: 'default',
    formKey: '',
  })

  const titles = getFieldsetTitles(subflowConfigForm)
  assert.ok(
    titles.includes('选择流程节点配置') || hasNestedField(subflowConfigForm.body.body, 'subProcessId'),
    'Subflow panel should be registered and render its fieldset'
  )
})
