const resolveAppName = () => {
  if (typeof window === 'undefined' || !window.location || !window.location.pathname) {
    return ''
  }
  const match = window.location.pathname.match(/\/dev\/([^/]+)/)
  return match && match[1] ? decodeURIComponent(match[1]) : ''
}

const withAppName = (data = {}) => {
  const appName = resolveAppName()
  return appName ? { ...data, appName } : data
}

/**
 * 基本信息-分类
 */
const categorySource = {
  method: 'get',
  url: '/api/approval-workflow/base-info/categories',
}

/**
 * 基本信息-绑定表单
 */
const formSource = {
  method: 'get',
  url: '/api/approval-workflow/base-info/form/default',
}

/**
 * 条件字段
 */
const expressionVariableSource = {
  method: 'get',
  url: '/api/approval-workflow/base-info/form/${formType}/${formKey}/expression-variable',
}

/**
 * 候选人
 */
const candidateSource = {
  method: 'get',
  url: `/api/approval-workflow/candidate`,
  data: withAppName(),
}
/**
 * 表单权限字段
 */
const formFieldSource = {
  method: 'get',
  url: '/api/approval-workflow/base-info/form/${formType}/${formKey}/field',
}
/**
 * 选择流程
 */
const subProcessSource = {
  method: 'get',
  url: '/api/approval-workflow',
  data: {
    page: 1,
    perPage: 10000,
    status: 'deployed',
  },
}

/**
 * 选择员工-左侧部门树接口
 */
const leftTreeSource = {
  url: '/api/approval-workflow/candidate/${name}/category',
  method: 'get',
  data: withAppName(),
}
/**
 * 选择员工-选中部门获取员工接口
 */
const selectItemSource = {
  url: '/api/approval-workflow/candidate/${name}/items',
  method: 'get',
  data: withAppName({
    category: '${category}',
    value: '${value}',
  }),
}

export {
  categorySource,
  formSource,
  expressionVariableSource,
  candidateSource,
  formFieldSource,
  subProcessSource,
  leftTreeSource,
  selectItemSource,
  resolveAppName,
  withAppName,
}
