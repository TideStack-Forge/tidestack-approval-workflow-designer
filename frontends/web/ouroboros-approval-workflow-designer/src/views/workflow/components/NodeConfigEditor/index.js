import {
  Approval,
  BasicInfo,
  Candidates,
  Condition,
  Fork,
  FormPermission,
  Subflow,
} from './ConfigItems'
import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../../../../translator/define/persistedNodeTypes.js'

const STABLE_NODE_COMPONENTS_MAP = {
  [PERSISTED_NODE_TYPES.START]: [],
  [PERSISTED_NODE_TYPES.APPROVAL]: [BasicInfo, Candidates, Approval, FormPermission],
  [PERSISTED_NODE_TYPES.HANDLE]: [BasicInfo, Candidates, FormPermission],
  [PERSISTED_NODE_TYPES.CC]: [BasicInfo, Candidates],
  [PERSISTED_NODE_TYPES.SUBFLOW]: [BasicInfo, Subflow],
  [PERSISTED_NODE_TYPES.JOIN]: [BasicInfo],
}

const HIDDEN_LEGACY_NODE_COMPONENTS_MAP = {
  分流节点: [BasicInfo, Fork],
  条件节点: [BasicInfo, Condition],
}

const normalizeNodeConfigType = (nodeType) => normalizePersistedNodeType(nodeType) || nodeType

function updateMapBasedOnConfig(config) {
  const baseComponentsMap = config?.allowLegacyNodeConfigSurface
    ? {
        ...STABLE_NODE_COMPONENTS_MAP,
        ...HIDDEN_LEGACY_NODE_COMPONENTS_MAP,
      }
    : STABLE_NODE_COMPONENTS_MAP
  const computedComponentsMap = Object.fromEntries(
    Object.entries(baseComponentsMap).map(([nodeType, components]) => [nodeType, [...components]])
  )

  if (!config?.hideFormPermission) {
    return computedComponentsMap
  }

  Object.keys(computedComponentsMap).forEach((nodeType) => {
    computedComponentsMap[nodeType] = computedComponentsMap[nodeType].filter(
      (component) => component !== FormPermission
    )
  })

  return computedComponentsMap
}

async function renderNodeProperties({
  nodeType,
  fetcher,
  isReadonly,
  formData,
  nodeConfig = {},
  conditionFields = [],
  candidateSource = null,
  formPermissionFieldSource = null,
  candidateFieldSource = null,
  formType = null,
}) {
  const normalizedNodeType = normalizeNodeConfigType(nodeType)
  const computedComponentsMap = updateMapBasedOnConfig(nodeConfig)
  const context = {}
  context.conditionFields = conditionFields
  context.nodeConfig = nodeConfig
  context.nodeType = normalizedNodeType
  context.formType = formType
  context.candidateSource = candidateSource
  context.formPermissionFieldSource = formPermissionFieldSource
  context.candidateFieldSource = candidateFieldSource
  const nodeProperties = []
  const components = computedComponentsMap[normalizedNodeType] || []

  if (!components.length) {
    return nodeProperties
  }

  for (let i = 0; i < components.length; i++) {
    const component = components[i]
    let propertySchema
    if (typeof component === 'function') {
      propertySchema = await component(fetcher, isReadonly, formData, context)
    } else {
      propertySchema = component
    }

    if (propertySchema) {
      nodeProperties.push(propertySchema)
    }
  }

  if (!nodeProperties.length) return []
  return nodeProperties
}

function normalizeRenderedNodeProperties(nodeProperties) {
  if (nodeProperties.length !== 1) {
    return nodeProperties
  }

  const [singleProperty] = nodeProperties
  if (singleProperty?.type !== 'fieldSet') {
    return nodeProperties
  }

  return Array.isArray(singleProperty.body)
    ? singleProperty.body
    : singleProperty.body
      ? [singleProperty.body]
      : []
}

export async function nodeConfigForm({
  nodeType,
  fetcher,
  isReadonly,
  formData,
  nodeConfig = {},
  conditionFields = [],
  candidateSource = null,
  formPermissionFieldSource = null,
  candidateFieldSource = null,
  formType = null,
}) {
  const form = {
    title: '审批流节点信息配置',
    body: {
      type: 'form',
      name: 'property',
      mode: 'horizontal',
      title: '',
      static: isReadonly,
      wrapWithPanel: false, // 去除表单边框
      body: normalizeRenderedNodeProperties(
        await renderNodeProperties({
          nodeType,
          fetcher,
          isReadonly,
          formData,
          nodeConfig,
          conditionFields,
          candidateSource,
          formPermissionFieldSource,
          candidateFieldSource,
          formType,
        })
      ),
    },
    resizable: true,
    actions: [
      {
        type: 'button',
        actionType: 'close',
        label: '取消',
      },
      {
        type: 'button',
        actionType: 'confirm',
        label: '修改配置',
        primary: true,
        disabledOn: "${mode === 'preview'}",
      },
    ],
  }
  return form
}
