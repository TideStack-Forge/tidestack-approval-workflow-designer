import { t } from '../../../../i18n.js'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  WORKFLOW_CHROME_VISUAL_KINDS,
  WORKFLOW_CHROME_VISUAL_TONES,
  buildWorkflowChromeVisualStateDataAttributes,
  createWorkflowChromeTooltipMeta,
  createWorkflowChromeVisualState,
  resolveWorkflowChromeTooltipText,
} from './workflowChromeVisualContract'

const DIAGNOSTIC_SEVERITY_LABEL = Object.freeze({
  error: '错误',
  warning: '警告',
})

const WorkflowEditorDiagnosticsSurface = ({
  diagnosticsSnapshot,
  diagnosticsStatusMeta,
  diagnosticsBlockingCount,
  indicatorState,
  onNavigate,
  visualContract,
}) => {
  const containerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  const diagnosticItems = Array.isArray(diagnosticsSnapshot?.items) ? diagnosticsSnapshot.items : []
  const diagnosticsStatus = indicatorState?.status || diagnosticsSnapshot?.status || 'clean'
  const diagnosticsIconClassName = indicatorState?.iconClassName || 'fa-solid fa-check'
  const diagnosticsSummaryText =
    diagnosticItems.length > 0
      ? `${t(diagnosticsStatusMeta.summary)} (${t('共 {{p0}} 项，阻塞项 {{p1}} 个', { p0: diagnosticItems.length, p1: diagnosticsBlockingCount })})`
      : t(diagnosticsStatusMeta.summary)
  const diagnosticsTooltip = resolveWorkflowChromeTooltipText(
    createWorkflowChromeTooltipMeta({
      label: t('流程诊断：{{status}}', { status: t(diagnosticsStatusMeta.label) }),
      tooltip: diagnosticsSummaryText,
    }),
    visualContract
  )
  const diagnosticsAriaLabel =
    diagnosticsTooltip ||
    t('流程诊断：{{status}}', { status: t(diagnosticsStatusMeta.label) })
  const diagnosticsTone =
    diagnosticsStatusMeta?.tone && Object.values(WORKFLOW_CHROME_VISUAL_TONES).includes(diagnosticsStatusMeta.tone)
      ? diagnosticsStatusMeta.tone
      : WORKFLOW_CHROME_VISUAL_TONES.DEFAULT
  const diagnosticsVisualStateDataAttributes = buildWorkflowChromeVisualStateDataAttributes(
    createWorkflowChromeVisualState({
      kind: WORKFLOW_CHROME_VISUAL_KINDS.STATUS,
      pressed: isOpen,
      tone: diagnosticsTone,
    })
  )

  const closeDiagnosticsLayer = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) {
        return
      }

      closeDiagnosticsLayer()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDiagnosticsLayer()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeDiagnosticsLayer, isOpen])

  const handleItemNavigate = useCallback(
    async (item) => {
      const didNavigate = await onNavigate?.(item)
      if (didNavigate) {
        closeDiagnosticsLayer()
      }
    },
    [closeDiagnosticsLayer, onNavigate]
  )

  return (
    <div
      ref={containerRef}
      className={`workflow-editor-diagnostics-surface workflow-editor-diagnostics-${diagnosticsStatus}`}
      data-testid="workflow-editor-diagnostics-surface"
    >
      <button
        type="button"
        className={`workflow-editor-diagnostics-trigger${isOpen ? ' is-open' : ''}`}
        title={t(diagnosticsTooltip)}
        aria-label={t(diagnosticsAriaLabel)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        data-testid="workflow-editor-diagnostics-trigger"
        data-diagnostics-status={diagnosticsStatus}
        {...diagnosticsVisualStateDataAttributes}
        onClick={() => {
          setIsOpen((currentOpen) => !currentOpen)
        }}
      >
        <span className="workflow-editor-diagnostics-trigger-icon" aria-hidden="true">
          <i className={diagnosticsIconClassName}></i>
        </span>
        <span className="workflow-editor-diagnostics-trigger-label">
          {t(diagnosticsStatusMeta.label)}
        </span>
        {diagnosticItems.length > 0 ? (
          <span className="workflow-editor-diagnostics-trigger-count" aria-hidden="true">
            {diagnosticItems.length}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div
          className="workflow-editor-diagnostics-popover"
          data-testid="workflow-editor-diagnostics-popover"
          role="dialog"
          aria-label={t('流程诊断')}>
          <div
            className="workflow-editor-diagnostics-summary"
            data-testid="workflow-editor-diagnostics-summary">
            <span className="workflow-editor-diagnostics-badge">
              {t(diagnosticsStatusMeta.label)}
            </span>
            <div className="workflow-editor-diagnostics-summary-text">
              <strong>{t(diagnosticsStatusMeta.summary)}</strong>
              {diagnosticItems.length > 0 ? (
                <span>
                  {t('共 {{p0}} 项，阻塞项 {{p1}} 个', {
                    p0: diagnosticItems.length,
                    p1: diagnosticsBlockingCount,
                  })}
                </span>
              ) : (
                <span>{t('允许继续编辑，最终准入以后端校验为准。')}</span>
              )}
            </div>
          </div>
          {diagnosticItems.length > 0 ? (
            <ul className="workflow-editor-diagnostics-list">
              {diagnosticItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`workflow-editor-diagnostics-item workflow-editor-diagnostics-item-${item.severity}`}
                    title={t(item.message)}
                    onClick={() => {
                      void handleItemNavigate(item)
                    }}
                  >
                    <span className="workflow-editor-diagnostics-item-meta">
                      {t(
                        DIAGNOSTIC_SEVERITY_LABEL[item.severity] ||
                          DIAGNOSTIC_SEVERITY_LABEL.warning
                      )}
                    </span>
                    <span className="workflow-editor-diagnostics-item-message">
                      {t(item.message)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default WorkflowEditorDiagnosticsSurface
