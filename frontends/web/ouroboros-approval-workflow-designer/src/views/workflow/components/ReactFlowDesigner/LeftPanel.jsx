import { useLocale } from '../../../../useLocale.js'
import { t } from '../../../../i18n.js'
import React, { useMemo, useState } from 'react'
import { buildWorkflowNodeCatalog } from '../../../../editor-core/workflowNodeCatalog'
import { getWorkflowNodeAppearance, isWorkflowSpecialNodeType } from './workflowNodeAppearance'

const LeftPanel = ({
  readonly,
  coreCapabilities,
  visible = true,
  onRequestClose,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [searchKeyword, setSearchKeyword] = useState('')
  const locale = useLocale()
  const nodeCatalog = useMemo(
    () => buildWorkflowNodeCatalog({ readonly, coreCapabilities }),
    [coreCapabilities, readonly]
  )

  const groupedNodes = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()

    return nodeCatalog.reduce((acc, node) => {
      const searchableText = [
        node.label,
        t(node.label),
        t(node.group),
        t(node.description),
        node.nodeType,
        node.group,
        node.description,
        getWorkflowNodeAppearance(node.nodeType)?.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (normalizedKeyword && !searchableText.includes(normalizedKeyword)) {
        return acc
      }

      const groupName = node.group || '其他'
      if (!acc[groupName]) {
        acc[groupName] = []
      }
      acc[groupName].push(node)
      return acc
    }, {})
  }, [nodeCatalog, searchKeyword, locale])

  const groupedNodeEntries = Object.entries(groupedNodes)

  if (nodeCatalog.length === 0) {
    return null
  }

  const toggleGroup = (groupName) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const onDragStart = (event, node) => {
    if (!node.draggable) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData('application/reactflow', node.nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className={`left-panel ${visible ? '' : 'collapsed'}`}
      data-testid="workflow-panel-left"
      data-panel-visible={visible ? 'true' : 'false'}
    >
      <div className="left-panel-header">
        <label className="node-search-field">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t('搜索节点')}
            aria-label={t('搜索节点')}
            data-testid="workflow-node-search"
          />
        </label>
        <button
          type="button"
          className="panel-close-button"
          data-testid="workflow-left-panel-close"
          aria-label={t('隐藏节点面板')}
          onClick={() => {
            onRequestClose?.()
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="node-groups">
        {groupedNodeEntries.length === 0 ? (
          <div className="node-search-empty">{t('无匹配节点')}</div>
        ) : (
          groupedNodeEntries.map(([groupName, nodes]) => (
            <div key={groupName} className="node-group">
              <div
                className="group-title"
                onClick={() => toggleGroup(groupName)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleGroup(groupName)
                  }
                }}>
                <h4>{t(groupName)}</h4>
                <i
                  className={`fa-solid fa-chevron-right ${collapsedGroups[groupName] ? '' : 'rotate'}`}
                ></i>
              </div>
              <div
                className="group-content"
                style={{
                  maxHeight: collapsedGroups[groupName] ? '0' : 'none',
                  paddingBottom: collapsedGroups[groupName] ? '0' : '25px',
                }}
              >
                <ul className="node-list">
                  {nodes.map((node) => {
                    const appearance = getWorkflowNodeAppearance(node.nodeType)
                    const isSpecialNode = isWorkflowSpecialNodeType(node.nodeType)
                    const secondaryLabel = appearance.label !== node.label ? appearance.label : ''
                    return (
                      <li
                        key={node.key}
                        draggable={node.draggable}
                        onDragStart={(event) => onDragStart(event, node)}
                        data-testid="workflow-node-palette-item"
                        data-node-type={node.nodeType}
                        className={`workflow-node-palette-item ${isSpecialNode ? 'workflow-node-palette-item-special' : ''}`}
                        style={{
                          cursor: node.draggable ? 'grab' : 'not-allowed',
                          opacity: node.draggable ? 1 : 0.6,
                          '--workflow-node-border-color': appearance.borderColor,
                          '--workflow-node-icon-color': appearance.iconColor || appearance.borderColor,
                        }}
                        title={t(node.hiddenReason || node.description || node.label)}>
                        <span
                          className="workflow-node-palette-item-icon"
                          aria-hidden="true">
                          <i className={appearance.iconClassName}></i>
                        </span>
                        <span className="workflow-node-palette-item-content">
                          <span className="node-name">{t(node.label)}</span>
                          {secondaryLabel ? (
                            <span className="workflow-node-palette-item-meta">
                              {t(secondaryLabel)}
                            </span>
                          ) : null}
                        </span>
                        {!node.enabled && (
                          <span className="node-badge">{t('暂未开放')}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LeftPanel
