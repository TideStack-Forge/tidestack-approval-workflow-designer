import { t } from '../../../../i18n.js'
import React from 'react'
import WorkflowToolbarSchemaEntry from './WorkflowToolbarSchemaEntry'
import {
  WORKFLOW_TOOLBAR_ENTRY_KINDS,
  WORKFLOW_TOOLBAR_PRESENTATIONS,
  groupWorkflowToolbarEntries,
} from './workflowToolbarSurfaceContract'
import {
  WORKFLOW_CHROME_VISUAL_KINDS,
  buildWorkflowChromeVisualStateDataAttributes,
  createWorkflowChromeTooltipMeta,
  createWorkflowChromeVisualState,
  resolveWorkflowChromeTooltipText,
} from './workflowChromeVisualContract'

const buildEntryVisualStateDataAttributes = ({ kind, pressed = false, disabled = false }) => {
  return buildWorkflowChromeVisualStateDataAttributes(
    createWorkflowChromeVisualState({
      kind,
      pressed,
      disabled,
    })
  )
}

const renderToolbarEntry = ({ entry, onExecuteCommand, visualContract }) => {
  if (!entry?.visible) {
    return null
  }

  switch (entry.kind) {
    case WORKFLOW_TOOLBAR_ENTRY_KINDS.SCHEMA_ENTRY: {
      const schemaEntryVisualStateDataAttributes = buildEntryVisualStateDataAttributes({
        kind: WORKFLOW_CHROME_VISUAL_KINDS.COMMAND,
      })
      return (
        <div
          key={entry.id}
          className="workflow-command-custom-entry"
          data-command-id={entry.id}
          data-command-presentation={entry.presentation}
        >
          <WorkflowToolbarSchemaEntry
            entry={entry.payload?.entry}
            className="workflow-command-schema-entry"
            visualStateDataAttributes={schemaEntryVisualStateDataAttributes}
          />
        </div>
      )
    }
    case WORKFLOW_TOOLBAR_ENTRY_KINDS.STATUS_ENTRY:
      return (
        <div
          key={entry.id}
          className="workflow-command-status-entry"
          data-command-id={entry.id}
          data-command-presentation={entry.presentation}
          {...buildEntryVisualStateDataAttributes({
            kind: WORKFLOW_CHROME_VISUAL_KINDS.STATUS,
          })}
        >
          {entry.payload?.element || null}
        </div>
      )
    case WORKFLOW_TOOLBAR_ENTRY_KINDS.COMMAND_BUTTON: {
      const { commandId, label, iconClassName, enabled, tooltip, disabledReason, pressed } =
        entry.payload || {}
      const isIconOnly =
        entry.presentation === WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_COMMAND ||
        entry.presentation === WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE
      const isToggle = entry.presentation === WORKFLOW_TOOLBAR_PRESENTATIONS.ICON_ONLY_TOGGLE
      const visualStateDataAttributes = buildEntryVisualStateDataAttributes({
        kind: isToggle ? WORKFLOW_CHROME_VISUAL_KINDS.TOGGLE : WORKFLOW_CHROME_VISUAL_KINDS.COMMAND,
        pressed: isToggle && Boolean(pressed),
        disabled: !enabled,
      })
      const tooltipText = resolveWorkflowChromeTooltipText(
        createWorkflowChromeTooltipMeta({
          label: t(label),
          tooltip: t(tooltip),
          disabledReason: t(disabledReason),
        }),
        visualContract
      )

      return (
        <button
          key={entry.id}
          type="button"
          className={`workflow-command-button${isIconOnly ? ' workflow-command-button-icon-only' : ''}${
            isToggle && pressed ? ' workflow-command-button-pressed' : ''
          }`}
          disabled={!enabled}
          title={t(tooltipText)}
          aria-label={t(tooltipText || label)}
          aria-pressed={isToggle ? Boolean(pressed) : undefined}
          data-command-id={commandId}
          data-command-presentation={entry.presentation}
          data-command-pressed={isToggle ? (pressed ? 'true' : 'false') : undefined}
          data-workflow-tooltip={tooltipText || undefined}
          {...visualStateDataAttributes}
          onClick={() => {
            void onExecuteCommand?.(commandId)
          }}
        >
          <i className={iconClassName}></i>
          {!isIconOnly ? <span>{t(label)}</span> : null}
        </button>
      )
    }
    default:
      return null
  }
}

const WorkflowEditorCommandSurface = ({
  entries = [],
  onExecuteCommand,
  visualContract,
  dockingContext,
}) => {
  const visibleGroups = groupWorkflowToolbarEntries(entries)
  if (visibleGroups.length === 0) {
    return null
  }

  return (
    <div
      className="workflow-editor-command-surface"
      data-testid="workflow-editor-command-surface"
      data-follows-palette={dockingContext?.followsPalette ? 'true' : 'false'}
      data-palette-visible={dockingContext?.paletteVisible ? 'true' : 'false'}
      data-toolbar-left-inset={dockingContext?.leftInset ?? ''}
      data-toolbar-top-inset={dockingContext?.topInset ?? ''}
    >
      {visibleGroups.map((group) => (
        <div key={group.id} className="workflow-command-group" data-command-group={group.id}>
          {group.entries
            .map((entry) =>
              renderToolbarEntry({
                entry,
                onExecuteCommand,
                visualContract,
              })
            )
            .filter(Boolean)}
        </div>
      ))}
    </div>
  )
}

export default WorkflowEditorCommandSurface
