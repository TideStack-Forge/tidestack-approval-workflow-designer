export async function FormPermission(fetcher, isReadonly, formData, context) {
  const items = context?.formPermissionFieldSource?.fields || []
  if (!items.length) {
    return null
  }

  return {
    type: 'fieldSet',
    title: '表单权限配置',
    className: 'mb-4',
    collapsable: true,
    body: [
      {
        name: 'permission',
        type: 'form-permission',
        label: false,
        options: items,
      },
    ],
  }
}
