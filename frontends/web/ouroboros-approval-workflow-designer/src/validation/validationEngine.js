import { reactFlowTypeToMiddleType } from '../canvas-adapters/react-flow/nodeTypeMapping.js'
import { SYNTHETIC_NODE_TYPES } from '../translator/define/reactflow.js'
import {
  NODE_TYPES,
  hasCycle,
  isValidConnection as isAllowedConnection,
} from './connection-rules.js'
import {
  edgeBelongsToConditionalRoute,
  resolveEdgeConditionValue,
} from '../editor-core/workflowEdgeConditionContract.js'

export const VALIDATION_ERROR_CODES = Object.freeze({
  INCOMPLETE_CONNECTION: 'INCOMPLETE_CONNECTION',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  SELF_LOOP: 'SELF_LOOP',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE',
  CONNECTION_RULE: 'CONNECTION_RULE',
  SOURCE_OUTGOING_LIMIT: 'SOURCE_OUTGOING_LIMIT',
  TARGET_INCOMING_LIMIT: 'TARGET_INCOMING_LIMIT',
  CYCLE: 'CYCLE',
  UNSUPPORTED_NODE_TYPE: 'UNSUPPORTED_NODE_TYPE',
})

export const WORKFLOW_DIAGNOSTIC_CODES = Object.freeze({
  ...VALIDATION_ERROR_CODES,
  APPROVAL_NODE_CANDIDATES_REQUIRED: 'APPROVAL_NODE_CANDIDATES_REQUIRED',
  HANDLE_NODE_CANDIDATES_REQUIRED: 'HANDLE_NODE_CANDIDATES_REQUIRED',
  NODE_OUTGOING_REQUIRED: 'NODE_OUTGOING_REQUIRED',
  EDGE_CONDITION_REQUIRED: 'EDGE_CONDITION_REQUIRED',
  CONDITION_FIELD_SOURCE_REQUIRED: 'CONDITION_FIELD_SOURCE_REQUIRED',
  CONDITION_FIELD_UNAVAILABLE: 'CONDITION_FIELD_UNAVAILABLE',
  CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED: 'CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED',
  TIMEOUT_TRANSFER_TARGET_REQUIRED: 'TIMEOUT_TRANSFER_TARGET_REQUIRED',
  START_NODE_UNIQUE_REQUIRED: 'START_NODE_UNIQUE_REQUIRED',
})

const NODE_TYPE_LABELS = Object.freeze({
  start: '发起节点',
  approval: '审批节点',
  handle: '办理节点',
  branch: '分流节点',
  condition: '条件节点',
  subprocess: '子流程节点',
  'join-or': '合并',
  end: '结束',
})

const MULTI_INCOMING_NODE_TYPES = new Set(['end', 'join-or'])
const WORKFLOW_DIAGNOSTIC_SEVERITY_PRIORITY = Object.freeze({
  warning: 1,
  error: 2,
})

const buildValidationResult = ({
  valid,
  code = null,
  error = '',
  shouldNotify = false,
}) => ({
  valid,
  code,
  error,
  shouldNotify,
})

const buildWorkflowDiagnosticItem = ({
  id,
  severity,
  code,
  message,
  targetType,
  targetId,
  blocking = false,
}) => ({
  id,
  severity,
  code,
  message,
  targetType,
  targetId,
  blocking,
  persistUntilResolved: true,
})

const normalizeConnection = (sourceOrConnection, targetId) => {
  if (typeof sourceOrConnection === 'object' && sourceOrConnection !== null) {
    return {
      source: sourceOrConnection.source,
      target: sourceOrConnection.target,
    }
  }

  return {
    source: sourceOrConnection,
    target: targetId,
  }
}

const conditionPayloadIsFilled = (condition) => {
  if (condition === null || condition === undefined) {
    return false
  }

  if (typeof condition === 'string') {
    return condition.trim().length > 0
  }

  if (Array.isArray(condition)) {
    return condition.length > 0
  }

  if (typeof condition === 'object') {
    return Object.keys(condition).length > 0
  }

  return Boolean(condition)
}

const chooseHigherSeverity = (currentSeverity, nextSeverity) => {
  if (!currentSeverity) {
    return nextSeverity || null
  }

  if (!nextSeverity) {
    return currentSeverity
  }

  return WORKFLOW_DIAGNOSTIC_SEVERITY_PRIORITY[nextSeverity] >
    WORKFLOW_DIAGNOSTIC_SEVERITY_PRIORITY[currentSeverity]
    ? nextSeverity
    : currentSeverity
}

const deriveWorkflowValidationStatus = (items) => {
  const diagnosticItems = Array.isArray(items) ? items : []

  if (diagnosticItems.some((item) => item?.severity === 'error' && item?.blocking)) {
    return 'draft-invalid'
  }

  if (diagnosticItems.some((item) => item?.severity === 'error')) {
    return 'error'
  }

  if (diagnosticItems.some((item) => item?.severity === 'warning')) {
    return 'warning'
  }

  return 'clean'
}

export class ValidationEngine {
  constructor(nodes = [], edges = []) {
    this.nodes = nodes || []
    this.edges = edges || []
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]))
  }

  getNodeById(nodeId) {
    return this.nodeById.get(nodeId) || null
  }

  getNodeLabel(node) {
    if (!node) {
      return '节点'
    }

    return (
      node.data?.name ||
      node.data?.label ||
      NODE_TYPE_LABELS[node.type] ||
      node.id ||
      '节点'
    )
  }

  resolveValidationNodeType(node) {
    if (!node?.type) {
      return null
    }

    if (node.type === SYNTHETIC_NODE_TYPES.CONDITION) {
      return NODE_TYPES.CONDITION
    }

    return reactFlowTypeToMiddleType(node.type)
  }

  getOutgoingEdges(nodeId) {
    return this.edges.filter((edge) => edge?.source === nodeId)
  }

  getIncomingEdges(nodeId) {
    return this.edges.filter((edge) => edge?.target === nodeId)
  }

  validateConnection(sourceOrConnection, targetId) {
    const connection = normalizeConnection(sourceOrConnection, targetId)
    const sourceId = connection.source
    const resolvedTargetId = connection.target

    if (!sourceId || !resolvedTargetId) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.INCOMPLETE_CONNECTION,
      })
    }

    const sourceNode = this.getNodeById(sourceId)
    const targetNode = this.getNodeById(resolvedTargetId)

    if (!sourceNode) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.SOURCE_NOT_FOUND,
        error: '未找到连线的起点节点',
        shouldNotify: true,
      })
    }

    if (!targetNode) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.TARGET_NOT_FOUND,
        error: '未找到连线的终点节点',
        shouldNotify: true,
      })
    }

    if (sourceId === resolvedTargetId) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.SELF_LOOP,
        error: '节点不能连接到自身',
        shouldNotify: true,
      })
    }

    const duplicatedEdge = this.edges.find(
      (edge) => edge?.source === sourceId && edge?.target === resolvedTargetId
    )
    if (duplicatedEdge) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.DUPLICATE_EDGE,
        error: `节点“${this.getNodeLabel(sourceNode)}”与“${this.getNodeLabel(targetNode)}”之间已存在连线`,
        shouldNotify: true,
      })
    }

    const sourceType = this.resolveValidationNodeType(sourceNode)
    const targetType = this.resolveValidationNodeType(targetNode)

    if (!sourceType || !targetType) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.UNSUPPORTED_NODE_TYPE,
        error: '当前节点类型暂不支持连线',
        shouldNotify: true,
      })
    }

    if (!isAllowedConnection(sourceType, targetType)) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.CONNECTION_RULE,
        error: `节点“${this.getNodeLabel(sourceNode)}”不能连接到“${this.getNodeLabel(targetNode)}”`,
        shouldNotify: true,
      })
    }

    if (
      !MULTI_INCOMING_NODE_TYPES.has(targetNode.type) &&
      this.getIncomingEdges(resolvedTargetId).length > 0
    ) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.TARGET_INCOMING_LIMIT,
        error: `节点“${this.getNodeLabel(targetNode)}”已有上游节点，暂不支持多个节点汇入同一节点`,
        shouldNotify: true,
      })
    }

    if (
      hasCycle(this.nodes, this.edges, { source: sourceId, target: resolvedTargetId })
    ) {
      return buildValidationResult({
        valid: false,
        code: VALIDATION_ERROR_CODES.CYCLE,
        error: '这条连线会形成循环，请选择其他节点',
        shouldNotify: true,
      })
    }

    return buildValidationResult({ valid: true })
  }

  validateGraph() {
    const errors = []

    this.edges.forEach((edge) => {
      const nextEdges = this.edges.filter((candidateEdge) => candidateEdge !== edge)
      const nextEngine = new ValidationEngine(this.nodes, nextEdges)
      const validationResult = nextEngine.validateConnection(edge.source, edge.target)

      if (!validationResult.valid) {
        errors.push({
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          code: validationResult.code,
          error: validationResult.error,
        })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

export function createValidationEngine(nodes, edges) {
  return new ValidationEngine(nodes, edges)
}

export function buildWorkflowValidationSnapshot({
  nodes = [],
  edges = [],
  conditionFieldSource = null,
} = {}) {
  const validationEngine = createValidationEngine(nodes, edges)
  const items = []
  const conditionFields = Array.isArray(conditionFieldSource?.fields)
    ? conditionFieldSource.fields
    : []

  const graphValidation = validationEngine.validateGraph()
  graphValidation.errors.forEach((error) => {
    items.push(
      buildWorkflowDiagnosticItem({
        id: `edge:${error.edgeId}:${error.code}`,
        severity: 'error',
        code: error.code,
        message: error.error,
        targetType: 'edge',
        targetId: error.edgeId,
        blocking: true,
      })
    )
  })

  const startNodes = nodes.filter(
    (node) => validationEngine.resolveValidationNodeType(node) === NODE_TYPES.START
  )
  if (startNodes.length === 0) {
    items.push(
      buildWorkflowDiagnosticItem({
        id: `graph:${WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED,
        message: '画布必须包含一个流程开始节点',
        targetType: 'graph',
        blocking: true,
      })
    )
  } else if (startNodes.length > 1) {
    startNodes.forEach((node) => {
      items.push(
        buildWorkflowDiagnosticItem({
          id: `node:${node.id}:${WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED}`,
          severity: 'error',
          code: WORKFLOW_DIAGNOSTIC_CODES.START_NODE_UNIQUE_REQUIRED,
          message: '画布上只能保留一个流程开始节点',
          targetType: 'node',
          targetId: node.id,
          blocking: true,
        })
      )
    })
  }

  nodes.forEach((node) => {
    const validationNodeType = validationEngine.resolveValidationNodeType(node)
    const codeByNodeType = {
      [NODE_TYPES.APPROVAL]: WORKFLOW_DIAGNOSTIC_CODES.APPROVAL_NODE_CANDIDATES_REQUIRED,
      [NODE_TYPES.HANDLE]: WORKFLOW_DIAGNOSTIC_CODES.HANDLE_NODE_CANDIDATES_REQUIRED,
    }
    const diagnosticCode = codeByNodeType[validationNodeType]
    if (!diagnosticCode) {
      return
    }

    const candidates = Array.isArray(node?.data?.candidates) ? node.data.candidates : []
    if (candidates.length > 0) {
      return
    }

    items.push(
      buildWorkflowDiagnosticItem({
        id: `node:${node.id}:${diagnosticCode}`,
        severity: 'error',
        code: diagnosticCode,
        message: `节点“${validationEngine.getNodeLabel(node)}”的候选人不能为空`,
        targetType: 'node',
        targetId: node.id,
        blocking: true,
      })
    )
  })

  nodes.forEach((node) => {
    const validationNodeType = validationEngine.resolveValidationNodeType(node)
    if (validationNodeType !== NODE_TYPES.APPROVAL) {
      return
    }

    const timeout = node?.data?.timeout
    if (!timeout || timeout.action !== 'transfer') {
      return
    }

    const transferTo =
      typeof timeout.transferTo === 'string'
        ? timeout.transferTo.trim()
        : timeout.transferTo
    if (transferTo) {
      return
    }

    items.push(
      buildWorkflowDiagnosticItem({
        id: `node:${node.id}:${WORKFLOW_DIAGNOSTIC_CODES.TIMEOUT_TRANSFER_TARGET_REQUIRED}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.TIMEOUT_TRANSFER_TARGET_REQUIRED,
        message: `节点“${validationEngine.getNodeLabel(node)}”的超时转办目标不能为空`,
        targetType: 'node',
        targetId: node.id,
        blocking: true,
      })
    )
  })

  nodes.forEach((node) => {
    if (node?.type === 'end') {
      return
    }

    if (validationEngine.getOutgoingEdges(node.id).length > 0) {
      return
    }

    items.push(
      buildWorkflowDiagnosticItem({
        id: `node:${node.id}:${WORKFLOW_DIAGNOSTIC_CODES.NODE_OUTGOING_REQUIRED}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.NODE_OUTGOING_REQUIRED,
        message: `节点“${validationEngine.getNodeLabel(node)}”至少需要一条出边`,
        targetType: 'node',
        targetId: node.id,
        blocking: true,
      })
    )
  })

  const conditionalEdges = edges.filter((edge) =>
    edgeBelongsToConditionalRoute(edge, edges)
  )
  if (conditionalEdges.length > 0 && conditionFields.length === 0) {
    items.push(
      buildWorkflowDiagnosticItem({
        id: `graph:${WORKFLOW_DIAGNOSTIC_CODES.CONDITION_FIELD_SOURCE_REQUIRED}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.CONDITION_FIELD_SOURCE_REQUIRED,
        message: '当前流程存在条件路由，但未提供可用条件字段',
        targetType: 'graph',
        blocking: true,
      })
    )
  }

  const conditionFieldNames = (fields) =>
    fields.flatMap((field) =>
      Array.isArray(field.children)
        ? conditionFieldNames(field.children)
        : [field.value || field.name]
    )
  const availableConditionFields = new Set(conditionFieldNames(conditionFields))
  const checkConditionFields = (condition, edge) => {
    if (Array.isArray(condition?.children)) {
      condition.children.forEach((child) => checkConditionFields(child, edge))
      return
    }
    const name = condition?.left?.field
    if (!name || availableConditionFields.has(name)) return
    items.push(
      buildWorkflowDiagnosticItem({
        id: `edge:${edge.id}:${WORKFLOW_DIAGNOSTIC_CODES.CONDITION_FIELD_UNAVAILABLE}:${name}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.CONDITION_FIELD_UNAVAILABLE,
        message: `连线条件引用的字段“${name}”已不可用，请重新选择字段`,
        targetType: 'edge',
        targetId: edge.id,
        blocking: true,
      })
    )
  }
  conditionalEdges.forEach((edge) => {
    const condition = resolveEdgeConditionValue(edge)
    checkConditionFields(condition, edge)
    if (conditionPayloadIsFilled(condition)) {
      return
    }

    const sourceNode = validationEngine.getNodeById(edge.source)
    const targetNode = validationEngine.getNodeById(edge.target)
    items.push(
      buildWorkflowDiagnosticItem({
        id: `edge:${edge.id}:${WORKFLOW_DIAGNOSTIC_CODES.EDGE_CONDITION_REQUIRED}`,
        severity: 'error',
        code: WORKFLOW_DIAGNOSTIC_CODES.EDGE_CONDITION_REQUIRED,
        message: `连线“${validationEngine.getNodeLabel(sourceNode)} -> ${validationEngine.getNodeLabel(targetNode)}”的条件不能为空`,
        targetType: 'edge',
        targetId: edge.id,
        blocking: true,
      })
    )
  })

  nodes.forEach((node) => {
    const outgoingEdges = validationEngine.getOutgoingEdges(node.id)
    if (
      outgoingEdges.length <= 1 ||
      !outgoingEdges.some((edge) => edgeBelongsToConditionalRoute(edge, edges))
    ) {
      return
    }

    items.push(
      buildWorkflowDiagnosticItem({
        id: `node:${node.id}:${WORKFLOW_DIAGNOSTIC_CODES.CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED}`,
        severity: 'warning',
        code: WORKFLOW_DIAGNOSTIC_CODES.CONDITIONAL_BRANCH_COVERAGE_UNCONFIRMED,
        message: `节点“${validationEngine.getNodeLabel(node)}”存在多条路由，请编辑者自行确认条件能够全覆盖`,
        targetType: 'node',
        targetId: node.id,
        blocking: false,
      })
    )
  })

  const deduplicatedItems = Array.from(
    items
      .reduce((result, item) => {
        if (!item?.id) {
          return result
        }

        const existing = result.get(item.id)
        if (!existing) {
          result.set(item.id, item)
          return result
        }

        result.set(item.id, {
          ...existing,
          severity: chooseHigherSeverity(existing.severity, item.severity),
          blocking: existing.blocking || item.blocking,
        })
        return result
      }, new Map())
      .values()
  )

  return {
    status: deriveWorkflowValidationStatus(deduplicatedItems),
    items: deduplicatedItems,
  }
}

export default ValidationEngine
