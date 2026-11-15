export default {
  type: 'fieldSet',
  title: '选择流程节点配置',
  className: 'mb-4',
  collapsable: true,
  body: [
    {
      type: 'container',
      body: [
        {
          name: 'subProcessId',
          type: 'select',
          label: '选择流程',
          mode: 'normal',
          required: true,
          source: {
            method: 'get',
            url: '/api/approval-workflow',
            data: {
              page: 1,
              perPage: 10000,
              status: 'deployed',
            },
          },
        },
        {
          type: 'input-table',
          name: 'inParameters',
          label: '传入变量',
          mode: 'normal',
          addable: true,
          editable: true,
          removable: true,
          required: true,
          columns: [
            {
              name: 'source',
              label: '来源',
              placeholder: '选择变量',
            },
            {
              name: 'target',
              label: '目标',
            },
          ],
        },
        {
          name: 'inParameters',
          label: '回传变量',
          mode: 'normal',
          type: 'input-table',
          addable: true,
          editable: true,
          removable: true,
          columns: [
            {
              name: 'source',
              label: '来源',
              placeholder: '选择变量',
            },
            {
              name: 'target',
              label: '目标',
            },
          ],
        },
      ],
    },
  ],
}
