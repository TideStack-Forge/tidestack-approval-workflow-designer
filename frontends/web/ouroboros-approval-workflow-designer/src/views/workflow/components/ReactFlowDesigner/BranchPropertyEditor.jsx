import { t } from '../../../../i18n.js'
import React, { useState, useEffect } from 'react'
import { openDrawer } from 'ouroboros-sdk'
import {
  buildRouteEdgeDrawerRequest,
  normalizeRouteEdgePatch,
  summarizeCondition,
} from './workflowEdgeInspectorContract.js'

const BranchPropertyEditor = ({
  node,
  session,
  onAddBranch,
  onRemoveBranch,
  onEdgePropertyChange,
  isReadonly,
  conditionFields,
  edges = [],
}) => {
  const [branchNode, setBranchNode] = useState(null)
  const [branches, setBranches] = useState([])
  const [drawerError, setDrawerError] = useState('')
  const sessionRevision = session?.getRevision?.() || 0

  useEffect(() => {
    if (node?.id && session) {
      const repository = session.getRepository()
      const middleNode = repository.get(node.id)

      if (middleNode && middleNode.type === '分流节点') {
        setBranchNode(middleNode)
        setBranches(middleNode.branches || [])
      }
    }
  }, [node, session, sessionRevision])

  const resolveBranchEdge = (conditionNode) => {
    const matchedEdge = (edges || []).find((edge) => edge?.id === conditionNode?.id)
    if (matchedEdge) {
      return matchedEdge
    }

    return {
      id: conditionNode?.id,
      data: {
        condition: conditionNode?.condition || null,
        order: conditionNode?.order,
      },
    }
  }

  const handleAddBranch = () => {
    if (onAddBranch && branchNode) {
      onAddBranch(branchNode.id)
    }
  }

  const handleRemoveBranch = async (conditionNode) => {
    if (onRemoveBranch && conditionNode) {
      const confirmed = window.confirm(
        t('确定要删除分支"{{p0}}"吗？删除后该分支下的所有节点都会被移除。', {
          p0: conditionNode.name,
        })
      )
      if (confirmed) {
        await onRemoveBranch(conditionNode.id)
      }
    }
  }

  const handleEditCondition = async (conditionNode) => {
    if (!conditionFields || conditionFields.length === 0) {
      setDrawerError('当前入口未提供可用条件字段，请先回到外层页面确认关联表单与字段来源。')
      return
    }

    if (!onEdgePropertyChange) {
      setDrawerError('当前路由条件无法同步到 V2 连线配置')
      return
    }

    setDrawerError('')
    const branchEdge = resolveBranchEdge(conditionNode)

    try {
      const result = await openDrawer({
        ...buildRouteEdgeDrawerRequest(branchEdge, conditionFields),
        localeNamespace: 'workflow-editor',
      })
      const patch = normalizeRouteEdgePatch(branchEdge, result)
      if (!patch) {
        return
      }

      onEdgePropertyChange(conditionNode.id, patch)
    } catch (error) {
      console.error('编辑条件失败:', error)
      setDrawerError(error?.message || '编辑条件失败')
    }
  }

  if (!branchNode) {
    return null
  }

  return (
    <div className="branch-property-editor">
      <div className="property-section">
        <div className="form-group">
          <label>{t('分支逻辑')}</label>
          <input
            type="text"
            value={t(
              branchNode.logic === 'inclusive'
                ? '并行（所有分支都执行）'
                : '互斥（只执行第一个满足条件的分支）'
            )}
            disabled
            className="form-control"
          />
        </div>
      </div>

      <div className="property-section">
        <div className="section-header">
          <h4 className="section-title">{t('分支列表')}</h4>
          {!isReadonly && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleAddBranch}
              title={t('添加新分支')}>
              <i className="fa-solid fa-plus"></i> {t('添加分支')}
            </button>
          )}
        </div>

        {branches.length === 0 ? (
          <div className="empty-state">
            <p>{t('暂无分支，点击"添加分支"按钮创建第一个分支')}</p>
          </div>
        ) : (
          <div className="branch-list">
            {drawerError ? <p className="text-danger">{t(drawerError)}</p> : null}
            {branches.map((conditionNode, index) => (
              <div key={conditionNode.id} className="branch-item">
                <div className="branch-item-header">
                  <span className="branch-index">
                    {t('分支')}
                    {index + 1}
                  </span>
                  {!isReadonly && branches.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon btn-danger"
                      onClick={() => handleRemoveBranch(conditionNode)}
                      title={t('删除此分支')}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  )}
                </div>
                <div className="branch-item-body">
                  <div className="form-group">
                    <label>{t('条件名称')}</label>
                    <input
                      type="text"
                      value={conditionNode.name || ''}
                      disabled
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('条件表达式')}</label>
                    <div className="condition-preview">
                      {resolveBranchEdge(conditionNode)?.data?.condition ? (
                        <code>{summarizeCondition(resolveBranchEdge(conditionNode).data.condition)}</code>
                      ) : (
                        <span className="text-muted">{t('未设置条件')}</span>
                      )}
                    </div>
                    {!isReadonly && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary mt-2"
                        onClick={() => handleEditCondition(conditionNode)}
                        title={t('编辑条件')}>
                        <i className="fa-solid fa-edit"></i> {t('编辑条件')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BranchPropertyEditor
