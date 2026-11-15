# React Flow Renderer Contract

## Overview

The approval workflow editor uses React Flow as the only supported renderer for the design-time editor and runtime read-only workflow diagram viewer.

The remaining G6-related source files are compatibility debt for historical adapter behavior and tests. They are not a supported runtime mode and must not be exposed through new schema, URL parameters, globals, or environment flags.

## Current Contract

- `workflow-editor` always renders `ReactFlowDesignerShell`.
- `workflow-diagram-viewer` renders the React Flow canvas in read-only mode.
- New and saved definitions use the approval workflow static metadata contract (`formatVersion: 1`, `form.formType` / `form.formId`).
- V1 and V2 graph inputs are accepted only through the definition-format adapter so historical definitions can be converted to static metadata on save.
- There is no supported G6 fallback mode.

## Migration Rules

- Keep `src/main.js` importing `registerComponent.js`; without that import the `workflow-editor` renderer is never registered with AMIS.
- Do not add `editorMode=g6` URLs or schema props.
- Do not add global or environment switches for G6.
- Do not import `ProcessDesigner` from `registerComponent.js` or runtime renderers.
- Keep static metadata / V1 / V2 format branching inside `translator/definition-format`.
- Keep runtime diagram rendering on React Flow and mark nodes read-only.

## Testing Checklist

Before shipping changes to this package:

- Verify the editor shell renders React Flow panels.
- Verify save payloads remain approval workflow static metadata.
- Verify historical V1/V2 definitions save as approval workflow static metadata; verify editable legacy V1 inputs show the upgrade notice.
- Verify runtime read-only diagrams render active nodes without edit handles.
- Verify no new code path reintroduces G6 as a renderer mode.

## Remaining Cleanup

G6 files can be removed after any tests or adapter utilities that still import them are migrated to React Flow or deleted. Until then, treat them as isolated compatibility debt, not a product surface.
