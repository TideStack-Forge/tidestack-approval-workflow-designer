import { t } from '../../../../i18n.js'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import PropertyEditor from './PropertyEditor.jsx'
import WorkflowEdgeInspector from './WorkflowEdgeInspector.jsx'
import {
  getWorkflowInspectorPanelTitle,
  isHiddenLegacyWorkflowInspectorTargetKind,
  resolveWorkflowInspectorTargetKind,
} from '../../../../editor-core/workflowInspectorRegistry'

const RightPanel = (
  {
    selectionMode,
    selection,
    inspectorTargetSnapshot,
    selectionSnapshot,
    session,
    edges = [],
    onPropertyChange,
    onEdgePropertyChange,
    isReadonly,
    coreCapabilities,
    conditionFieldSource,
    visible = false,
    onRequestClose,
    onOccupiedWidthChange,
  }
) => {
  const [panelWidth, setPanelWidth] = useState(450)
  const [isDragging, setIsDragging] = useState(false)
  const resizeHandleRef = useRef(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(450)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      const deltaX = startXRef.current - e.clientX
      const newWidth = Math.max(300, Math.min(800, startWidthRef.current + deltaX))
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  useLayoutEffect(() => {
    onOccupiedWidthChange?.(visible ? panelWidth : 0)
  }, [onOccupiedWidthChange, panelWidth, visible])

  const handleResizeStart = (e) => {
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = e.clientX
    startWidthRef.current = panelWidth
  }

  const resolvedSelectionMode =
    inspectorTargetSnapshot?.selectionMode || selectionMode || (selection ? 'single-node' : 'none')
  const selectedNodeCount = selectionSnapshot?.nodeIds?.length || 0
  const selectedEdgeCount = selectionSnapshot?.edgeIds?.length || 0
  const inspectorTargetKind =
    inspectorTargetSnapshot?.targetKind ||
    resolveWorkflowInspectorTargetKind({
      selectionMode: resolvedSelectionMode,
      selection,
    })
  const panelTitle = getWorkflowInspectorPanelTitle(inspectorTargetKind)
  const inspectorReadonly = isReadonly || coreCapabilities?.allowInspectorEdit === false
  const compatibilityNodeSelected =
    resolvedSelectionMode === 'single-node' &&
    isHiddenLegacyWorkflowInspectorTargetKind(inspectorTargetKind)
  const panelBody = resolvedSelectionMode === 'multi'
    ? (
      <>
        <div className="info-message">
          <i className="fa-solid fa-layer-group"></i>
          <p>{t('已选择多个对象，当前版本暂不支持批量属性编辑。')}</p>
        </div>
        <div className="property-group workflow-multi-selection-summary">
          <div className="property-item">
            <label>{t('节点数量')}</label>
            <span>{selectedNodeCount}</span>
          </div>
          <div className="property-item">
            <label>{t('连线数量')}</label>
            <span>{selectedEdgeCount}</span>
          </div>
        </div>
        <p className="info-text">{t('可继续使用删除或视口命令处理当前选择。')}</p>
      </>
    )
    : selection
      ? (
        resolvedSelectionMode === 'single-node'
          ? (
            <>
              {compatibilityNodeSelected ? (
                <div className="info-message">
                  <i className="fa-solid fa-shield-halved"></i>
                  <p>{t('当前节点属于兼容读取范围，右侧只保留基础摘要，不再提供旧版分支/定时器属性编辑。')}</p>
                </div>
              ) : null}
              <PropertyEditor
                node={selection}
                targetSnapshot={inspectorTargetSnapshot}
                session={session}
                onPropertyChange={onPropertyChange}
                isReadonly={inspectorReadonly}
                conditionFieldSource={conditionFieldSource}
              />
            </>
          )
          : (
            <WorkflowEdgeInspector
              edge={selection}
              edges={edges}
              onEdgePropertyChange={onEdgePropertyChange}
              isReadonly={inspectorReadonly}
              conditionFieldSource={conditionFieldSource}
            />
          )
      )
      : (
        <div className="empty-state">
          <i className="fa-solid fa-circle-info" style={{ fontSize: '48px', color: '#ccc' }}></i>
          <p>{t('请选择节点或连线查看属性')}</p>
        </div>
      )

  return (
    <div
      className={`properties-panel ${visible ? 'expanded' : 'collapsed'}`}
      data-testid="workflow-panel-right"
      data-panel-visible={visible ? 'true' : 'false'}
      style={visible ? { width: `${panelWidth}px` } : undefined}
    >
      {visible && (
        <>
          <div className="resize-handle" ref={resizeHandleRef} onMouseDown={handleResizeStart} />
          <div className="panel-content">
            <div className="panel-header">
              <h3 className="panel-title">{t(panelTitle)}</h3>
              <button
                type="button"
                className="panel-close-button"
                data-testid="workflow-right-panel-close"
                aria-label={t('隐藏属性面板')}
                onClick={() => {
                  onRequestClose?.()
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="panel-body">
              {panelBody}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RightPanel
