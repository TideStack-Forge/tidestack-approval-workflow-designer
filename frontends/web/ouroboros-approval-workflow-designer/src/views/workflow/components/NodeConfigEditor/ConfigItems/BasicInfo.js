import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../../../../../translator/define/persistedNodeTypes.js'

export function BasicInfo(fetcher, isReadonly, formData, context) {
  const nodeType = normalizePersistedNodeType(context?.nodeType || formData?.type)

  if (nodeType === PERSISTED_NODE_TYPES.START || nodeType === PERSISTED_NODE_TYPES.END) {
    return null
  }

  return {
    type: 'fieldSet',
    title: '基础信息',
    className: 'mb-4',
    collapsable: true,
    body: [
      {
        type: 'input-text',
        name: 'name',
        label: '节点名称',
        required: true,
        disabled: isReadonly,
        clearable: true,
      },
    ],
  }
}
