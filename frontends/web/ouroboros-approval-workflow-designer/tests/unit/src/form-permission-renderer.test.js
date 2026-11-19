const assert = require('assert')
require('@babel/register')({
  extensions: ['.js'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

let registeredComponent = null

require.cache[require.resolve('ouroboros-sdk')] = {
  exports: {
    FormItem: () => (component) => {
      registeredComponent = component
      return component
    },
  },
}

require('../../../src/views/workflow/components/Amis/Renderers/FormPermission.js')

test('form permission renderer treats missing value as default visible permission list', async () => {
  const renderer = new registeredComponent({
    value: undefined,
    options: [{ name: 'amount', label: '金额' }],
  })

  let nextState = null
  renderer.setState = (state) => {
    nextState = state
  }

  await renderer.fetchPermissionList()

  assert.deepEqual(nextState, {
    formList: [
      {
        name: 'amount',
        label: '金额',
        visible: true,
        writable: false,
        required: false,
      },
    ],
  })
})

test('form permission renderer treats missing options as empty field list', async () => {
  const renderer = new registeredComponent({
    value: [{ name: 'amount', visible: true }],
    options: undefined,
  })

  let nextState = null
  renderer.setState = (state) => {
    nextState = state
  }

  await renderer.fetchPermissionList()

  assert.deepEqual(nextState, {
    formList: [],
  })
})

test('form permission renderer merges value-only field options by stable field key', async () => {
  const renderer = new registeredComponent({
    value: [
      { name: 'amount', visible: true },
      { value: 'title', writable: true },
      { value: 'secret', visible: false, writable: false },
    ],
    options: [
      { value: 'amount', label: '金额' },
      { value: 'title', label: '标题' },
      { value: 'secret', label: '保密字段' },
    ],
  })

  let nextState = null
  renderer.setState = (state) => {
    nextState = state
  }

  await renderer.fetchPermissionList()

  assert.deepEqual(nextState, {
    formList: [
      {
        value: 'amount',
        label: '金额',
        name: 'amount',
        visible: true,
        writable: false,
        required: false,
      },
      {
        value: 'title',
        label: '标题',
        name: 'title',
        visible: true,
        writable: true,
        required: false,
      },
      {
        value: 'secret',
        label: '保密字段',
        name: 'secret',
        visible: false,
        writable: false,
        required: false,
      },
    ],
  })
})

test('form permission renderer merges edits when current permission value is missing', () => {
  let changedValue = null
  const renderer = new registeredComponent({
    value: undefined,
    onChange: (value) => {
      changedValue = value
    },
  })

  renderer.handleCheckboxChange('visible', true, {
    name: 'amount',
    visible: false,
    writable: false,
    required: false,
  })

  assert.deepEqual(changedValue, [
    {
      name: 'amount',
      visible: true,
      writable: false,
      required: false,
    },
  ])
})

test('form permission renderer keeps untouched default-visible fields in emitted value', () => {
  let changedValue = null
  const renderer = new registeredComponent({
    value: undefined,
    onChange: (value) => {
      changedValue = value
    },
  })

  renderer.state.formList = [
    { name: 'amount', label: '金额', visible: true, writable: false, required: false },
    { name: 'title', label: '标题', visible: true, writable: false, required: false },
  ]

  renderer.handleCheckboxChange('visible', false, {
    name: 'amount',
    label: '金额',
    visible: true,
    writable: false,
    required: false,
  })

  assert.deepEqual(changedValue, [
    {
      name: 'amount',
      label: '金额',
      visible: false,
      writable: false,
      required: false,
    },
    {
      name: 'title',
      label: '标题',
      visible: true,
      writable: false,
      required: false,
    },
  ])
})

test('form permission renderer writes value-only field edits with canonical name', () => {
  let changedValue = null
  const renderer = new registeredComponent({
    value: [{ value: 'title', visible: false }],
    onChange: (value) => {
      changedValue = value
    },
  })

  renderer.handleCheckboxChange('visible', true, {
    value: 'amount',
    label: '金额',
    visible: false,
    writable: false,
    required: false,
  })

  assert.deepEqual(changedValue, [
    {
      value: 'title',
      visible: false,
      name: 'title',
    },
    {
      value: 'amount',
      label: '金额',
      visible: true,
      writable: false,
      required: false,
      name: 'amount',
    },
  ])
})

test('field source refresh updates visible rows while preserving saved missing permissions on edits', () => {
  let emitted
  const previous = {
    options: [{ name: 'amount', label: '采购金额' }],
    value: [{ name: 'amount', writable: true }],
  }
  const renderer = new registeredComponent(previous)
  renderer.setState = (state) => {
    renderer.state = { ...renderer.state, ...state }
  }
  renderer.componentDidMount()
  const next = {
    options: [{ name: 'expense', label: '报销金额' }],
    value: previous.value,
    onChange: (value) => {
      emitted = value
    },
  }
  renderer.props = next
  renderer.componentDidUpdate(previous)
  assert.deepEqual(
    renderer.state.formList.map((item) => item.name),
    ['expense']
  )
  renderer.handleCheckboxChange('writable', true, renderer.state.formList[0])
  assert.equal(emitted.find((item) => item.name === 'amount').writable, true)
  assert.equal(emitted.find((item) => item.name === 'expense').writable, true)
})
