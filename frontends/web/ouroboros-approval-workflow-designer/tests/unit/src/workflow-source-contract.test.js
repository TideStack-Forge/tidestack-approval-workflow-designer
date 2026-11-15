const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  deriveWorkflowFieldSources,
  normalizeWorkflowCandidateSource,
  normalizeWorkflowFormFieldSource,
  normalizeWorkflowFormPermissionFieldSource,
  normalizeWorkflowCandidateSourceFromApi,
  resolveWorkflowSourceApi,
} = require('../../../src/editor-core/workflowSourceContract.js')
const { normalizeWorkflowConditionFieldSource } = require('../../../src/editor-core/coreContract.js')

test('condition fields use actual value types to select inputs and comparison operators', () => {
  const cases = [
    ['Integer', 'number'], ['Long', 'number'], ['Short', 'number'],
    ['Float', 'number'], ['Double', 'number'], ['Decimal', 'number'],
    ['Date', 'date'], ['DateTime', 'datetime'], ['Time', 'time'],
    ['String', 'text'], ['Boolean', 'boolean'],
    ['Snowflake', 'text'], ['Json', 'text'], ['Map', 'text'],
    ['List', 'text'], ['CustomValue', 'text'],
  ]
  const fields = cases.map(([valueType], index) => ({
    name: `field${index}`, type: '自定义业务字段', valueType,
  }))
  const sources = deriveWorkflowFieldSources({ fields })

  assert.deepStrictEqual(sources.formFieldSource.fields.map((field) => field.type), fields.map((field) => field.type))
  assert.strictEqual(sources.conditionFieldSource.fields.length, cases.length)
  sources.conditionFieldSource.fields.forEach((field, index) => {
    const [valueType, expectedType] = cases[index]
    assert.strictEqual(field.type, expectedType, valueType)
    assert.strictEqual(field.valueType, valueType)
    if (['number', 'date', 'time', 'datetime'].includes(expectedType)) {
      assert(field.operators.includes('greater'), valueType)
      assert(field.operators.includes('between'), valueType)
      assert(!field.operators.includes('like'), valueType)
    } else if (valueType === 'String') {
      assert(field.operators.includes('like'))
      assert(field.operators.includes('starts_with'))
      assert(!field.operators.includes('greater'))
    } else {
      assert.deepStrictEqual(field.operators, ['equal', 'not_equal'], valueType)
    }
  })
})

test('value type takes precedence over business field names and bounds explicitly supplied operators', () => {
  const source = normalizeWorkflowConditionFieldSource([
    { name: 'code', type: 'number', valueType: 'String' },
    { name: 'amount', type: '单行文本', valueType: 'Decimal', operators: ['greater', 'like'] },
    { name: 'object', type: 'text', valueType: 'Map' },
  ])

  assert.strictEqual(source.fields[0].type, 'text')
  assert(!source.fields[0].operators.includes('greater'))
  assert.strictEqual(source.fields[1].type, 'number')
  assert.deepStrictEqual(source.fields[1].operators, ['greater'])
  assert.deepStrictEqual(source.fields[2].operators, ['equal', 'not_equal'])
})

test('value type constraints also bound default operators and preserve declared equality operators', () => {
  const source = normalizeWorkflowConditionFieldSource([
    { name: 'object', valueType: 'Map', defaultOp: 'like' },
    { name: 'amount', valueType: 'Decimal', defaultOp: 'like', operators: ['greater', 'less'] },
    { name: 'status', valueType: 'String', operators: ['select_equals', 'select_not_equals'] },
    { name: 'unsupported', valueType: 'Map', operators: ['like'] },
  ])

  assert.strictEqual(source.fields[0].defaultOp, 'equal')
  assert.strictEqual(source.fields[1].defaultOp, 'greater')
  assert.deepStrictEqual(source.fields[2].operators, ['select_equals', 'select_not_equals'])
  assert.strictEqual(source.fields[2].defaultOp, 'select_equals')
  assert.deepStrictEqual(source.fields.map((field) => field.name), ['object', 'amount', 'status'])
})

test('workflow source contract normalizes candidate arrays into stable item payloads', () => {
  const candidateSource = normalizeWorkflowCandidateSource([
    {
      value: 'User',
      title: '指定成员',
      configMode: 'Pick',
    },
  ])

  assert.deepStrictEqual(candidateSource, {
    revisionToken: 'candidate:1',
    items: [
      {
        value: 'User',
        title: '指定成员',
        configMode: 'Pick',
        name: 'User',
        label: '指定成员',
        valueKey: 'User',
        items: [],
        disabledIn: [],
      },
    ],
  })
})

test('workflow source contract normalizes form permission items into field payloads', () => {
  const formPermissionFieldSource = normalizeWorkflowFormPermissionFieldSource({
    items: [
      {
        name: 'amount',
        title: '申请金额',
      },
    ],
  })

  assert.deepStrictEqual(formPermissionFieldSource, {
    items: [
      {
        name: 'amount',
        title: '申请金额',
      },
    ],
    revisionToken: 'form-permission:1',
    fields: [
      {
        name: 'amount',
        title: '申请金额',
        label: '申请金额',
        value: 'amount',
      },
    ],
  })
})

test('workflow source contract derives condition permission and candidate views from one form field source', () => {
  const fieldSources = deriveWorkflowFieldSources({
    sourceKind: 'form-fields',
    revisionToken: 'form-fields:demo.order:4',
    fields: [
      {
        name: 'managerId',
        label: '直属主管',
        type: '员工',
        usages: ['candidate', 'permission'],
      },
      {
        name: 'amount',
        label: '申请金额',
        type: 'number',
        usages: ['condition', 'permission'],
      },
      {
        name: 'remark',
        label: '备注',
        type: 'text',
      },
      {
        name: 'reviewers',
        label: '复核人',
        type: '多员工',
      },
    ],
  })

  assert.deepStrictEqual(
    fieldSources.formFieldSource.fields.map((field) => field.value),
    ['managerId', 'amount', 'remark', 'reviewers']
  )
  assert.deepStrictEqual(
    fieldSources.conditionFieldSource.fields.map((field) => field.value),
    ['amount', 'remark']
  )
  assert.deepStrictEqual(
    fieldSources.formPermissionFieldSource.fields.map((field) => field.value),
    ['managerId', 'amount', 'remark', 'reviewers']
  )
  assert.deepStrictEqual(
    fieldSources.candidateFieldSource.fields.map((field) => field.value),
    ['managerId', 'reviewers']
  )
})

test('workflow source contract keeps empty form field source views empty', () => {
  const fieldSources = deriveWorkflowFieldSources(normalizeWorkflowFormFieldSource(null))

  assert.deepStrictEqual(fieldSources.formFieldSource.fields, [])
  assert.deepStrictEqual(fieldSources.conditionFieldSource.fields, [])
  assert.deepStrictEqual(fieldSources.formPermissionFieldSource.fields, [])
  assert.deepStrictEqual(fieldSources.candidateFieldSource.fields, [])
})

test('workflow source contract resolves request templates before fetch and unwraps payload', async () => {
  const fetchCalls = []
  const payload = await resolveWorkflowSourceApi({
    env: {
      fetcher: async (request) => {
        fetchCalls.push(request)
        return {
          status: 0,
          data: {
            items: [{ value: 'u1', label: '张三' }],
          },
        }
      },
    },
    sourceApi: {
      method: 'get',
      url: '/api/approval-workflow/candidate/${candidateName}/items',
      data: {
        appName: '${appName}',
      },
    },
    data: {
      candidateName: 'User',
      appName: 'crm',
    },
    normalize: (value) => value,
  })

  assert.deepStrictEqual(fetchCalls, [
    {
      method: 'get',
      url: '/api/approval-workflow/candidate/User/items',
      data: {
        appName: 'crm',
      },
    },
  ])
  assert.deepStrictEqual(payload, {
    items: [{ value: 'u1', label: '张三' }],
  })
})

test('workflow source contract keeps runtime candidate item templates for category and selected values', async () => {
  const candidateSource = await normalizeWorkflowCandidateSourceFromApi({
    env: {
      fetcher: async () => ({
        status: 0,
        data: {
          items: [
            {
              name: 'User',
              label: '指定成员',
              configMode: 'Pick',
              valueKey: 'users',
            },
          ],
        },
      }),
    },
    sourceApi: {
      list: {
        method: 'get',
        url: '/api/approval-workflow/candidate',
      },
      items: {
        method: 'get',
        url: '/api/approval-workflow/candidate/${candidateName}/items',
        data: {
          category: '${category}',
          value: '${value}',
        },
      },
      category: {
        method: 'get',
        url: '/api/approval-workflow/candidate/${candidateName}/category',
      },
    },
  })

  assert.deepStrictEqual(candidateSource, {
    revisionToken: 'candidate:1',
    items: [
      {
        name: 'User',
        label: '指定成员',
        configMode: 'Pick',
        valueKey: 'users',
        items: [],
        disabledIn: [],
        itemsSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/items',
          data: {
            category: '${category}',
            value: '${value}',
          },
        },
        categorySourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/category',
        },
      },
    ],
  })
})

test('workflow source contract keeps schema-first candidate items while attaching explicit item and category apis', async () => {
  const candidateSource = await normalizeWorkflowCandidateSourceFromApi({
    env: {
      fetcher: async () => ({
        status: 0,
        data: {
          items: [
            {
              name: 'User',
              label: '指定成员',
              valueKey: 'users',
              schema: {
                type: 'dynamic-tree-transfer-picker',
                name: 'users',
                label: '请选择指定成员',
              },
            },
          ],
        },
      }),
    },
    sourceApi: {
      list: {
        method: 'get',
        url: '/api/approval-workflow/candidate',
      },
      items: {
        method: 'get',
        url: '/api/approval-workflow/candidate/${candidateName}/items',
        data: {
          category: '${category}',
          value: '${value}',
        },
      },
      category: {
        method: 'get',
        url: '/api/approval-workflow/candidate/${candidateName}/category',
      },
    },
  })

  assert.deepStrictEqual(candidateSource, {
    revisionToken: 'candidate:1',
    items: [
      {
        name: 'User',
        label: '指定成员',
        valueKey: 'users',
        schema: {
          type: 'dynamic-tree-transfer-picker',
          name: 'users',
          label: '请选择指定成员',
        },
        items: [],
        disabledIn: [],
        itemsSourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/items',
          data: {
            category: '${category}',
            value: '${value}',
          },
        },
        categorySourceApi: {
          method: 'get',
          url: '/api/approval-workflow/candidate/User/category',
        },
      },
    ],
  })
})
