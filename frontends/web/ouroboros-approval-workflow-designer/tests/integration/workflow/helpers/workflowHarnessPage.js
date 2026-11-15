const formatHarnessJson = (value) => {
  return JSON.stringify(typeof value === 'undefined' ? null : value)
}

class WorkflowHarnessPage {
  constructor(page) {
    this.page = page
  }

  async nodeScreenPoint(nodeId) {
    return this.page.evaluate((requestedNodeId) => {
      const nodeSelector = `.react-flow__node[data-id="${requestedNodeId}"]`
      const node = document.querySelector(nodeSelector)
      if (!node) {
        throw new Error(`react flow node not found: ${requestedNodeId}`)
      }

      const rect = node.getBoundingClientRect()
      const candidateXs = [
        rect.left + rect.width / 2,
        rect.left + rect.width * 0.75,
        rect.left + rect.width * 0.25,
        rect.right - Math.min(16, rect.width / 4),
        rect.left + Math.min(16, rect.width / 4),
      ]
      const candidateYs = [
        rect.top + rect.height / 2,
        rect.top + Math.min(16, rect.height / 4),
        rect.bottom - Math.min(16, rect.height / 4),
      ]

      for (const candidateY of candidateYs) {
        for (const candidateX of candidateXs) {
          const hitElements = document.elementsFromPoint(candidateX, candidateY) || []
          const matchedNode = hitElements.find(
            (element) => element === node || element?.closest?.(nodeSelector) === node
          )
          if (matchedNode) {
            return {
              x: candidateX,
              y: candidateY,
            }
          }
        }
      }

      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    }, nodeId)
  }

  async edgeScreenPoint(edgeId) {
    return this.page.evaluate((requestedEdgeId) => {
      const edgeContainerSelector = `.react-flow__edge[data-id="${requestedEdgeId}"]`
      const edgeContainer = document.querySelector(edgeContainerSelector)
      const edgeLabelWrapper = document.querySelector(
        `.react-flow__edge[data-id="${requestedEdgeId}"] .react-flow__edge-textwrapper`
      )

      const isEdgeHit = (screenX, screenY) => {
        const hitElements = document.elementsFromPoint(screenX, screenY) || []
        return hitElements.some(
          (element) => element === edgeContainer || element?.closest?.(edgeContainerSelector) === edgeContainer
        )
      }

      if (edgeLabelWrapper) {
        const rect = edgeLabelWrapper.getBoundingClientRect()
        const labelPoint = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
        if (isEdgeHit(labelPoint.x, labelPoint.y)) {
          return labelPoint
        }
      }

      const edgePath =
        document.querySelector(
          `.react-flow__edge[data-id="${requestedEdgeId}"] .react-flow__edge-interaction`
        ) ||
        document.querySelector(
          `.react-flow__edge[data-id="${requestedEdgeId}"] .react-flow__edge-path`
        )

      if (!edgePath) {
        throw new Error(`edge path not found: ${requestedEdgeId}`)
      }

      const totalLength = edgePath.getTotalLength()
      const sampleFractions = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]
      const screenMatrix = edgePath.getScreenCTM()
      if (!screenMatrix) {
        throw new Error(`edge screen matrix not resolved: ${requestedEdgeId}`)
      }

      for (const sampleFraction of sampleFractions) {
        const candidatePoint = edgePath.getPointAtLength(totalLength * sampleFraction)
        const screenPoint = screenMatrix.translate(candidatePoint.x, candidatePoint.y)
        if (isEdgeHit(screenPoint.e, screenPoint.f)) {
          return {
            x: screenPoint.e,
            y: screenPoint.f,
          }
        }
      }

      const middlePoint = edgePath.getPointAtLength(totalLength / 2)
      const fallbackScreenPoint = screenMatrix.translate(middlePoint.x, middlePoint.y)
      return {
        x: fallbackScreenPoint.e,
        y: fallbackScreenPoint.f,
      }
    }, edgeId)
  }

  async gotoScenario(scenarioName) {
    const canSwitchScenarioInPlace = await this.page
      .evaluate(() => Boolean(window.__APPROVAL_WORKFLOW_HARNESS__?.switchScenario))
      .catch(() => false)

    if (canSwitchScenarioInPlace) {
      await this.invokeHarness('switchScenario', scenarioName)
      await this.page.waitForFunction(
        (requestedScenario) =>
          new URL(window.location.href).searchParams.get('scenario') === requestedScenario &&
          Boolean(window.__APPROVAL_WORKFLOW_HARNESS__),
        scenarioName
      )
    } else {
      await this.page.goto(`playwright-harness.html?scenario=${scenarioName}`, {
        waitUntil: 'domcontentloaded',
      })
      await this.page.waitForFunction(() => Boolean(window.__APPROVAL_WORKFLOW_HARNESS__))
    }
    await this.page.getByTestId('workflow-editor-host').waitFor({ state: 'visible' })
  }

  async currentDefinitionText() {
    return formatHarnessJson(await this.currentDefinition())
  }

  async currentDefinition() {
    return this.invokeHarness('readCurrentDefinition')
  }

  async currentCanvasDataText() {
    return formatHarnessJson(await this.currentCanvasData())
  }

  async currentCanvasData() {
    return this.invokeHarness('readCurrentCanvasData')
  }

  async selectionSnapshot() {
    return this.invokeHarness('readSelectionSnapshot')
  }

  async rightPanelText() {
    return (await this.page.getByTestId('workflow-panel-right').innerText()) || ''
  }

  async rightPanelVisible() {
    return (await this.page.getByTestId('workflow-panel-right').getAttribute('data-panel-visible')) === 'true'
  }

  async leftPanelVisible() {
    return (await this.page.getByTestId('workflow-panel-left').getAttribute('data-panel-visible')) === 'true'
  }

  async toolbarCommandPressed(commandId) {
    return (
      (await this.page.locator(`[data-command-id="${commandId}"]`).first().getAttribute('data-command-pressed')) ===
      'true'
    )
  }

  async toolbarCommandEnabled(commandId) {
    return await this.page.locator(`[data-command-id="${commandId}"]`).first().isEnabled()
  }

  async toolbarCommandCount(commandId) {
    return this.page.locator(`[data-command-id="${commandId}"]`).count()
  }

  async clickToolbarCommand(commandId) {
    await this.page.locator(`[data-command-id="${commandId}"]`).first().click()
  }

  async togglePalettePanel() {
    await this.clickToolbarCommand('toggle-palette')
  }

  async toggleInspectorPanel() {
    await this.clickToolbarCommand('toggle-inspector')
  }

  async fetcherCallsText() {
    return formatHarnessJson(await this.fetcherCalls())
  }

  async fetcherCalls() {
    return this.invokeHarness('readFetcherCalls')
  }

  async notificationsText() {
    return formatHarnessJson(await this.notifications())
  }

  async notifications() {
    return this.invokeHarness('readNotifications')
  }

  async lastDrawerRequestText() {
    return formatHarnessJson(await this.lastDrawerRequest())
  }

  async lastDrawerRequest() {
    return this.invokeHarness('readLastDrawerRequest')
  }

  async lastSavedDefinitionText() {
    return formatHarnessJson(await this.lastSavedDefinition())
  }

  async lastSavedDefinition() {
    return this.invokeHarness('readLastSavedDefinition')
  }

  async invokeHarness(method, ...args) {
    return this.page.evaluate(
      ([requestedMethod, requestedArgs]) => {
        return window.__APPROVAL_WORKFLOW_HARNESS__[requestedMethod](...requestedArgs)
      },
      [method, args]
    )
  }

  async reactFlowContractSnapshot() {
    return this.invokeHarness('reactFlowContractSnapshot')
  }

  async editorInputContractText() {
    return formatHarnessJson(await this.editorInputContract())
  }

  async editorInputContract() {
    return this.invokeHarness('readEditorInputContract')
  }

  async diagnosticsSnapshot() {
    return this.invokeHarness('readDiagnosticsSnapshot')
  }

  async diagnosticMessages() {
    const diagnosticsSnapshot = await this.diagnosticsSnapshot()
    return Array.isArray(diagnosticsSnapshot?.items)
      ? diagnosticsSnapshot.items.map((item) => item?.message).filter(Boolean)
      : []
  }

  async clickSave() {
    await this.page.getByRole('button', { name: '保存', exact: true }).click()
  }

  async blankCanvasPoint() {
    await this.page.evaluate(async () => {
      const surfaceSelectors = [
        '[data-testid="workflow-panel-left"]',
        '[data-testid="workflow-panel-right"]',
        '.workflow-viewport-cluster',
      ]

      const readSurfaceSignature = () => {
        return surfaceSelectors
          .map((selector) => {
            const element = document.querySelector(selector)
            if (!element) {
              return `${selector}:missing`
            }

            const rect = element.getBoundingClientRect()
            return [
              selector,
              Math.round(rect.left),
              Math.round(rect.top),
              Math.round(rect.width),
              Math.round(rect.height),
              element.getAttribute('data-panel-visible') || '',
            ].join(':')
          })
          .join('|')
      }

      let previousSignature = ''
      let stableFrames = 0
      for (let frame = 0; frame < 30 && stableFrames < 2; frame += 1) {
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
        const nextSignature = readSurfaceSignature()
        if (nextSignature === previousSignature) {
          stableFrames += 1
        } else {
          stableFrames = 0
          previousSignature = nextSignature
        }
      }
    })

    return this.page.evaluate(() => {
      const pane = document.querySelector('.react-flow__pane')
      if (!pane) {
        throw new Error('react flow pane not found')
      }

      const paneRect = pane.getBoundingClientRect()
      const hitBlockerSelector =
        '.react-flow__node, .react-flow__edge, .react-flow__edge-path, .react-flow__edge-interaction, .react-flow__edge-textwrapper, .react-flow__edge-textbg, .workflow-viewport-cluster, .workflow-editor-command-surface, .workflow-editor-diagnostics-popover, .left-panel, .right-panel, .properties-panel, [data-testid="workflow-panel-right"]'

      for (let y = paneRect.bottom - 48; y >= paneRect.top + 48; y -= 40) {
        for (let x = paneRect.right - 48; x >= paneRect.left + 48; x -= 40) {
          const hitElements = document.elementsFromPoint(x, y) || []
          const isInsidePane = hitElements.some((element) => {
            return Boolean(element === pane || element?.closest?.('.react-flow__pane'))
          })
          if (!isInsidePane) {
            continue
          }

          const blocked = hitElements.some((element) => {
            return Boolean(
              element?.matches?.(hitBlockerSelector) || element?.closest?.(hitBlockerSelector)
            )
          })

          if (!blocked) {
            return { x, y }
          }
        }
      }

      throw new Error('blank canvas point not found')
    })
  }

  async viewportTransform() {
    return this.page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport')
      if (!viewport) {
        throw new Error('react flow viewport not found')
      }

      const transform = window.getComputedStyle(viewport).transform
      if (!transform || transform === 'none') {
        return {
          x: 0,
          y: 0,
          scale: 1,
        }
      }

      const matrix = new DOMMatrixReadOnly(transform)
      return {
        x: matrix.m41,
        y: matrix.m42,
        scale: matrix.a,
      }
    })
  }

  async nodeBox(nodeId) {
    return this.page.evaluate((requestedNodeId) => {
      const node = document.querySelector(`.react-flow__node[data-id="${requestedNodeId}"]`)
      if (!node) {
        throw new Error(`react flow node not found: ${requestedNodeId}`)
      }

      const rect = node.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }, nodeId)
  }

  async selectedNodeIds() {
    const selectionSnapshot = await this.selectionSnapshot()
    return Array.isArray(selectionSnapshot?.nodeIds) ? selectionSnapshot.nodeIds : []
  }

  async selectedEdgeIds() {
    const selectionSnapshot = await this.selectionSnapshot()
    return Array.isArray(selectionSnapshot?.edgeIds) ? selectionSnapshot.edgeIds : []
  }

  async selectNode(nodeId) {
    return this.invokeHarness('selectNode', nodeId)
  }

  async selectEdge(edgeId) {
    return this.invokeHarness('selectEdge', edgeId)
  }

  async applySelectionSnapshot(selectionSnapshot) {
    return this.invokeHarness('applySelectionSnapshot', selectionSnapshot)
  }

  async clickNode(nodeId) {
    const point = await this.nodeScreenPoint(nodeId)
    await this.page.mouse.click(point.x, point.y)
    return point
  }

  async diagnosticsTriggerStatus() {
    return this.page.getByTestId('workflow-editor-diagnostics-trigger').getAttribute('data-diagnostics-status')
  }

  async openDiagnosticsPopover() {
    const popover = this.page.getByTestId('workflow-editor-diagnostics-popover')
    if (await popover.isVisible().catch(() => false)) {
      return
    }

    await this.page.getByTestId('workflow-editor-diagnostics-trigger').click()
    await popover.waitFor({ state: 'visible' })
  }

  async clickFirstDiagnosticItem() {
    await this.openDiagnosticsPopover()
    await this.page.locator('.workflow-editor-diagnostics-item').first().click()
  }

  async clickDiagnosticItemByMessage(message) {
    await this.openDiagnosticsPopover()
    await this.page.locator('.workflow-editor-diagnostics-item').filter({ hasText: message }).first().click()
  }

  async rightPanelIsEmpty() {
    return (await this.rightPanelText()).trim().length === 0
  }

  async dropNodeTypeOnBlankCanvas(nodeType) {
    return this.page.evaluate((requestedNodeType) => {
      const canvas = document.querySelector('[data-testid="workflow-panel-center"]')
      if (!canvas) {
        throw new Error('workflow canvas not found')
      }

      const canvasRect = canvas.getBoundingClientRect()
      const hitBlockerSelector =
        '.react-flow__node, .react-flow__edge-path, .react-flow__edge-textwrapper, .react-flow__edge-textbg'

      let dropPoint = null
      for (let y = canvasRect.bottom - 48; y >= canvasRect.top + 48 && !dropPoint; y -= 40) {
        for (let x = canvasRect.right - 48; x >= canvasRect.left + 48; x -= 40) {
          const hitElements = document.elementsFromPoint(x, y) || []
          const blocked = hitElements.some((element) => {
            return Boolean(
              element?.matches?.(hitBlockerSelector) || element?.closest?.(hitBlockerSelector)
            )
          })

          if (!blocked) {
            dropPoint = { x, y }
            break
          }
        }
      }

      if (!dropPoint) {
        throw new Error('blank canvas drop point not found')
      }

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('application/reactflow', requestedNodeType)
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: dropPoint.x,
        clientY: dropPoint.y,
        dataTransfer,
      })
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: dropPoint.x,
        clientY: dropPoint.y,
        dataTransfer,
      })

      canvas.dispatchEvent(dragOverEvent)
      canvas.dispatchEvent(dropEvent)

      return dropPoint
    }, nodeType)
  }

  async dropNodeTypeOnEdge(nodeType, edgeId) {
    return this.page.evaluate(([requestedNodeType, requestedEdgeId]) => {
      const canvas = document.querySelector('[data-testid="workflow-panel-center"]')
      if (!canvas) {
        throw new Error('workflow canvas not found')
      }

      const edgePath =
        document.querySelector(
          `.react-flow__edge[data-id="${requestedEdgeId}"] .react-flow__edge-path`
        ) ||
        document.querySelector(
          `.react-flow__edge[data-id="${requestedEdgeId}"] .react-flow__edge-interaction`
        )
      if (!edgePath) {
        throw new Error(`edge path not found: ${requestedEdgeId}`)
      }

      const totalLength = edgePath.getTotalLength()
      const middlePoint = edgePath.getPointAtLength(totalLength / 2)
      const screenPoint = edgePath.getScreenCTM()?.translate(middlePoint.x, middlePoint.y)
      if (!screenPoint) {
        throw new Error(`edge screen point not resolved: ${requestedEdgeId}`)
      }

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('application/reactflow', requestedNodeType)
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: screenPoint.e,
        clientY: screenPoint.f,
        dataTransfer,
      })
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: screenPoint.e,
        clientY: screenPoint.f,
        dataTransfer,
      })

      canvas.dispatchEvent(dragOverEvent)
      canvas.dispatchEvent(dropEvent)

      return {
        x: screenPoint.e,
        y: screenPoint.f,
      }
    }, [nodeType, edgeId])
  }

  async clickEdge(edgeId) {
    const point = await this.edgeScreenPoint(edgeId)
    await this.page.mouse.click(point.x, point.y)
    return point
  }
}

module.exports = {
  WorkflowHarnessPage,
}
