import { t } from '../../../../i18n.js'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AmisPropertyForm from './AmisPropertyForm.jsx'
import {
  buildNodeConfigSchemaDescriptor,
  buildNodeConfigValueProjection,
  buildWorkflowInspectorSchemaKey,
  extractDrawerSubmitPayload,
  pickWorkflowInspectorBridgeSchemaContext,
} from './propertyEditorContracts.js'
import { useApprovalWorkflowEditorCoreBridge } from '../../../../editor-core/approvalWorkflowEditorCoreBridge'
import {
  isConfigurableWorkflowInspectorTargetKind,
  isHiddenLegacyWorkflowInspectorTargetKind,
} from '../../../../editor-core/workflowInspectorRegistry'

const PropertyEditor = ({
  node,
  targetSnapshot,
  session,
  onPropertyChange,
  isReadonly,
  conditionFieldSource,
}) => {
  const bridgeContext = useApprovalWorkflowEditorCoreBridge()
  const bridgeContextRef = useRef(bridgeContext)
  const [schemaDescriptor, setSchemaDescriptor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    bridgeContextRef.current = bridgeContext
  }, [bridgeContext])

  const targetId = targetSnapshot?.targetId || null
  const inspectorTargetKind = targetSnapshot?.targetKind || 'selection:none'
  const compatibilityOnly = isHiddenLegacyWorkflowInspectorTargetKind(inspectorTargetKind)
  const sessionRevision = session?.getRevision?.() || 0
  const bridgeSchemaContext = useMemo(
    () => pickWorkflowInspectorBridgeSchemaContext(bridgeContext),
    [
      bridgeContext?.nodeConfig?.allowLegacyNodeConfigSurface,
      bridgeContext?.nodeConfig?.hideFormPermission,
      bridgeContext?.nodeConfig?.approvalConfiguration?.hideActions,
      bridgeContext?.nodeConfig?.approvalConfiguration?.hidePercentage,
      bridgeContext?.nodeConfig?.approvalConfiguration?.hideRejectAction,
      bridgeContext?.nodeConfig?.approvalConfiguration?.hideNoCandidateMode,
      bridgeContext?.formType,
      bridgeContext?.candidateSource?.revisionToken,
      bridgeContext?.formPermissionFieldSource?.revisionToken,
    ]
  )
  const schemaKey = useMemo(
    () =>
      buildWorkflowInspectorSchemaKey({
        targetKind: inspectorTargetKind,
        nodeType: targetSnapshot?.nodeType,
        isReadonly,
        conditionFieldSource,
        bridgeContext: bridgeSchemaContext,
      }),
    [bridgeSchemaContext, conditionFieldSource?.revisionToken, inspectorTargetKind, isReadonly, targetSnapshot?.nodeType]
  )

  useEffect(() => {
    let cancelled = false

    const loadSchemaDescriptor = async () => {
      if (!targetId || !isConfigurableWorkflowInspectorTargetKind(inspectorTargetKind)) {
        setSchemaDescriptor(null)
        setLoadError('')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const nextSchemaDescriptor = await buildNodeConfigSchemaDescriptor({
          session,
          nodeId: targetId,
          targetKind: inspectorTargetKind,
          nodeType: targetSnapshot?.nodeType,
          isReadonly,
          conditionFieldSource,
          bridgeContext: bridgeContextRef.current,
        })

        if (cancelled) {
          return
        }

        setSchemaDescriptor(nextSchemaDescriptor)
      } catch (error) {
        if (cancelled) {
          return
        }

        setSchemaDescriptor(null)
        setLoadError(error?.message || '节点配置加载失败')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSchemaDescriptor()

    return () => {
      cancelled = true
    }
  }, [schemaKey, session])

  const valueProjection = useMemo(() => {
    if (!targetId) {
      return null
    }

    return buildNodeConfigValueProjection({
      session,
      nodeId: targetId,
      formPermissionFieldSource: bridgeContext?.formPermissionFieldSource,
    })
  }, [bridgeContext?.formPermissionFieldSource, session, sessionRevision, targetId])

  const handleSubmitNodeConfig = useCallback(
    (submission) => {
      if (!schemaDescriptor || !targetId || !onPropertyChange) {
        return
      }

      const patch = extractDrawerSubmitPayload(submission, {
        candidateSource: bridgeContextRef.current?.candidateSource,
      })
      if (!patch) {
        return
      }

      onPropertyChange(targetId, patch)
    },
    [onPropertyChange, schemaDescriptor, targetId, targetSnapshot?.nodeType]
  )

  if (!node) {
    return null
  }

  return (
    <div className="property-editor">
      <div className="property-section">
        {compatibilityOnly ? (
          <p className="text-muted">
            {t('该节点属于兼容读取范围，当前版本不再提供正式属性编辑。')}
          </p>
        ) : null}
        {loading ? <p className="text-muted">{t('正在加载旧版配置项…')}</p> : null}
        {!loading && loadError ? <p className="text-danger">{loadError}</p> : null}
        {!compatibilityOnly && !loading && !loadError && schemaDescriptor?.schema ? (
          <AmisPropertyForm
            schemaKey={schemaDescriptor.schemaKey || schemaKey}
            schema={schemaDescriptor.schema}
            valueProjection={valueProjection}
            isReadonly={isReadonly}
            onSubmit={handleSubmitNodeConfig}
            className="node-config-form"
          />
        ) : null}
        {!compatibilityOnly && !loading && !loadError && !schemaDescriptor?.schema ? (
          <p className="text-muted">{t('当前节点没有额外可编辑配置。')}</p>
        ) : null}
      </div>
    </div>
  )
}

export default PropertyEditor
