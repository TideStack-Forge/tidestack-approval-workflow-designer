import { normalizeWorkflowConditionFieldSource } from '../../../../editor-core/coreContract'
import { parseConditionToString } from '../../../../conditionEscape/index.js'
import { extractDrawerSubmitPayload } from './propertyEditorContracts.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const readEdgeCondition = (edge) => {
  if (edge?.data?.condition !== undefined) {
    return edge.data.condition
  }

  return edge?.condition ?? null
}

const projectConditionBuilderValue = (condition) => {
  const value = clone(condition)
  return value?.left && value?.op
    ? { conjunction: 'and', children: [value] }
    : value
}

const readEdgeOrder = (edge) => {
  if (edge?.data?.order !== undefined) {
    return edge.data.order
  }

  return edge?.order
}

export const summarizeCondition = (condition, conditionFields = []) => {
  if (!condition) {
    return '未设置条件'
  }

  if (typeof condition === 'string') {
    return condition
  }

  if (condition.expression) {
    return condition.expression
  }

  const summary = parseConditionToString(condition, conditionFields)
  if (summary?.conditionStr) {
    return summary.conditionStr
  }

  if (condition.conjunction && Array.isArray(condition.children)) {
    return `${condition.children.length} 个条件`
  }

  return JSON.stringify(condition)
}

export const buildRouteEdgeDrawerRequest = (edge, conditionFields = []) => {
  const normalizedConditionFields = normalizeWorkflowConditionFieldSource(conditionFields).fields

  return {
    title: `编辑路由条件 - ${edge?.id || edge?.source || '当前连线'}`,
    body: {
      type: 'form',
      mode: 'horizontal',
      wrapWithPanel: false,
      body: [
        {
          type: 'condition-builder',
          label: '条件表达式',
          name: 'condition',
          searchable: true,
          mode: 'normal',
          required: true,
          fields: clone(normalizedConditionFields),
          value: projectConditionBuilderValue(readEdgeCondition(edge)),
        },
      ],
    },
    size: 'lg',
    actions: [
      {
        type: 'button',
        actionType: 'cancel',
        label: '取消',
      },
      {
        type: 'button',
        actionType: 'confirm',
        label: '保存',
        primary: true,
      },
    ],
  }
}

export const normalizeRouteEdgePatch = (edge, submission) => {
  const payload = extractDrawerSubmitPayload(submission)
  if (!payload) {
    return null
  }

  return {
    name: undefined,
    condition: payload.condition,
    order: readEdgeOrder(edge),
  }
}

export const buildWorkflowEdgeInspectorSchemaKey = ({
  targetKind,
  isReadonly,
  conditionFieldSource,
  hasOrder,
} = {}) => {
  const normalizedFieldSource = normalizeWorkflowConditionFieldSource(conditionFieldSource)

  return JSON.stringify({
    targetKind: targetKind || 'edge:sequence',
    readonly: Boolean(isReadonly),
    conditionFieldRevisionToken: normalizedFieldSource.revisionToken,
    hasOrder: Boolean(hasOrder),
  })
}

export const buildWorkflowEdgeInspectorSchemaDescriptor = ({
  targetKind,
  isReadonly,
  conditionFieldSource,
  hasOrder,
} = {}) => {
  const normalizedFieldSource = normalizeWorkflowConditionFieldSource(conditionFieldSource)

  if (Boolean(isReadonly) || normalizedFieldSource.fields.length === 0) {
    return {
      schemaKey: buildWorkflowEdgeInspectorSchemaKey({
        targetKind,
        isReadonly,
        conditionFieldSource: normalizedFieldSource,
        hasOrder,
      }),
      schema: null,
      summaryOnly: true,
    }
  }

  const body = [
    {
      type: 'condition-builder',
      label: '条件表达式',
      name: 'condition',
      searchable: true,
      mode: 'normal',
      required: true,
      fields: clone(normalizedFieldSource.fields),
    },
  ]

  if (hasOrder) {
    body.push({
      type: 'input-text',
      label: '路由顺序',
      name: 'order',
      disabled: true,
    })
  }

  return {
    schemaKey: buildWorkflowEdgeInspectorSchemaKey({
      targetKind,
      isReadonly,
      conditionFieldSource: normalizedFieldSource,
      hasOrder,
    }),
    schema: {
      type: 'form',
      mode: 'horizontal',
      wrapWithPanel: false,
      body,
    },
    summaryOnly: false,
  }
}

export const buildWorkflowEdgeInspectorValueProjection = ({ edge, hasOrder } = {}) => {
  if (!edge?.id) {
    return null
  }

  const values = {
    condition: projectConditionBuilderValue(readEdgeCondition(edge)),
  }

  if (hasOrder) {
    values.order = readEdgeOrder(edge)
  }

  return {
    targetId: edge.id,
    values,
  }
}

export const buildWorkflowEdgeConditionPatch = ({ edge, submission } = {}) => {
  const payload = submission && typeof submission === 'object' ? submission : null
  if (!payload) {
    return null
  }

  return {
    name: undefined,
    condition: payload.condition ?? null,
    order: readEdgeOrder(edge),
  }
}
