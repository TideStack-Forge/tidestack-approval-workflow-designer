export default function (fetcher, isReadonly, formData, context) {
  return {
    type: 'fieldSet',
    title: '分支条件',
    className: 'mb-4',
    collapsable: true,
    body: [
      {
        type: 'condition-builder',
        label: '条件组件',
        name: 'condition',
        searchable: true,
        mode: 'normal',
        required: true,
        fields: context.conditionFields,
        disabledOn: '${mode}',
      },
    ],
  }
}
