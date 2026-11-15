const opMap = {
  equal: '=',
  'not_equal': '!=',
  'is_empty': '为空',
  'is_not_empty': '不为空',
  like: '模糊匹配',
  'not_like': '不匹配',
  'starts_with': '匹配开头',
  'ends_with': '匹配结尾',
  less: '小于',
  'less_or_equal': '小于或等于',
  greater: '大于',
  'greater_or_equal': '大于或等于',
  between: '属于范围',
  'not_between': '不属于范围',
  'select_equals': '=',
  'select_not_equals': '!=',
  'select_any_in': '包含',
  'select_not_any_in': '不包含',
}

const conjunctionMap = {
  and: '且',
  or: '或',
}
export function parseConditionToString(condition, conditionFields = []) {
  if (!condition) {
    return ''
  }
  return {
    conditionStr: parseCondition(condition, conditionFields),
  }
}

function parseCondition(condition, conditionFields = [], isGroup = false) {
  let result = ''
  if (condition.children && condition.children.length > 0) {
    const childConditions = condition.children.map((child) =>
      parseCondition(child, conditionFields, true)
    )
    if (childConditions.some((child) => !child)) return ''
    const conjunction = conjunctionMap[condition.conjunction]
    result = `${childConditions.join(` ${conjunction} `)}`
  } else {
    const fieldName = condition?.left?.field
    const operator = opMap[condition.op]
    if (!fieldName || !operator) return ''

    const field = conditionFields.find((item) => (item.name || item.value) === fieldName)
    const label = field?.label || fieldName
    const formatValue = (value) => {
      const displayValue = field?.options?.find((item) => item.value === value)?.label ?? value
      return typeof displayValue === 'string' ? JSON.stringify(displayValue) : String(displayValue)
    }
    const fieldValue = Array.isArray(condition.right)
      ? condition.right.map(formatValue).join(', ')
      : formatValue(condition.right)
    result =
      condition.op === 'is_empty' || condition.op === 'is_not_empty'
        ? `${label} ${operator}`
        : `${label} ${operator} ${fieldValue}`
  }
  return result && isGroup ? `(${result})` : result
}
