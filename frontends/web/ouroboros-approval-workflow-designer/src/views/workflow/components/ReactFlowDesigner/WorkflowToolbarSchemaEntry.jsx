import React, { useEffect, useMemo, useRef } from 'react'
import { renderAmisSchema } from 'ouroboros-sdk'
import {
  applyAmisValueProjection,
  readAmisFormValues,
} from './workflowInspectorAmisSession.js'

const cloneSchema = (schema) => {
  if (Array.isArray(schema)) {
    return schema.map(cloneSchema)
  }

  if (!schema || typeof schema !== 'object') {
    return schema
  }

  return Object.keys(schema).reduce((nextSchema, key) => {
    nextSchema[key] = cloneSchema(schema[key])
    return nextSchema
  }, {})
}

const destroyRenderHandle = (handle) => {
  handle?.destroy?.()
}

const WorkflowToolbarSchemaEntry = ({
  entry,
  className = '',
  visualStateDataAttributes = null,
}) => {
  const containerRef = useRef(null)
  const renderHandleRef = useRef(null)
  const pendingHandlePromiseRef = useRef(null)
  const schema = useMemo(() => cloneSchema(entry?.schema), [entry?.schema])

  useEffect(() => {
    return () => {
      const handle = renderHandleRef.current
      renderHandleRef.current = null
      destroyRenderHandle(handle)

      const pendingHandlePromise = pendingHandlePromiseRef.current
      pendingHandlePromiseRef.current = null
      if (pendingHandlePromise && typeof pendingHandlePromise.then === 'function') {
        pendingHandlePromise.then((pendingHandle) => {
          destroyRenderHandle(pendingHandle)
        })
      }
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const ensureRenderHandle = async () => {
      if (renderHandleRef.current) {
        return renderHandleRef.current
      }

      if (!pendingHandlePromiseRef.current) {
        pendingHandlePromiseRef.current = renderAmisSchema(
          containerRef.current,
          schema,
          {
            ...(entry?.props || {}),
            disableFeedbackSurface: true,
            localeNamespace: 'workflow-editor',
          },
          entry?.env || {}
        )
      }

      const handle = await pendingHandlePromiseRef.current
      pendingHandlePromiseRef.current = null

      if (!disposed) {
        renderHandleRef.current = handle
      }

      return handle
    }

    const renderEntry = async () => {
      if (!containerRef.current || !entry?.key || !schema) {
        return
      }

      const handle = await ensureRenderHandle()

      if (disposed) {
        return
      }

      if (typeof handle?.update === 'function') {
        await handle.update(
          schema,
          {
            ...(entry?.props || {}),
            disableFeedbackSurface: true,
            localeNamespace: 'workflow-editor',
          },
          entry?.env || {}
        )
      }
      const projection = entry?.formValueProjection
      const currentValues = projection && readAmisFormValues(handle, projection.formName)
      if (currentValues) {
        applyAmisValueProjection({
          renderHandle: handle,
          formName: projection.formName,
          valueProjection: { values: { ...currentValues, ...projection.values } },
        })
      }
    }

    void renderEntry()

    return () => {
      disposed = true
    }
  }, [entry?.env, entry?.key, entry?.props, entry?.formValueProjection, schema])

  if (!entry?.key || !schema) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid={entry.key}
      {...(visualStateDataAttributes || {})}
    />
  )
}

export default WorkflowToolbarSchemaEntry
