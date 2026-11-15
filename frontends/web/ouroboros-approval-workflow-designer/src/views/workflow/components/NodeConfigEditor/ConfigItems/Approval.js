export default function (fetcher, isReadonly, formData, context) {
  const hideActions = context?.nodeConfig?.approvalConfiguration?.hideActions || false
  const hidePercentage =
    context?.nodeConfig?.approvalConfiguration?.hidePercentage || false
  const hideRejectAction =
    context?.nodeConfig?.approvalConfiguration?.hideRejectAction || false
  const hideNoCandidateMode =
    context?.nodeConfig?.approvalConfiguration?.hideNoCandidateMode || false
  const userSelector = context.userSelector
  const noCandidateModeOptions = [
    {
      value: 'approved',
      label: '自动通过',
    },
    {
      value: 'rejected',
      label: '拒绝',
    },
  ]

  if (userSelector) {
    noCandidateModeOptions.push({
      value: 'reAssignUser',
      label: '转交给某个人',
    })
  }

  return {
    type: 'fieldSet',
    title: '审批配置',
    className: 'mb-4',
    collapsable: true,
    body: [
      {
        type: 'container',
        body: [
          {
            name: 'subType',
            type: 'radios',
            label: '审批方式',
            required: true,
            options: [
              {
                label: '单签',
                value: '单签',
              },
              {
                label: '会签',
                value: '会签',
              },
            ],
            onEvent: {
              change: {
                actions: [
                  {
                    actionType: 'broadcast',
                    args: {
                      eventName: 'changeSubType',
                    },
                  },
                ],
              },
            },
          },
          {
            name: 'actions',
            type: 'checkboxes',
            joinValues: false,
            extractValue: true,
            label: '可选审批动作',
            visibleOn: "${subType === '单签'&& " + !hideActions + ' }',
            options: [
              {
                value: 'rollback',
                label: '退回',
              },
              {
                value: 'reject',
                label: '拒绝',
              },
              {
                value: 'transfer',
                label: '转办',
              },
              {
                value: 'addSign',
                label: '加签',
              },
              {
                value: 'freeReject',
                label: '自由驳回',
              },
              {
                value: 'freeApproval',
                label: '自由审批',
              },
            ],
          },
          {
            name: 'multipleMode',
            type: 'radios',
            label: '会签模式',
            visibleOn: "${subType === '会签'}",
            required: true,
            options: [
              {
                label: '串行',
                value: '串行',
              },
              {
                label: '并行',
                value: '并行',
              },
            ],
            value: '并行',
          },
          {
            name: 'percentage',
            type: 'input-number',
            label: '通过比例',
            visibleOn: "${subType === '会签' && " + !hidePercentage + '}',
            required: true,
            suffix: '%',
            min: 1,
            max: 100,
            value: 100,
          },
          {
            name: 'percentage',
            type: 'hidden',
            label: '通过比例',
            visibleOn: "${subType === '会签'}",
            required: true,
            suffix: '%',
            min: 1,
            max: 100,
            value: 100,
          },
          {
            name: 'rejectAction',
            type: 'radios',
            label: '会签失败动作',
            visibleOn: "${subType === '会签' && " + !hideRejectAction + '}',
            required: true,
            options: [
              {
                value: 'rollback',
                label: '退回',
              },
              {
                value: 'reject',
                label: '拒绝',
              },
            ],
            value: 'reject',
          },
          {
            name: 'rejectAction',
            type: 'hidden',
            label: '会签失败动作',
            visibleOn: "${subType === '会签'}",
            required: true,
            options: [
              {
                value: 'rollback',
                label: '退回',
              },
              {
                value: 'reject',
                label: '拒绝',
              },
            ],
            value: 'reject',
          },
          {
            name: 'noCandidateMode',
            type: 'radios',
            label: '审批人为空时',
            visibleOn:
              '${candidates && candidates.length && ' + !hideNoCandidateMode + '}',
            required: true,
            options: noCandidateModeOptions,
            onEvent: {
              change: {
                actions: [
                  {
                    actionType: 'setValue',
                    componentName: 'reAssignUsers',
                    args: {
                      value: [],
                    },
                  },
                ],
              },
            },
          },
          userSelector
            ? {
                ...userSelector,
                visibleOn: "${noCandidateMode === 'reAssignUser'}",
                name: 'reAssignUsers',
                label: '请选择审批人',
                mode: 'normal',
                required: true,
                validations: {
                  minLength: 1,
                  maxLength: 1,
                },
                validationErrors: {
                  minLength: '审批人至少选择1个',
                  maxLength: '审批人最多只能选择1个',
                },
              }
            : null,
        ],
      },
    ],
  }
}
