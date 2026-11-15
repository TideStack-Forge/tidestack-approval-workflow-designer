import { unwrapFetcherResultData } from '../utils/fetcherResult'
import { containsTemplateExpression, resolveTemplateValue } from '../utils/template'
import { normalizeWorkflowConditionFieldSource } from './coreContract'

const EMPTY_WORKFLOW_CANDIDATE_SOURCE = Object.freeze({
  revisionToken: '__empty__',
  items: [],
})

const EMPTY_WORKFLOW_FORM_PERMISSION_FIELD_SOURCE = Object.freeze({
  revisionToken: '__empty__',
  fields: [],
})

const EMPTY_WORKFLOW_FORM_FIELD_SOURCE = Object.freeze({
  sourceKind: 'definition-bound-form',
  revisionToken: '__empty__',
  fields: [],
})

const isPlainObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const isWorkflowSourceApiRequest = (value) =>
  isPlainObject(value) &&
  (typeof value.url === 'string' ||
    typeof value.method === 'string' ||
    Object.prototype.hasOwnProperty.call(value, 'data'))

const normalizeCandidateItem = (item) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const normalizedName = item.name || item.value || item.key || null
  const normalizedLabel = item.label || item.title || normalizedName
  const normalizedValueKey = item.valueKey || normalizedName

  if (!normalizedName && !normalizedValueKey) {
    return null
  }

  return {
    ...item,
    name: normalizedName,
    label: normalizedLabel || normalizedName,
    valueKey: normalizedValueKey || normalizedName,
    items: Array.isArray(item.items) ? item.items : [],
    disabledIn: Array.isArray(item.disabledIn) ? item.disabledIn : [],
  }
}

export const normalizeWorkflowCandidateSource = (candidateSource) => {
  if (Array.isArray(candidateSource)) {
    const items = candidateSource.map(normalizeCandidateItem).filter(Boolean)
    return {
      revisionToken: `candidate:${items.length}`,
      items,
    }
  }

  if (!candidateSource || typeof candidateSource !== 'object') {
    return {
      ...EMPTY_WORKFLOW_CANDIDATE_SOURCE,
    }
  }

  const items = Array.isArray(candidateSource.items)
    ? candidateSource.items.map(normalizeCandidateItem).filter(Boolean)
    : []

  return {
    ...candidateSource,
    revisionToken:
      candidateSource.revisionToken || `candidate:${items.length}`,
    items,
  }
}

const attachCandidateItemSourceApis = ({
  candidateSource = null,
  sourceApi = null,
  data = null,
} = {}) => {
  if (!sourceApi || !isPlainObject(sourceApi)) {
    return candidateSource
  }

  if (isWorkflowSourceApiRequest(sourceApi)) {
    return candidateSource
  }

  const items = Array.isArray(candidateSource?.items)
    ? candidateSource.items.map((item) => {
        const templateData = {
          ...(data || {}),
          ...(item || {}),
          candidateName: item?.name,
          candidateType: item?.name,
        }

        return {
          ...item,
          itemsSourceApi: sourceApi.items
            ? resolveTemplateValue(sourceApi.items, templateData)
            : item?.itemsSourceApi,
          categorySourceApi: sourceApi.category
            ? resolveTemplateValue(sourceApi.category, templateData)
            : item?.categorySourceApi,
        }
      })
    : []

  return {
    ...candidateSource,
    items,
  }
}

const normalizePermissionField = (field) => {
  if (!field || typeof field !== 'object') {
    return null
  }

  const value = field.value || field.name || field.key || null
  const label = field.label || field.title || value

  if (!value) {
    return null
  }

  return {
    ...field,
    label,
    value,
  }
}

const normalizeDerivedPermissionField = (field) => {
  const permissionField = normalizePermissionField(field)
  if (!permissionField) {
    return null
  }
  const result = {
    label: permissionField.label,
    value: permissionField.value,
  }
  if (permissionField.title) {
    result.title = permissionField.title
  }
  if (permissionField.key) {
    result.key = permissionField.key
  }
  if (permissionField.usages) {
    result.usages = permissionField.usages
  }
  if (permissionField.extraProps) {
    result.extraProps = permissionField.extraProps
  }
  return {
    ...result,
  }
}

const CANDIDATE_FIELD_TYPES = new Set([
  '员工',
  '多员工',
])

const normalizeFormFieldUsage = (usage) =>
  typeof usage === 'string' ? usage.trim().toLowerCase() : ''

const hasFormFieldUsage = (field, usage) => {
  const normalizedUsage = normalizeFormFieldUsage(usage)
  return Array.isArray(field?.usages)
    ? field.usages.map(normalizeFormFieldUsage).includes(normalizedUsage)
    : false
}

const readFormFieldTypes = (field) =>
  [field?.type, field?.fieldType, field?.valueType]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

const isCandidateFormField = (field) => {
  if (hasFormFieldUsage(field, 'candidate')) {
    return true
  }

  if (field?.extraProps?.workflowCandidateField === true) {
    return true
  }

  return readFormFieldTypes(field).some((type) =>
    CANDIDATE_FIELD_TYPES.has(type.toLowerCase())
  )
}

const isConditionFormField = (field) => {
  if (hasFormFieldUsage(field, 'condition')) {
    return true
  }

  if (typeof field?.valueType === 'string' && field.valueType.trim()) {
    return true
  }

  const types = readFormFieldTypes(field).map((type) => type.toLowerCase())
  return types.length === 0 || types.some((type) =>
    ['text', 'string', 'number', 'integer', 'decimal', 'date', 'datetime', 'time', 'boolean', 'bool', 'enum', 'select'].includes(type)
  )
}

const isPermissionFormField = (field) =>
  hasFormFieldUsage(field, 'permission') ||
  !Array.isArray(field?.usages) ||
  field.usages.length === 0

const normalizeFormField = (field) => {
  if (!field || typeof field !== 'object') {
    return null
  }

  const value = field.value || field.name || field.key || null
  const label = field.label || field.title || value

  if (!value) {
    return null
  }

  return {
    ...field,
    name: field.name || value,
    label,
    value,
    type: field.type || field.fieldType || field.valueType || 'text',
  }
}

export const normalizeWorkflowFormFieldSource = (formFieldSource) => {
  if (Array.isArray(formFieldSource)) {
    const fields = formFieldSource.map(normalizeFormField).filter(Boolean)
    return {
      sourceKind: 'definition-bound-form',
      revisionToken: `form-fields:${fields.length}`,
      fields,
    }
  }

  if (!formFieldSource || typeof formFieldSource !== 'object') {
    return {
      ...EMPTY_WORKFLOW_FORM_FIELD_SOURCE,
    }
  }

  const fields = Array.isArray(formFieldSource.fields)
    ? formFieldSource.fields.map(normalizeFormField).filter(Boolean)
    : Array.isArray(formFieldSource.items)
      ? formFieldSource.items.map(normalizeFormField).filter(Boolean)
      : []

  return {
    ...formFieldSource,
    sourceKind: formFieldSource.sourceKind || 'definition-bound-form',
    revisionToken:
      formFieldSource.revisionToken ||
      `${formFieldSource.sourceKind || 'definition-bound-form'}:${fields.length}`,
    fields,
  }
}

export const deriveWorkflowFieldSources = (formFieldSource) => {
  const normalizedFormFieldSource = normalizeWorkflowFormFieldSource(formFieldSource)
  const conditionFields = normalizedFormFieldSource.fields.filter(isConditionFormField)
  const permissionFields = normalizedFormFieldSource.fields.filter(isPermissionFormField)
  const candidateFields = normalizedFormFieldSource.fields.filter(isCandidateFormField)

  return {
    formFieldSource: normalizedFormFieldSource,
    conditionFieldSource: normalizeWorkflowConditionFieldSource({
      ...normalizedFormFieldSource,
      fields: conditionFields,
    }),
    formPermissionFieldSource: {
      ...normalizedFormFieldSource,
      fields: permissionFields.map(normalizeDerivedPermissionField).filter(Boolean),
    },
    candidateFieldSource: {
      ...normalizedFormFieldSource,
      fields: candidateFields,
    },
  }
}

export const normalizeWorkflowFormPermissionFieldSource = (formPermissionFieldSource) => {
  if (Array.isArray(formPermissionFieldSource)) {
    const fields = formPermissionFieldSource.map(normalizePermissionField).filter(Boolean)
    return {
      revisionToken: `form-permission:${fields.length}`,
      fields,
    }
  }

  if (!formPermissionFieldSource || typeof formPermissionFieldSource !== 'object') {
    return {
      ...EMPTY_WORKFLOW_FORM_PERMISSION_FIELD_SOURCE,
    }
  }

  const fields = Array.isArray(formPermissionFieldSource.fields)
    ? formPermissionFieldSource.fields.map(normalizePermissionField).filter(Boolean)
    : Array.isArray(formPermissionFieldSource.items)
      ? formPermissionFieldSource.items.map(normalizePermissionField).filter(Boolean)
      : []

  return {
    ...formPermissionFieldSource,
    revisionToken:
      formPermissionFieldSource.revisionToken || `form-permission:${fields.length}`,
    fields,
  }
}

export const resolveWorkflowSourceApi = async ({
  env = null,
  sourceApi = null,
  data = null,
  normalize = (value) => value,
  emptyValue = null,
} = {}) => {
  if (!sourceApi) {
    return normalize(emptyValue)
  }

  const resolvedSourceApi = resolveTemplateValue(sourceApi, data || {})
  if (containsTemplateExpression(resolvedSourceApi)) {
    return normalize(emptyValue)
  }

  if (!env?.fetcher) {
    return normalize(emptyValue)
  }

  const result = await env.fetcher(resolvedSourceApi)
  const payload = unwrapFetcherResultData(result)
  return normalize(payload)
}

export const normalizeWorkflowConditionFieldSourceFromApi = async ({
  env = null,
  sourceApi = null,
  data = null,
} = {}) => {
  return resolveWorkflowSourceApi({
    env,
    sourceApi,
    data,
    normalize: (payload) => normalizeWorkflowConditionFieldSource(payload),
    emptyValue: null,
  })
}

export const normalizeWorkflowCandidateSourceFromApi = async ({
  env = null,
  sourceApi = null,
  data = null,
} = {}) => {
  const candidateListSourceApi =
    isWorkflowSourceApiRequest(sourceApi) ? sourceApi : sourceApi?.list || null
  const candidateSource = await resolveWorkflowSourceApi({
    env,
    sourceApi: candidateListSourceApi,
    data,
    normalize: (payload) => normalizeWorkflowCandidateSource(payload),
    emptyValue: null,
  })

  return attachCandidateItemSourceApis({
    candidateSource,
    sourceApi,
    data,
  })
}

export const normalizeWorkflowFormPermissionFieldSourceFromApi = async ({
  env = null,
  sourceApi = null,
  data = null,
} = {}) => {
  return resolveWorkflowSourceApi({
    env,
    sourceApi,
    data,
    normalize: (payload) => normalizeWorkflowFormPermissionFieldSource(payload),
    emptyValue: null,
  })
}

export const normalizeWorkflowFormFieldSourceFromApi = async ({
  env = null,
  sourceApi = null,
  data = null,
} = {}) => {
  return resolveWorkflowSourceApi({
    env,
    sourceApi,
    data,
    normalize: (payload) => normalizeWorkflowFormFieldSource(payload),
    emptyValue: null,
  })
}

export {
  EMPTY_WORKFLOW_CANDIDATE_SOURCE,
  EMPTY_WORKFLOW_FORM_PERMISSION_FIELD_SOURCE,
  EMPTY_WORKFLOW_FORM_FIELD_SOURCE,
}
