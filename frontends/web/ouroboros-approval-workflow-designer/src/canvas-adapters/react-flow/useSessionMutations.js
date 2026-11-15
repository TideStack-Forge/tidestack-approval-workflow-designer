import { useCallback, useEffect, useRef } from 'react'
import { addEditorLayoutToV2 } from '../../translator/define/v2-extensions.js'
import { reactFlowToDefinitionV2 } from './reactFlowToDefinitionV2.js'

const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
}

const NODE_TYPE_TO_SESSION_ADD_TYPE = Object.freeze({
  start: 'StartNode',
  approval: 'ApprovalNode',
  handle: 'HandleNode',
  cc: 'CcNode',
  subprocess: 'SubProcess',
  'join-or': 'JoinOrNode',
  end: 'EndNode',
})

const clone = (value) => {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

const getSessionEditorLayout = (session) => {
  const workflow = session?.getWorkflow ? session.getWorkflow() : null
  const definitionLayout = session?.getDefinition?.()?.editorLayout
  const workflowLayout = workflow?.editorLayout

  return clone({
    nodePositions: definitionLayout?.nodePositions || workflowLayout?.nodePositions || {},
    viewport: workflowLayout?.viewport || DEFAULT_VIEWPORT,
  })
}

export function useSessionMutations(session, onSessionChange) {
  const debounceTimerRef = useRef(null)
  const pendingLayoutRef = useRef(null)
  const activeSessionRef = useRef(session)

  const clearPendingLayoutCommit = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    pendingLayoutRef.current = null
  }, [])

  const notifySessionChange = useCallback(() => {
    if (onSessionChange && session && activeSessionRef.current === session) {
      onSessionChange(session)
    }
  }, [onSessionChange, session])

  const commitLayout = useCallback(
    (layoutPatch) => {
      if (!session || activeSessionRef.current !== session) {
        return
      }

      const currentLayout = getSessionEditorLayout(session)
      const nextLayout = {
        ...currentLayout,
        ...layoutPatch,
        nodePositions: {
          ...(currentLayout.nodePositions || {}),
          ...(layoutPatch?.nodePositions || {}),
        },
        viewport: layoutPatch?.viewport || currentLayout.viewport || DEFAULT_VIEWPORT,
      }

      session.updateWorkflowMeta({ editorLayout: nextLayout })
      notifySessionChange()
    },
    [notifySessionChange, session]
  )

  const queueLayoutCommit = useCallback(
    (layoutPatch, delay = 300) => {
      if (!session) {
        return
      }

      const pendingLayout = pendingLayoutRef.current || {}
      pendingLayoutRef.current = {
        ...pendingLayout,
        ...layoutPatch,
        nodePositions: {
          ...(pendingLayout.nodePositions || {}),
          ...(layoutPatch?.nodePositions || {}),
        },
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        const nextPatch = pendingLayoutRef.current
        pendingLayoutRef.current = null
        commitLayout(nextPatch)
      }, delay)
    },
    [commitLayout, session]
  )

  const flushLayoutCommit = useCallback(() => {
    if (!pendingLayoutRef.current) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const patch = pendingLayoutRef.current
    pendingLayoutRef.current = null
    commitLayout(patch)
  }, [commitLayout])

  useEffect(() => {
    activeSessionRef.current = session
    clearPendingLayoutCommit()
  }, [clearPendingLayoutCommit, session])

  useEffect(() => {
    return () => {
      clearPendingLayoutCommit()
    }
  }, [clearPendingLayoutCommit])

  const syncFromReactFlow = useCallback(
    (nodes, edges, layoutMetadata) => {
      if (!session?.getDefinition || !session?.replaceDefinition) {
        return
      }

      const nextDefinition = addEditorLayoutToV2(
        reactFlowToDefinitionV2(nodes, edges, session.getDefinition()),
        layoutMetadata || getSessionEditorLayout(session)
      )
      session.replaceDefinition(nextDefinition)
      notifySessionChange()
    },
    [notifySessionChange, session]
  )

  const addNode = useCallback(
    ({ type, targetNodeId, nodeId, name, position, nodeData }) => {
      if (!session) {
        return false
      }

      const sessionNodeType = NODE_TYPE_TO_SESSION_ADD_TYPE[type]
      if (!sessionNodeType) {
        return false
      }

      session.addNode(targetNodeId || null, {
        ...(nodeData || {}),
        id: nodeId,
        name,
        type: sessionNodeType,
      })

      if (position && nodeId) {
        commitLayout({
          nodePositions: {
            [nodeId]: {
              x: position.x,
              y: position.y,
            },
          },
        })
      } else {
        notifySessionChange()
      }

      return true
    },
    [commitLayout, notifySessionChange, session]
  )

  const deleteNode = useCallback(
    async (nodeId) => {
      if (!session || !nodeId) {
        return false
      }

      await session.deleteNode(nodeId)

      const currentLayout = getSessionEditorLayout(session)
      const nextNodePositions = { ...(currentLayout.nodePositions || {}) }
      delete nextNodePositions[nodeId]

      session.updateWorkflowMeta({
        editorLayout: {
          ...currentLayout,
          nodePositions: nextNodePositions,
        },
      })
      notifySessionChange()
      return true
    },
    [notifySessionChange, session]
  )

  const connectNodes = useCallback(
    (nodes, edges, layoutMetadata) => {
      syncFromReactFlow(nodes, edges, layoutMetadata)
    },
    [syncFromReactFlow]
  )

  const disconnectEdge = useCallback(
    (nodes, edges, layoutMetadata) => {
      syncFromReactFlow(nodes, edges, layoutMetadata)
    },
    [syncFromReactFlow]
  )

  const updateNodePosition = useCallback(
    (nodeId, position) => {
      if (!nodeId || !position) {
        return
      }

      queueLayoutCommit({
        nodePositions: {
          [nodeId]: {
            x: position.x,
            y: position.y,
          },
        },
      })
    },
    [queueLayoutCommit]
  )

  const updateViewport = useCallback(
    (viewport) => {
      if (!viewport) {
        return
      }

      queueLayoutCommit({
        viewport: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        },
      })
    },
    [queueLayoutCommit]
  )

  const updateNode = useCallback(
    (nodeId, properties) => {
      if (!session || !nodeId || !properties) {
        return false
      }

      session.updateNodeConfig(nodeId, properties)
      notifySessionChange()
      return true
    },
    [notifySessionChange, session]
  )

  const updateEdge = useCallback(
    (edgeId, properties, nodes, edges, layoutMetadata) => {
      if (!session || !edgeId || !properties || !Array.isArray(edges)) {
        return false
      }

      const nextEdges = edges.map((edge) => {
        if (edge.id !== edgeId) {
          return edge
        }

        const nextData = {
          ...(edge.data || {}),
          ...properties,
        }

        return {
          ...edge,
          label: properties.name !== undefined ? properties.name : edge.label,
          data: nextData,
        }
      })

      syncFromReactFlow(nodes, nextEdges, layoutMetadata)
      return true
    },
    [session, syncFromReactFlow]
  )

  const addBranch = useCallback(
    (branchNodeId) => {
      if (!session || !branchNodeId) {
        return false
      }

      session.addBranch(branchNodeId)
      notifySessionChange()
      return true
    },
    [notifySessionChange, session]
  )

  const removeBranch = useCallback(
    async (conditionNodeId) => {
      if (!session || !conditionNodeId) {
        return false
      }

      await session.deleteNode(conditionNodeId)
      notifySessionChange()
      return true
    },
    [notifySessionChange, session]
  )

  return {
    addNode,
    deleteNode,
    updateNode,
    updateEdge,
    connectNodes,
    disconnectEdge,
    updateNodePosition,
    updateViewport,
    flushLayoutCommit,
    syncFromReactFlow,
    addBranch,
    removeBranch,
    getSessionEditorLayout: () => getSessionEditorLayout(session),
  }
}
