const assert = require('assert')
const fs = require('fs')
const path = require('path')

const readSource = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

test('workflow diagnostics surface converges into a toolbar entry while preserving shared diagnostics facts', () => {
  const shellSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx')
  const canvasSource = readSource('src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx')
  const diagnosticsSurfaceSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowEditorDiagnosticsSurface.jsx'
  )
  const commandSurfaceSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/WorkflowEditorCommandSurface.jsx'
  )
  const chromeVisualContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowChromeVisualContract.js'
  )
  const toolbarSurfaceContractSource = readSource(
    'src/views/workflow/components/ReactFlowDesigner/workflowToolbarSurfaceContract.js'
  )
  const readOnlyViewerSource = readSource('src/views/workflow/components/ReadOnlyFlowCanvas/index.jsx')

  assert.ok(shellSource.includes('buildWorkflowValidationSnapshot'))
  assert.ok(shellSource.includes("import WorkflowEditorDiagnosticsSurface from './WorkflowEditorDiagnosticsSurface'"))
  assert.ok(shellSource.includes('buildWorkflowToolbarEntries'))
  assert.ok(shellSource.includes("from './workflowToolbarSurfaceContract'"))
  assert.ok(shellSource.includes('createWorkflowChromeVisualContract'))
  assert.ok(shellSource.includes('buildWorkflowChromeCssVariables'))
  assert.ok(shellSource.includes('buildWorkflowToolbarEntries({'))
  assert.ok(commandSurfaceSource.includes('workflow-command-status-entry'))
  assert.ok(toolbarSurfaceContractSource.includes("group: WORKFLOW_TOOLBAR_GROUPS.META"))
  assert.ok(shellSource.includes('diagnosticsIndicatorState'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-surface'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-trigger'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-trigger-label'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-trigger-count'))
  assert.ok(diagnosticsSurfaceSource.includes('workflow-editor-diagnostics-popover'))
  assert.ok(diagnosticsSurfaceSource.includes('resolveWorkflowChromeTooltipText'))
  assert.ok(diagnosticsSurfaceSource.includes("kind: WORKFLOW_CHROME_VISUAL_KINDS.STATUS"))
  assert.ok(diagnosticsSurfaceSource.includes('buildWorkflowChromeVisualStateDataAttributes'))
  assert.ok(diagnosticsSurfaceSource.includes('diagnosticsVisualStateDataAttributes'))
  assert.ok(shellSource.includes('handleDiagnosticNavigation'))
  assert.ok(chromeVisualContractSource.includes("['tooltip', 'disabledReason', 'label']"))
  assert.ok(chromeVisualContractSource.includes("'data-visual-tone'"))

  assert.ok(canvasSource.includes('diagnosticsSnapshot'))
  assert.ok(canvasSource.includes('diagnosticSeverity'))
  assert.ok(canvasSource.includes('focusTarget: handleFocusTargetCommand'))

  assert.ok(readOnlyViewerSource.includes('diagnosticsSnapshot={diagnostics}'))
})
