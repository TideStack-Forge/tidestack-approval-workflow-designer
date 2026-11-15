import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isEqual } from 'lodash'
import { EditorSession } from '../editor-session/index'
import ReactFlowDesignerShell from '../views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell'
import {
  createEmptyWorkflowDiagnosticsSnapshot,
  createEmptyWorkflowSelectionSnapshot,
  normalizeApprovalWorkflowEditorCoreCapabilities,
  normalizeWorkflowConditionFieldSource,
} from './coreContract'
import { ApprovalWorkflowEditorCoreBridgeProvider } from './approvalWorkflowEditorCoreBridge'

const hasDefinitionValue = (definition) =>
  !!definition && typeof definition === 'object' && Object.keys(definition).length > 0

const createSessionFromValue = (value) => {
  if (hasDefinitionValue(value)) {
    return EditorSession.createFromDefinition(value)
  }

  return EditorSession.createInitial()
}

const ApprovalWorkflowEditorCore = forwardRef(function ApprovalWorkflowEditorCore(
  {
    value,
    readonly = false,
    coreCapabilities = null,
    conditionFieldSource = null,
    initialDiagnostics = null,
    onChange,
    onDiagnosticsChange,
    onSelectionChange,
    bridgeContext = null,
  },
  ref
) {
  const processDesignerRef = useRef(null)
  const [session, setSession] = useState(() => createSessionFromValue(value))
  const [sessionRevision, setSessionRevision] = useState(() => session.getRevision())
  const [selection, setSelection] = useState(() => createEmptyWorkflowSelectionSnapshot())
  const [diagnostics, setDiagnostics] = useState(() =>
    initialDiagnostics || createEmptyWorkflowDiagnosticsSnapshot()
  )

  const normalizedConditionFieldSource = useMemo(
    () => normalizeWorkflowConditionFieldSource(conditionFieldSource),
    [conditionFieldSource]
  )

  const normalizedCoreCapabilities = useMemo(
    () => normalizeApprovalWorkflowEditorCoreCapabilities(coreCapabilities, readonly),
    [coreCapabilities, readonly]
  )

  const normalizedBridgeContext = useMemo(
    () => ({
      ...(bridgeContext || {}),
      readonly,
      coreCapabilities: normalizedCoreCapabilities,
    }),
    [bridgeContext, normalizedCoreCapabilities, readonly]
  )

  useEffect(() => {
    const nextSession = createSessionFromValue(value)
    const currentDefinition = session?.getDefinition?.()
    const nextDefinition = nextSession.getDefinition()

    if (
      currentDefinition &&
      isEqual(currentDefinition, nextDefinition) &&
      session?.getSourceFormatVersion?.() === nextSession.getSourceFormatVersion()
    ) {
      return
    }

    setSession(nextSession)
    setSessionRevision(nextSession.getRevision())
    setSelection(createEmptyWorkflowSelectionSnapshot())
    setDiagnostics(initialDiagnostics || createEmptyWorkflowDiagnosticsSnapshot())
  }, [initialDiagnostics, value])

  useEffect(() => {
    if (!onSelectionChange) {
      return
    }

    onSelectionChange(selection)
  }, [onSelectionChange, selection])

  useEffect(() => {
    if (!onDiagnosticsChange) {
      return
    }

    onDiagnosticsChange(diagnostics)
  }, [diagnostics, onDiagnosticsChange])

  const handleSessionChange = useCallback(
    (nextSession) => {
      if (!nextSession) {
        return
      }

      const nextDefinition = nextSession.getDefinition()
      setSession(nextSession)
      setSessionRevision(nextSession.getRevision())

      if (onChange && !isEqual(value, nextDefinition)) {
        onChange(nextDefinition)
      }
    },
    [onChange, value]
  )

  const handleSelectionChange = useCallback((nextSelection) => {
    setSelection(nextSelection || createEmptyWorkflowSelectionSnapshot())
  }, [])

  const handleDiagnosticsChange = useCallback((nextDiagnostics) => {
    setDiagnostics(nextDiagnostics || createEmptyWorkflowDiagnosticsSnapshot())
  }, [])

  const readDefinition = useCallback(() => {
    return session ? session.getDefinition() : value || null
  }, [session, value])

  const readSessionSnapshot = useCallback(() => {
    if (!session) {
      return null
    }

    return {
      revision: session.getRevision(),
      sourceFormatVersion: session.getSourceFormatVersion(),
      definition: session.getDefinition(),
    }
  }, [session])

  const navigateToDiagnosticTarget = useCallback(
    (targetId) => {
      const workflowDesigner = processDesignerRef.current
      if (!workflowDesigner || !targetId) {
        return false
      }

      const currentSelection = workflowDesigner.getSelectionSnapshot?.() || selection
      if (currentSelection?.nodeIds?.includes(targetId)) {
        workflowDesigner.nodeSelectedHandler?.({ id: targetId })
        return true
      }

      if (currentSelection?.edgeIds?.includes(targetId)) {
        workflowDesigner.edgeSelectedHandler?.({ id: targetId })
        return true
      }

      if (workflowDesigner.nodeSelectedHandler) {
        workflowDesigner.nodeSelectedHandler({ id: targetId })
      }
      if (workflowDesigner.edgeSelectedHandler) {
        workflowDesigner.edgeSelectedHandler({ id: targetId })
      }
      return true
    },
    [selection]
  )

  const getWorkflowDesigner = useCallback(() => {
    return processDesignerRef.current
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      getWorkflowDesigner,
      handleSessionChange,
      readDefinition,
      readSessionSnapshot,
      navigateToDiagnosticTarget,
      get session() {
        return session
      },
      get state() {
        return {
          session,
          sessionRevision,
          diagnostics,
          selection,
        }
      },
    }),
    [
      diagnostics,
      getWorkflowDesigner,
      handleSessionChange,
      navigateToDiagnosticTarget,
      readDefinition,
      readSessionSnapshot,
      selection,
      session,
      sessionRevision,
    ]
  )

  return (
    <ApprovalWorkflowEditorCoreBridgeProvider value={normalizedBridgeContext}>
      <ReactFlowDesignerShell
        ref={processDesignerRef}
        session={session}
        readonly={readonly}
        coreCapabilities={normalizedCoreCapabilities}
        conditionFieldSource={normalizedConditionFieldSource}
        onSessionChange={handleSessionChange}
        onSelectionChange={handleSelectionChange}
        onDiagnosticsChange={handleDiagnosticsChange}
      />
    </ApprovalWorkflowEditorCoreBridgeProvider>
  )
})

export { ApprovalWorkflowEditorCore }
