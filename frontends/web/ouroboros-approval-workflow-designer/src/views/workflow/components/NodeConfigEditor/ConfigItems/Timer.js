export default {
  type: 'fieldSet',
  title: '定时器配置',
  className: 'mb-4',
  collapsable: true,
  body: [
    {
      name: 'duration',
      type: 'timer-input',
      label: false,
      // required: true,
    },
  ],
}
