// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { initAmisComponentLib } from 'ouroboros-sdk'
import LeftPanel from '../../../../src/views/workflow/components/ReactFlowDesigner/LeftPanel.jsx'
import RightPanel from '../../../../src/views/workflow/components/ReactFlowDesigner/RightPanel.jsx'
import { useLocale } from '../../../../src/useLocale.js'

vi.mock(
  '../../../../src/views/workflow/components/ReactFlowDesigner/PropertyEditor.jsx',
  () => ({ default: () => null })
)
vi.mock(
  '../../../../src/views/workflow/components/ReactFlowDesigner/WorkflowEdgeInspector.jsx',
  () => ({ default: () => null })
)

const listeners = new Set()
let locale = 'en-US'
const translations = {
  搜索节点: 'Search nodes',
  隐藏节点面板: 'Hide nodes',
  隐藏属性面板: 'Hide properties',
  审批: 'Approve',
  常量: 'Constant',
  无匹配节点: 'No matches',
}
const platformI18n = {
  getLocale: () => locale,
  onLocaleChange: (callback) => {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
  tn: vi.fn((namespace, key, fallback) =>
    locale === 'en-US' ? translations[key] || fallback : fallback
  ),
}
let root
let container
async function mount(element) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  locale = 'en-US'
  await initAmisComponentLib({}).mount({ i18n: platformI18n })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(element))
}
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  expect(listeners.size).toBe(0)
  vi.clearAllMocks()
})

test('palette uses its development namespace and refreshes existing inputs on language changes', async () => {
  await mount(
    React.createElement(LeftPanel, { coreCapabilities: { allowNodeCreate: true } })
  )
  const input = container.querySelector('input[type="search"]')
  expect(input.placeholder).toBe('Search nodes')
  expect(container.querySelector('[aria-label="Hide nodes"]')).not.toBeNull()
  expect(container.textContent).toContain('Approve')
  expect(platformI18n.tn).toHaveBeenCalledWith(
    'workflow-editor',
    '搜索节点',
    '搜索节点',
    undefined
  )
  await act(async () => {
    locale = 'zh-CN'
    for (const listener of listeners) listener(locale)
  })
  expect(container.querySelector('input[type="search"]')).toBe(input)
  expect(input.placeholder).toBe('搜索节点')
})

test('property close button uses the same namespace without altering selection data', async () => {
  const selection = { nodeIds: [], edgeIds: [] }
  function Panel() {
    useLocale()
    return React.createElement(RightPanel, {
      visible: true,
      selectionSnapshot: selection,
    })
  }
  await mount(React.createElement(Panel))
  expect(container.querySelector('[aria-label="Hide properties"]')).not.toBeNull()
  await act(async () => {
    locale = 'zh-CN'
    for (const listener of listeners) listener(locale)
  })
  expect(container.querySelector('[aria-label="隐藏属性面板"]')).not.toBeNull()
  expect(selection).toEqual({ nodeIds: [], edgeIds: [] })
})
