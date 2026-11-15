import { t } from '../../../../i18n.js'
import React from 'react'
import { Renderer as RendererWrapper } from 'ouroboros-sdk'
import ReactFlowCanvas from '../ReactFlowDesigner/ReactFlowCanvas'
import {
  buildWorkflowChromeCssVariables,
  createWorkflowChromeVisualContract,
} from '../ReactFlowDesigner/workflowChromeVisualContract'
import {
  buildReadOnlyCanvasData,
  resolveReadOnlyCanvasHeight,
  resolveReadOnlyActiveNodeIds,
  resolveReadOnlyDefinition,
} from './transform.js'
import '../ReactFlowDesigner/styles.scss'
import './index.scss'

const READ_ONLY_WORKFLOW_CHROME_VISUAL_CONTRACT = createWorkflowChromeVisualContract()
const READ_ONLY_WORKFLOW_CHROME_STYLE = buildWorkflowChromeCssVariables(
  READ_ONLY_WORKFLOW_CHROME_VISUAL_CONTRACT
)

/**
 * Read-only workflow diagram renderer for AMIS
 * Reuses FlowCanvas component with editing disabled
 * 
 * Props:
 * - definition: Workflow definition JSON (nodes + edges)
 * - activeNodeIds: Array of node IDs to highlight (optional)
 */
class ReadOnlyFlowCanvas extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      canvasData: null,
    }
  }

  componentDidMount() {
    this.updateCanvasData()
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.definition !== this.props.definition ||
      prevProps.activeNodeIds !== this.props.activeNodeIds ||
      prevProps.data !== this.props.data
    ) {
      this.updateCanvasData()
    }
  }

  updateCanvasData() {
    const { definition, activeNodeIds, data } = this.props
    const resolvedDefinition = resolveReadOnlyDefinition(definition, data)
    const resolvedActiveNodeIds = resolveReadOnlyActiveNodeIds(activeNodeIds, data)

    if (!resolvedDefinition) {
      this.setState({ canvasData: null })
      return
    }

    const canvasData = this.transformDefinitionToCanvasData(
      resolvedDefinition,
      resolvedActiveNodeIds
    )
    this.setState({ canvasData })
  }

  transformDefinitionToCanvasData(definition, activeNodeIds = []) {
    return buildReadOnlyCanvasData(definition, activeNodeIds)
  }

  render() {
    const { diagnostics, height } = this.props
    const { canvasData } = this.state
    const resolvedHeight = resolveReadOnlyCanvasHeight(height)
    const viewerStyle = {
      height: resolvedHeight,
      minHeight: resolvedHeight,
    }

    if (!canvasData) {
      return (
        <div className="workflow-diagram-viewer-empty" style={viewerStyle}>
          <p>{t('暂无流程图数据')}</p>
        </div>
      )
    }

    return (
      <div className="workflow-diagram-viewer" style={viewerStyle}>
        <div
          className="react-flow-designer-container workflow-diagram-viewer-surface"
          style={READ_ONLY_WORKFLOW_CHROME_STYLE}
        >
          <ReactFlowCanvas
            data={{
              isReadonly: true,
            }}
            externalCanvasData={canvasData}
            diagnosticsSnapshot={diagnostics}
            visualContract={READ_ONLY_WORKFLOW_CHROME_VISUAL_CONTRACT}
          />
        </div>
      </div>
    )
  }
}

const WorkflowDiagramViewer = RendererWrapper({
  type: 'workflow-diagram-viewer',
  name: 'WorkflowDiagramViewer',
})(ReadOnlyFlowCanvas)

export default WorkflowDiagramViewer
