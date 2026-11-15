import { useCallback, useMemo, useRef } from 'react'
import toast from '../../utils/toast.js'
import { createValidationEngine } from '../../validation/validationEngine.js'

const VALIDATION_TOAST_TIMEOUT = 3000

export function useValidation(nodes, edges, onError) {
  const lastInvalidResultRef = useRef(null)
  const validationEngine = useMemo(() => createValidationEngine(nodes, edges), [nodes, edges])

  const clearValidationError = useCallback(() => {
    lastInvalidResultRef.current = null
  }, [])

  const showValidationError = useCallback(
    (validationResult) => {
      if (!validationResult?.shouldNotify || !validationResult?.error) {
        return Promise.resolve()
      }

      if (onError) {
        onError(validationResult.error)
      }

      return toast({
        msg: validationResult.error,
        msgType: 'warning',
        timeout: VALIDATION_TOAST_TIMEOUT,
      })
    },
    [onError]
  )

  const validateConnection = useCallback(
    (connection) => {
      const result = validationEngine.validateConnection(connection)
      lastInvalidResultRef.current = result.valid || !result.shouldNotify ? null : result
      return result
    },
    [validationEngine]
  )

  const isValidConnection = useCallback(
    (connection) => {
      return validateConnection(connection).valid
    },
    [validateConnection]
  )

  const validateGraph = useCallback(() => validationEngine.validateGraph(), [validationEngine])

  const handleConnectionStart = useCallback(() => {
    lastInvalidResultRef.current = null
  }, [])

  const handleConnectionEnd = useCallback(
    (_event, connectionState) => {
      if (connectionState?.isValid !== false || !connectionState?.toNode) {
        lastInvalidResultRef.current = null
        return
      }

      const result = lastInvalidResultRef.current
      if (result && !result.valid) {
        void showValidationError(result)
      }

      lastInvalidResultRef.current = null
    },
    [showValidationError]
  )

  const notifyPendingError = useCallback(() => {
    const result = lastInvalidResultRef.current
    if (result && !result.valid) {
      void showValidationError(result)
    }
    lastInvalidResultRef.current = null
  }, [showValidationError])

  return {
    clearValidationError,
    handleConnectionEnd,
    handleConnectionStart,
    isValidConnection,
    notifyPendingError,
    showValidationError,
    validateConnection,
    validateGraph,
  }
}
