export default {
  type: 'fieldSet',
  title: '分流节点配置',
  className: 'mb-4',
  collapsable: true,
  body: [
    {
      name: 'logic',
      type: 'radios',
      label: '分流方式',
      required: true,
      options: [
        {
          label: '并行',
          value: 'inclusive',
        },
        {
          label: '互斥',
          value: 'exclusive',
        },
      ],
    },
  ],
}
