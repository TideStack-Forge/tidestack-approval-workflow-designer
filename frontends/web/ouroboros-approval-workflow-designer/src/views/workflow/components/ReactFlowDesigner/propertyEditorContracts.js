import { nodeConfigForm } from '../NodeConfigEditor/index.js'
import { normalizeWorkflowConditionFieldSource } from '../../../../editor-core/coreContract'
import {
  normalizeWorkflowCandidateSource,
  normalizeWorkflowFormFieldSource,
  normalizeWorkflowFormPermissionFieldSource,
} from '../../../../editor-core/workflowSourceContract'
import {
  PERSISTED_NODE_TYPES,
  normalizePersistedNodeType,
} from '../../../../translator/define/persistedNodeTypes.js'
import {
  materializeWorkflowFormPermissionValue,
} from '../../../../editor-core/workflowFormPermissionDefaults.js'

const REACT_FLOW_NODE_TYPE_TO_PERSISTED_NODE_TYPE = Object.freeze({
  start: PERSISTED_NODE_TYPES.START,
  approval: PERSISTED_NODE_TYPES.APPROVAL,
  handle: PERSISTED_NODE_TYPES.HANDLE,
  cc: PERSISTED_NODE_TYPES.CC,
  subprocess: PERSISTED_NODE_TYPES.SUBFLOW,
  'join-or': PERSISTED_NODE_TYPES.JOIN,
  end: PERSISTED_NODE_TYPES.END,
})

const DEFAULT_VISIBLE_FORM_PERMISSION_NODE_TYPES = new Set([
  PERSISTED_NODE_TYPES.APPROVAL,
  PERSISTED_NODE_TYPES.HANDLE,
])

const resolveCandidateValueKey = (candidateItem) =>
  candidateItem?.valueKey || candidateItem?.schema?.name || candidateItem?.name || null

const normalizeCandidateSubmissionPatch = (patch, candidateSource = null) => {
  const normalizedCandidateSource = normalizeWorkflowCandidateSource(candidateSource)
  const candidateItems = normalizedCandidateSource.items || []

  if (!patch || !Array.isArray(patch.candidates) || candidateItems.length === 0) {
    return patch
  }

  const candidateByType = new Map(candidateItems.map((item) => [item.name, item]))
  const candidateValueKeys = new Set(
    candidateItems.map(resolveCandidateValueKey).filter(Boolean)
  )

  return {
    ...patch,
    candidates: patch.candidates.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return candidate
      }

      const selectedCandidate = candidateByType.get(candidate.type)
      const selectedValueKey = resolveCandidateValueKey(selectedCandidate)

      return Object.entries(candidate).reduce((nextCandidate, [key, value]) => {
        if (key === 'type' || !candidateValueKeys.has(key) || key === selectedValueKey) {
          nextCandidate[key] = value
        }
        return nextCandidate
      }, {})
    }),
  }
}

export const extractDrawerSubmitPayload = (result, { candidateSource = null } = {}) => {
  if (!result) {
    return null
  }

  if (Array.isArray(result)) {
    return normalizeCandidateSubmissionPatch(result[0] || null, candidateSource)
  }

  return normalizeCandidateSubmissionPatch(result, candidateSource)
}

export const resolveCanonicalNodeType = (node) => {
  const explicitType = node?.data?.type
  if (explicitType) {
    return normalizePersistedNodeType(explicitType)
  }

  return (
    normalizePersistedNodeType(REACT_FLOW_NODE_TYPE_TO_PERSISTED_NODE_TYPE[node?.type]) ||
    normalizePersistedNodeType(node?.type) ||
    null
  )
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const normalizeWorkflowInspectorNodeConfig = (nodeConfig = {}) => ({
  hideFormPermission: Boolean(nodeConfig?.hideFormPermission),
  allowLegacyNodeConfigSurface: Boolean(nodeConfig?.allowLegacyNodeConfigSurface),
  approvalConfiguration: {
    hideActions: Boolean(nodeConfig?.approvalConfiguration?.hideActions),
    hidePercentage: Boolean(nodeConfig?.approvalConfiguration?.hidePercentage),
    hideRejectAction: Boolean(nodeConfig?.approvalConfiguration?.hideRejectAction),
    hideNoCandidateMode: Boolean(nodeConfig?.approvalConfiguration?.hideNoCandidateMode),
  },
})

const normalizeWorkflowInspectorBridgeSchemaContext = (bridgeContext = {}) => ({
  nodeConfig: normalizeWorkflowInspectorNodeConfig(bridgeContext?.nodeConfig || {}),
  formType: bridgeContext?.formType || null,
  candidateSourceRevisionToken: normalizeWorkflowCandidateSource(
    bridgeContext?.candidateSource
  ).revisionToken,
  formPermissionFieldSourceRevisionToken: normalizeWorkflowFormPermissionFieldSource(
    bridgeContext?.formPermissionFieldSource
  ).revisionToken,
})

const normalizeNodeConfigFormValues = ({ formData, nodeType, formPermissionFieldSource = null }) => {
  const values = deepClone(formData || {})
  const resolvedNodeType = normalizePersistedNodeType(nodeType || values?.type || null)

  if (DEFAULT_VISIBLE_FORM_PERMISSION_NODE_TYPES.has(resolvedNodeType)) {
    const permission = materializeWorkflowFormPermissionValue(
      formPermissionFieldSource?.fields,
      values.permission
    )
    values.permission = permission
  }

  if (
    (resolvedNodeType === PERSISTED_NODE_TYPES.START ||
      resolvedNodeType === PERSISTED_NODE_TYPES.APPROVAL ||
      resolvedNodeType === PERSISTED_NODE_TYPES.HANDLE) &&
    !Array.isArray(values.permission)
  ) {
    values.permission = []
  }

  if (
    (resolvedNodeType === PERSISTED_NODE_TYPES.APPROVAL ||
      resolvedNodeType === PERSISTED_NODE_TYPES.HANDLE ||
      resolvedNodeType === PERSISTED_NODE_TYPES.CC) &&
    (!Array.isArray(values.candidates) || values.candidates.length === 0)
  ) {
    values.candidates = [{ type: '' }]
  }

  return values
}

const stripDrawerData = (drawerRequest) => {
  if (!drawerRequest) {
    return null
  }

  const nextDrawerRequest = deepClone(drawerRequest)
  if (nextDrawerRequest?.body && typeof nextDrawerRequest.body === 'object') {
    delete nextDrawerRequest.body.data
  }
  return nextDrawerRequest
}

const hasInspectorSchemaBody = (schema) => {
  const body = schema?.body?.body
  return Array.isArray(body) && body.length > 0
}

const resolveSessionNodeFormData = (session, nodeId) => {
  if (!session || !nodeId) {
    return null
  }

  const repositoryNode = session?.getRepository?.()?.get(nodeId)
  if (repositoryNode) {
    return repositoryNode
  }

  const definitionNodes = session?.getDefinition?.()?.nodes
  if (!Array.isArray(definitionNodes)) {
    return null
  }

  return definitionNodes.find((node) => node?.id === nodeId) || null
}

export const pickWorkflowInspectorBridgeSchemaContext = (bridgeContext = {}) => {
  return normalizeWorkflowInspectorBridgeSchemaContext(bridgeContext)
}

export const buildWorkflowInspectorSchemaKey = ({
  targetKind,
  nodeType,
  isReadonly,
  conditionFieldSource,
  bridgeContext,
}) => {
  const normalizedFieldSource = normalizeWorkflowConditionFieldSource(conditionFieldSource)
  const bridgeSchemaContext = normalizeWorkflowInspectorBridgeSchemaContext(bridgeContext)
  const canonicalNodeType = normalizePersistedNodeType(nodeType) || resolveCanonicalNodeType({ type: nodeType })

  return JSON.stringify({
    targetKind: targetKind || 'selection:none',
    nodeType: canonicalNodeType || null,
    readonly: Boolean(isReadonly),
    conditionFieldRevisionToken: normalizedFieldSource.revisionToken,
    bridgeSchemaContext,
  })
}

export const buildNodeConfigSchemaDescriptor = async ({
  session,
  nodeId,
  targetKind,
  nodeType: targetNodeType,
  isReadonly,
  conditionFieldSource = null,
  bridgeContext = {},
  fetcher,
  nodeConfig,
  flowKey,
  formType,
}) => {
  const formData = resolveSessionNodeFormData(session, nodeId)
  if (!formData) {
    return null
  }

  const nodeType =
    normalizePersistedNodeType(formData.type) ||
    (targetNodeType ? resolveCanonicalNodeType({ type: targetNodeType }) : null) ||
    resolveCanonicalNodeType({ data: formData })
  if (!nodeType || nodeType === PERSISTED_NODE_TYPES.END) {
    return null
  }

  const normalizedConditionFieldSource = normalizeWorkflowConditionFieldSource(conditionFieldSource)
  const normalizedCandidateSource = normalizeWorkflowCandidateSource(
    bridgeContext?.candidateSource
  )
  const normalizedFormPermissionFieldSource =
    normalizeWorkflowFormPermissionFieldSource(bridgeContext?.formPermissionFieldSource)
  const normalizedCandidateFieldSource = normalizeWorkflowFormFieldSource(
    bridgeContext?.candidateFieldSource
  )
  const normalizedBridgeContext = {
    fetcher: bridgeContext.fetcher || fetcher,
    nodeConfig: bridgeContext.nodeConfig || nodeConfig || {},
    flowKey: bridgeContext.flowKey || flowKey,
    formType: bridgeContext.formType || formType,
    candidateSource: normalizedCandidateSource,
    formPermissionFieldSource: normalizedFormPermissionFieldSource,
    candidateFieldSource: normalizedCandidateFieldSource,
  }

  const drawerRequest = await nodeConfigForm({
    nodeType,
    fetcher: normalizedBridgeContext.fetcher,
    isReadonly,
    formData,
    nodeConfig: normalizedBridgeContext.nodeConfig,
    flowKey: normalizedBridgeContext.flowKey,
    formType: normalizedBridgeContext.formType,
    conditionFields: normalizedConditionFieldSource.fields,
    candidateSource: normalizedBridgeContext.candidateSource,
    formPermissionFieldSource: normalizedBridgeContext.formPermissionFieldSource,
    candidateFieldSource: normalizedBridgeContext.candidateFieldSource,
  })

  const schema = stripDrawerData(drawerRequest)
  const schemaKey = buildWorkflowInspectorSchemaKey({
    targetKind,
    nodeType,
    isReadonly,
    conditionFieldSource: normalizedConditionFieldSource,
    bridgeContext: normalizedBridgeContext,
  })

  return {
    schemaKey,
    schema: hasInspectorSchemaBody(schema) ? schema : null,
    compatibilityOnly: false,
  }
}

export const buildNodeConfigValueProjection = ({ session, nodeId, formPermissionFieldSource = null }) => {
  const formData = resolveSessionNodeFormData(session, nodeId)
  if (!formData) {
    return null
  }

  const nodeType = formData.type || resolveCanonicalNodeType({ data: formData })
  const canonicalNodeType =
    normalizePersistedNodeType(nodeType) || resolveCanonicalNodeType({ data: formData })

  return {
    targetId: nodeId,
    values: normalizeNodeConfigFormValues({
      formData,
      nodeType: canonicalNodeType,
      formPermissionFieldSource,
    }),
  }
}

export const getDrawerFieldsetTitles = (drawerRequest) => {
  return ((drawerRequest?.body?.body || [])
    .map((item) => item?.title)
    .filter(Boolean))
}
