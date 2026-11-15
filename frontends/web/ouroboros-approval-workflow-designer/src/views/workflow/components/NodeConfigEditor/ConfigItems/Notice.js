export default {
  type: 'fieldSet',
  title: '通知配置',
  className: 'mb-4',
  collapsable: true,
  body: [
    {
      name: 'content',
      type: 'textarea',
      label: '内容模板',
      required: true,
    },
    {
      name: 'channel',
      type: 'checkboxes',
      label: '通知方式',
      options: [
        {
          value: 'email',
          label: '电子邮件',
        },
        {
          value: 'message',
          label: '短信',
        },
      ],
    },
  ],
}
