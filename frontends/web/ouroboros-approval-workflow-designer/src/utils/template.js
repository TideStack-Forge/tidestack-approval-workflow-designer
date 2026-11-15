const EXACT_TEMPLATE_PATTERN = /^\$\{([^}]+)\}$/
const INLINE_TEMPLATE_PATTERN = /\$\{([^}]+)\}/g
const HAS_TEMPLATE_PATTERN = /\$\{[^}]+\}/

const isPlainObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const isPathExpression = (expression) => /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(expression)

const getByPath = (source, path) => {
  if (!path) {
    return source
  }

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current == null) {
        return undefined
      }
      return current[segment]
    }, source)
}

const resolveTemplateString = (template, data) => {
  const exactMatch = template.match(EXACT_TEMPLATE_PATTERN)
  if (exactMatch) {
    const expression = exactMatch[1].trim()
    if (!isPathExpression(expression)) {
      return template
    }

    const resolved = getByPath(data, expression)
    return resolved === undefined ? template : resolved
  }

  return template.replace(INLINE_TEMPLATE_PATTERN, (match, expression) => {
    const normalizedExpression = expression.trim()
    if (!isPathExpression(normalizedExpression)) {
      return match
    }

    const resolved = getByPath(data, normalizedExpression)
    return resolved == null ? match : String(resolved)
  })
}

export const resolveTemplateValue = (value, data = {}) => {
  if (typeof value === 'string') {
    return resolveTemplateString(value, data)
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, data))
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((accumulator, [key, item]) => {
      accumulator[key] = resolveTemplateValue(item, data)
      return accumulator
    }, {})
  }

  return value
}

export const containsTemplateExpression = (value) => {
  if (typeof value === 'string') {
    return HAS_TEMPLATE_PATTERN.test(value)
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsTemplateExpression(item))
  }

  if (isPlainObject(value)) {
    return Object.values(value).some((item) => containsTemplateExpression(item))
  }

  return false
}
