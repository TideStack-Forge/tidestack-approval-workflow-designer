import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { isEqual } from 'lodash'
import { renderAmisSchema } from 'ouroboros-sdk'
import {
  applyAmisValueProjection,
  PROPERTY_EDITOR_FORM_NAME,
} from './workflowInspectorAmisSession.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

const cloneFormValues = (value) => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return clone(value)
}

const withPanelFormSubmit = (schema, submitHandler, changeHandler, isReadonly) => {
  const baseBody = schema?.body?.type === 'form' ? clone(schema.body) : clone(schema)

  if (!baseBody || baseBody.type !== 'form') {
    return null
  }

  const originalOnChange = baseBody.onChange
  const originalOnSubmit = baseBody.onSubmit

  baseBody.wrapWithPanel = false
  baseBody.name = PROPERTY_EDITOR_FORM_NAME
  baseBody.static = isReadonly
  baseBody.actions = []
  baseBody.onChange = async (values) => {
    if (typeof originalOnChange === 'function') {
      await originalOnChange(values)
    }
    if (!isReadonly) {
      return changeHandler?.(values)
    }
    return undefined
  }
  baseBody.onSubmit = async (values) => {
    if (typeof originalOnSubmit === 'function') {
      await originalOnSubmit(values)
    }
    return submitHandler?.(values)
  }

  return {
    type: 'container',
    body: baseBody,
  }
}

const destroyRenderHandleLater = (handle) => {
  if (!handle?.destroy) {
    return
  }

  window.setTimeout(() => {
    handle.destroy?.()
  }, 0)
}

const AmisPropertyForm = ({
  schemaKey,
  schema,
  valueProjection,
  isReadonly,
  onSubmit,
  className = 'property-editor',
}) => {
  const containerRef = useRef(null)
  const renderHandleRef = useRef(null)
  const submitHandlerRef = useRef(onSubmit)
  const valueProjectionRef = useRef(valueProjection)
  const lastSyncedValuesRef = useRef(null)

  const rememberProjectedValues = useCallback((nextValueProjection) => {
    lastSyncedValuesRef.current = nextValueProjection?.values
      ? cloneFormValues(nextValueProjection.values)
      : null
  }, [])

  const handleFormChange = useCallback((values) => {
    const nextValues = cloneFormValues(values)
    if (isEqual(nextValues, lastSyncedValuesRef.current)) {
      return undefined
    }

    lastSyncedValuesRef.current = nextValues
    return submitHandlerRef.current?.(nextValues)
  }, [])

  useEffect(() => {
    submitHandlerRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    valueProjectionRef.current = valueProjection
  }, [valueProjection])

  const panelSchema = useMemo(
    () =>
      withPanelFormSubmit(
        schema,
        (values) => submitHandlerRef.current?.(values),
        handleFormChange,
        isReadonly
      ),
    [handleFormChange, isReadonly, schema]
  )

  useEffect(() => {
    return () => {
      const handle = renderHandleRef.current
      renderHandleRef.current = null
      destroyRenderHandleLater(handle)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const renderForm = async () => {
      if (!containerRef.current || !panelSchema || !schemaKey) {
        return
      }

      rememberProjectedValues(valueProjectionRef.current)
      const renderHandle = renderHandleRef.current
      const renderProps = {
        data: valueProjectionRef.current?.values || {},
        disableFeedbackSurface: true,
      }
      const handle =
        typeof renderHandle?.update === 'function'
          ? (await renderHandle.update(panelSchema, {
              ...renderProps,
              localeNamespace: 'workflow-editor',
            }),
            renderHandle)
          : await renderAmisSchema(containerRef.current, panelSchema, {
              ...renderProps,
              localeNamespace: 'workflow-editor',
            })

      if (disposed) {
        destroyRenderHandleLater(handle)
        return
      }

      renderHandleRef.current = handle
      applyAmisValueProjection({
        renderHandle: handle,
        valueProjection: valueProjectionRef.current,
        formName: PROPERTY_EDITOR_FORM_NAME,
      })
    }

    void renderForm()

    return () => {
      disposed = true
    }
  }, [panelSchema, rememberProjectedValues, schemaKey])

  useEffect(() => {
    rememberProjectedValues(valueProjection)
    applyAmisValueProjection({
      renderHandle: renderHandleRef.current,
      valueProjection,
      formName: PROPERTY_EDITOR_FORM_NAME,
    })
  }, [rememberProjectedValues, valueProjection])

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  )
}

export default AmisPropertyForm
