import '@fortawesome/fontawesome-free/css/all.css'
import '@fortawesome/fontawesome-free/css/v4-shims.css'
import 'amis/lib/themes/cxd.css'
import 'amis/lib/helper.css'
import 'amis/sdk/iconfont.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  render as renderAmis,
  registerIcon as registerAmisIcon,
  extractObjectChain,
  createObjectFromChain,
} from 'amis'
import {
  FormItem,
  OptionsControl,
  Renderer,
  addRule,
  registerAction,
  registerFormula,
  utils,
} from 'amis-core'

import { mount as designerMount } from '../../../../src/main.js'
import { ApprovalWorkFlowEditor } from '../../../../src/registerComponent.js'
import { middleToReactFlow } from '../../../../src/canvas-adapters/react-flow/index.js'
import { EditorSession } from '../../../../src/editor-session/index.js'
import { createMockEnv } from './createMockEnv.js'
import { resolveScenario } from './scenarios.js'

let sdkInitPromise = null
const harnessRenderRoots = new WeakMap()

const normalizeAmisSchema = (schema) => {
  if (Array.isArray(schema)) {
    return {
      type: 'page',
      body: schema,
    }
  }

  return schema
}

const renderHarnessAmisSchema = async (containerEl, schema, props = {}, env = {}) => {
  const root = harnessRenderRoots.get(containerEl) || createRoot(containerEl)
  harnessRenderRoots.set(containerEl, root)

  let scopeRef = null
  const renderOnce = async (nextSchema, nextProps = {}, nextEnv = {}) => {
    const dataChain = extractObjectChain(nextProps?.data || {})
    root.render(
      renderAmis(
        normalizeAmisSchema(nextSchema),
        {
          ...(nextProps || {}),
          data: createObjectFromChain(dataChain),
          scopeRef(ref) {
            scopeRef = ref
            nextProps?.scopeRef?.(ref)
          },
        },
        {
          ...(nextEnv || {}),
        }
      )
    )
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }

  await renderOnce(schema, props, env)

  return {
    getScopeRef() {
      return scopeRef
    },
    async update(nextSchema = schema, nextProps = props, nextEnv = env) {
      await renderOnce(nextSchema, nextProps, nextEnv)
    },
    async destroy() {
      root.unmount()
      harnessRenderRoots.delete(containerEl)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    },
  }
}

function createHarnessI18n() {
  let locale = 'zh-CN'
  let messages = {}
  const listeners = new Set()
  const translate = (namespace, key, fallback) =>
    messages[namespace]?.[key] || fallback || key
  return {
    getLocale: () => locale,
    getLanguages: () => [],
    switchLanguage: async (nextLocale, nextMessages = {}) => {
      locale = nextLocale
      messages = nextMessages
      for (const listener of listeners) listener(locale)
    },
    t: (key, defaultText) => defaultText || key,
    tn: translate,
    tMenu: (key, defaultText) => translate('menu', key, defaultText),
    tCommon: (key, defaultText) => translate('common', key, defaultText),
    useNamespace: (namespace) => (key, defaultText) =>
      translate(namespace, key, defaultText),
    getLocaleData: () => ({ locale, messages }),
    onLocaleChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const harnessI18n = createHarnessI18n()

function createHarnessUtils(mock) {
  return {
    FormItem,
    OptionsControl,
    Renderer,
    addRule,
    registerFormula,
    registerAction,
    registerValidator: () => {},
    registerEditorPlugin: () => {},
    registerActionPanel: () => {},
    registerIcon: registerAmisIcon,
    confirm: async () => {
      if (!mock.confirmResponses.length) {
        return false
      }
      return mock.confirmResponses.shift()
    },
    alert: async () => {},
    prompt: async () => null,
    toast: {
      success: () => {},
      warning: () => {},
      info: () => {},
      error: () => {},
    },
    request: async () => ({ status: 0, data: null }),
    amisUtils: utils,
    openTab: () => {},
    closeTab: () => {},
    openOrSwitchTab: () => {},
    sendToOpenerTab: () => {},
    updateTabTitle: () => {},
    openMenu: () => {},
    openDialog: async () => {
      if (!mock.dialogResponses.length) {
        return null
      }
      return mock.dialogResponses.shift()
    },
    openDrawer: async (request) => {
      mock.recordDrawerRequest(request)
      if (!mock.drawerResponses.length) {
        return null
      }
      return mock.drawerResponses.shift()
    },
    renderAmisSchema: renderHarnessAmisSchema,
    eventBus: {
      on() {},
      off() {},
      emit() {},
    },
    hasAuth: () => true,
    setTheme: () => {},
    getTheme: () => 'default',
    loginHandler: async () => ({}),
    getToken: async () => null,
    listExternalProviders: async () => [],
    isLocalPasswordLoginEnabled: () => true,
    startRedirectLogin: () => null,
    loginWithLdap: async () => ({}),
    exchangeLoginCode: async () => ({}),
    bindExternalAccount: async () => ({}),
    resolveReturnUrl: () => '/',
    mapAuthError: (code) => String(code || ''),
    logoutHandler: async () => {},
    stomp: {},
    getUserInfo: async () => ({}),
  }
}

async function ensureDesignerSdkReady(mock) {
  if (!sdkInitPromise) {
    sdkInitPromise = designerMount({
      __utils__: createHarnessUtils(mock),
      i18n: harnessI18n,
    })
  }

  return sdkInitPromise
}

function buildScenarioState(scenarioName) {
  return {
    scenarioName,
    scenario: resolveScenario(scenarioName),
  }
}

function createScenarioState() {
  const url = new URL(window.location.href)
  return buildScenarioState(url.searchParams.get('scenario') || 'new-flow')
}

function captureReactFlowContractSnapshot() {
  const shellPanels = Array.from(
    document.querySelectorAll('[data-testid^="workflow-panel-"]')
  )
  const paletteItems = Array.from(
    document.querySelectorAll('[data-testid="workflow-node-palette-item"]')
  )
  const paletteNodeTypes = paletteItems
    .map((item) => item.getAttribute('data-node-type') || '')
    .filter(Boolean)
  const lowerCasePaletteNodeTypes = paletteNodeTypes.map((nodeType) =>
    nodeType.toLowerCase()
  )

  return {
    hasThreePanelShell:
      document.querySelector('[data-testid="workflow-panel-left"]') !== null &&
      document.querySelector('[data-testid="workflow-panel-center"]') !== null &&
      document.querySelector('[data-testid="workflow-panel-right"]') !== null,
    shellPanelCount: shellPanels.length,
    paletteNodeTypes,
    paletteIncludesEnd: lowerCasePaletteNodeTypes.includes('end'),
    paletteIncludesCondition: lowerCasePaletteNodeTypes.includes('condition'),
    hasConditionPseudoNodeInCanvas:
      document.querySelector('[data-testid="reactflow-node-condition"]') !== null,
    hasEndNodeInCanvas:
      document.querySelector('[data-testid="reactflow-node-end"]') !== null,
    hasGridBackground:
      document.querySelector('.react-flow__background') !== null ||
      document.querySelector('.react-flow__background-pattern') !== null,
    hasAlignmentGuide:
      document.querySelector('.workflow-canvas-alignment-guide') !== null,
  }
}

function HarnessApp() {
  const [scenarioState, setScenarioState] = useState(() => createScenarioState())
  const { scenarioName, scenario } = scenarioState
  const [value, setValue] = useState(scenario.definition)
  const [editorGeneration, setEditorGeneration] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [fetcherCalls, setFetcherCalls] = useState([])
  const [savedDefinitions, setSavedDefinitions] = useState([])
  const [drawerRequests, setDrawerRequests] = useState([])
  const [publishedDefinitions, setPublishedDefinitions] = useState([])
  const [runtimeCoreCapabilities, setRuntimeCoreCapabilities] = useState(
    scenario.coreCapabilities
  )
  const [harnessDiagnosticsSnapshot, setHarnessDiagnosticsSnapshot] = useState({
    status: 'clean',
    items: [],
  })
  const [ready, setReady] = useState(false)
  const editorRef = useRef(null)
  const valueRef = useRef(value)
  const editorInputContract = useMemo(
    () => ({
      source: scenario.source || null,
      basicInfoFormItems: scenario.basicInfoFormItems || null,
      basicInfoDataSourceApi: scenario.basicInfoDataSourceApi || null,
      basicInfoButtonLabel: scenario.basicInfoButtonLabel || null,
      basicInfoButtonIcon: scenario.basicInfoButtonIcon || null,
      basicInfoOpenMode: scenario.basicInfoOpenMode || null,
      conditionFieldSource: scenario.conditionFieldSource || null,
      conditionFieldSourceApi: scenario.conditionFieldSourceApi || null,
      formFieldSourceApi: scenario.formFieldSourceApi || null,
      candidateSource: scenario.candidateSource || null,
      candidateSourceApi: scenario.candidateSourceApi || null,
      formPermissionFieldSource: scenario.formPermissionFieldSource || null,
      formPermissionFieldSourceApi: scenario.formPermissionFieldSourceApi || null,
    }),
    [scenario]
  )

  const mock = useMemo(
    () =>
      createMockEnv({
        onNotify(nextNotifications) {
          setNotifications([...nextNotifications])
        },
        onFetcher(nextFetcherCalls) {
          setFetcherCalls([...nextFetcherCalls])
        },
        onSave(nextSavedDefinitions) {
          setSavedDefinitions([...nextSavedDefinitions])
        },
        onDrawer(nextDrawerRequests) {
          setDrawerRequests([...nextDrawerRequests])
        },
      }),
    []
  )

  useEffect(() => {
    mock.reset({
      fetcherResponses: scenario.fetcherResponses,
    })
    setNotifications([])
    setFetcherCalls([])
    setSavedDefinitions([])
    setDrawerRequests([])
    setPublishedDefinitions([])
    setRuntimeCoreCapabilities(scenario.coreCapabilities)
    setHarnessDiagnosticsSnapshot({
      status: 'clean',
      items: [],
    })
    setValue(scenario.definition)
  }, [mock, scenario, scenarioName])

  useEffect(() => {
    let alive = true

    ensureDesignerSdkReady(mock).then(() => {
      if (alive) {
        setReady(true)
      }
    })

    return () => {
      alive = false
    }
  }, [mock])

  const env = useMemo(
    () => ({
      fetcher: mock.env.fetcher,
      notify: mock.env.notify,
    }),
    [mock]
  )

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const currentCanvasProjection = useMemo(() => {
    if (!value) {
      return null
    }

    const session = EditorSession.createFromDefinition(value)
    return middleToReactFlow(session.getWorkflow(), session.getDefinition().editorLayout)
  }, [value])

  useEffect(() => {
    const waitForRender = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    const mutateSession = async (applyMutation) => {
      const editor = editorRef.current
      const currentSession = editor?.state?.session
      const currentDefinition = currentSession?.getDefinition() || valueRef.current
      if (!currentDefinition) {
        return false
      }

      const session = EditorSession.createFromDefinition(currentDefinition)
      await applyMutation(session, editor)
      setValue(session.getDefinition())
      editor?.handleSessionChange?.(session)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      return true
    }

    const resolveWorkflowDesigner = async () => {
      const editor = editorRef.current
      if (!editor) {
        return null
      }

      let workflowDesigner = editor?.getWorkflowDesigner?.()
      if (!workflowDesigner) {
        await waitForRender()
        workflowDesigner = editor?.getWorkflowDesigner?.()
      }

      return workflowDesigner || null
    }

    const withWorkflowDesigner = async (applyMutation) => {
      const editor = editorRef.current
      const workflowDesigner = await resolveWorkflowDesigner()
      if (!workflowDesigner) {
        return false
      }

      const currentDefinition = valueRef.current
      const session = currentDefinition
        ? EditorSession.createFromDefinition(currentDefinition)
        : workflowDesigner.getSession()
      const originalGetSession = workflowDesigner.getSession.bind(workflowDesigner)

      workflowDesigner.getSession = () => session
      try {
        await applyMutation(workflowDesigner, editor, session)
      } finally {
        workflowDesigner.getSession = originalGetSession
      }
      await waitForRender()
      return true
    }

    window.__APPROVAL_WORKFLOW_HARNESS__ = {
      switchLanguage: harnessI18n.switchLanguage,
      reloadDefinition: async (definition) => {
        mock.reset({
          fetcherResponses: {
            ...scenario.fetcherResponses,
            [`/api/approval-workflow/definition/${scenario.flowKey}`]: {
              status: 0,
              data: definition,
            },
          },
        })
        setValue(definition)
        setEditorGeneration((generation) => generation + 1)
        await waitForRender()
      },
      addNode: async (targetNodeId, nodeData) =>
        mutateSession((session) => session.addNode(targetNodeId, nodeData)),
      addBranch: async (branchNodeId) =>
        mutateSession((session) => session.addBranch(branchNodeId)),
      deleteNodeViaDesigner: async (nodeId) =>
        withWorkflowDesigner((workflowDesigner) =>
          workflowDesigner.deleteNodeHandler({ id: nodeId })
        ),
      selectNode: async (nodeId) =>
        withWorkflowDesigner((workflowDesigner) =>
          workflowDesigner.nodeSelectedHandler({ id: nodeId })
        ),
      openNodeConfigViaDesigner: async (nodeId) =>
        withWorkflowDesigner((workflowDesigner) =>
          workflowDesigner.nodeSelectedHandler({ id: nodeId })
        ),
      selectEdge: async (edgeId) =>
        withWorkflowDesigner((workflowDesigner) =>
          workflowDesigner.edgeSelectedHandler({ id: edgeId })
        ),
      applySelectionSnapshot: async (selectionSnapshot) =>
        withWorkflowDesigner((workflowDesigner) =>
          workflowDesigner.applySelectionSnapshot(selectionSnapshot)
        ),
      readSelectionSnapshot: async () => {
        const workflowDesigner = await resolveWorkflowDesigner()
        return workflowDesigner?.getSelectionSnapshot?.() || null
      },
      updateWorkflowMeta: async (patch) =>
        mutateSession((session) => session.updateWorkflowMeta(patch)),
      submitBasicInfo: async (patch) => {
        const editor = editorRef.current
        const currentDefinition = editor?.readDefinition?.() || valueRef.current
        if (!editor?.handleBasicInfoSubmit || !currentDefinition) {
          return false
        }

        const nextDefinition = {
          ...currentDefinition,
          ...patch,
        }
        if (Object.prototype.hasOwnProperty.call(patch || {}, 'formId')) {
          nextDefinition.formKey = patch.formId
          delete nextDefinition.formId
        }

        return editor.handleBasicInfoSubmit(nextDefinition)
      },
      updateNodeConfig: async (nodeId, patch) =>
        mutateSession((session) => session.updateNodeConfig(nodeId, patch)),
      enqueueDialogResponse(response) {
        mock.dialogResponses.push(response)
        return mock.dialogResponses.length
      },
      enqueueDrawerResponse(response) {
        mock.drawerResponses.push(response)
        return mock.drawerResponses.length
      },
      enqueueConfirmResponse(response) {
        mock.confirmResponses.push(response)
        return mock.confirmResponses.length
      },
      readCurrentDefinition: () => valueRef.current || null,
      readCurrentCanvasData: () => currentCanvasProjection,
      readNotifications: () => notifications,
      readFetcherCalls: () => fetcherCalls,
      readLastSavedDefinition: () =>
        savedDefinitions.length ? savedDefinitions[savedDefinitions.length - 1] : null,
      readLastPublishedDefinition: () =>
        publishedDefinitions.length
          ? publishedDefinitions[publishedDefinitions.length - 1]
          : null,
      readLastDrawerRequest: () =>
        drawerRequests.length ? drawerRequests[drawerRequests.length - 1] : null,
      readDiagnosticsSnapshot: () => harnessDiagnosticsSnapshot,
      reactFlowContractSnapshot() {
        return captureReactFlowContractSnapshot()
      },
      readEditorInputContract() {
        return editorInputContract
      },
      updateCoreCapabilities(nextCoreCapabilities) {
        setRuntimeCoreCapabilities(nextCoreCapabilities || null)
        return true
      },
      switchScenario(nextScenarioName) {
        const nextScenarioState = buildScenarioState(nextScenarioName || 'new-flow')
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('scenario', nextScenarioState.scenarioName)
        window.history.replaceState({}, '', nextUrl.toString())
        setScenarioState(nextScenarioState)
        return nextScenarioState.scenarioName
      },
    }

    return () => {
      delete window.__APPROVAL_WORKFLOW_HARNESS__
    }
  }, [
    currentCanvasProjection,
    drawerRequests,
    fetcherCalls,
    harnessDiagnosticsSnapshot,
    mock,
    notifications,
    editorInputContract,
    publishedDefinitions,
    savedDefinitions,
  ])

  const currentDefinition = JSON.stringify(value || null)
  const currentCanvasData = JSON.stringify(currentCanvasProjection)
  const lastSavedDefinition = savedDefinitions.length
    ? JSON.stringify(savedDefinitions[savedDefinitions.length - 1])
    : 'null'
  const lastPublishedDefinition = publishedDefinitions.length
    ? JSON.stringify(publishedDefinitions[publishedDefinitions.length - 1])
    : 'null'
  const lastDrawerRequest = drawerRequests.length
    ? JSON.stringify(drawerRequests[drawerRequests.length - 1])
    : 'null'

  const handleSave = () => {
    const persistedDefinition =
      editorRef.current?.state?.session?.getPersistedDefinition?.() || valueRef.current
    if (!persistedDefinition) {
      return
    }

    mock.onSave(persistedDefinition)
  }

  const handlePublish = () => {
    const persistedDefinition =
      editorRef.current?.state?.session?.getPersistedDefinition?.() || valueRef.current
    if (!persistedDefinition) {
      return
    }

    setPublishedDefinitions((currentPublishedDefinitions) => [
      ...currentPublishedDefinitions,
      persistedDefinition,
    ])
    mock.env.notify('success', '发布动作由外层页面承接')
  }

  return (
    <div
      data-testid="workflow-harness-shell"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
      }}
    >
      <div>Approval workflow harness shell</div>
      <div
        data-testid="workflow-page-actions"
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {scenario.outerPageActions?.allowReturnNavigation ? (
          <button type="button">返回</button>
        ) : null}
        {scenario.outerPageActions?.allowDefinitionSave ? (
          <button type="button" onClick={handleSave}>
            保存
          </button>
        ) : null}
        {scenario.outerPageActions?.allowPublishAction ? (
          <button type="button" onClick={handlePublish}>
            发布
          </button>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid #d9d9d9' }}>
        {ready ? (
          <ApprovalWorkFlowEditor
            key={`${scenarioName}:${editorGeneration}`}
            ref={editorRef}
            data={{
              appName: scenario.appName || 'workflow-harness',
              id: scenario.flowKey,
              flowKey: scenario.flowKey,
              definitionId: scenario.definitionId,
              formType: scenario.formType,
              formId: scenario.fullName,
              formKey: scenario.fullName,
              modelName: scenario.modelName,
              sourceLayer: scenario.sourceLayer,
              returnTarget: scenario.returnTarget,
              mode: scenario.mode || 'edit',
            }}
            coreCapabilities={runtimeCoreCapabilities}
            conditionFieldSource={scenario.conditionFieldSource}
            conditionFieldSourceApi={scenario.conditionFieldSourceApi}
            formFieldSourceApi={scenario.formFieldSourceApi}
            candidateSource={scenario.candidateSource}
            candidateSourceApi={scenario.candidateSourceApi}
            formPermissionFieldSource={scenario.formPermissionFieldSource}
            formPermissionFieldSourceApi={scenario.formPermissionFieldSourceApi}
            basicInfoFormItems={scenario.basicInfoFormItems}
            basicInfoDataSourceApi={scenario.basicInfoDataSourceApi}
            basicInfoButtonLabel={scenario.basicInfoButtonLabel}
            basicInfoButtonIcon={scenario.basicInfoButtonIcon}
            basicInfoOpenMode={scenario.basicInfoOpenMode}
            env={env}
            onChange={setValue}
            onDiagnosticsChange={setHarnessDiagnosticsSnapshot}
            source={scenario.source}
            value={value}
          />
        ) : (
          <div style={{ padding: 16 }}>Loading workflow editor...</div>
        )}
      </div>
      <details
        style={{
          marginTop: 12,
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 8,
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: 8 }}>
          Debug Information (Click to expand)
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Current Definition
            </summary>
            <pre
              data-testid="current-definition"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {currentDefinition}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Notifications
            </summary>
            <pre
              data-testid="notifications"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {JSON.stringify(notifications)}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Current Canvas Data
            </summary>
            <pre
              data-testid="current-canvas-data"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {currentCanvasData}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Fetcher Calls
            </summary>
            <pre
              data-testid="fetcher-calls"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {JSON.stringify(fetcherCalls)}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Last Saved Definition
            </summary>
            <pre
              data-testid="last-saved-definition"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {lastSavedDefinition}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Editor Input Contract
            </summary>
            <pre
              data-testid="editor-input-contract"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {JSON.stringify(editorInputContract)}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Last Published Definition
            </summary>
            <pre
              data-testid="last-published-definition"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {lastPublishedDefinition}
            </pre>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Last Drawer Request
            </summary>
            <pre
              data-testid="last-drawer-request"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
              }}
            >
              {lastDrawerRequest}
            </pre>
          </details>
        </div>
      </details>
    </div>
  )
}

export function mountHarnessApp(container) {
  const root = createRoot(container)
  root.render(<HarnessApp />)
  return root
}
