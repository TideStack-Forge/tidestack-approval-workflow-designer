# React Flow Editor - Quick Start

## Renderer Contract

React Flow is the default and only supported renderer for the approval workflow editor. No component prop, global flag, or environment variable is required to enable it.

## Feature Comparison

| Feature | React Flow Mode |
|---------|-----------------|
| Drag & Drop | Free-form canvas |
| Node Positioning | User-controlled |
| Viewport Pan/Zoom | Supported |
| Layout Persistence | Saved in definition |
| Validation | Shared workflow rules |
| Properties Panel | Shared node configuration schema |
| Data Format | Approval workflow static metadata (`formatVersion: 1`, `form.formType` / `form.formId`) |

## Definition and Renderer Contract

Persisted definitions use approval workflow static metadata. Historical V1/V2 graph inputs pass through `translator/definition-format` and are saved as static metadata; the editable legacy V1 input shows an upgrade notice. Optional `editorLayout` carries node positions and viewport.

The supported renderer and compatibility boundaries are maintained in the [current renderer contract](./react-flow-rollout.md). React Flow is the only supported renderer.

## Testing

Run unit tests:
```bash
npm run test:unit
```

Run integration tests:
```bash
npm run test:integration
```

## Documentation

- [Renderer Contract](./react-flow-rollout.md) - Current renderer and compatibility boundaries
- [Architecture](../src/canvas-adapters/react-flow/index.js) - Technical implementation entry
- [Testing Guide](../tests/README.md) - Test coverage and standards
