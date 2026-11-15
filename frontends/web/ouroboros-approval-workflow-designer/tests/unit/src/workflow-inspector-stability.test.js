const assert = require('assert')
require('@babel/register')({
  extensions: ['.js', '.jsx'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
})

const {
  createWorkflowInspectorTargetSnapshot,
  resolveWorkflowInspectorSelectionPayload,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowInspectorTarget.js')
const {
  applyAmisValueProjection,
  PROPERTY_EDITOR_FORM_NAME,
  readAmisFormValues,
  resolveAmisPropertyForm,
  submitAmisPropertyForm,
} = require('../../../src/views/workflow/components/ReactFlowDesigner/workflowInspectorAmisSession.js')

test('workflow inspector target snapshot tracks logical target instead of object identity', () => {
  const selectionSnapshot = {
    mode: 'single-node',
    primaryTargetId: 'approve-1',
    nodeIds: ['approve-1'],
    edgeIds: [],
  }
  const payloadA = resolveWorkflowInspectorSelectionPayload({
    selectionSnapshot,
    nodes: [{ id: 'approve-1', type: 'approval', data: { name: '经理审批' } }],
    edges: [],
  })
  const payloadB = resolveWorkflowInspectorSelectionPayload({
    selectionSnapshot,
    nodes: [{ id: 'approve-1', type: 'approval', data: { name: '总监审批' } }],
    edges: [],
  })

  assert.notStrictEqual(payloadA, payloadB)
  assert.deepEqual(
    createWorkflowInspectorTargetSnapshot({
      selectionMode: selectionSnapshot.mode,
      selectionSnapshot,
      selectionPayload: payloadA,
    }),
    createWorkflowInspectorTargetSnapshot({
      selectionMode: selectionSnapshot.mode,
      selectionSnapshot,
      selectionPayload: payloadB,
    })
  )
})

test('workflow inspector amis session updates values in place through the property form instance', () => {
  const updates = []
  const mockForm = {
    setValues(values, replace) {
      updates.push({ values, replace })
    },
  }
  const renderHandle = {
    getScopeRef() {
      return {
        getComponentByName(name) {
          return name === PROPERTY_EDITOR_FORM_NAME ? mockForm : null
        },
      }
    },
  }

  const resolvedForm = resolveAmisPropertyForm(renderHandle)
  const updated = applyAmisValueProjection({
    renderHandle,
    valueProjection: {
      targetId: 'approve-1',
      values: {
        name: '经理审批',
      },
    },
  })

  assert.strictEqual(resolvedForm, mockForm)
  assert.strictEqual(updated, true)
  assert.deepEqual(updates, [
    {
      values: {
        name: '经理审批',
      },
      replace: true,
    },
  ])
})

test('workflow inspector submit bridge reads current form values and forwards them through the stable submit handler', async () => {
  const submissions = []
  const mockForm = {
    getValues() {
      return {
        name: '经理审批-ok',
        subType: '单签',
      }
    },
  }
  const renderHandle = {
    getScopeRef() {
      return {
        getComponentByName(name) {
          return name === PROPERTY_EDITOR_FORM_NAME ? mockForm : null
        },
      }
    },
  }

  assert.deepEqual(readAmisFormValues(renderHandle), {
    name: '经理审批-ok',
    subType: '单签',
  })

  const submitted = await submitAmisPropertyForm({
    renderHandle,
    onSubmit: async (values) => {
      submissions.push(values)
    },
  })

  assert.strictEqual(submitted, true)
  assert.deepEqual(submissions, [
    {
      name: '经理审批-ok',
      subType: '单签',
    },
  ])
})
