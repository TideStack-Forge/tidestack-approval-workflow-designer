import { t } from '../../../../i18n.js'
import React, { useCallback, useMemo, useState } from 'react'
import AmisPropertyForm from './AmisPropertyForm.jsx'
import {
  buildWorkflowEdgeConditionPatch,
  buildWorkflowEdgeInspectorSchemaDescriptor,
  buildWorkflowEdgeInspectorValueProjection,
  summarizeCondition,
} from './workflowEdgeInspectorContract.js'
import {
  edgeBelongsToConditionalRoute,
  resolveSplitEdgeContext,
} from '../../../../editor-core/workflowEdgeConditionContract.js'

const WorkflowEdgeInspector = ({
  edge,
  edges = [],
  onEdgePropertyChange,
  isReadonly,
  conditionFieldSource,
}) => {
  const [submitError, setSubmitError] = useState('')

  const splitEdgeContext = useMemo(() => resolveSplitEdgeContext(edge, edges), [edge, edges])
  const hasCondition = Boolean(edge?.data?.condition ?? edge?.condition)
  const hasOrder = Number.isFinite(Number(edge?.data?.order ?? edge?.order))
  const canEditCondition = !isReadonly && edgeBelongsToConditionalRoute(edge, edges)
  const conditionFields = Array.isArray(conditionFieldSource?.fields) ? conditionFieldSource.fields : []
  const schemaDescriptor = useMemo(() => {
    if (!canEditCondition) {
      return null
    }

    return buildWorkflowEdgeInspectorSchemaDescriptor({
      targetKind: 'edge:sequence',
      isReadonly,
      conditionFieldSource,
      hasOrder,
    })
  }, [canEditCondition, conditionFieldSource, hasOrder, isReadonly])
  const valueProjection = useMemo(() => {
    if (!canEditCondition || !schemaDescriptor?.schema) {
      return null
    }

    return buildWorkflowEdgeInspectorValueProjection({
      edge,
      hasOrder,
    })
  }, [canEditCondition, edge, hasOrder, schemaDescriptor?.schema])

  const handleSubmit = useCallback(
    async (submission) => {
      if (!onEdgePropertyChange || !edge?.id) {
        setSubmitError('当前路由条件无法同步到连线配置')
        return
      }

      const patch = buildWorkflowEdgeConditionPatch({
        edge,
        submission,
      })
      if (!patch) {
        return
      }

      setSubmitError('')
      const updated = await onEdgePropertyChange(edge.id, patch)
      if (updated === false) {
        setSubmitError('当前路由条件无法同步到连线配置')
      }
    },
    [edge, onEdgePropertyChange]
  )

  if (!edge) {
    return null
  }

  const showBlockingSourceError = canEditCondition && conditionFields.length === 0

  return (
    <div className="property-editor">
      <div className="property-section">
        {showBlockingSourceError ? (
          <p className="text-danger">
            {t('当前入口未提供可用条件字段，请先回到外层页面确认关联表单与字段来源。')}
          </p>
        ) : null}
        {submitError ? <p className="text-danger">{t(submitError)}</p> : null}
        {canEditCondition && schemaDescriptor?.schema && valueProjection ? (
          <AmisPropertyForm
            schemaKey={schemaDescriptor.schemaKey}
            schema={schemaDescriptor.schema}
            valueProjection={valueProjection}
            isReadonly={false}
            onSubmit={handleSubmit}
            className="workflow-edge-inspector-form"
          />
        ) : hasCondition ? (
          <div className="form-group">
            <label>{t('路由条件')}</label>
            <div className="condition-preview">
              <code>{summarizeCondition(edge?.data?.condition ?? edge?.condition, conditionFields)}</code>
            </div>
          </div>
        ) : null}
        {hasOrder && (!schemaDescriptor?.schema || isReadonly || showBlockingSourceError) ? (
          <div className="form-group">
            <label>{t('路由顺序')}</label>
            <input
              type="text"
              value={edge?.data?.order ?? edge?.order ?? ''}
              disabled
              className="form-control"
            />
          </div>
        ) : null}
        {!canEditCondition && !hasCondition && !hasOrder ? (
          <p className="text-muted">{t('当前连线无需配置条件。')}</p>
        ) : null}
        {splitEdgeContext.isSplitEdge && !hasOrder ? (
          <p className="info-text">
            {t('当前共有 {{count}} 条同源出边，这条连线按分支路由处理。', {
              count: splitEdgeContext.outgoingCount,
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default WorkflowEdgeInspector
