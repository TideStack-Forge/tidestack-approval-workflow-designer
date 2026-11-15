---
doc_type: module-design
module: ouroboros-approval-workflow-designer
status: current
tags: [approval-workflow, workflow-editor, react-flow, frontend]
---

# Approval Workflow Designer Design

## Purpose

`ouroboros-approval-workflow-designer` is the React micro frontend that provides the approval workflow graph editor and read-only diagram viewer.

The editor is intentionally a thin graph editor. It edits workflow graph state, node and edge properties, diagnostics, selection, and viewport commands. Page-level actions such as save, publish, return navigation, version management, and business-model binding writeback belong to the outer page or AMIS form that embeds the editor.

## Stable Entry Points

- AMIS renderer: `workflow-editor`
- Component registration: `src/registerComponent.js`
- Editable path: `ApprovalWorkFlowEditor -> ApprovalWorkflowEditorCore -> ReactFlowDesignerShell -> ReactFlowCanvas`
- Read-only path: `workflow-diagram-viewer -> ReadOnlyFlowCanvas -> ReactFlowCanvas(readonly)`
- Renderer policy: React Flow is the only current product renderer. Do not add a G6 fallback, renderer mode switch, URL flag, or schema-level alternate renderer.

## Definition Model

The editor reads and writes approval workflow definition documents through the versioned definition translators:

- V2 persisted node types are defined in `src/translator/define/persistedNodeTypes.js`.
- V2 node constructors live in `src/translator/define/v2.js`.
- `editor-session` owns mutable graph state and synchronizes changes back to V2 definition output.
- `middle-v2` and `v2-middle` translators convert between the editor's middle graph and persisted V2 documents.

The current node set exposed by the editor includes:

- `StartNode` / `发起节点`
- `ApprovalNode` / `审批节点`
- `HandleNode` / `办理节点`
- `CcNode` / `抄送节点`
- `SubflowNode` / `子流程节点`
- `JoinNode` / `合并节点`
- condition / branch nodes derived from edges and branch structure
- `EndNode` / `结束节点`

`HandleNode` is part of the stable editor path. It is inserted through the React Flow mutation layer, represented in V2 as `HandleNode`, and rendered/validated as `办理节点`.

The visible palette currently exposes approval, handle, cc, subprocess, join-or, and end entries. `StartNode` is initialized by the definition/session path rather than inserted from the palette. Branch and condition structures remain graph-derived or hidden legacy structure, not user-added product nodes.

## Source Contract

The editor does not infer page data from routes, hidden globals, or business model conventions. The outer page must pass explicit sources:

- `formFieldSource` or `formFieldSourceApi`
- `conditionFieldSource` or `conditionFieldSourceApi`
- `candidateSource` or `candidateSourceApi`
- `formPermissionFieldSource` or `formPermissionFieldSourceApi`
- optional `basicInfoFormItems`
- optional basic-info button/container settings

`formFieldSource` is the target contract for form-bound fields. `src/editor-core/workflowSourceContract.js` normalizes this source and derives condition, form-permission, and candidate-field views from the same field list. Design-time and runtime host pages both pass `formFieldSourceApi`; definition management pages use the static approval metadata shape and read form binding from `flowDefinition.form.formType` and `flowDefinition.form.formId`, for example `/api/approval-workflow/base-info/form/${flowDefinition.form.formType}/${flowDefinition.form.formId}/workflow-field`. Existing `conditionFieldSource` and `formPermissionFieldSource` inputs remain adapter-only compatibility inputs for older embeddings and are normalized into the same internal source; they must not become a second long-term source path. Candidate metadata still comes from `candidateSource`, but a `FormField` candidate schema reads its field options from the derived candidate-field view. Candidate field derivation is intentionally limited to form fields whose type is `员工` or `多员工`.

`src/editor-core/workflowSourceContract.js` normalizes form-field, candidate, and form-permission sources. `src/editor-core/coreContract.js` normalizes core capabilities and selection snapshots.

The design-time field endpoint compiles each business field through `FieldTypeCatalog` in the current application's development context and returns the data field's actual `valueType` alongside its business `type`. Field parameters and application-defined field types follow the same compiler as other field projections. Fields without a data projection retain their permission metadata; compilation failures are reported as business errors.

Runtime dynamic-form expression variables carry the compiled data field's `valueType` in their existing extra properties. The runtime field endpoint passes it through without substituting the variable's input control type.

Condition-field normalization uses `valueType` to choose the AMIS input and operators. `Short`, `Integer`, `Long`, `Float`, `Double` and `Decimal` support numeric comparisons; `Date`, `Time` and `DateTime` support temporal comparisons and ranges; `String` supports equality and text matching; other value types support only equality and inequality. Explicit operator lists and defaults are bounded by the value type's allowed operators, including AMIS's select equality operators. Fields without any allowed operators are omitted from the condition view. The unified source retains business field types for the other views. Existing explicit AMIS condition fields without `valueType` keep their native input contracts; business field names are not used to infer storage types.

Saved route conditions may be individual comparisons or condition groups. The inspector projects an individual comparison as a one-item `and` group for condition-builder without rewriting the stored condition on opening. Canvas labels and inspector previews share the plain-text condition formatter, using field labels and option labels when available and field names otherwise.

If a source API still contains unresolved template expressions after the current page data is applied, the editor falls back to an empty normalized source instead of guessing.

## State And Capabilities

`ApprovalWorkflowEditorCore` receives the editable definition value, readonly state, normalized sources, and editor capabilities. The default capability set allows palette insertion, inspector editing, selection deletion, viewport commands, and diagnostics navigation. Readonly mode disables graph mutation while keeping viewport and diagnostics navigation available.

Selection state is represented as a normalized snapshot:

- `none`
- `single-node`
- `single-edge`
- `multi`

Viewport controls belong to `ReactFlowCanvas` and the viewport cluster. Current viewport changes are session-level state and must not be reintroduced as a second page-level persistence path.

## Toolbar Boundary

The editor toolbar owns graph-editor commands only:

- palette insertion
- diagnostics navigation
- node or edge inspector access
- viewport commands
- workflow basic-info popup shell when the outer page provides basic-info fields

The toolbar must not own:

- save or submit
- deploy or offline
- return navigation
- version management
- default business-model binding writeback

Those actions are page responsibilities.

## Validation

Validation is local to the graph editing experience:

- node type and connection rules live under `src/validation` and React Flow adapter files
- condition-field validation uses explicit condition field source data
- diagnostics are surfaced through the editor UI and `onDiagnosticsChange`

Validation messages should point the editor back to missing explicit input rather than silently inventing candidates, fields, or form permissions.

## Test Baseline

The current designer baseline is documented in:

- `tests/README.md`
- `tests/integration/workflow/README.md`
- `docs/manual-testing-guide.md`
- `react-flow-rollout.md`

Use these tests to protect the product path:

- renderer registration for `workflow-editor`
- React Flow canvas rendering and node insertion
- V2 translator round-trip
- branch/condition editing
- readonly diagram rendering
- diagnostics and selection navigation

Do not revive G6 tests as product-path coverage. G6 references are migration history only.

## Change Rules

- Extend the current React Flow path before introducing new editor infrastructure.
- Add node support through the V2 definition contract, middle graph translators, React Flow adapter, property editor, validation, backend codec/transpiler, and testkit together.
- Keep external data as explicit sources passed by the embedding page.
- Keep page actions outside the editor.
- Update this file when the editor public contract changes.

## Interaction Contracts (as built, 2026-09-12)

These are the editor's current shell-local contracts. They were previously kept on the summary page in `docs/design/modules/`; the summary is now a pointer and this is the authoritative copy.

- 设计器与只读 viewer 当前继续共用同一条 React Flow projection / viewport 主链，不新增第二套 viewer surface。
- 顶部 toolbar 当前通过 `workflowToolbarSurfaceContract.js` 这条 shell-local surface contract 统一描述 `meta / view / history / selection / status` 五组 entry；其中当前真实可见的 `meta` 组承载 `baseInfoEntry + diagnostics`，`status` 仅保留为未来扩展组位。基础信息入口已经收紧为 editor-owned 按钮与 dialog/drawer 壳，外层页面只传 `basicInfoFormItems` 和可选 `basicInfoButtonLabel / basicInfoButtonIcon / basicInfoOpenMode`，toolbar 再按 icon 有无稳定区分 `text-only / icon-text`；history group 是否出现仍遵守 `allowHistoryCommands` / `history.available` capability，且当前真实 `canUndo / canRedo / tooltip` 已由 `EditorSession` 的 session-local history snapshot 驱动。
- `view` group 现在已经正式接通 `toggle-palette / toggle-inspector`：palette / inspector 的外层 visible state 统一由 `ReactFlowDesignerShell` 持有，面板内部不再保留侧边手柄，右上角按钮只负责隐藏，重新打开统一回到 toolbar；palette 是否可用继续只由 node catalog 裁剪，readonly 或 `allowPaletteInsert=false` 时不再渲染左侧面板，也不显示 `toggle-palette`。
- diagnostics 当前已经收口为顶部 toolbar 内的状态入口与浮层列表，不再保留右上角常驻 diagnostics 面板；状态图标、摘要和列表继续复用同一份 `WorkflowDiagnosticsSnapshot`。
- toolbar、diagnostics 与右下角 viewport cluster 当前还共享同一份 `workflowChromeVisualContract.js`：按钮高度、圆角、图标尺寸、tone 与 tooltip 优先级统一由 shell-local visual contract 提供；基础信息入口现在支持 `text-only` 与 `icon-text` 两种正式表面，其余命令入口继续按各自 contract 保持 icon-only。
- `ReactFlowCanvas` 当前已通过 history bridge 暴露 `getHistorySnapshot / undo / redo`，`ReactFlowDesignerShell` 只消费 bridge 或 session 提供的 snapshot 并转发命令，不再在 shell 自己拼装假的 history 栈。
- inspector 的默认联动当前已经收紧为 selection 驱动：可编辑场景下，选中节点/连线会默认打开 inspector，selection 清空会默认关闭 inspector；diagnostics 的 node / edge 导航仍可显式打开 inspector，graph 级 diagnostics 仍只驱动视口聚焦。
- 画布首帧定位已经固定为“有图就按图主体自动 framing，空图才保留 placeholder 默认视口”；重新打开同一流程也不恢复历史持久化 viewport。
- viewport 当前只在会话内同步，不再写回 `editorLayout.viewport`；持久化定义里只保留节点布局元数据。
- history scope 当前只覆盖 definition mutation，包括节点/连线结构、节点属性、流程基础信息和稳定布局提交；viewport、selection、panel visible 与 diagnostics popover 继续不进入 undo / redo。
- 右下角 minimap 与缩放/定位 controls 现在按一个 cluster surface 维护，共享宽度和壳层样式；`MiniMap` 需要明确使用数值宽高，避免投影 `viewBox` / mask 漂移成 `NaN`。
- 右侧属性检查器当前继续只由审批流自己的 `RightPanel` 承担正式入口，但其外层表面已经收口为类似逻辑流编辑器的浮动属性壳，并在右上角提供 close-only 按钮；内部属性表单仍沿用审批流自己的 `PropertyEditor -> AmisPropertyForm` 渲染链，不与逻辑流 `PropertiesPanel` 统一。对于可配置节点与普通连线，正式属性面现在只保留真正可操作的表单内容，不再在外壳里重复渲染 `ID / 类型 / 节点名称 / 源节点 / 目标节点` 这类静态摘要，也不再单独罗列一份配置分组标题。

### Stale references removed while moving this section

The summary page also listed `src/nodes/` and `fetchConditionFields()` under key abstractions. Neither exists: node editing lives in `src/views/workflow/components/NodeConfigEditor/`, and there is no `fetchConditionFields` anywhere in the module. The condition-field support that does exist is `src/conditionEscape/`.
