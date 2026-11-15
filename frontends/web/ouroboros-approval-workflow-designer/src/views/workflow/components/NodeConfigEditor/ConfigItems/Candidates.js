export async function Candidates(fetcher, isReadonly, formData, context) {
  let allCandidateList = context?.candidateSource?.items || []
  if (!allCandidateList.length) {
    return null
  }

  const disabledCandidatesBySubType = allCandidateList.reduce((accumulator, item) => {
    const disabledIn = item?.disabledIn || []
    disabledIn.forEach((subType) => {
      if (!accumulator[subType]) {
        accumulator[subType] = []
      }
      accumulator[subType].push(item.name)
    })
    return accumulator
  }, {})
  const computedCandidateList = allCandidateList.map((item) => {
    const arrays = item?.disabledIn || []
    return {
      name: item.name,
      label: item.label,
      hiddenOn: arrays.length > 0 ? '"' + arrays + '".includes(this.subType)' : false,
    }
  })
  const serializeCandidateNames = (candidateNames) =>
    '[' + candidateNames.map((candidateName) => "'" + candidateName.replace(/'/g, "\\'") + "'").join(', ') + ']'
  const changeSubTypeActions = Object.entries(disabledCandidatesBySubType).map(
    ([subType, candidateNames]) => ({
      actionType: 'setValue',
      args: {
        value: '',
      },
      expression:
        "${subType === '" + subType + "' && " + serializeCandidateNames(candidateNames) + '.includes(type)}',
    })
  )

  function applySchemaSourceContract(selectorSchema, item) {
    if (!selectorSchema || typeof selectorSchema !== 'object') {
      return selectorSchema
    }

    const nextSelector = {
      ...selectorSchema,
    }
    const selectorType = nextSelector.type
    const hasOptions = Array.isArray(nextSelector.options) && nextSelector.options.length > 0

    if (nextSelector.source === '$candidateFieldSource.fields') {
      nextSelector.options = context?.candidateFieldSource?.fields || []
      delete nextSelector.source
    }

    if ((selectorType === 'list-select' || selectorType === 'select') && !hasOptions) {
      if (Array.isArray(item?.items) && item.items.length > 0) {
        nextSelector.options = item.items
      } else if (!nextSelector.source && item?.itemsSourceApi) {
        nextSelector.source = item.itemsSourceApi
      }
    }

    if (selectorType === 'dynamic-tree-transfer-picker') {
      if (!nextSelector.leftTreeSource && item?.categorySourceApi) {
        nextSelector.leftTreeSource = item.categorySourceApi
      }
      if (!nextSelector.selectItemSource && item?.itemsSourceApi) {
        nextSelector.selectItemSource = item.itemsSourceApi
      }
    }

    return nextSelector
  }
  // 根据接口渲染配置
  const candidateSelector = allCandidateList.map((item) => {
    let selectorSchema = null
    // 如果存在schema 则直接渲染
    if (item?.schema && Object.keys(item?.schema).length !== 0) {
      selectorSchema = applySchemaSourceContract({
        ...item.schema,
        name: item.schema.name || item.valueKey,
        visibleOn: '${ type ==="' + item.name + '" }',
        clearValueOnHidden: true,
      }, item)
    } else {
      selectorSchema = renderCandidateSelector(item)
    }
    if (item.name === 'User') {
      context.userSelector = selectorSchema
    }

    return selectorSchema
  })

  // 公共 select 属性
  function commonSelectProperty(candidateType) {
    const { items = [], label, valueKey } = candidateType
    let result = {
      label: '请选择' + label,
      // name: 'candidates[0].' + valueKey,
      name: valueKey,
      options: items,
      joinValues: false,
      extractValue: true,
      required: true,
      mode: 'normal',
      validateOnChange: true,
    }
    if (!items || !items.length) {
      delete result.options
      result.source = candidateType.itemsSourceApi || undefined
    }
    return result
  }
  function renderCandidateSelector(item) {
    let selectSelector
    const { max, min = 0, label, valueKey } = item
    switch (item.configMode) {
      case 'Enum':
        selectSelector = {
          ...commonSelectProperty(item),
          type: 'list-select',
          clearable: true,
        }
        break
      case 'SingleSelect':
        selectSelector = {
          ...commonSelectProperty(item),
          type: 'select',
          searchable: true,
          multiple: false,
        }
        break
      case 'MultiSelect':
        selectSelector = {
          ...commonSelectProperty(item),
          type: 'select',
          label: `请选择${label} ( ${min} - ${max ? max : '无限'} )`,
          searchable: true,
          multiple: true,
          validations: {
            minLength: min,
            maxLength: max,
          },
          validationErrors: {
            minLength: label + '至少选择' + min + '个',
            maxLength: label + '最多只能选择' + max + '个',
          },
        }
        break
      case 'Pick':
        selectSelector = {
          mode: 'normal',
          required: true,
          type: 'dynamic-tree-transfer-picker',
          label: '请选择' + label,
          // name: 'candidates[0].' + valueKey,
          name: valueKey,
          validateOnChange: true,
          validations: {
            minLength: min,
            maxLength: max,
          },
          validationErrors: {
            minLength: label + '至少选择' + min + '个',
            maxLength: label + '最多只能选择' + max + '个',
          },
          leftTreeSource: item.categorySourceApi || undefined,
          selectItemSource: item.itemsSourceApi || undefined,
          pickerSize: 'lg',
        }
        break
      case 'Check':
        selectSelector = {
          type: 'hidden',
          value: true,
          name: valueKey,
        }
        break
      default:
        break
    }
    if (selectSelector) {
      // selectSelector.visibleOn = "${candidates[0].type === '" + item.name + "'}"
      selectSelector.visibleOn = "${type === '" + item.name + "'}"
      selectSelector.clearValueOnHidden = true
    }
    return selectSelector
  }

  const candidateFieldsetTitle =
    context?.nodeType === 'CcNode' ? '抄送人员' : '人员配置'

  const candidatesSchema = {
    type: 'fieldSet',
    title: candidateFieldsetTitle,
    className: 'mb-4',
    collapsable: true,
    body: [
      {
        type: 'combo',
        name: 'candidates',
        noBorder: true,
        strictMode: false,
        canAccessSuperData: true,
        label: false,
        multiLine: true,
        multiple: true,
        maxLength: 1,
        minLength: 1,
        addable: false,
        removable: false,
        items: [
          {
            // name: 'candidates[0].type',
            name: 'type',
            type: 'list-select',
            extractValue: true,
            clearable: true,
            label: false,
            valueField: 'name',
            required: true,
            options: computedCandidateList,
            static: false,
            disabled: isReadonly,
            onEvent:
              changeSubTypeActions.length > 0
                ? {
                    changeSubType: {
                      actions: changeSubTypeActions,
                    },
                  }
                : undefined,
          },
          ...candidateSelector,
        ],
      },
    ],
  }
  return candidatesSchema
}
