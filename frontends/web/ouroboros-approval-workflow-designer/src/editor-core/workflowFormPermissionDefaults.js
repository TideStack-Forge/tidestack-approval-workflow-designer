const normalizeArray = (value) => (Array.isArray(value) ? value : [])

export const resolveWorkflowFormPermissionFieldKey = (item) =>
  item?.name || item?.value || item?.key || null

export const normalizeWorkflowFormPermissionItem = (item) => {
  const name = resolveWorkflowFormPermissionFieldKey(item)
  return name ? { ...item, name } : item
}

export const buildDefaultVisibleFormPermission = (item) => {
  const normalizedItem = normalizeWorkflowFormPermissionItem(item)
  const name = resolveWorkflowFormPermissionFieldKey(normalizedItem)

  if (!name) {
    return null
  }

  return {
    ...normalizedItem,
    name,
    visible: true,
    writable: false,
    required: false,
  }
}

export const buildDefaultVisibleFormPermissions = (fields) =>
  normalizeArray(fields).map(buildDefaultVisibleFormPermission).filter(Boolean)

export const normalizeWorkflowFormPermissionValues = (value) =>
  normalizeArray(value)
    .map(normalizeWorkflowFormPermissionItem)
    .filter((item) => resolveWorkflowFormPermissionFieldKey(item))

export const mergeWorkflowFormPermissionRows = (fields, value) => {
  const defaultRows = buildDefaultVisibleFormPermissions(fields)
  const permissionValues = normalizeWorkflowFormPermissionValues(value)

  if (!defaultRows.length) {
    return []
  }

  return defaultRows.map((row) => {
    const rowName = resolveWorkflowFormPermissionFieldKey(row)
    const foundValue = permissionValues.find(
      (item) => resolveWorkflowFormPermissionFieldKey(item) === rowName
    )
    return foundValue ? { ...row, ...foundValue } : row
  })
}

export const materializeWorkflowFormPermissionValue = (fields, value) => {
  const rows = mergeWorkflowFormPermissionRows(fields, value)
  return rows.length ? rows : normalizeWorkflowFormPermissionValues(value)
}
