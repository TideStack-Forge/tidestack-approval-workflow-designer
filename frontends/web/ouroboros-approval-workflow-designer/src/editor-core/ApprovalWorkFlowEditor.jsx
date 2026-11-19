import { t } from '../i18n.js'
import React from 'react'
import { isEqual } from 'lodash'
import '../assets/iconfont/iconfont.css'
import '../style.scss'
import { createDefinitionRequestSource } from '@/translator/definition-format/index'
import { EditorSession } from '../editor-session/index'
import { ApprovalWorkflowEditorCore } from './ApprovalWorkflowEditorCore'
import {
  createEmptyWorkflowDiagnosticsSnapshot,
  createEmptyWorkflowSelectionSnapshot,
  normalizeApprovalWorkflowEditorCoreCapabilities,
  normalizeWorkflowConditionFieldSource,
} from './coreContract'
import {
  deriveWorkflowFieldSources,
  normalizeWorkflowCandidateSource,
  normalizeWorkflowFormFieldSource,
  normalizeWorkflowFormPermissionFieldSource,
} from './workflowSourceContract'
import { ApprovalWorkflowEditorIntegrationAdapter } from '../editor-integration/approvalWorkflowEditorIntegrationAdapter'

const hasDefinitionValue = (definition) =>
  !!definition && typeof definition === 'object' && Object.keys(definition).length > 0

const buildUpgradeNoticeKey = (definitionId, flowKey) =>
  definitionId || flowKey || '__draft__'

const readEditorMode = (props) => `${props?.data?.mode || ''}`.toLowerCase()

const resolveDefinitionLoadKey = (props) =>
  props?.data?.flowKey || props?.data?.id || props?.flowKey || props?.id || null

const resolveCreateDefinitionId = (props) =>
  props?.data?.definitionId || props?.definitionId || null

const resolveFlowKey = (props) =>
  resolveDefinitionLoadKey(props) || resolveCreateDefinitionId(props)

const appendSchemaClassName = (schema, className) => {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const nextClassName = [schema.className, className].filter(Boolean).join(' ').trim()

  return {
    ...schema,
    className: nextClassName || undefined,
  }
}

const clonePlainValue = (value) => {
  if (typeof value === 'undefined') {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const resolveExternalSourceOrFallback = async (
  sourcePromise,
  fallbackValue,
  sourceName
) => {
  try {
    return {
      value: await sourcePromise,
      error: null,
    }
  } catch (error) {
    return {
      value: fallbackValue,
      error: {
        sourceName,
        error,
      },
    }
  }
}

const mergeDefinedProperties = (baseValue, overrideValue) => {
  if (!hasDefinitionValue(baseValue)) {
    return overrideValue
  }

  if (!hasDefinitionValue(overrideValue)) {
    return baseValue
  }

  return Object.entries(overrideValue).reduce(
    (accumulator, [key, value]) => {
      if (typeof value !== 'undefined') {
        accumulator[key] = value
      }
      return accumulator
    },
    { ...baseValue }
  )
}

const resolveDesignAppNameFromProps = (props) => {
  if (typeof props?.data?.appName === 'string' && props.data.appName.trim()) {
    return props.data.appName.trim()
  }

  if (typeof props?.appName === 'string' && props.appName.trim()) {
    return props.appName.trim()
  }

  return ''
}

const BASIC_INFO_DEFAULT_LABEL = '流程信息'
const BASIC_INFO_DEFAULT_TITLE = '流程信息'
const BASIC_INFO_DEFAULT_ICON = 'fa-solid fa-circle-info'
const BASIC_INFO_DEFAULT_OPEN_MODE = 'dialog'
const BASIC_INFO_FORM_NAME = 'edit-workflow-base-info-form'

const normalizeBasicInfoButtonLabel = (label) => {
  if (typeof label !== 'string') {
    return BASIC_INFO_DEFAULT_LABEL
  }

  const trimmedLabel = label.trim()
  return trimmedLabel || BASIC_INFO_DEFAULT_LABEL
}

const normalizeBasicInfoButtonIcon = (icon) => {
  if (typeof icon !== 'string') {
    return BASIC_INFO_DEFAULT_ICON
  }

  const trimmedIcon = icon.trim()
  return trimmedIcon || BASIC_INFO_DEFAULT_ICON
}

const normalizeBasicInfoOpenMode = (openMode) =>
  openMode === 'drawer' ? 'drawer' : BASIC_INFO_DEFAULT_OPEN_MODE

const normalizeBasicInfoFormItems = (formItems) =>
  Array.isArray(formItems) && formItems.length > 0 ? clonePlainValue(formItems) : []

const buildBasicInfoFormShell = (formItems) => ({
  type: 'form',
  name: BASIC_INFO_FORM_NAME,
  id: BASIC_INFO_FORM_NAME,
  title: false,
  wrapWithPanel: false,
  mode: 'horizontal',
  body: formItems,
  actions: [],
})

const normalizeBasicInfoFormKey = (formKeyValue, fallbackValue = '') => {
  if (typeof formKeyValue === 'string') {
    return formKeyValue.trim()
  }

  if (formKeyValue && typeof formKeyValue === 'object' && !Array.isArray(formKeyValue)) {
    const candidate =
      formKeyValue.fullName ??
      formKeyValue.formKey ??
      formKeyValue.value ??
      formKeyValue.name ??
      formKeyValue.key

    return typeof candidate === 'string' ? candidate.trim() : ''
  }

  return typeof fallbackValue === 'string' ? fallbackValue.trim() : ''
}

const readDefinitionFormBinding = (definition, fallbackData = {}) => {
  const form = definition?.form || {}
  const hasTopLevelFormKey = Object.prototype.hasOwnProperty.call(
    definition || {},
    'formKey'
  )
  const hasNestedFormId = Object.prototype.hasOwnProperty.call(form, 'formId')
  const hasNestedFormKey = Object.prototype.hasOwnProperty.call(form, 'formKey')

  return {
    formType: form.formType ?? definition?.formType ?? fallbackData?.formType ?? null,
    formId: hasNestedFormId
      ? form.formId
      : hasNestedFormKey
        ? form.formKey
        : hasTopLevelFormKey
          ? definition.formKey
          : (fallbackData?.formId ?? fallbackData?.formKey ?? null),
  }
}

const buildBasicInfoDefinitionFromFormData = (formData = {}) => {
  const base = formData.flowDefinition || {}
  const baseForm = readDefinitionFormBinding(base)
  const hasSubmittedFormId = Object.prototype.hasOwnProperty.call(formData, 'formId')
  const hasSubmittedFormKey = Object.prototype.hasOwnProperty.call(formData, 'formKey')
  const selectedFormKey = hasSubmittedFormId
    ? normalizeBasicInfoFormKey(formData.formId, '')
    : hasSubmittedFormKey
      ? normalizeBasicInfoFormKey(formData.formKey, '')
      : normalizeBasicInfoFormKey(baseForm.formId, '')
  const selectedFormType =
    typeof formData.formType === 'string' && formData.formType.trim()
      ? formData.formType.trim()
      : baseForm.formType || 'business-model'
  const nextFlowDefinition = {
    ...base,
    id: typeof formData.name === 'string' ? formData.name : base.id || base.name,
    name: typeof formData.title === 'string' ? formData.title : base.title || base.name,
    description:
      typeof formData.description === 'string'
        ? formData.description
        : base.description || '',
    formType: selectedFormType,
    formKey: selectedFormKey,
  }

  return nextFlowDefinition
}

const buildInitialDefinitionMetaFromProps = (props) => {
  const data = props?.data || {}
  const metaPatch = {}
  if (typeof data.formType === 'string' && data.formType.trim()) {
    metaPatch.formType = data.formType.trim()
  }
  if (Object.prototype.hasOwnProperty.call(data, 'formId')) {
    metaPatch.formKey = typeof data.formId === 'string' ? data.formId.trim() : data.formId
  }
  if (Object.prototype.hasOwnProperty.call(data, 'formKey')) {
    metaPatch.formKey =
      typeof data.formKey === 'string' ? data.formKey.trim() : data.formKey
  }

  return Object.keys(metaPatch).length > 0 ? metaPatch : null
}

const buildBasicInfoSubmitActions = () => [
  {
    type: 'button',
    actionType: 'close',
    label: '取消',
  },
  {
    type: 'button',
    label: '确认',
    level: 'primary',
    actionType: 'confirm',
  },
]

const buildBasicInfoContainerSchema = ({ openMode, formItems, onBasicInfoSubmit }) => {
  const containerSchema = {
    title: BASIC_INFO_DEFAULT_TITLE,
    closeOnEsc: true,
    closeOnOutside: false,
    data: {
      '&': '$$',
      flowDefinition: '$flowDefinition',
      name: '${flowDefinition.name || flowDefinition.id || ""}',
      title: '${flowDefinition.title || flowDefinition.name || ""}',
      description: '${flowDefinition.description || ""}',
      formType: '${flowDefinition.form.formType || flowDefinition.formType || ""}',
      formId: '${flowDefinition.form.formId || flowDefinition.formKey || ""}',
    },
    body: buildBasicInfoFormShell(formItems),
    actions: buildBasicInfoSubmitActions(),
    onConfirm: (values) => {
      if (typeof onBasicInfoSubmit !== 'function') {
        return
      }

      const formData = Array.isArray(values) ? values[0] : values
      onBasicInfoSubmit(buildBasicInfoDefinitionFromFormData(formData || {}))
    },
  }

  if (openMode === 'drawer') {
    return {
      ...containerSchema,
      position: 'right',
    }
  }

  return containerSchema
}

const buildBasicInfoEntrySchema = ({
  formItems,
  buttonLabel,
  buttonIcon,
  openMode,
  onBasicInfoSubmit,
}) => {
  const resolvedOpenMode = normalizeBasicInfoOpenMode(openMode)
  const schema = {
    type: 'button',
    label: normalizeBasicInfoButtonLabel(buttonLabel),
    'aria-label': normalizeBasicInfoButtonLabel(buttonLabel),
    level: 'light',
    size: 'sm',
    actionType: resolvedOpenMode,
    [resolvedOpenMode]: buildBasicInfoContainerSchema({
      openMode: resolvedOpenMode,
      formItems,
      onBasicInfoSubmit,
    }),
  }

  const resolvedIcon = normalizeBasicInfoButtonIcon(buttonIcon)
  if (resolvedIcon) {
    schema.icon = resolvedIcon
  }

  return schema
}

const isDefinitionMetaOnlyChanged = (previousDefinition, nextDefinition) => {
  if (!hasDefinitionValue(previousDefinition) || !hasDefinitionValue(nextDefinition)) {
    return false
  }

  const nameChanged = previousDefinition.name !== nextDefinition.name
  const descriptionChanged =
    (previousDefinition.description || '') !== (nextDefinition.description || '')

  return (
    previousDefinition.id === nextDefinition.id &&
    (nameChanged || descriptionChanged) &&
    isEqual(
      {
        ...previousDefinition,
        name: nextDefinition.name,
        description: nextDefinition.description,
      },
      nextDefinition
    )
  )
}

export class ApprovalWorkFlowEditor extends React.Component {
  constructor(props) {
    super(props)
    this.flowKey = resolveFlowKey(props)
    this.definitionLoadKey = resolveDefinitionLoadKey(props)
    this.coreRef = React.createRef()
    this.externalSourceSyncSeq = 0
    this.state = {
      session: null,
      value: hasDefinitionValue(props?.value) ? props.value : null,
      conditionFieldSource: normalizeWorkflowConditionFieldSource(
        props?.conditionFieldSource || null
      ),
      candidateSource: normalizeWorkflowCandidateSource(props?.candidateSource || null),
      formFieldSource: normalizeWorkflowFormFieldSource(props?.formFieldSource || null),
      formPermissionFieldSource: normalizeWorkflowFormPermissionFieldSource(
        props?.formPermissionFieldSource || null
      ),
      candidateFieldSource: normalizeWorkflowFormFieldSource(null),
      basicInfoData: {},
      fieldSourceStatus: 'loading',
      diagnostics: createEmptyWorkflowDiagnosticsSnapshot(),
      selection: createEmptyWorkflowSelectionSnapshot(),
      v1UpgradeNoticeKey: null,
      sourceFormatVersion: null,
    }
  }

  isReadonly(props = this.props) {
    return (
      props?.readonly === true ||
      props?.static === true ||
      readEditorMode(props) === 'preview'
    )
  }

  async generateFlowDefinition() {
    const flowDefinition = await ApprovalWorkflowEditorIntegrationAdapter.loadDefinition({
      props: {
        ...this.props,
        source:
          this.props?.source || this.props?.flowDefinitionSource
            ? createDefinitionRequestSource(
                this.props?.source || this.props?.flowDefinitionSource
              )
            : this.definitionLoadKey
              ? createDefinitionRequestSource({
                  method: 'get',
                  url: `/api/approval-workflow/definition/${this.definitionLoadKey}`,
                })
              : null,
      },
      flowKey: this.definitionLoadKey,
      env: this.props?.env,
    })

    if (
      !flowDefinition &&
      (this.props?.source || this.props?.flowDefinitionSource || this.definitionLoadKey)
    ) {
      if (this.isReadonly()) {
        this.props.env.notify('warning', t('获取审批流程失败'))
      }
      return null
    }

    return hasDefinitionValue(flowDefinition)
      ? flowDefinition
      : hasDefinitionValue(this.props?.value)
        ? this.props.value
        : null
  }

  componentDidMount() {
    this.initFlowDefinition()
  }

  componentDidUpdate(prevProps) {
    const previousFlowKey = resolveFlowKey(prevProps)
    const nextFlowKey = resolveFlowKey(this.props)
    const previousDefinitionLoadKey = resolveDefinitionLoadKey(prevProps)
    const nextDefinitionLoadKey = resolveDefinitionLoadKey(this.props)
    const flowKeyChanged = previousFlowKey !== nextFlowKey
    const definitionLoadKeyChanged = previousDefinitionLoadKey !== nextDefinitionLoadKey
    const externalSourcesChanged =
      !isEqual(prevProps.data, this.props.data) ||
      prevProps.appName !== this.props.appName ||
      !isEqual(prevProps.conditionFieldSource, this.props.conditionFieldSource) ||
      !isEqual(prevProps.conditionFieldSourceApi, this.props.conditionFieldSourceApi) ||
      !isEqual(prevProps.formFieldSource, this.props.formFieldSource) ||
      !isEqual(prevProps.formFieldSourceApi, this.props.formFieldSourceApi) ||
      !isEqual(prevProps.candidateSource, this.props.candidateSource) ||
      !isEqual(prevProps.candidateSourceApi, this.props.candidateSourceApi) ||
      !isEqual(
        prevProps.formPermissionFieldSource,
        this.props.formPermissionFieldSource
      ) ||
      !isEqual(
        prevProps.formPermissionFieldSourceApi,
        this.props.formPermissionFieldSourceApi
      ) ||
      !isEqual(prevProps.basicInfoDataSourceApi, this.props.basicInfoDataSourceApi) ||
      prevProps.readonly !== this.props.readonly ||
      prevProps.static !== this.props.static ||
      readEditorMode(prevProps) !== readEditorMode(this.props)
    const hasRemoteSource = !!(
      this.props.source ||
      this.props.flowDefinitionSource ||
      nextDefinitionLoadKey
    )
    const sourceChanged =
      flowKeyChanged ||
      definitionLoadKeyChanged ||
      !isEqual(prevProps.source, this.props.source) ||
      !isEqual(prevProps.flowDefinitionSource, this.props.flowDefinitionSource)
    const valueChanged = !isEqual(prevProps.value, this.props.value)
    const currentDefinition = this.readDefinition()
    const remoteMetaOnlyChanged =
      hasRemoteSource &&
      valueChanged &&
      isDefinitionMetaOnlyChanged(currentDefinition, this.props.value)

    if (flowKeyChanged) {
      this.flowKey = nextFlowKey
    }
    if (definitionLoadKeyChanged) {
      this.definitionLoadKey = nextDefinitionLoadKey
    }

    if (externalSourcesChanged) {
      this.syncExternalSources()
    }

    if (remoteMetaOnlyChanged) {
      if (this.applyMetaOnlyDefinitionToLiveSession(this.props.value)) {
        return
      }

      this.initFlowDefinition()
      return
    }

    if (
      sourceChanged ||
      (!hasRemoteSource && valueChanged && !isEqual(currentDefinition, this.props.value))
    ) {
      this.initFlowDefinition()
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !isEqual(this.props.value, nextProps.value) ||
      !isEqual(this.props.data, nextProps.data) ||
      this.props.appName !== nextProps.appName ||
      this.props.readonly !== nextProps.readonly ||
      this.props.static !== nextProps.static ||
      readEditorMode(this.props) !== readEditorMode(nextProps) ||
      !isEqual(this.props.basicInfoFormItems, nextProps.basicInfoFormItems) ||
      !isEqual(this.props.basicInfoDataSourceApi, nextProps.basicInfoDataSourceApi) ||
      this.props.basicInfoButtonLabel !== nextProps.basicInfoButtonLabel ||
      this.props.basicInfoButtonIcon !== nextProps.basicInfoButtonIcon ||
      this.props.basicInfoOpenMode !== nextProps.basicInfoOpenMode ||
      !isEqual(this.props.coreCapabilities, nextProps.coreCapabilities) ||
      !isEqual(this.props.conditionFieldSource, nextProps.conditionFieldSource) ||
      !isEqual(this.props.conditionFieldSourceApi, nextProps.conditionFieldSourceApi) ||
      !isEqual(this.props.formFieldSource, nextProps.formFieldSource) ||
      !isEqual(this.props.formFieldSourceApi, nextProps.formFieldSourceApi) ||
      !isEqual(this.props.candidateSource, nextProps.candidateSource) ||
      !isEqual(this.props.candidateSourceApi, nextProps.candidateSourceApi) ||
      !isEqual(
        this.props.formPermissionFieldSource,
        nextProps.formPermissionFieldSource
      ) ||
      !isEqual(
        this.props.formPermissionFieldSourceApi,
        nextProps.formPermissionFieldSourceApi
      ) ||
      this.state.session !== nextState.session ||
      !isEqual(this.state.value, nextState.value) ||
      this.state.sourceFormatVersion !== nextState.sourceFormatVersion ||
      !isEqual(this.state.conditionFieldSource, nextState.conditionFieldSource) ||
      !isEqual(this.state.candidateSource, nextState.candidateSource) ||
      !isEqual(this.state.formFieldSource, nextState.formFieldSource) ||
      !isEqual(
        this.state.formPermissionFieldSource,
        nextState.formPermissionFieldSource
      ) ||
      !isEqual(this.state.candidateFieldSource, nextState.candidateFieldSource) ||
      !isEqual(this.state.basicInfoData, nextState.basicInfoData) ||
      this.state.fieldSourceStatus !== nextState.fieldSourceStatus ||
      !isEqual(this.state.diagnostics, nextState.diagnostics) ||
      !isEqual(this.state.selection, nextState.selection)
    )
  }

  async initFlowDefinition() {
    const flowDefinition = await this.generateFlowDefinition()
    const canCreateInitial = !!this.flowKey
    const session = hasDefinitionValue(flowDefinition)
      ? EditorSession.createFromDefinition(flowDefinition)
      : this.isReadonly() && (this.definitionLoadKey || this.flowKey)
        ? null
        : canCreateInitial
          ? EditorSession.createInitial(this.flowKey)
          : null

    if (!session) {
      const shouldClearDefinition =
        this.state.session !== null ||
        hasDefinitionValue(this.state.value) ||
        hasDefinitionValue(this.props.value)
      if (shouldClearDefinition) {
        this.setState({
          session: null,
          value: null,
          sourceFormatVersion: null,
          v1UpgradeNoticeKey: null,
        })
        if (this.props?.onChange && this.props.value) {
          this.props.onChange(null)
        }
      }
      return
    }

    if (!hasDefinitionValue(flowDefinition) && canCreateInitial) {
      const initialMetaPatch = buildInitialDefinitionMetaFromProps(this.props)
      if (initialMetaPatch) {
        session.updateWorkflowMeta(initialMetaPatch, { recordHistory: false })
      }
    }

    const nextDefinition = session.getPersistedDefinition?.() || session.getDefinition()
    const currentDefinition =
      this.state.session?.getPersistedDefinition?.() ||
      this.state.session?.getDefinition?.() ||
      this.state.value
    const shouldReuseEquivalentSessionState =
      currentDefinition &&
      nextDefinition &&
      isEqual(currentDefinition, nextDefinition) &&
      this.state.session instanceof EditorSession &&
      this.state.sourceFormatVersion === session.getSourceFormatVersion()

    if (shouldReuseEquivalentSessionState) {
      await this.syncExternalSources()
      return
    }

    const nextState = {
      session,
      value: nextDefinition,
      sourceFormatVersion: session.getSourceFormatVersion(),
      v1UpgradeNoticeKey: null,
    }

    if (session.shouldNotifyUpgrade(this.isReadonly())) {
      const upgradeNoticeKey = buildUpgradeNoticeKey(
        flowDefinition?.id || flowDefinition?.name,
        this.flowKey
      )
      if (this.state.v1UpgradeNoticeKey !== upgradeNoticeKey) {
        this.props.env.notify(
          'warning',
          t('当前流程为旧版格式，保存后将自动升级为审批流元数据格式')
        )
      }
      nextState.v1UpgradeNoticeKey = upgradeNoticeKey
    }

    await new Promise((resolve) => {
      this.setState(nextState, async () => {
        if (this.props?.onChange && !isEqual(this.props.value, nextDefinition)) {
          this.props.onChange(nextDefinition)
        }

        await this.syncExternalSources(nextDefinition)
        resolve()
      })
    })
  }

  async syncExternalSources(definitionOverride = null) {
    const syncSeq = ++this.externalSourceSyncSeq
    const currentDefinition = hasDefinitionValue(definitionOverride)
      ? definitionOverride
      : this.readDefinition()
    const sourceResolveData = this.buildExternalSourceResolveData(currentDefinition)
    const binding = readDefinitionFormBinding(currentDefinition, this.props?.data)
    const bindingKey = JSON.stringify(binding)
    if (bindingKey !== this.externalSourceBindingKey) {
      this.externalSourceBindingKey = bindingKey
      const empty = deriveWorkflowFieldSources(null)
      await new Promise((resolve) =>
        this.setState(
          {
            formFieldSource: normalizeWorkflowFormFieldSource(empty.formFieldSource),
            conditionFieldSource: normalizeWorkflowConditionFieldSource(
              empty.conditionFieldSource
            ),
            formPermissionFieldSource: normalizeWorkflowFormPermissionFieldSource(
              empty.formPermissionFieldSource
            ),
            candidateFieldSource: normalizeWorkflowFormFieldSource(
              empty.candidateFieldSource
            ),
            basicInfoData: {},
            fieldSourceStatus: binding.formId ? 'loading' : 'unbound',
          },
          resolve
        )
      )
    }
    const sourceResults = await Promise.all([
      resolveExternalSourceOrFallback(
        ApprovalWorkflowEditorIntegrationAdapter.resolveFormFieldSources({
          props: this.props,
          env: this.props.env,
          data: sourceResolveData,
        }),
        deriveWorkflowFieldSources(null),
        'formFieldSource'
      ),
      resolveExternalSourceOrFallback(
        ApprovalWorkflowEditorIntegrationAdapter.resolveCandidateSource({
          props: this.props,
          env: this.props.env,
          data: sourceResolveData,
        }),
        null,
        'candidateSource'
      ),
      resolveExternalSourceOrFallback(
        ApprovalWorkflowEditorIntegrationAdapter.resolveBasicInfoData({
          props: this.props,
          env: this.props.env,
          data: sourceResolveData,
        }),
        {},
        'basicInfoData'
      ),
    ])

    if (syncSeq !== this.externalSourceSyncSeq) {
      return
    }

    const [nextFormFieldSources, nextCandidateSource, nextBasicInfoData] =
      sourceResults.map((result) => result.value)
    const sourceErrors = sourceResults.map((result) => result.error).filter(Boolean)
    if (sourceErrors.length > 0) {
      this.props.env?.notify?.(
        'warning',
        t('审批流外部数据源加载失败，已使用空数据源刷新')
      )
    }

    const fieldSourceStatus = sourceResults[0].error
      ? 'error'
      : !binding.formId
        ? 'unbound'
        : 'ready'
    const normalizedFormFieldSources =
      nextFormFieldSources || deriveWorkflowFieldSources(null)
    const normalizedFormFieldSource = normalizeWorkflowFormFieldSource(
      normalizedFormFieldSources.formFieldSource
    )
    const normalizedConditionFieldSource = normalizeWorkflowConditionFieldSource(
      normalizedFormFieldSources.conditionFieldSource
    )
    const normalizedCandidateSource =
      normalizeWorkflowCandidateSource(nextCandidateSource)
    const normalizedFormPermissionFieldSource =
      normalizeWorkflowFormPermissionFieldSource(
        normalizedFormFieldSources.formPermissionFieldSource
      )
    const normalizedCandidateFieldSource = normalizeWorkflowFormFieldSource(
      normalizedFormFieldSources.candidateFieldSource
    )

    if (
      isEqual(this.state.conditionFieldSource, normalizedConditionFieldSource) &&
      isEqual(this.state.candidateSource, normalizedCandidateSource) &&
      isEqual(this.state.formFieldSource, normalizedFormFieldSource) &&
      isEqual(
        this.state.formPermissionFieldSource,
        normalizedFormPermissionFieldSource
      ) &&
      isEqual(this.state.candidateFieldSource, normalizedCandidateFieldSource) &&
      isEqual(this.state.basicInfoData, nextBasicInfoData) &&
      this.state.fieldSourceStatus === fieldSourceStatus
    ) {
      return
    }

    await new Promise((resolve) => {
      this.setState(
        {
          conditionFieldSource: normalizedConditionFieldSource,
          candidateSource: normalizedCandidateSource,
          formFieldSource: normalizedFormFieldSource,
          formPermissionFieldSource: normalizedFormPermissionFieldSource,
          candidateFieldSource: normalizedCandidateFieldSource,
          basicInfoData: nextBasicInfoData,
          fieldSourceStatus,
        },
        resolve
      )
    })
  }

  handleSessionChange(session) {
    if (!session) return
    this.syncSessionState(session)
  }

  syncSessionState(session, options = {}) {
    if (!session) {
      return
    }

    const { emitChange = true } = options
    const nextSession =
      session instanceof EditorSession
        ? session
        : hasDefinitionValue(session)
          ? EditorSession.createFromDefinition(session)
          : null

    if (!nextSession) {
      return
    }

    const nextDefinition =
      nextSession.getPersistedDefinition?.() || nextSession.getDefinition()
    if (
      emitChange &&
      this.props?.onChange &&
      !isEqual(this.props.value, nextDefinition)
    ) {
      this.props.onChange(nextDefinition)
    }

    this.setState({
      session: nextSession,
      value: nextDefinition,
      sourceFormatVersion: nextSession.getSourceFormatVersion(),
    })
  }

  applyMetaOnlyDefinitionToLiveSession(nextDefinition) {
    if (!hasDefinitionValue(nextDefinition)) {
      return false
    }

    const activeSession = this.coreRef.current?.session || this.state.session
    if (!(activeSession instanceof EditorSession)) {
      return false
    }

    const currentDefinition = activeSession.getDefinition?.()
    if (!isDefinitionMetaOnlyChanged(currentDefinition, nextDefinition)) {
      return false
    }

    const metaPatch = {}
    if (currentDefinition?.name !== nextDefinition.name) {
      metaPatch.name = nextDefinition.name
    }
    if ((currentDefinition?.description || '') !== (nextDefinition.description || '')) {
      metaPatch.description = nextDefinition.description
    }

    if (Object.keys(metaPatch).length === 0) {
      return false
    }

    activeSession.updateWorkflowMeta(metaPatch)
    this.syncSessionState(activeSession, { emitChange: false })
    return true
  }

  handleBasicInfoSubmit(nextDefinition) {
    if (!hasDefinitionValue(nextDefinition)) {
      return false
    }

    const activeSession = this.coreRef.current?.session || this.state.session
    if (!(activeSession instanceof EditorSession)) {
      return false
    }

    const currentDefinition = activeSession.getDefinition?.()
    if (!currentDefinition) {
      return false
    }

    const nextForm = readDefinitionFormBinding(nextDefinition)
    const currentForm = readDefinitionFormBinding(currentDefinition)
    const nextFormKey = normalizeBasicInfoFormKey(nextForm.formId, '')
    const currentFormKey = normalizeBasicInfoFormKey(currentForm.formId, '')
    const metaPatch = {}

    if (currentDefinition.id !== nextDefinition.id) {
      metaPatch.id = nextDefinition.id
    }
    if (currentDefinition.name !== nextDefinition.name) {
      metaPatch.name = nextDefinition.name
    }
    if ((currentDefinition.description || '') !== (nextDefinition.description || '')) {
      metaPatch.description = nextDefinition.description
    }
    if (currentForm.formType !== nextForm.formType) {
      metaPatch.formType = nextForm.formType
    }
    if (
      currentFormKey !== nextFormKey ||
      !Object.prototype.hasOwnProperty.call(currentDefinition, 'formKey')
    ) {
      metaPatch.formKey = nextFormKey
    }

    if (Object.keys(metaPatch).length === 0) {
      return false
    }

    activeSession.updateWorkflowMeta(metaPatch)
    const nextDefinitionSnapshot = clonePlainValue(
      activeSession.getPersistedDefinition?.() || activeSession.getDefinition?.()
    )
    this.syncSessionState(activeSession, { emitChange: true })
    this.syncExternalSources(nextDefinitionSnapshot)
    return true
  }

  getWorkflowDesigner() {
    return this.coreRef.current?.getWorkflowDesigner?.() || null
  }

  readDefinition() {
    return (
      this.coreRef.current?.readDefinition?.() ||
      this.state.session?.getDefinition?.() ||
      this.state.value ||
      this.props.value ||
      null
    )
  }

  readSessionSnapshot() {
    if (this.coreRef.current?.readSessionSnapshot) {
      return this.coreRef.current.readSessionSnapshot()
    }

    const session = this.state.session
    if (!session) {
      return null
    }

    return {
      revision: session.getRevision(),
      sourceFormatVersion: session.getSourceFormatVersion(),
      definition: session.getDefinition(),
    }
  }

  navigateToDiagnosticTarget(targetId) {
    return this.coreRef.current?.navigateToDiagnosticTarget?.(targetId) || false
  }

  handleDiagnosticsChange(nextDiagnostics) {
    const diagnostics = nextDiagnostics || createEmptyWorkflowDiagnosticsSnapshot()
    this.setState({
      diagnostics,
    })

    if (this.props?.onDiagnosticsChange) {
      this.props.onDiagnosticsChange(diagnostics)
    }
  }

  handleSelectionChange(nextSelection) {
    const selection = nextSelection || createEmptyWorkflowSelectionSnapshot()
    this.setState({
      selection,
    })

    if (this.props?.onSelectionChange) {
      this.props.onSelectionChange(selection)
    }
  }

  renderEditor({ value, readonly, coreCapabilities, bridgeContext }) {
    return (
      <ApprovalWorkflowEditorCore
        key="workflow-designer-shell"
        ref={this.coreRef}
        value={value}
        readonly={readonly}
        coreCapabilities={coreCapabilities}
        conditionFieldSource={this.state.conditionFieldSource}
        onChange={(nextDefinition) => {
          const activeSession = this.coreRef.current?.session
          if (
            activeSession instanceof EditorSession &&
            isEqual(activeSession.getDefinition?.(), nextDefinition)
          ) {
            this.handleSessionChange(activeSession)
            return
          }

          const nextSession = hasDefinitionValue(nextDefinition)
            ? EditorSession.createFromDefinition(nextDefinition)
            : this.flowKey
              ? EditorSession.createInitial(this.flowKey)
              : null
          this.handleSessionChange(nextSession)
        }}
        onDiagnosticsChange={this.handleDiagnosticsChange.bind(this)}
        onSelectionChange={this.handleSelectionChange.bind(this)}
        bridgeContext={bridgeContext}
      />
    )
  }

  buildToolbarBaseInfoEntry({ readonly, currentDefinition }) {
    const formItems = normalizeBasicInfoFormItems(this.props.basicInfoFormItems)
    if (readonly || formItems.length === 0) {
      return null
    }

    const resolvedAppName = resolveDesignAppNameFromProps(this.props)

    return {
      key: 'approval-workflow-base-info-entry',
      formValueProjection: {
        formName: BASIC_INFO_FORM_NAME,
        values: {
          workflowFields: this.state.formFieldSource.fields,
          workflowFieldStatus: this.state.fieldSourceStatus,
        },
      },
      env: this.props.env,
      schema: appendSchemaClassName(
        buildBasicInfoEntrySchema({
          formItems: [
            ...formItems,
            {
              type: 'divider',
              title: '当前流程表单字段',
            },
            {
              type: 'alert',
              level: 'info',
              visibleOn: '${workflowFieldStatus === "loading"}',
              body: '正在加载表单字段…',
            },
            {
              type: 'alert',
              level: 'warning',
              visibleOn: '${workflowFieldStatus === "error"}',
              body: '表单字段加载失败，请检查关联表单后重试。',
            },
            {
              type: 'tpl',
              visibleOn: '${workflowFieldStatus === "unbound"}',
              tpl: '尚未关联表单',
            },
            {
              type: 'table',
              visibleOn: '${workflowFieldStatus === "ready"}',
              source: '${workflowFields}',
              placeholder: '此表单未声明字段',
              columns: [
                { name: 'label', label: '字段名称' },
                { name: 'name', label: '标识' },
                { name: 'fieldType', label: '类型', placeholder: '-' },
                { name: 'description', label: '说明', placeholder: '-' },
              ],
            },
          ],
          buttonLabel: this.props.basicInfoButtonLabel,
          buttonIcon: this.props.basicInfoButtonIcon,
          openMode: this.props.basicInfoOpenMode,
          onBasicInfoSubmit: this.handleBasicInfoSubmit.bind(this),
        }),
        'workflow-toolbar-base-info-entry'
      ),
      props: {
        data: {
          ...(this.props.data || {}),
          ...(this.state.basicInfoData || {}),
          appName: resolvedAppName,
          flowDefinition: currentDefinition,
          workflowFields: this.state.formFieldSource.fields,
          workflowFieldStatus: this.state.fieldSourceStatus,
        },
      },
    }
  }

  buildExternalSourceResolveData(currentDefinition) {
    const persistedDefinition = hasDefinitionValue(this.state.value)
      ? this.state.value
      : hasDefinitionValue(this.props.value)
        ? this.props.value
        : null
    const mergedDefinition = hasDefinitionValue(currentDefinition)
      ? mergeDefinedProperties(persistedDefinition, currentDefinition)
      : persistedDefinition
    const mergedForm = readDefinitionFormBinding(mergedDefinition, this.props?.data)
    const mergedDefinitionKey =
      mergedDefinition?.id ||
      persistedDefinition?.id ||
      mergedDefinition?.name ||
      this.definitionLoadKey ||
      this.flowKey ||
      ''
    const mergedDefinitionTitle =
      mergedDefinition?.title ||
      (mergedDefinition?.id ? mergedDefinition?.name : null) ||
      persistedDefinition?.title ||
      mergedDefinitionKey
    const resolvedDefinition = mergedDefinition
      ? {
          ...mergedDefinition,
          id: mergedDefinitionKey,
          name: mergedDefinitionKey,
          title: mergedDefinitionTitle,
          form: {
            ...(mergedDefinition.form || {}),
            formType: mergedForm.formType,
            formId: mergedForm.formId,
          },
          formType: mergedForm.formType,
          formKey: mergedForm.formId,
        }
      : null

    const resolvedAppName = resolveDesignAppNameFromProps(this.props)

    return {
      ...(this.props.data || {}),
      appName: resolvedAppName,
      flowDefinition: resolvedDefinition,
      formType:
        resolvedDefinition?.form?.formType ??
        resolvedDefinition?.formType ??
        this.props?.data?.formType ??
        null,
      formId:
        resolvedDefinition?.form?.formId ??
        this.props?.data?.formId ??
        this.props?.data?.formKey ??
        null,
      formKey:
        resolvedDefinition?.form?.formId ??
        resolvedDefinition?.formKey ??
        this.props?.data?.formKey ??
        null,
    }
  }

  render() {
    const currentDefinition = this.state.value || this.props.value || {}
    const readonly = this.isReadonly()
    const shouldRenderDefinitionPlaceholder =
      !this.state.session &&
      !hasDefinitionValue(this.state.value) &&
      !hasDefinitionValue(this.props.value) &&
      !this.flowKey
    const normalizedCoreCapabilities = normalizeApprovalWorkflowEditorCoreCapabilities(
      this.props.coreCapabilities,
      readonly
    )
    const toolbarBaseInfoEntry = this.buildToolbarBaseInfoEntry({
      readonly,
      currentDefinition,
    })
    const bridgeContext =
      ApprovalWorkflowEditorIntegrationAdapter.resolveCoreBridgeContext({
        props: this.props,
        flowKey: this.flowKey,
        readonly,
        coreCapabilities: normalizedCoreCapabilities,
        candidateSource: this.state.candidateSource,
        formPermissionFieldSource: this.state.formPermissionFieldSource,
        candidateFieldSource: this.state.candidateFieldSource,
      })
    const editorNode = shouldRenderDefinitionPlaceholder ? (
      <div
        className="workflow-editor-empty-state text-muted d-flex align-items-center justify-content-center"
        style={{
          height: '100%',
          minHeight: 240,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {t('请先在外层页面指定流程标识，再开始创建审批流程定义。')}
      </div>
    ) : (
      this.renderEditor({
        value: this.state.value || this.props.value,
        readonly,
        coreCapabilities: normalizedCoreCapabilities,
        bridgeContext: {
          ...bridgeContext,
          toolbarSurface: {
            ...(bridgeContext?.toolbarSurface || {}),
            baseInfoEntry: toolbarBaseInfoEntry,
          },
        },
      })
    )

    return (
      <div
        className="workflow-editor-host"
        data-testid="workflow-editor-host"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        {editorNode}
      </div>
    )
  }
}
