import { t } from '../../../../i18n.js'
import React, { useState } from 'react'
import { MiniMap } from '@xyflow/react'
import { WORKFLOW_EDITOR_COMMAND_IDS } from '../../../../editor-core/coreContract'
import {
  createWorkflowNavigatorSurfaceState,
  isWorkflowNavigatorMinimapExpanded,
  normalizeWorkflowNavigatorDockingContext,
  toggleWorkflowNavigatorMinimapState,
  WORKFLOW_NAVIGATOR_CONTROL_IDS,
  WORKFLOW_NAVIGATOR_LAYOUTS,
  WORKFLOW_NAVIGATOR_MINIMAP_STATES,
  WORKFLOW_NAVIGATOR_MINIMAP_TOGGLE_META,
  WORKFLOW_NAVIGATOR_SURFACE_CONTRACT,
} from './workflowNavigatorSurfaceContract'
import {
  WORKFLOW_CHROME_VISUAL_KINDS,
  buildWorkflowChromeVisualStateDataAttributes,
  createWorkflowChromeTooltipMeta,
  createWorkflowChromeVisualState,
  resolveWorkflowChromeTooltipText,
} from './workflowChromeVisualContract'

const VIEWPORT_CLUSTER_BUTTONS = Object.freeze([
  {
    commandId: WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_OUT,
    label: '缩小',
    iconClassName: 'fa-solid fa-magnifying-glass-minus',
  },
  {
    commandId: WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_PERCENT,
    label: '缩放',
    iconClassName: 'fa-solid fa-expand',
  },
  {
    commandId: WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_IN,
    label: '放大',
    iconClassName: 'fa-solid fa-magnifying-glass-plus',
  },
  {
    commandId: WORKFLOW_EDITOR_COMMAND_IDS.FIT_GRAPH,
    label: '适配',
    iconClassName: 'fa-solid fa-maximize',
  },
  {
    commandId: WORKFLOW_EDITOR_COMMAND_IDS.CENTER_GRAPH,
    label: '居中',
    iconClassName: 'fa-solid fa-crosshairs',
  },
])

const renderViewportCommandButton = ({
  commandId,
  label,
  iconClassName,
  commandStateMap,
  viewport,
  onExecuteCommand,
  visualContract,
}) => {
  const commandState = commandStateMap?.[commandId]
  if (!commandState?.visible) {
    return null
  }

  if (commandId === WORKFLOW_EDITOR_COMMAND_IDS.ZOOM_PERCENT) {
    const tooltipText = resolveWorkflowChromeTooltipText(
      createWorkflowChromeTooltipMeta({
        label: `${Math.round((viewport?.zoom || 1) * 100)}%`,
        tooltip: '当前缩放比例',
        disabledReason: commandState.disabledReason,
      }),
      visualContract
    )

    return (
      <span
        key={commandId}
        className="workflow-viewport-chip"
        title={t(tooltipText)}
        aria-label={t(tooltipText)}
        data-command-id={commandId}
        {...buildWorkflowChromeVisualStateDataAttributes(
          createWorkflowChromeVisualState({
            kind: WORKFLOW_CHROME_VISUAL_KINDS.CHIP,
            disabled: !commandState.enabled,
          })
        )}
      >
        {Math.round((viewport?.zoom || 1) * 100)}%
      </span>
    )
  }

  const tooltipText = resolveWorkflowChromeTooltipText(
    createWorkflowChromeTooltipMeta({
      label,
      disabledReason: commandState.disabledReason,
    }),
    visualContract
  )

  return (
    <button
      key={commandId}
      type="button"
      className="workflow-viewport-button"
      disabled={!commandState.enabled}
      title={t(tooltipText)}
      aria-label={t(tooltipText || label)}
      data-command-id={commandId}
      {...buildWorkflowChromeVisualStateDataAttributes(
        createWorkflowChromeVisualState({
          kind: WORKFLOW_CHROME_VISUAL_KINDS.NAVIGATOR_CONTROL,
          disabled: !commandState.enabled,
        })
      )}
      onClick={() => {
        void onExecuteCommand?.(commandId)
      }}
    >
      <i className={iconClassName}></i>
    </button>
  )
}

const renderMinimapToggleButton = ({
  minimapExpanded,
  onToggleMinimap,
  collapsed = false,
  visualContract,
}) => {
  const minimapState = minimapExpanded
    ? WORKFLOW_NAVIGATOR_MINIMAP_STATES.EXPANDED
    : WORKFLOW_NAVIGATOR_MINIMAP_STATES.COLLAPSED
  const toggleMeta = WORKFLOW_NAVIGATOR_MINIMAP_TOGGLE_META[minimapState]
  const className = collapsed
    ? 'workflow-viewport-button workflow-viewport-button--toggle workflow-viewport-minimap-toggle workflow-viewport-minimap-toggle--collapsed'
    : 'workflow-viewport-button workflow-viewport-button--toggle workflow-viewport-minimap-toggle'
  const tooltipText = resolveWorkflowChromeTooltipText(
    createWorkflowChromeTooltipMeta({
      label: toggleMeta.label,
      tooltip: toggleMeta.label,
    }),
    visualContract
  )

  return (
    <button
      key={WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP}
      type="button"
      className={className}
      aria-label={t(tooltipText || toggleMeta.label)}
      title={t(tooltipText)}
      data-control-id={WORKFLOW_NAVIGATOR_CONTROL_IDS.TOGGLE_MINIMAP}
      data-minimap-state={minimapState}
      {...buildWorkflowChromeVisualStateDataAttributes(
        createWorkflowChromeVisualState({
          kind: WORKFLOW_CHROME_VISUAL_KINDS.TOGGLE,
          pressed: minimapExpanded,
        })
      )}
      onClick={onToggleMinimap}
    >
      <i className={toggleMeta.iconClassName}></i>
    </button>
  )
}

const WorkflowViewportCluster = ({
  commandStateMap,
  viewport,
  onExecuteCommand,
  visualContract,
  dockingContext,
}) => {
  const [navigatorState, setNavigatorState] = useState(() => createWorkflowNavigatorSurfaceState())
  const minimapExpanded = isWorkflowNavigatorMinimapExpanded(navigatorState)
  const navigatorDockingContext = normalizeWorkflowNavigatorDockingContext(dockingContext)
  const visibleButtons = VIEWPORT_CLUSTER_BUTTONS.map((button) =>
    renderViewportCommandButton({
      ...button,
      commandStateMap,
      viewport,
      onExecuteCommand,
      visualContract,
    })
  ).filter(Boolean)

  if (visibleButtons.length === 0) {
    return null
  }

  const handleToggleMinimap = () => {
    setNavigatorState((currentState) => toggleWorkflowNavigatorMinimapState(currentState))
  }
  const layout = minimapExpanded
    ? WORKFLOW_NAVIGATOR_LAYOUTS.EXPANDED
    : WORKFLOW_NAVIGATOR_LAYOUTS.COLLAPSED
  const clusterStyle = {
    right: navigatorDockingContext.rightInset,
    bottom: navigatorDockingContext.bottomInset,
  }

  return (
    <div
      className={`workflow-viewport-cluster${
        minimapExpanded ? '' : ' workflow-viewport-cluster--collapsed'
      }`}
      data-testid="workflow-viewport-cluster"
      data-command-group="viewport"
      data-minimap-state={navigatorState.minimapState}
      data-layout={layout}
      data-navigator-owner={WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.owner}
      data-top-toolbar-toggle={WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.topToolbarToggle ? 'true' : 'false'}
      data-docking-follows-property-panel={navigatorDockingContext.followsPropertyPanel ? 'true' : 'false'}
      data-property-panel-visible={navigatorDockingContext.propertyPanelVisible ? 'true' : 'false'}
      data-property-panel-occupied-width={navigatorDockingContext.propertyPanelOccupiedWidth}
      data-docking-right-inset={navigatorDockingContext.rightInset}
      style={clusterStyle}
    >
      {minimapExpanded ? (
        <>
          <div
            className="workflow-viewport-minimap-shell"
            style={{
              width: visualContract?.navigator?.width || WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.width,
            }}
          >
            <MiniMap
              className="workflow-canvas-minimap"
              style={{
                width: visualContract?.navigator?.width || WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.width,
                height:
                  visualContract?.navigator?.minimapHeight ||
                  WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.minimapHeight,
                background: 'transparent',
              }}
            />
          </div>
          <div
            className="workflow-viewport-toolbar"
            style={{
              width: visualContract?.navigator?.width || WORKFLOW_NAVIGATOR_SURFACE_CONTRACT.width,
            }}
          >
            {visibleButtons}
            {renderMinimapToggleButton({
              minimapExpanded,
              onToggleMinimap: handleToggleMinimap,
              visualContract,
            })}
          </div>
        </>
      ) : null}
      {!minimapExpanded
        ? renderMinimapToggleButton({
            minimapExpanded,
            onToggleMinimap: handleToggleMinimap,
            collapsed: true,
            visualContract,
          })
        : null}
    </div>
  )
}

export default WorkflowViewportCluster
