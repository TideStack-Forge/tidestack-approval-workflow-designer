import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const registerComponentSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/registerComponent.js'),
  'utf8'
)
const editorAdapterSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/editor-core/ApprovalWorkFlowEditor.jsx'),
  'utf8'
)
const editorCoreSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/editor-core/ApprovalWorkflowEditorCore.jsx'),
  'utf8'
)
const workflowSourceContractSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/editor-core/workflowSourceContract.js'),
  'utf8'
)
const nodeEditorSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/workflow-editor-adapters/middle/nodeEditor.js'),
  'utf8'
)
const reactFlowCanvasSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/views/workflow/components/ReactFlowDesigner/ReactFlowCanvas.jsx'),
  'utf8'
)
const mainEntrySource = fs.readFileSync(path.resolve(process.cwd(), 'src/main.js'), 'utf8')
const readOnlyFlowCanvasSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/views/workflow/components/ReadOnlyFlowCanvas/index.jsx'),
  'utf8'
)
const harnessEntrySource = fs.readFileSync(
  path.resolve(process.cwd(), 'tests/integration/workflow/harness/App.js'),
  'utf8'
)

describe('ApprovalWorkFlowEditor source contract', () => {
  it('loads workflow editor registration from the micro frontend entry', () => {
    expect(mainEntrySource).toContain("import './registerComponent'")
  })

  it('registers the read-only diagram viewer through ouroboros-sdk so runtime pages can load it via component-library mount', () => {
    expect(readOnlyFlowCanvasSource).toContain("import { Renderer as RendererWrapper } from 'ouroboros-sdk'")
    expect(readOnlyFlowCanvasSource).toContain("type: 'workflow-diagram-viewer'")
    expect(readOnlyFlowCanvasSource).not.toContain("import { Renderer as RendererWrapper } from 'amis-core'")
  })

  it('keeps registerComponent.js as a thin registration entry', () => {
    expect(registerComponentSource).toContain(
      "import { ApprovalWorkFlowEditor } from './editor-core/ApprovalWorkFlowEditor'"
    )
    expect(registerComponentSource).toContain("type: 'workflow-editor'")
    expect(registerComponentSource).toContain('export { ApprovalWorkFlowEditor }')
    expect(registerComponentSource).not.toContain('ReactFlowDesignerShell')
    expect(registerComponentSource).not.toContain('ProcessDesigner')
    expect(registerComponentSource).not.toContain('editorMode')
    expect(registerComponentSource).not.toContain('WORKFLOW_EDITOR_RENDERER_G6')
    expect(registerComponentSource).not.toContain('__OUROBOROS_WORKFLOW_EDITOR_MODE__')
  })

  it('keeps ApprovalWorkFlowEditor as the outer adapter around the core editor', () => {
    expect(editorAdapterSource).toContain('ApprovalWorkflowEditorCore')
    expect(editorAdapterSource).toContain('<ApprovalWorkflowEditorCore')
    expect(editorAdapterSource).not.toContain('ReactFlowDesignerShell')
  })

  it('uses React Flow as the only workflow editor renderer inside the core editor', () => {
    expect(editorCoreSource).toContain('ReactFlowDesignerShell')
    expect(editorCoreSource).not.toContain('ProcessDesigner')
    expect(editorCoreSource).not.toContain('g6CanvasAdapter')
    expect(editorCoreSource).not.toContain('editorMode')
    expect(editorCoreSource).not.toContain('WORKFLOW_EDITOR_RENDERER_G6')
    expect(editorCoreSource).not.toContain('WORKFLOW_EDITOR_RENDERER_MODE')
    expect(editorCoreSource).not.toContain('__OUROBOROS_WORKFLOW_EDITOR_MODE__')
  })

  it('keeps the browser harness on the React Flow product surface without legacy renderer switches', () => {
    expect(harnessEntrySource).toContain("import { mount as designerMount } from '../../../../src/main.js'")
    expect(harnessEntrySource).toContain(
      "import { ApprovalWorkFlowEditor } from '../../../../src/registerComponent.js'"
    )
    expect(harnessEntrySource).not.toContain('ProcessDesigner')
    expect(harnessEntrySource).not.toContain('workflow-chart')
    expect(harnessEntrySource).not.toContain('editorMode')
    expect(harnessEntrySource).not.toContain('WORKFLOW_EDITOR_RENDERER_G6')
    expect(harnessEntrySource).not.toContain('__OUROBOROS_WORKFLOW_EDITOR_MODE__')
  })

  it('keeps command surface and selection contract inside the shell layer', () => {
    const shellSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/views/workflow/components/ReactFlowDesigner/ReactFlowDesignerShell.jsx'
      ),
      'utf8'
    )
    const commandSurfaceSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/views/workflow/components/ReactFlowDesigner/WorkflowEditorCommandSurface.jsx'
      ),
      'utf8'
    )
    const rightPanelSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/views/workflow/components/ReactFlowDesigner/RightPanel.jsx'
      ),
      'utf8'
    )

    expect(shellSource).toContain('WorkflowEditorCommandSurface')
    expect(commandSurfaceSource).toContain('workflow-editor-command-surface')
    expect(shellSource).toContain('selectionMode={selection.mode}')
    expect(shellSource).toContain('onRegisterCommandBridge={handleRegisterCommandBridge}')
    expect(shellSource).toContain('onRegisterMutationBridge={handleRegisterMutationBridge}')
    expect(shellSource).toContain('commandBridge?.getHistorySnapshot?.()')
    expect(shellSource).toContain('case WORKFLOW_EDITOR_COMMAND_IDS.UNDO')
    expect(shellSource).toContain('case WORKFLOW_EDITOR_COMMAND_IDS.REDO')
    expect(reactFlowCanvasSource).toContain('getHistorySnapshot')
    expect(reactFlowCanvasSource).toContain('undo: handleUndoCommand')
    expect(reactFlowCanvasSource).toContain('redo: handleRedoCommand')
    expect(rightPanelSource).toContain("resolvedSelectionMode === 'multi'")
    expect(rightPanelSource).toContain('当前版本暂不支持批量属性编辑')
  })

  it('keeps page composition concerns out of the editor host surface', () => {
    expect(editorAdapterSource).toContain('ApprovalWorkflowEditorIntegrationAdapter.loadDefinition')
    expect(editorAdapterSource).toContain('ApprovalWorkflowEditorIntegrationAdapter.resolveFormFieldSources')
    expect(editorAdapterSource).toContain('ApprovalWorkflowEditorIntegrationAdapter.resolveCandidateSource')
    expect(editorAdapterSource).toContain(
      'ApprovalWorkflowEditorIntegrationAdapter.resolveBasicInfoData'
    )
    expect(editorAdapterSource).toContain('buildToolbarBaseInfoEntry')
    expect(editorAdapterSource).toContain('buildExternalSourceResolveData')
    expect(editorAdapterSource).toContain('this.props.basicInfoFormItems')
    expect(editorAdapterSource).toContain('this.props.basicInfoDataSourceApi')
    expect(editorAdapterSource).toContain('this.props.basicInfoButtonLabel')
    expect(editorAdapterSource).toContain('this.props.basicInfoButtonIcon')
    expect(editorAdapterSource).toContain('this.props.basicInfoOpenMode')
    expect(editorAdapterSource).toContain('props?.data?.definitionId')
    expect(editorAdapterSource).toContain('data-testid="workflow-editor-host"')
    expect(editorAdapterSource).not.toContain('this.props.basicInfoSchema')
    expect(editorAdapterSource).not.toContain('showBaseInfo')
    expect(editorAdapterSource).not.toContain('showSaveButton')
    expect(editorAdapterSource).not.toContain('showReturnButton')
    expect(editorAdapterSource).not.toContain('this.props.render(')
    expect(editorAdapterSource).not.toContain("label: '流程ID'")
    expect(editorAdapterSource).not.toContain("label: '绑定表单'")
  })

  it('does not reinitialize when the current session already matches the incoming value', () => {
    expect(editorAdapterSource).toContain('!isEqual(currentDefinition, this.props.value)')
  })

  it('keeps the normalized-session early return that prevents echo reinitialization', () => {
    expect(editorCoreSource).toContain('isEqual(currentDefinition, nextDefinition)')
    expect(editorCoreSource).toContain(
      'session?.getSourceFormatVersion?.() === nextSession.getSourceFormatVersion()'
    )
    expect(editorCoreSource).toContain('return')
  })

  it('commits the session before syncing the normalized definition back to props', () => {
    expect(editorAdapterSource).toContain('this.setState(nextState, async () => {')
    expect(editorAdapterSource).toContain(
      'if (this.props?.onChange && !isEqual(this.props.value, nextDefinition)) {'
    )
    expect(editorAdapterSource).toContain('this.props.onChange(nextDefinition)')
    expect(editorAdapterSource).toContain('await this.syncExternalSources()')
  })

  it('syncs remote definition meta edits from the outer page without forcing a reload', () => {
    expect(editorAdapterSource).toContain('isDefinitionMetaOnlyChanged')
    expect(editorAdapterSource).toContain('this.applyMetaOnlyDefinitionToLiveSession(this.props.value)')
    expect(editorAdapterSource).toContain('activeSession.updateWorkflowMeta(metaPatch)')
    expect(editorAdapterSource).not.toContain('this.handleSessionChange(this.props.value)')
  })

  it('reuses the live core session when the inner editor emits an updated definition echo', () => {
    expect(editorAdapterSource).toContain('const activeSession = this.coreRef.current?.session')
    expect(editorAdapterSource).toContain('this.handleSessionChange(activeSession)')
    expect(editorAdapterSource).toContain('isEqual(activeSession.getDefinition?.(), nextDefinition)')
  })

  it('requires the outer page to provide a definitionId for new workflow drafts', () => {
    expect(editorAdapterSource).toContain('请先在外层页面指定流程标识')
    expect(nodeEditorSource).toContain("const middleWorkflowGraphId = flowId || ''")
    expect(nodeEditorSource).not.toContain("flowId || getUUID('flow')")
  })

  it('keeps explicit source normalization outside the core capability contract', () => {
    expect(workflowSourceContractSource).toContain('normalizeWorkflowCandidateSource')
    expect(workflowSourceContractSource).toContain('normalizeWorkflowCandidateSourceFromApi')
    expect(workflowSourceContractSource).toContain('normalizeWorkflowFormPermissionFieldSource')
    expect(workflowSourceContractSource).toContain('resolveWorkflowSourceApi')
    expect(workflowSourceContractSource).toContain('candidateName')
  })
})
