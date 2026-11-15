import {
  normalizeApprovalWorkflowEditorCoreBridgeContext,
} from '../editor-core/approvalWorkflowEditorCoreBridge'
import {
  deriveWorkflowFieldSources,
  normalizeWorkflowCandidateSource,
  normalizeWorkflowCandidateSourceFromApi,
  normalizeWorkflowConditionFieldSourceFromApi,
  normalizeWorkflowFormFieldSource,
  normalizeWorkflowFormFieldSourceFromApi,
  normalizeWorkflowFormPermissionFieldSource,
  normalizeWorkflowFormPermissionFieldSourceFromApi,
  resolveWorkflowSourceApi,
} from '../editor-core/workflowSourceContract'
import { normalizeWorkflowConditionFieldSource } from '../editor-core/coreContract'
import { unwrapFetcherResultData } from '../utils/fetcherResult'
import {
  containsTemplateExpression,
  resolveTemplateValue,
} from '../utils/template'

const buildDefaultDefinitionSource = (flowKey) => {
  if (!flowKey) {
    return null
  }

  return {
    method: 'get',
    url: `/api/approval-workflow/definition/${flowKey}`,
  }
}

const resolveDefinitionSource = (props, flowKey) => {
  const explicitSource = props?.source || props?.flowDefinitionSource
  const resolvedSource = resolveTemplateValue(explicitSource, props?.data || {})

  if (resolvedSource && !containsTemplateExpression(resolvedSource)) {
    return resolvedSource
  }

  return buildDefaultDefinitionSource(flowKey)
}

const buildLegacyFieldSources = ({
  conditionFieldSource = null,
  formPermissionFieldSource = null,
} = {}) => ({
  ...deriveWorkflowFieldSources(normalizeWorkflowFormFieldSource(null)),
  conditionFieldSource: normalizeWorkflowConditionFieldSource(conditionFieldSource),
  formPermissionFieldSource: normalizeWorkflowFormPermissionFieldSource(formPermissionFieldSource),
})

export const ApprovalWorkflowEditorIntegrationAdapter = Object.freeze({
  async loadDefinition({
    props = {},
    flowKey = null,
    env = null,
  } = {}) {
    const source = resolveDefinitionSource(props, flowKey)

    if (!source || !env?.fetcher) {
      return props?.value || null
    }

    const result = await env.fetcher(source)
    return unwrapFetcherResultData(result)
  },

  async resolveConditionFieldSource({
    props = {},
    env = null,
    data = null,
  } = {}) {
    const fieldSources = await this.resolveFormFieldSources({ props, env, data })
    return fieldSources.conditionFieldSource
  },

  async resolveCandidateSource({
    props = {},
    env = null,
    data = null,
  } = {}) {
    if (props?.candidateSource) {
      return normalizeWorkflowCandidateSource(props.candidateSource)
    }

    if (props?.candidateSourceApi) {
      return normalizeWorkflowCandidateSourceFromApi({
        env,
        sourceApi: props.candidateSourceApi,
        data: data || props?.data,
      })
    }

    return normalizeWorkflowCandidateSource(null)
  },

  async resolveFormPermissionFieldSource({
    props = {},
    env = null,
    data = null,
  } = {}) {
    const fieldSources = await this.resolveFormFieldSources({ props, env, data })
    return fieldSources.formPermissionFieldSource
  },

  async resolveFormFieldSources({
    props = {},
    env = null,
    data = null,
  } = {}) {
    const resolveData = data || props?.data

    if (props?.formFieldSource) {
      return deriveWorkflowFieldSources(props.formFieldSource)
    }

    if (props?.formFieldSourceApi) {
      const formFieldSource = await normalizeWorkflowFormFieldSourceFromApi({
        env,
        sourceApi: props.formFieldSourceApi,
        data: resolveData,
      })
      return deriveWorkflowFieldSources(formFieldSource)
    }

    if (
      props?.conditionFieldSource ||
      props?.conditionFieldSourceApi ||
      props?.formPermissionFieldSource ||
      props?.formPermissionFieldSourceApi
    ) {
      const [
        conditionFieldSource,
        formPermissionFieldSource,
      ] = await Promise.all([
        props?.conditionFieldSource
          ? normalizeWorkflowConditionFieldSource(props.conditionFieldSource)
          : normalizeWorkflowConditionFieldSourceFromApi({
              env,
              sourceApi: props.conditionFieldSourceApi,
              data: resolveData,
            }),
        props?.formPermissionFieldSource
          ? normalizeWorkflowFormPermissionFieldSource(props.formPermissionFieldSource)
          : normalizeWorkflowFormPermissionFieldSourceFromApi({
              env,
              sourceApi: props.formPermissionFieldSourceApi,
              data: resolveData,
            }),
      ])

      return buildLegacyFieldSources({
        conditionFieldSource,
        formPermissionFieldSource,
      })
    }

    return deriveWorkflowFieldSources(normalizeWorkflowFormFieldSource(null))
  },

  async resolveBasicInfoData({
    props = {},
    env = null,
    data = null,
  } = {}) {
    return resolveWorkflowSourceApi({
      env,
      sourceApi: props?.basicInfoDataSourceApi || null,
      data: data || props?.data,
      normalize: (payload) =>
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? payload
          : {},
      emptyValue: {},
    })
  },

  resolveCoreBridgeContext({
    props = {},
    flowKey = null,
    readonly = false,
    coreCapabilities = null,
    candidateSource = null,
    formPermissionFieldSource = null,
    candidateFieldSource = null,
  } = {}) {
    return normalizeApprovalWorkflowEditorCoreBridgeContext({
      data: {
        flowKey,
        candidateSource,
        formPermissionFieldSource,
        candidateFieldSource,
      },
      env: props?.env,
      nodeConfig: {
        ...(props?.nodeConfig || {}),
      },
      readonly,
      coreCapabilities,
    })
  },
})
