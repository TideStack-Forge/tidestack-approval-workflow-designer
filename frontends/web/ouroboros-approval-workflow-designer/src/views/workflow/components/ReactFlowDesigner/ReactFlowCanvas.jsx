import { useLocale } from '../../../../useLocale.js'
import { t } from '../../../../i18n.js'
import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  getBezierPath,
  useOnSelectionChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  buildGraphDeleteRequest,
  definitionToReactFlow,
  GRAPH_DELETE_SOURCES,
  planGraphDelete,
} from '../../../../canvas-adapters/react-flow/index.js'
import { useSessionMutations } from '../../../../canvas-adapters/react-flow/useSessionMutations.js'
import { useValidation } from '../../../../canvas-adapters/react-flow/useValidation.js'
import {
  buildWorkflowEditorCommandStates,
  createWorkflowSelectionSnapshot,
  WORKFLOW_EDITOR_COMMAND_IDS,
} from '../../../../editor-core/coreContract'
import { useApprovalWorkflowEditorCoreBridge } from '../../../../editor-core/approvalWorkflowEditorCoreBridge'
import {
  buildDefaultVisibleFormPermissions,
} from '../../../../editor-core/workflowFormPermissionDefaults.js'
import { isVisibleWorkflowNodeCatalogType } from '../../../../editor-core/workflowNodeCatalog'
import { isSyntheticNodeType } from '../../../../translator/define/reactflow.js'
import toast from '../../../../utils/toast.js'
import getUUID from '../../../../utils/uuid.js'
import {
  buildCanvasGestureInteractionProps,
  buildCanvasSelectionScreenRect,
  CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER,
  isCanvasMarqueeModifierPressed,
  resolveCanvasWheelGestureIntent,
  shouldStartCanvasMarqueeSelection,
} from './canvasGestureContract'
import {
  projectFlowGuideToScreenStyle,
  resolveWorkflowCanvasNodeRect,
  resolveWorkflowNodeAlignmentGuides,
  snapWorkflowCanvasPositionToGrid,
  WORKFLOW_CANVAS_SNAP_GRID,
} from './workflowCanvasAssistContract.js'
import { getWorkflowNodeAppearance, isWorkflowSpecialNodeType } from './workflowNodeAppearance'
import { summarizeCondition } from './workflowEdgeInspectorContract.js'
import WorkflowViewportCluster from './WorkflowViewportCluster'

const EDGE_TYPES = Object.freeze({
  SEQUENCE: 'SEQUENCE',
})
const REACT_FLOW_SEQUENCE_EDGE_TYPE = 'workflow-sequence'
const EMPTY_VIEWPORT_STATE = Object.freeze({
  x: 0,
  y: 0,
  zoom: 1,
})

const DEFAULT_FIT_PADDING = 0.16
const DIAGNOSTIC_SEVERITY_PRIORITY = Object.freeze({
  warning: 1,
  error: 2,
})
const DIAGNOSTIC_EDGE_STYLE_MAP = Object.freeze({
  warning: {
    stroke: '#d97706',
    background: '#fff7ed',
  },
  error: {
    stroke: '#dc2626',
    background: '#fef2f2',
  },
})

const EDGE_INSERT_CONTAINER_SELECTOR = '.react-flow__edge[data-id]'

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const FOUR_DIRECTION_HANDLES = Object.freeze([
  {
    id: 'top',
    position: Position.Top,
    style: { top: -6, width: 10, height: 10, borderWidth: 2 },
  },
  {
    id: 'right',
    position: Position.Right,
    style: { right: -6, width: 10, height: 10, borderWidth: 2 },
  },
  {
    id: 'bottom',
    position: Position.Bottom,
    style: { bottom: -6, width: 10, height: 10, borderWidth: 2 },
  },
  {
    id: 'left',
    position: Position.Left,
    style: { left: -6, width: 10, height: 10, borderWidth: 2 },
  },
])

const SELECTED_NODE_INNER_RING = 'inset 0 0 0 1px #2563eb'
const SELECTED_NODE_RING = '0 0 0 4px rgba(37, 99, 235, 0.18)'
const SELECTED_EDGE_SHADOW = 'drop-shadow(0 0 6px rgba(37, 99, 235, 0.28))'
const DEFAULT_EDGE_STROKE = '#94a3b8'
const DEFAULT_EDGE_STROKE_WIDTH = 1.8
const DIAGNOSTIC_EDGE_STROKE_WIDTH = 2.2
const SELECTED_EDGE_STROKE_WIDTH = 2.4
const DEFAULT_EDGE_MARKER_SIZE = 10
const EDGE_SOURCE_ATTACH_OFFSET = 10
const NODE_ICON_INSET = 12
const NODE_ICON_SIZE = 18
const NODE_SPECIAL_ICON_SIZE = 20
const NODE_ICON_GAP = 10

const edgeHasRouteMetadata = (edgeData) => {
  return (
    Boolean(edgeData?.condition) ||
    Number.isFinite(Number(edgeData?.order))
  )
}

const buildSelectionIdSets = (selectionSnapshot) => ({
  selectedNodeIdSet: new Set(Array.isArray(selectionSnapshot?.nodeIds) ? selectionSnapshot.nodeIds : []),
  selectedEdgeIdSet: new Set(Array.isArray(selectionSnapshot?.edgeIds) ? selectionSnapshot.edgeIds : []),
})

const buildEdgeMarkerConfig = (color = DEFAULT_EDGE_STROKE) => ({
  type: MarkerType.ArrowClosed,
  width: DEFAULT_EDGE_MARKER_SIZE,
  height: DEFAULT_EDGE_MARKER_SIZE,
  color,
  strokeWidth: DEFAULT_EDGE_STROKE_WIDTH,
})

const resolveEdgeAnchorInset = (position, distance = 0) => {
  switch (position) {
    case Position.Top:
      return { x: 0, y: distance }
    case Position.Right:
      return { x: -distance, y: 0 }
    case Position.Bottom:
      return { x: 0, y: -distance }
    case Position.Left:
      return { x: distance, y: 0 }
    default:
      return { x: 0, y: 0 }
  }
}

const resolveHandleTransform = (position, scale) => {
  switch (position) {
    case Position.Top:
    case Position.Bottom:
      return `translateX(-50%) scale(${scale})`
    case Position.Left:
    case Position.Right:
      return `translateY(-50%) scale(${scale})`
    default:
      return `scale(${scale})`
  }
}

const normalizeEdgeVisualStyle = (style = null) => ({
  stroke: style?.stroke || DEFAULT_EDGE_STROKE,
  strokeWidth: Number(style?.strokeWidth) || DEFAULT_EDGE_STROKE_WIDTH,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...(style || {}),
})

const WorkflowSequenceEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
  pathOptions,
}) => {
  const sourceInset = resolveEdgeAnchorInset(sourcePosition, EDGE_SOURCE_ATTACH_OFFSET)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX + sourceInset.x,
    sourceY: sourceY + sourceInset.y,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    ...(pathOptions || {}),
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      interactionWidth={interactionWidth}
    />
  )
}

const resolveHandleId = (node, side) => {
  if (!node?.type || !side) {
    return null
  }

  return `${node.type}-${side}`
}

const resolveRelativeHandlePair = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) {
    return {
      sourceHandle: null,
      targetHandle: null,
    }
  }

  const sourceRect = resolveWorkflowCanvasNodeRect(sourceNode)
  const targetRect = resolveWorkflowCanvasNodeRect(targetNode)
  const dx = targetRect.centerX - sourceRect.centerX
  const dy = targetRect.centerY - sourceRect.centerY

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? {
          sourceHandle: resolveHandleId(sourceNode, 'right'),
          targetHandle: resolveHandleId(targetNode, 'left'),
        }
      : {
          sourceHandle: resolveHandleId(sourceNode, 'left'),
          targetHandle: resolveHandleId(targetNode, 'right'),
        }
  }

  return dy >= 0
    ? {
        sourceHandle: resolveHandleId(sourceNode, 'bottom'),
        targetHandle: resolveHandleId(targetNode, 'top'),
      }
    : {
        sourceHandle: resolveHandleId(sourceNode, 'top'),
        targetHandle: resolveHandleId(targetNode, 'bottom'),
      }
}

const createDraftNodeData = (nodeType, formPermissionDefaults = []) => {
  const appearance = getWorkflowNodeAppearance(nodeType)
  const defaultName = `新${appearance?.label || '节点'}`

  switch (nodeType) {
    case 'approval':
      return {
        label: defaultName,
        name: defaultName,
        subType: '单签',
        candidates: [],
        permission: clone(formPermissionDefaults),
      }
    case 'handle':
      return {
        label: defaultName,
        name: defaultName,
        candidates: [],
        permission: clone(formPermissionDefaults),
      }
    case 'cc':
      return {
        label: appearance.label,
        name: appearance.label,
        candidates: [],
      }
    case 'subprocess':
      return {
        label: defaultName,
        name: defaultName,
        subProcessId: '',
        inParameters: [],
        outParameters: [],
        rejectAction: '',
      }
    case 'branch':
      return {
        label: defaultName,
        name: defaultName,
        logic: 'exclusive',
      }
    case 'join-or':
      return {
        label: getWorkflowNodeAppearance('join-or').label,
        name: getWorkflowNodeAppearance('join-or').label,
        joinType: 'OR',
      }
    case 'end':
      return {
        label: getWorkflowNodeAppearance('end').label,
        name: getWorkflowNodeAppearance('end').label,
      }
    case 'start':
      return {
        label: getWorkflowNodeAppearance('start').label,
        name: getWorkflowNodeAppearance('start').label,
      }
    default:
      return {
        label: defaultName,
        name: defaultName,
      }
  }
}

const createDraftCanvasNode = (nodeType, nodeId, position, formPermissionDefaults = []) => ({
  id: nodeId,
  type: nodeType,
  position,
  data: createDraftNodeData(nodeType, formPermissionDefaults),
})

const buildReplacementSequenceEdges = (edge, insertedNodeId) => {
  const inheritedEdgeId = edge?.id || `sequence-${edge?.source || 'source'}-${insertedNodeId}`
  const trailingEdgeId = `sequence-${insertedNodeId}-${edge?.target || 'target'}`
  const edgeData = edge?.data || {}

  return [
    {
      ...edge,
      id: inheritedEdgeId,
      target: insertedNodeId,
      targetHandle: null,
      data: {
        ...edgeData,
        id: inheritedEdgeId,
        edgeType: edgeData.edgeType || EDGE_TYPES.SEQUENCE,
      },
    },
    {
      id: trailingEdgeId,
      source: insertedNodeId,
      target: edge?.target,
      sourceHandle: null,
      targetHandle: null,
      data: {
        id: trailingEdgeId,
        edgeType: EDGE_TYPES.SEQUENCE,
      },
    },
  ]
}

const createNodeRenderer = (nodeType) => {
  return function ReactFlowNodeRenderer({ data, selected }) {
    useLocale()
    const appearance = getWorkflowNodeAppearance(nodeType)
    const isStart = nodeType === 'start'
    const isEnd = nodeType === 'end'
    const title =
      isStart || isEnd
        ? t(appearance.label)
        : data?.name || data?.label || t(appearance.label)
    const isSpecialNode = isWorkflowSpecialNodeType(nodeType)
    const shouldShowNodeTypeLabel = !isStart && !isEnd
    const secondaryText = shouldShowNodeTypeLabel
      ? data?.secondaryText || t(appearance.label)
      : ''
    const isActive = selected || data?.isActive || false
    const showAnchors = data?.showAnchors === true
    const diagnosticSeverity = data?.diagnosticSeverity || null
    const handleType = isEnd ? 'target' : 'source'
    const isConnectable = !data?.isReadonly
    const canConnectFrom = !isEnd
    const canConnectTo = !isStart
    const nodeShadow = isActive
      ? `${SELECTED_NODE_INNER_RING}, ${SELECTED_NODE_RING}, 0 8px 18px rgba(15, 23, 42, 0.08)`
      : '0 8px 18px rgba(15, 23, 42, 0.08)'
    const diagnosticShadow =
      diagnosticSeverity === 'error'
        ? '0 0 10px rgba(220, 38, 38, 0.28)'
        : diagnosticSeverity === 'warning'
          ? '0 0 10px rgba(217, 119, 6, 0.2)'
          : null
    const contentPaddingLeft = isSpecialNode
      ? NODE_ICON_INSET + NODE_SPECIAL_ICON_SIZE + NODE_ICON_GAP
      : NODE_ICON_INSET + NODE_ICON_SIZE + NODE_ICON_GAP
    const iconWrapperStyle = isSpecialNode
      ? {
          position: 'absolute',
          left: NODE_ICON_INSET,
          top: '50%',
          transform: 'translateY(-50%)',
          width: NODE_SPECIAL_ICON_SIZE,
          height: NODE_SPECIAL_ICON_SIZE,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.88)',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
          color: appearance.iconColor || appearance.borderColor,
          zIndex: 1,
        }
      : {
          position: 'absolute',
          left: NODE_ICON_INSET,
          top: NODE_ICON_INSET,
          width: NODE_ICON_SIZE,
          height: NODE_ICON_SIZE,
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.84)',
          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)',
          color: appearance.iconColor || appearance.borderColor,
          zIndex: 1,
        }
    const renderHandle = ({ id, position, style }) => (
      <Handle
        key={`${nodeType}-${id}`}
        id={`${nodeType}-${id}`}
        type={handleType}
        position={position}
        isConnectable={isConnectable}
        isConnectableStart={isConnectable && canConnectFrom}
        isConnectableEnd={isConnectable && canConnectTo}
        style={{
          ...style,
          opacity: showAnchors ? 1 : 0,
          pointerEvents: showAnchors ? 'auto' : 'none',
          transform: resolveHandleTransform(position, showAnchors ? 1 : 0.82),
          transition: 'opacity 0.16s ease, transform 0.16s ease',
          background: '#ffffff',
          borderColor: '#2563eb',
          zIndex: 2,
        }}
      />
    )

    return (
      <div
        data-testid={`reactflow-node-${nodeType}`}
        style={{
          minWidth: isSpecialNode ? 124 : 152,
          borderRadius: isSpecialNode ? 999 : 12,
          position: 'relative',
          border: `1px solid ${isActive ? '#2563eb' : appearance.borderColor}`,
          background: appearance.backgroundColor,
          padding: isSpecialNode ? `10px 14px 10px ${contentPaddingLeft}px` : `10px 12px 10px ${contentPaddingLeft}px`,
          boxShadow: diagnosticShadow ? `${diagnosticShadow}, ${nodeShadow}` : nodeShadow,
          color: '#1f2937',
          fontSize: 12,
          lineHeight: 1.4,
          boxSizing: 'border-box',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
      >
        {FOUR_DIRECTION_HANDLES.map(renderHandle)}
        {appearance.iconClassName ? (
          <span style={iconWrapperStyle} aria-hidden="true">
            <i
              className={appearance.iconClassName}
              style={{
                fontSize: isSpecialNode ? 10 : 11,
                lineHeight: 1,
              }}
            />
          </span>
        ) : null}
        {diagnosticSeverity ? (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 14,
              height: 14,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: diagnosticSeverity === 'error' ? '#dc2626' : '#d97706',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              zIndex: 2,
              pointerEvents: 'none',
            }}
            title={(data?.diagnosticMessages || [])
              .map((message) => t(message))
              .join('\n')}
            aria-label={t(diagnosticSeverity === 'error' ? '存在错误' : '存在警告')}>
            !
          </span>
        ) : null}
        <div style={{ fontWeight: 600 }}>{title}</div>
        {secondaryText ? <div style={{ marginTop: 4, color: '#6b7280' }}>{secondaryText}</div> : null}
      </div>
    )
  }
}

const nodeTypes = {
  start: createNodeRenderer('start'),
  approval: createNodeRenderer('approval'),
  handle: createNodeRenderer('handle'),
  cc: createNodeRenderer('cc'),
  subprocess: createNodeRenderer('subprocess'),
  'join-or': createNodeRenderer('join-or'),
  end: createNodeRenderer('end'),
}

const edgeTypes = {
  [REACT_FLOW_SEQUENCE_EDGE_TYPE]: WorkflowSequenceEdge,
}

const buildRouteLabel = (edgeData, conditionFields) => {
  if (typeof edgeData?.condition === 'string' && edgeData.condition.trim().length > 0) {
    return edgeData.condition.trim()
  }

  if (edgeData?.condition) {
    return summarizeCondition(edgeData.condition, conditionFields)
  }

  return undefined
}

const resolveHigherDiagnosticSeverity = (currentSeverity, nextSeverity) => {
  if (!currentSeverity) {
    return nextSeverity || null
  }

  if (!nextSeverity) {
    return currentSeverity
  }

  return DIAGNOSTIC_SEVERITY_PRIORITY[nextSeverity] > DIAGNOSTIC_SEVERITY_PRIORITY[currentSeverity]
    ? nextSeverity
    : currentSeverity
}

const buildCanvasDiagnosticsIndex = (diagnosticsSnapshot) => {
  const items = Array.isArray(diagnosticsSnapshot?.items) ? diagnosticsSnapshot.items : []
  const nodeDiagnostics = new Map()
  const edgeDiagnostics = new Map()

  items.forEach((item) => {
    if (!item?.targetId || !item?.targetType) {
      return
    }

    const targetMap =
      item.targetType === 'node'
        ? nodeDiagnostics
        : item.targetType === 'edge'
          ? edgeDiagnostics
          : null
    if (!targetMap) {
      return
    }

    const current = targetMap.get(item.targetId) || {
      severity: null,
      count: 0,
      messages: [],
    }

    targetMap.set(item.targetId, {
      severity: resolveHigherDiagnosticSeverity(current.severity, item.severity),
      count: current.count + 1,
      messages: item.message ? [...current.messages, item.message] : current.messages,
    })
  })

  return {
    nodeDiagnostics,
    edgeDiagnostics,
  }
}

const applyCanvasNodeDiagnostics = (nodes, diagnosticsIndex) => {
  return (nodes || []).map((node) => {
    const nodeDiagnostic = diagnosticsIndex.nodeDiagnostics.get(node.id)
    return {
      ...node,
      data: {
        ...(node.data || {}),
        diagnosticSeverity: nodeDiagnostic?.severity || null,
        diagnosticCount: nodeDiagnostic?.count || 0,
        diagnosticMessages: nodeDiagnostic?.messages || [],
      },
    }
  })
}

const applyCanvasNodePresentation = (
  nodes,
  diagnosticsIndex,
  selectionSnapshot,
  hoveredNodeId = null,
  isConnecting = false,
  isReadonly = false
) => {
  const { selectedNodeIdSet } = buildSelectionIdSets(selectionSnapshot)

  return applyCanvasNodeDiagnostics(nodes, diagnosticsIndex).map((node) => {
    const isActive = selectedNodeIdSet.has(node.id)

    return {
      ...node,
      selected: isActive,
      data: {
        ...(node.data || {}),
        isActive,
        isReadonly,
        showAnchors: !isReadonly && (isActive || hoveredNodeId === node.id || isConnecting),
      },
    }
  })
}

const normalizeEdgePresentation = (
  edge,
  dragOverEdgeId = null,
  diagnosticsIndex = null,
  selectionSnapshot = null,
  nodeIndex = null,
  conditionFields = []
) => {
  const baseStyle = normalizeEdgeVisualStyle(edge?.style)
  const baseEdge = edgeHasRouteMetadata(edge?.data)
    ? {
        ...edge,
        type: REACT_FLOW_SEQUENCE_EDGE_TYPE,
        label: buildRouteLabel(edge.data, conditionFields),
        style: baseStyle,
      }
    : {
        ...edge,
        type: REACT_FLOW_SEQUENCE_EDGE_TYPE,
        label: edge?.label,
        style: baseStyle,
      }

  const edgeDiagnostic = diagnosticsIndex?.edgeDiagnostics?.get(edge?.id)
  const edgeDiagnosticStyle = edgeDiagnostic?.severity
    ? DIAGNOSTIC_EDGE_STYLE_MAP[edgeDiagnostic.severity]
    : null
  const nextEdge = edgeDiagnosticStyle
    ? {
        ...baseEdge,
        data: {
          ...(baseEdge.data || {}),
          diagnosticSeverity: edgeDiagnostic.severity,
          diagnosticCount: edgeDiagnostic.count,
          diagnosticMessages: edgeDiagnostic.messages,
        },
        style: {
          ...(baseEdge.style || {}),
          stroke: edgeDiagnosticStyle.stroke,
          strokeWidth: Math.max(Number(baseEdge.style?.strokeWidth) || DEFAULT_EDGE_STROKE_WIDTH, DIAGNOSTIC_EDGE_STROKE_WIDTH),
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        labelStyle: {
          ...(baseEdge.labelStyle || {}),
          fill: edgeDiagnosticStyle.stroke,
          fontWeight: 600,
        },
        labelBgStyle: {
          ...(baseEdge.labelBgStyle || {}),
          fill: edgeDiagnosticStyle.background,
          fillOpacity: 0.96,
        },
      }
    : baseEdge
  const { selectedEdgeIdSet } = buildSelectionIdSets(selectionSnapshot)
  const isActive = selectedEdgeIdSet.has(edge?.id)
  const handleResolution = resolveRelativeHandlePair(nodeIndex?.get(edge?.source), nodeIndex?.get(edge?.target))
  const selectedStroke = edgeDiagnosticStyle ? edgeDiagnosticStyle.stroke : '#2563eb'
  const nextEdgeStyle = normalizeEdgeVisualStyle(nextEdge?.style)
  const nextSelectedEdge = isActive
    ? {
        ...nextEdge,
        selected: true,
        data: {
          ...(nextEdge.data || {}),
          isActive: true,
        },
        style: {
          ...nextEdgeStyle,
          stroke: selectedStroke,
          strokeWidth: Math.max(Number(nextEdgeStyle.strokeWidth) || DEFAULT_EDGE_STROKE_WIDTH, SELECTED_EDGE_STROKE_WIDTH),
          filter: SELECTED_EDGE_SHADOW,
        },
        markerEnd: buildEdgeMarkerConfig(selectedStroke),
        labelStyle: {
          ...(nextEdge.labelStyle || {}),
          fill: selectedStroke,
          fontWeight: 700,
        },
        labelBgStyle: {
          ...(nextEdge.labelBgStyle || {}),
          stroke: '#2563eb',
          strokeWidth: 1,
        },
      }
    : {
        ...nextEdge,
        selected: false,
        data: {
          ...(nextEdge.data || {}),
          isActive: false,
        },
        style: nextEdgeStyle,
        markerEnd: buildEdgeMarkerConfig(nextEdgeStyle.stroke || DEFAULT_EDGE_STROKE),
      }
  const resolvedEdge = {
    ...nextSelectedEdge,
    sourceHandle: handleResolution.sourceHandle,
    targetHandle: handleResolution.targetHandle,
  }

  if (resolvedEdge?.id !== dragOverEdgeId) {
    return resolvedEdge
  }

  return {
    ...resolvedEdge,
    label: resolvedEdge.label || '插入到此连线',
    style: {
      ...normalizeEdgeVisualStyle(resolvedEdge.style),
      stroke: '#1890ff',
      strokeWidth: 2.5,
    },
    markerEnd: buildEdgeMarkerConfig('#1890ff'),
    labelStyle: {
      ...(resolvedEdge.labelStyle || {}),
      fill: '#1890ff',
      fontSize: 12,
      fontWeight: 600,
    },
    labelBgStyle: {
      ...(resolvedEdge.labelBgStyle || {}),
      fill: '#e6f7ff',
      fillOpacity: 0.96,
    },
  }
}

const applyCanvasEdgePresentation = (
  nextEdges,
  dragOverEdgeId = null,
  diagnosticsIndex = null,
  selectionSnapshot = null,
  nodes = [],
  conditionFields = []
) => {
  const nodeIndex = new Map((nodes || []).map((node) => [node.id, node]))
  return (nextEdges || []).map((edge) =>
    normalizeEdgePresentation(
      edge, dragOverEdgeId, diagnosticsIndex, selectionSnapshot, nodeIndex, conditionFields
    )
  )
}

const resolveDroppedEdgeId = (event, canvasElement) => {
  const ownerDocument = canvasElement?.ownerDocument || document
  const elementsAtPoint = ownerDocument?.elementsFromPoint?.(event.clientX, event.clientY) || []
  const fallbackElement = ownerDocument?.elementFromPoint?.(event.clientX, event.clientY)
  const hitElements = elementsAtPoint.length > 0 ? elementsAtPoint : fallbackElement ? [fallbackElement] : []
  const edgeElement = hitElements
    .map((element) => element?.closest?.(EDGE_INSERT_CONTAINER_SELECTOR) || null)
    .find(Boolean)

  return edgeElement?.getAttribute('data-id') || null
}

const ReactFlowSelectionBridge = ({ onSelectionChange }) => {
  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes, edges: selectedEdges }) => {
      onSelectionChange?.(
        createWorkflowSelectionSnapshot({
          nodeIds: (selectedNodes || []).map((node) => node?.id),
          edgeIds: (selectedEdges || []).map((edge) => edge?.id),
        })
      )
    },
  })

  return null
}

const ReactFlowCanvasInner = ({
  conditionFieldSource,
  session,
  readonly,
  coreCapabilities,
  selectionSnapshot,
  onSessionChange,
  onSelectionChange,
  externalCanvasData,
  diagnosticsSnapshot,
  onRegisterMutationBridge,
  onRegisterCommandBridge,
  onViewportChange,
  visualContract,
  navigatorDockingContext,
  canvasAssistState,
}) => {
  const bridgeContext = useApprovalWorkflowEditorCoreBridge()
  const reactFlowInstance = useReactFlow()
  const reactFlowWrapper = useRef(null)
  const customSelectionStateRef = useRef(null)
  const hasResolvedInitialViewportRef = useRef(false)
  const pendingDeleteRequestRef = useRef(null)
  const validationTimerRef = useRef(null)
  const isReadonly = readonly === true
  const allowEdgeReconnect = !isReadonly && coreCapabilities?.allowEdgeReconnect !== false
  const allowDeleteSelection = !isReadonly && coreCapabilities?.allowDeleteSelection !== false
  const allowMultiSelect = !isReadonly && coreCapabilities?.allowMultiSelect !== false
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [dragOverEdgeId, setDragOverEdgeId] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentViewport, setCurrentViewport] = useState(EMPTY_VIEWPORT_STATE)
  const [customSelectionBox, setCustomSelectionBox] = useState(null)
  const [alignmentGuide, setAlignmentGuide] = useState({
    vertical: null,
    horizontal: null,
  })
  const normalizedCanvasAssistState = canvasAssistState || {
    gridSnappingEnabled: true,
    nodeAlignmentEnabled: true,
  }
  const gridSnappingEnabled = normalizedCanvasAssistState.gridSnappingEnabled !== false
  const nodeAlignmentEnabled = normalizedCanvasAssistState.nodeAlignmentEnabled === true

  const workflow = session?.getWorkflow ? session.getWorkflow() : null
  const definition = session?.getDefinition ? session.getDefinition() : null
  const editorLayout = definition?.editorLayout || workflow?.editorLayout
  const defaultFormPermissions = useMemo(
    () => buildDefaultVisibleFormPermissions(
      bridgeContext?.formPermissionFieldSource?.fields
    ),
    [
      bridgeContext?.formPermissionFieldSource?.fields,
      bridgeContext?.formPermissionFieldSource?.revisionToken,
    ]
  )

  const {
    addNode,
    updateNode,
    updateEdge,
    addBranch,
    removeBranch,
    connectNodes,
    updateNodePosition,
    flushLayoutCommit,
    getSessionEditorLayout,
    syncFromReactFlow,
  } = useSessionMutations(session, onSessionChange)

  const canvasData = useMemo(() => {
    if (externalCanvasData) {
      return externalCanvasData
    }

    if (!definition?.nodes?.length) {
      return { nodes: [], edges: [] }
    }

    return definitionToReactFlow(definition, editorLayout)
  }, [definition, editorLayout, externalCanvasData])
  const diagnosticsIndex = useMemo(() => {
    return buildCanvasDiagnosticsIndex(diagnosticsSnapshot)
  }, [diagnosticsSnapshot])
  const displayNodes = useMemo(() => {
    return applyCanvasNodePresentation(nodes, diagnosticsIndex, selectionSnapshot, hoveredNodeId, isConnecting, isReadonly)
  }, [diagnosticsIndex, hoveredNodeId, isConnecting, isReadonly, nodes, selectionSnapshot])
  const displayEdges = useMemo(() => {
    return applyCanvasEdgePresentation(
      edges, dragOverEdgeId, diagnosticsIndex, selectionSnapshot, nodes, conditionFieldSource?.fields
    )
  }, [conditionFieldSource, diagnosticsIndex, dragOverEdgeId, edges, nodes, selectionSnapshot])
  const alignmentGuideStyles = useMemo(() => {
    return projectFlowGuideToScreenStyle({
      guide: alignmentGuide,
      viewport: currentViewport,
      canvasRect: reactFlowWrapper.current?.getBoundingClientRect?.() || null,
    })
  }, [alignmentGuide, currentViewport])
  const publishViewportChange = useCallback(
    (nextViewport) => {
      if (
        !nextViewport ||
        !Number.isFinite(Number(nextViewport.x)) ||
        !Number.isFinite(Number(nextViewport.y)) ||
        !Number.isFinite(Number(nextViewport.zoom))
      ) {
        return
      }

      const normalizedViewport = {
        x: nextViewport.x,
        y: nextViewport.y,
        zoom: nextViewport.zoom,
      }

      setCurrentViewport((previousViewport) => {
        if (
          previousViewport.x === normalizedViewport.x &&
          previousViewport.y === normalizedViewport.y &&
          previousViewport.zoom === normalizedViewport.zoom
        ) {
          return previousViewport
        }

        return normalizedViewport
      })
      onViewportChange?.(normalizedViewport)
    },
    [onViewportChange]
  )
  const viewportCommandStateMap = useMemo(() => {
    return buildWorkflowEditorCommandStates({
      readonly: isReadonly,
      coreCapabilities,
      selection: null,
      viewport: currentViewport,
      history: {
        available: false,
        canUndo: false,
        canRedo: false,
      },
    }).reduce((result, commandState) => {
      result[commandState.commandId] = commandState
      return result
    }, {})
  }, [coreCapabilities, currentViewport, isReadonly])
  const canvasGestureInteractionProps = useMemo(() => {
    return buildCanvasGestureInteractionProps({
      allowMultiSelect,
      isReadonly,
    })
  }, [allowMultiSelect, isReadonly])
  const clearCustomSelectionBox = useCallback(() => {
    customSelectionStateRef.current = null
    setCustomSelectionBox(null)
  }, [])
  const resolveSelectedNodeIdsFromScreenRect = useCallback((screenRect) => {
    const canvasElement = reactFlowWrapper.current
    if (!canvasElement || !screenRect) {
      return []
    }

    return Array.from(canvasElement.querySelectorAll('.react-flow__node[data-id]'))
      .map((nodeElement) => ({
        nodeId: nodeElement.getAttribute('data-id'),
        rect: nodeElement.getBoundingClientRect(),
      }))
      .filter(({ nodeId, rect }) => {
        return (
          Boolean(nodeId) &&
          rect.left >= screenRect.left &&
          rect.right <= screenRect.right &&
          rect.top >= screenRect.top &&
          rect.bottom <= screenRect.bottom
        )
      })
      .map(({ nodeId }) => nodeId)
  }, [])
  const resolveSelectedEdgeIdsFromNodeIds = useCallback(
    (selectedNodeIds) => {
      if (!Array.isArray(selectedNodeIds) || selectedNodeIds.length === 0) {
        return []
      }

      const selectedNodeIdSet = new Set(selectedNodeIds)
      return edges
        .filter((edge) => selectedNodeIdSet.has(edge.source) || selectedNodeIdSet.has(edge.target))
        .map((edge) => edge.id)
    },
    [edges]
  )
  const handleCustomSelectionContextMenuCapture = useCallback(
    (event) => {
      if (isReadonly || !allowMultiSelect) {
        return
      }

      if (isCanvasMarqueeModifierPressed(event) && event.target?.closest?.('.react-flow__pane')) {
        event.preventDefault()
      }
    },
    [allowMultiSelect, isReadonly]
  )
  const handleCustomSelectionPointerDownCapture = useCallback(
    (event) => {
      const paneElement = reactFlowWrapper.current?.querySelector('.react-flow__pane')
      if (
        !shouldStartCanvasMarqueeSelection({
          event,
          allowMultiSelect,
          isReadonly,
          paneElement,
        })
      ) {
        return
      }

      const containerRect = reactFlowWrapper.current?.getBoundingClientRect()
      if (!containerRect) {
        return
      }

      const startPoint = {
        x: event.clientX,
        y: event.clientY,
      }

      customSelectionStateRef.current = {
        pointerId: event.pointerId,
        startPoint,
        containerRect,
        hasMoved: false,
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      setCustomSelectionBox({
        left: startPoint.x - containerRect.left,
        top: startPoint.y - containerRect.top,
        width: 0,
        height: 0,
      })
    },
    [allowMultiSelect, isReadonly]
  )
  const handleCustomSelectionPointerMoveCapture = useCallback(
    (event) => {
      const activeSelection = customSelectionStateRef.current
      if (!activeSelection || activeSelection.pointerId !== event.pointerId) {
        return
      }

      const screenRect = buildCanvasSelectionScreenRect({
        startPoint: activeSelection.startPoint,
        currentPoint: {
          x: event.clientX,
          y: event.clientY,
        },
      })
      if (!screenRect || (screenRect.width === 0 && screenRect.height === 0)) {
        return
      }

      const selectedNodeIds = resolveSelectedNodeIdsFromScreenRect(screenRect)
      const selectedEdgeIds = resolveSelectedEdgeIdsFromNodeIds(selectedNodeIds)

      activeSelection.hasMoved = true
      event.preventDefault()
      event.stopPropagation()
      setCustomSelectionBox({
        left: screenRect.left - activeSelection.containerRect.left,
        top: screenRect.top - activeSelection.containerRect.top,
        width: screenRect.width,
        height: screenRect.height,
      })
      onSelectionChange?.(
        createWorkflowSelectionSnapshot({
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds,
        })
      )
    },
    [onSelectionChange, resolveSelectedEdgeIdsFromNodeIds, resolveSelectedNodeIdsFromScreenRect]
  )
  const handleCustomSelectionPointerUpCapture = useCallback(
    (event) => {
      const activeSelection = customSelectionStateRef.current
      if (!activeSelection || activeSelection.pointerId !== event.pointerId) {
        return
      }

      event.currentTarget?.releasePointerCapture?.(event.pointerId)
      event.preventDefault()
      event.stopPropagation()
      clearCustomSelectionBox()
    },
    [clearCustomSelectionBox]
  )
  const handleCanvasWheelCapture = useCallback(
    (event) => {
      const wheelIntent = resolveCanvasWheelGestureIntent({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey,
      })
      if (!wheelIntent) {
        return
      }
      event.preventDefault()
      event.stopPropagation()

      if (wheelIntent.kind === 'zoom-viewport') {
        const currentZoom = reactFlowInstance.getZoom()
        const nextZoom =
          wheelIntent.deltaY < 0
            ? currentZoom * CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER
            : currentZoom / CANVAS_CTRL_WHEEL_ZOOM_MULTIPLIER

        void reactFlowInstance.zoomTo(nextZoom, { duration: 0 }).then(() => {
          publishViewportChange(reactFlowInstance.getViewport())
        })
        return
      }

      const currentViewport = reactFlowInstance.getViewport()
      const nextViewport = {
        x: currentViewport.x - (wheelIntent.deltaX || 0),
        y: currentViewport.y - (wheelIntent.deltaY || 0),
        zoom: currentViewport.zoom,
      }

      void reactFlowInstance.setViewport(nextViewport, { duration: 0 }).then(() => {
        publishViewportChange(reactFlowInstance.getViewport())
      })
    },
    [publishViewportChange, reactFlowInstance]
  )

  useEffect(() => {
    setNodes(canvasData.nodes || [])
    setEdges(canvasData.edges || [])
  }, [canvasData])

  useEffect(() => {
    const nextViewport = reactFlowInstance.getViewport()
    publishViewportChange(nextViewport)
  }, [publishViewportChange, reactFlowInstance])

  useEffect(() => {
    hasResolvedInitialViewportRef.current = false
  }, [session])

  useEffect(() => {
    return () => {
      if (validationTimerRef.current) {
        window.clearTimeout(validationTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    clearCustomSelectionBox()
  }, [clearCustomSelectionBox, session, isReadonly, allowMultiSelect])

  useEffect(() => {
    const ownerDocument = reactFlowWrapper.current?.ownerDocument
    if (!ownerDocument) {
      return undefined
    }

    const handleDocumentWheel = (event) => {
      const paneElement = reactFlowWrapper.current?.querySelector('.react-flow__pane')
      if (!paneElement) {
        return
      }

      if (!(event.target === paneElement || event.target?.closest?.('.react-flow__pane'))) {
        return
      }

      handleCanvasWheelCapture(event)
    }

    ownerDocument.addEventListener('wheel', handleDocumentWheel, {
      capture: true,
      passive: false,
    })

    return () => {
      ownerDocument.removeEventListener('wheel', handleDocumentWheel, true)
    }
  }, [handleCanvasWheelCapture])

  useEffect(() => {
    if (hasResolvedInitialViewportRef.current || !reactFlowInstance.viewportInitialized || nodes.length === 0) {
      return undefined
    }

    hasResolvedInitialViewportRef.current = true
    let cancelled = false
    const frameId = window.requestAnimationFrame(async () => {
      if (cancelled) {
        return
      }

      await reactFlowInstance.fitView({ padding: DEFAULT_FIT_PADDING, duration: 200 })

      const nextViewport = reactFlowInstance.getViewport()
      publishViewportChange(nextViewport)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [nodes, publishViewportChange, reactFlowInstance])

  const clearValidationFeedback = useCallback(() => {
    if (validationTimerRef.current) {
      window.clearTimeout(validationTimerRef.current)
      validationTimerRef.current = null
    }

    setValidationError(null)
  }, [])

  const handleValidationError = useCallback(
    (errorMessage) => {
      if (!errorMessage) {
        return
      }

      clearValidationFeedback()
      setValidationError(errorMessage)
      validationTimerRef.current = window.setTimeout(() => {
        validationTimerRef.current = null
        setValidationError(null)
      }, 3000)

      void toast({ msg: errorMessage, msgType: 'warning', timeout: 3000 })
    },
    [clearValidationFeedback]
  )

  const { clearValidationError, isValidConnection, notifyPendingError, validateConnection } = useValidation(nodes, edges, handleValidationError)

  const getHistorySnapshot = useCallback(() => {
    return (
      session?.getHistorySnapshot?.() || {
        available: true,
        canUndo: false,
        canRedo: false,
        undoLabel: undefined,
        redoLabel: undefined,
      }
    )
  }, [session])

  const emitDeleteFailureFeedback = useCallback(
    (outcome) => {
      if (!outcome || outcome.kind !== 'rejected') {
        return false
      }

      handleValidationError(outcome.diagnosticsMessage)
      return false
    },
    [handleValidationError]
  )

  const buildLayoutMetadata = useCallback(
    (nextNodes) => {
      const currentLayout = getSessionEditorLayout()

      const nextLayout = {
        ...currentLayout,
        nodePositions: {},
      }

      ;(nextNodes || []).forEach((node) => {
        if (!node || isSyntheticNodeType(node.type)) {
          return
        }

        nextLayout.nodePositions[node.id] = {
          x: node.position.x,
          y: node.position.y,
        }
      })

      return nextLayout
    },
    [getSessionEditorLayout]
  )

  const resolveGraphDeleteRequest = useCallback(
    (deletedNodes = [], deletedEdges = [], source = GRAPH_DELETE_SOURCES.KEYBOARD) => {
      const fallbackRequest = buildGraphDeleteRequest({
        source,
        nodeIds: deletedNodes.map((node) => node?.id),
        edgeIds: deletedEdges.map((edge) => edge?.id),
      })
      const pendingRequest = pendingDeleteRequestRef.current
      if (!pendingRequest) {
        return fallbackRequest
      }

      return buildGraphDeleteRequest({
        source: pendingRequest.source || fallbackRequest.source,
        nodeIds: pendingRequest.nodeIds.length > 0 ? pendingRequest.nodeIds : fallbackRequest.nodeIds,
        edgeIds: pendingRequest.edgeIds.length > 0 ? pendingRequest.edgeIds : fallbackRequest.edgeIds,
      })
    },
    []
  )

  const buildDeletePayload = useCallback(
    (request) => {
      const normalizedRequest = buildGraphDeleteRequest(request)
      const deletedNodeIdSet = new Set(normalizedRequest.nodeIds)
      const deletedEdgeIdSet = new Set(normalizedRequest.edgeIds)

      return {
        nodes: nodes.filter((node) => deletedNodeIdSet.has(node.id)),
        edges: edges.filter((edge) => deletedEdgeIdSet.has(edge.id)),
      }
    },
    [edges, nodes]
  )

  const applyGraphDeleteRequest = useCallback(
    (request) => {
      if (isReadonly) {
        return false
      }

      flushLayoutCommit()
      const outcome = planGraphDelete({
        nodes,
        edges,
        request,
      })

      if (outcome.kind !== 'applied') {
        return emitDeleteFailureFeedback(outcome)
      }

      clearValidationFeedback()
      clearValidationError()

      const nextLayoutMetadata = buildLayoutMetadata(outcome.nextNodes)
      setNodes(outcome.nextNodes)
      setEdges(outcome.nextEdges)
      onSelectionChange?.(
        createWorkflowSelectionSnapshot({
          nodeIds: [],
          edgeIds: [],
        })
      )
      syncFromReactFlow(outcome.nextNodes, outcome.nextEdges, nextLayoutMetadata)
      return true
    },
    [
      buildLayoutMetadata,
      clearValidationError,
      clearValidationFeedback,
      edges,
      emitDeleteFailureFeedback,
      flushLayoutCommit,
      isReadonly,
      nodes,
      onSelectionChange,
      reactFlowInstance,
      syncFromReactFlow,
    ]
  )

  const executeGraphDeleteRequest = useCallback(
    async (request) => {
      if (!allowDeleteSelection) {
        return false
      }

      const normalizedRequest = buildGraphDeleteRequest(request)
      const deletePayload = buildDeletePayload(normalizedRequest)

      if (deletePayload.nodes.length === 0 && deletePayload.edges.length === 0) {
        return false
      }

      const outcome = planGraphDelete({
        nodes,
        edges,
        request: normalizedRequest,
      })
      if (outcome.kind !== 'applied') {
        pendingDeleteRequestRef.current = null
        return emitDeleteFailureFeedback(outcome)
      }

      pendingDeleteRequestRef.current = normalizedRequest
      try {
        await reactFlowInstance.deleteElements(deletePayload)
        return true
      } catch (error) {
        pendingDeleteRequestRef.current = null
        throw error
      }
    },
    [
      allowDeleteSelection,
      buildDeletePayload,
      edges,
      emitDeleteFailureFeedback,
      nodes,
      reactFlowInstance,
    ]
  )

  useEffect(() => {
    if (!onRegisterMutationBridge) {
      return undefined
    }

    onRegisterMutationBridge({
      updateNode,
      updateEdge: (edgeId, properties) => {
        const layoutMetadata = buildLayoutMetadata(nodes)
        return updateEdge(edgeId, properties, nodes, edges, layoutMetadata)
      },
      addBranch,
      removeBranch,
    })

    return () => {
      onRegisterMutationBridge(null)
    }
  }, [
    addBranch,
    buildLayoutMetadata,
    edges,
    nodes,
    onRegisterMutationBridge,
    removeBranch,
    updateEdge,
    updateNode,
  ])

  const onDrop = useCallback(
    (event) => {
      if (isReadonly) {
        return
      }

      event.preventDefault()
      setDragOverEdgeId(null)

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) {
        return
      }

      if (!isVisibleWorkflowNodeCatalogType(type)) {
        void toast({ msg: '当前版本暂不允许新增该节点类型', msgType: 'warning', timeout: 3000 })
        return
      }

      const position = reactFlowInstance.screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        {
          snapToGrid: gridSnappingEnabled,
          snapGrid: WORKFLOW_CANVAS_SNAP_GRID,
        }
      )
      const draftNodeData = createDraftNodeData(type, defaultFormPermissions)

      const droppedEdgeId = resolveDroppedEdgeId(event, reactFlowWrapper.current)
      const droppedEdge = edges.find((edge) => edge.id === droppedEdgeId)
      if (!droppedEdge) {
        addNode({
          type,
          targetNodeId: null,
          nodeId: getUUID(type || 'node'),
          name: draftNodeData.name || draftNodeData.label || `新${type}节点`,
          nodeData: draftNodeData,
          position,
        })
        return
      }

      const insertedNodeId = getUUID(type || 'node')
      const insertedNode = createDraftCanvasNode(
        type,
        insertedNodeId,
        position,
        defaultFormPermissions
      )
      const nextNodes = [...nodes, insertedNode]
      const nextEdges = edges.flatMap((edge) => {
        if (edge.id !== droppedEdge.id) {
          return [edge]
        }

        return buildReplacementSequenceEdges(edge, insertedNodeId)
      })
      const nextLayoutMetadata = buildLayoutMetadata(nextNodes)

      setNodes(nextNodes)
      setEdges(nextEdges)
      connectNodes(nextNodes, nextEdges, nextLayoutMetadata)
    },
    [
      addNode,
      buildLayoutMetadata,
      connectNodes,
      defaultFormPermissions,
      edges,
      gridSnappingEnabled,
      isReadonly,
      nodes,
      reactFlowInstance,
    ]
  )

  const onDragOver = useCallback(
    (event) => {
      if (isReadonly) {
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverEdgeId(resolveDroppedEdgeId(event, reactFlowWrapper.current))
    },
    [isReadonly]
  )

  const onDragLeave = useCallback(() => {
    if (isReadonly) {
      return
    }
    setDragOverEdgeId(null)
  }, [isReadonly])

  const onNodesChange = useCallback(
    (changes) => {
      if (isReadonly) {
        return
      }

      const adjustedChanges = []
      const changedPositions = []

      changes.forEach((change) => {
        if (change.type !== 'position' || !change.position) {
          adjustedChanges.push(change)
          return
        }

        const currentNode = nodes.find((node) => node.id === change.id)
        if (!currentNode) {
          adjustedChanges.push(change)
          return
        }

        const activeNode = {
          ...currentNode,
          position: change.position,
          positionAbsolute: change.position,
        }
        const alignmentResult = resolveWorkflowNodeAlignmentGuides({
          activeNode,
          nodes,
          enabled: nodeAlignmentEnabled,
        })
        const gridPosition = gridSnappingEnabled
          ? snapWorkflowCanvasPositionToGrid(change.position)
          : change.position
        const nextPosition = alignmentResult.snappedPosition
          ? {
              x:
                alignmentResult.vertical === null
                  ? gridPosition.x
                  : alignmentResult.snappedPosition.x,
              y:
                alignmentResult.horizontal === null
                  ? gridPosition.y
                  : alignmentResult.snappedPosition.y,
            }
          : gridPosition

        adjustedChanges.push({
          ...change,
          position: nextPosition,
        })
        changedPositions.push({
          id: change.id,
          position: nextPosition,
          alignmentResult,
        })
      })

      setNodes((nds) => applyNodeChanges(adjustedChanges, nds))
      const latestAlignmentResult = changedPositions[changedPositions.length - 1]?.alignmentResult
      if (latestAlignmentResult) {
        setAlignmentGuide(latestAlignmentResult)
      }
      changedPositions.forEach((change) => {
        updateNodePosition(change.id, change.position)
      })
    },
    [gridSnappingEnabled, isReadonly, nodeAlignmentEnabled, nodes, updateNodePosition]
  )

  const updateAlignmentGuide = useCallback(
    (activeNode) => {
      setAlignmentGuide(
        resolveWorkflowNodeAlignmentGuides({
          activeNode,
          nodes,
          enabled: nodeAlignmentEnabled,
        })
      )
    },
    [nodeAlignmentEnabled, nodes]
  )

  const clearAlignmentGuide = useCallback(() => {
    setAlignmentGuide({
      vertical: null,
      horizontal: null,
    })
  }, [])

  useEffect(() => {
    if (!nodeAlignmentEnabled) {
      clearAlignmentGuide()
    }
  }, [clearAlignmentGuide, nodeAlignmentEnabled])

  const onEdgesChange = useCallback(
    (changes) => {
      if (isReadonly) {
        return
      }
      setEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [isReadonly]
  )

  const onConnect = useCallback(
    (connection) => {
      if (isReadonly) {
        return
      }

      const validationResult = validateConnection(connection)
      if (!validationResult.valid) {
        handleValidationError(validationResult.error)
        return
      }

      clearValidationFeedback()
      clearValidationError()

      const edgeData = {
        id: `sequence-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: null,
        targetHandle: null,
        data: {
          edgeType: EDGE_TYPES.SEQUENCE,
        },
      }

      const nextEdges = addEdge(edgeData, edges)
      const nextLayoutMetadata = buildLayoutMetadata(nodes)

      setEdges(nextEdges)
      connectNodes(nodes, nextEdges, nextLayoutMetadata)
    },
    [
      buildLayoutMetadata,
      clearValidationError,
      clearValidationFeedback,
      connectNodes,
      edges,
      handleValidationError,
      isReadonly,
      nodes,
      reactFlowInstance,
      validateConnection,
    ]
  )

  const onConnectStart = useCallback(() => {
    if (isReadonly) {
      return
    }
    setIsConnecting(true)
    clearValidationFeedback()
    clearValidationError()
  }, [clearValidationError, clearValidationFeedback, isReadonly])

  const onConnectEnd = useCallback(
    (_event, connectionState) => {
      if (isReadonly) {
        return
      }
      setIsConnecting(false)
      if (connectionState?.isValid === false) {
        notifyPendingError()
      }
    },
    [isReadonly, notifyPendingError]
  )

  const handleBeforeDelete = useCallback(
    async ({ nodes: deletedNodes = [], edges: deletedEdges = [] } = {}) => {
      if (isReadonly) {
        return false
      }

      const request = resolveGraphDeleteRequest(deletedNodes, deletedEdges, GRAPH_DELETE_SOURCES.KEYBOARD)
      const outcome = planGraphDelete({
        nodes,
        edges,
        request,
      })

      if (outcome.kind !== 'applied') {
        pendingDeleteRequestRef.current = null
        return emitDeleteFailureFeedback(outcome)
      }

      pendingDeleteRequestRef.current = request
      return true
    },
    [edges, emitDeleteFailureFeedback, isReadonly, nodes, resolveGraphDeleteRequest]
  )

  const handleDelete = useCallback(
    ({ nodes: deletedNodes = [], edges: deletedEdges = [] } = {}) => {
      if (isReadonly) {
        return
      }

      const request = resolveGraphDeleteRequest(deletedNodes, deletedEdges, GRAPH_DELETE_SOURCES.KEYBOARD)
      pendingDeleteRequestRef.current = null
      applyGraphDeleteRequest(request)
    },
    [applyGraphDeleteRequest, isReadonly, resolveGraphDeleteRequest]
  )

  const onMoveEnd = useCallback(() => {
    if (isReadonly) {
      return
    }
    const nextViewport = reactFlowInstance.getViewport()
    publishViewportChange(nextViewport)
  }, [isReadonly, publishViewportChange, reactFlowInstance])

  const handleSelectionSnapshotChange = useCallback(
    (nextSelectionSnapshot) => {
      if (isReadonly) {
        return
      }

      onSelectionChange?.(nextSelectionSnapshot)
    },
    [isReadonly, onSelectionChange]
  )

  const handleDeleteSelectionCommand = useCallback(async () => {
    if (!allowDeleteSelection) {
      return false
    }

    const { selectedNodeIdSet, selectedEdgeIdSet } = buildSelectionIdSets(selectionSnapshot)
    const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id))
    const selectedEdges = edges.filter((edge) => selectedEdgeIdSet.has(edge.id))
    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      return false
    }

    return executeGraphDeleteRequest({
      source: GRAPH_DELETE_SOURCES.TOOLBAR,
      nodeIds: selectedNodes.map((node) => node.id),
      edgeIds: selectedEdges.map((edge) => edge.id),
    })
  }, [allowDeleteSelection, edges, executeGraphDeleteRequest, nodes, selectionSnapshot?.edgeIds, selectionSnapshot?.nodeIds])

  const handleHistoryCommand = useCallback(
    async (direction) => {
      if (!session || typeof session[direction] !== 'function') {
        return false
      }

      flushLayoutCommit()
      clearValidationFeedback()
      clearValidationError()

      const didReplay = session[direction]()
      if (!didReplay) {
        return false
      }

      onSessionChange?.(session)
      return true
    },
    [
      clearValidationError,
      clearValidationFeedback,
      flushLayoutCommit,
      onSessionChange,
      session,
    ]
  )

  const handleUndoCommand = useCallback(() => {
    return handleHistoryCommand('undo')
  }, [handleHistoryCommand])

  const handleRedoCommand = useCallback(() => {
    return handleHistoryCommand('redo')
  }, [handleHistoryCommand])

  const handleNodeClick = useCallback(
    (_event, node) => {
      if (isReadonly || !node?.id) {
        return
      }

      onSelectionChange?.(
        createWorkflowSelectionSnapshot({
          nodeIds: [node.id],
          edgeIds: [],
        })
      )
    },
    [isReadonly, onSelectionChange]
  )

  const handleEdgeClick = useCallback(
    (_event, edge) => {
      if (isReadonly || !edge?.id) {
        return
      }

      onSelectionChange?.(
        createWorkflowSelectionSnapshot({
          nodeIds: [],
          edgeIds: [edge.id],
        })
      )
    },
    [isReadonly, onSelectionChange]
  )

  const handlePaneClick = useCallback(() => {
    if (isReadonly) {
      return
    }

    onSelectionChange?.(createWorkflowSelectionSnapshot())
  }, [isReadonly, onSelectionChange])

  const handleCenterGraphCommand = useCallback(async () => {
    if (!nodes.length) {
      return false
    }

    const bounds = reactFlowInstance.getNodesBounds(nodes)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const nextZoom = reactFlowInstance.getZoom()

    await reactFlowInstance.setCenter(centerX, centerY, {
      zoom: nextZoom,
      duration: 200,
    })
    const nextViewport = reactFlowInstance.getViewport()
    publishViewportChange(nextViewport)
    return true
  }, [nodes, publishViewportChange, reactFlowInstance])

  const handleFocusTargetCommand = useCallback(
    async (targetId) => {
      if (!targetId) {
        return false
      }

      const matchedNode = nodes.find((node) => node.id === targetId)
      if (matchedNode) {
        await reactFlowInstance.fitView({
          nodes: [matchedNode],
          padding: 0.9,
          duration: 200,
          maxZoom: 1.2,
        })
        publishViewportChange(reactFlowInstance.getViewport())
        return true
      }

      const matchedEdge = edges.find((edge) => edge.id === targetId)
      if (!matchedEdge) {
        return false
      }

      const relatedNodes = nodes.filter(
        (node) => node.id === matchedEdge.source || node.id === matchedEdge.target
      )
      if (relatedNodes.length === 0) {
        return false
      }

      await reactFlowInstance.fitView({
        nodes: relatedNodes,
        padding: 0.7,
        duration: 200,
        maxZoom: 1,
      })
      publishViewportChange(reactFlowInstance.getViewport())
      return true
    },
    [edges, nodes, publishViewportChange, reactFlowInstance]
  )
  const executeViewportCommand = useCallback(
    async (commandId) => {
      const commandState = viewportCommandStateMap[commandId]
      if (!commandState?.visible || !commandState.enabled) {
        return false
      }

      switch (commandId) {
        case WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_IN: {
          const result = await reactFlowInstance.zoomIn({ duration: 150 })
          publishViewportChange(reactFlowInstance.getViewport())
          return result
        }
        case WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_OUT: {
          const result = await reactFlowInstance.zoomOut({ duration: 150 })
          publishViewportChange(reactFlowInstance.getViewport())
          return result
        }
        case WORKFLOW_EDITOR_COMMAND_IDS.FIT_GRAPH: {
          const result = await reactFlowInstance.fitView({ padding: DEFAULT_FIT_PADDING, duration: 200 })
          publishViewportChange(reactFlowInstance.getViewport())
          return result
        }
        case WORKFLOW_EDITOR_COMMAND_IDS.CENTER_GRAPH:
          return handleCenterGraphCommand()
        default:
          return false
      }
    },
    [handleCenterGraphCommand, publishViewportChange, reactFlowInstance, viewportCommandStateMap]
  )
  useEffect(() => {
    if (!onRegisterCommandBridge) {
      return undefined
    }

    const bridge = {
      getHistorySnapshot,
      getViewportState: () => reactFlowInstance.getViewport(),
      zoomIn: async () => {
        const result = await reactFlowInstance.zoomIn({ duration: 150 })
        const nextViewport = reactFlowInstance.getViewport()
        publishViewportChange(nextViewport)
        return result
      },
      zoomOut: async () => {
        const result = await reactFlowInstance.zoomOut({ duration: 150 })
        const nextViewport = reactFlowInstance.getViewport()
        publishViewportChange(nextViewport)
        return result
      },
      fitGraph: async () => {
        const result = await reactFlowInstance.fitView({ padding: 0.16, duration: 200 })
        const nextViewport = reactFlowInstance.getViewport()
        publishViewportChange(nextViewport)
        return result
      },
      centerGraph: handleCenterGraphCommand,
      deleteElements: executeGraphDeleteRequest,
      deleteSelection: handleDeleteSelectionCommand,
      focusTarget: handleFocusTargetCommand,
      undo: handleUndoCommand,
      redo: handleRedoCommand,
    }

    onRegisterCommandBridge(bridge)
    return () => {
      onRegisterCommandBridge(null)
    }
  }, [
    handleCenterGraphCommand,
    executeGraphDeleteRequest,
    getHistorySnapshot,
    handleDeleteSelectionCommand,
    handleFocusTargetCommand,
    handleRedoCommand,
    onRegisterCommandBridge,
    publishViewportChange,
    reactFlowInstance,
    handleUndoCommand,
  ])

  return (
    <div
      className={`react-flow-canvas${validationError ? ' validation-error-active' : ''}`}
      data-testid="workflow-panel-center"
      ref={reactFlowWrapper}
      onDrop={isReadonly ? undefined : onDrop}
      onDragOver={isReadonly ? undefined : onDragOver}
      onDragLeave={isReadonly ? undefined : onDragLeave}
      onContextMenuCapture={handleCustomSelectionContextMenuCapture}
      onPointerDownCapture={handleCustomSelectionPointerDownCapture}
      onPointerMoveCapture={handleCustomSelectionPointerMoveCapture}
      onPointerUpCapture={handleCustomSelectionPointerUpCapture}
      onPointerCancelCapture={handleCustomSelectionPointerUpCapture}
    >
      {validationError ? <div className="validation-error-banner" role="alert" aria-live="assertive">{validationError}</div> : null}
      {customSelectionBox ? (
        <div
          className="workflow-custom-selection-box"
          aria-hidden="true"
          style={{
            left: customSelectionBox.left,
            top: customSelectionBox.top,
            width: customSelectionBox.width,
            height: customSelectionBox.height,
          }}
        ></div>
      ) : null}
      {alignmentGuideStyles.verticalStyle ? (
        <div
          className="workflow-canvas-alignment-guide workflow-canvas-alignment-guide-vertical"
          aria-hidden="true"
          style={alignmentGuideStyles.verticalStyle}
        ></div>
      ) : null}
      {alignmentGuideStyles.horizontalStyle ? (
        <div
          className="workflow-canvas-alignment-guide workflow-canvas-alignment-guide-horizontal"
          aria-hidden="true"
          style={alignmentGuideStyles.horizontalStyle}
        ></div>
      ) : null}
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        {...canvasGestureInteractionProps}
        onBeforeDelete={!allowDeleteSelection ? undefined : handleBeforeDelete}
        onDelete={!allowDeleteSelection ? undefined : handleDelete}
        onNodesChange={isReadonly ? undefined : onNodesChange}
        onEdgesChange={isReadonly ? undefined : onEdgesChange}
        onNodeClick={isReadonly ? undefined : handleNodeClick}
        onEdgeClick={isReadonly ? undefined : handleEdgeClick}
        onPaneClick={isReadonly ? undefined : handlePaneClick}
        onNodeMouseEnter={isReadonly ? undefined : (_event, node) => setHoveredNodeId(node?.id || null)}
        onNodeMouseLeave={isReadonly ? undefined : () => setHoveredNodeId(null)}
        onConnect={isReadonly ? undefined : onConnect}
        onConnectStart={isReadonly ? undefined : onConnectStart}
        onConnectEnd={isReadonly ? undefined : onConnectEnd}
        onNodeDrag={isReadonly ? undefined : (_event, node) => updateAlignmentGuide(node)}
        onNodeDragStop={isReadonly ? undefined : clearAlignmentGuide}
        onMoveEnd={isReadonly ? undefined : onMoveEnd}
        onMove={(_event, nextViewport) => {
          publishViewportChange(nextViewport)
        }}
        nodesDraggable={!isReadonly}
        nodesConnectable={!isReadonly}
        edgesReconnectable={allowEdgeReconnect}
        elementsSelectable={!isReadonly}
        snapToGrid={gridSnappingEnabled && !nodeAlignmentEnabled}
        snapGrid={WORKFLOW_CANVAS_SNAP_GRID}
        deleteKeyCode={allowDeleteSelection ? 'Delete' : null}
        connectionMode="loose"
        defaultEdgeOptions={{
          type: REACT_FLOW_SEQUENCE_EDGE_TYPE,
          style: {
            strokeWidth: DEFAULT_EDGE_STROKE_WIDTH,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          markerEnd: buildEdgeMarkerConfig(DEFAULT_EDGE_STROKE),
        }}
        proOptions={{ hideAttribution: true }}
      >
        {!isReadonly ? <ReactFlowSelectionBridge onSelectionChange={handleSelectionSnapshotChange} /> : null}
        {gridSnappingEnabled ? (
          <Background
            id="workflow-canvas-grid"
            variant={BackgroundVariant.Dots}
            gap={10}
            size={1}
            color="#d0dae1"
            bgColor="#F2F7FA"
          />
        ) : null}
        <WorkflowViewportCluster
          commandStateMap={viewportCommandStateMap}
          viewport={currentViewport}
          onExecuteCommand={executeViewportCommand}
          visualContract={visualContract}
          dockingContext={navigatorDockingContext}
        />
        {displayNodes.length === 0 ? (
          <div className="canvas-placeholder">
            <div className="placeholder-content">
              <i className="fa-solid fa-diagram-project" style={{ fontSize: '64px', color: '#ccc' }}></i>
              <h3>{isReadonly ? '流程图视图' : 'React Flow 编辑器'}</h3>
              <p>{isReadonly ? '当前流程暂无可展示节点' : '从左侧拖拽节点到画布开始设计流程'}</p>
            </div>
          </div>
        ) : null}
      </ReactFlow>
    </div>
  )
}

const ReactFlowCanvas = (props) => {
  const normalizedProps =
    props?.data && typeof props.data === 'object'
      ? {
          ...props,
          readonly: props.readonly ?? props.data.isReadonly,
          canvasAssistState: props.canvasAssistState ?? props.data.canvasAssistState,
        }
      : props

  return (
    <ReactFlowProvider>
      <ReactFlowCanvasInner {...normalizedProps} />
    </ReactFlowProvider>
  )
}

export default ReactFlowCanvas
