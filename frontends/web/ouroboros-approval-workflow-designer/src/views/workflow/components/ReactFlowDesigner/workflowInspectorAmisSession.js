const clone = (value) => JSON.parse(JSON.stringify(value))

export const PROPERTY_EDITOR_FORM_NAME = 'property'

export const resolveAmisPropertyForm = (
  renderHandle,
  formName = PROPERTY_EDITOR_FORM_NAME
) => {
  const scopeRef = renderHandle?.getScopeRef?.()
  if (!scopeRef) {
    return null
  }

  return (
    scopeRef.getComponentByName?.(formName) ||
    scopeRef.getComponentById?.(formName) ||
    null
  )
}

export const applyAmisValueProjection = ({
  renderHandle,
  valueProjection,
  formName = PROPERTY_EDITOR_FORM_NAME,
} = {}) => {
  if (!renderHandle || !valueProjection?.values) {
    return false
  }

  const nextValues = clone(valueProjection.values)
  const form = resolveAmisPropertyForm(renderHandle, formName)

  if (typeof form?.setValues === 'function') {
    form.setValues(nextValues, true)
    return true
  }

  if (typeof form?.setData === 'function') {
    form.setData(nextValues, true)
    return true
  }

  const scopeRef = renderHandle.getScopeRef?.()
  if (typeof scopeRef?.setData === 'function') {
    scopeRef.setData(nextValues, true)
    return true
  }

  return false
}

export const readAmisFormValues = (
  renderHandle,
  formName = PROPERTY_EDITOR_FORM_NAME
) => {
  const form = resolveAmisPropertyForm(renderHandle, formName)

  if (typeof form?.getValues === 'function') {
    return clone(form.getValues())
  }

  if (form?.props?.data && typeof form.props.data === 'object') {
    return clone(form.props.data)
  }

  return null
}

export const submitAmisPropertyForm = async ({
  renderHandle,
  onSubmit,
  formName = PROPERTY_EDITOR_FORM_NAME,
} = {}) => {
  if (typeof onSubmit !== 'function') {
    return false
  }

  const values = readAmisFormValues(renderHandle, formName)
  if (!values) {
    return false
  }

  await onSubmit(values)
  return true
}
