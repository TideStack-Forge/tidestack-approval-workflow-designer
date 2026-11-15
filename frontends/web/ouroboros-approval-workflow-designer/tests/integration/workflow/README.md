# Approval Workflow Editor Regression Baseline

`tests/integration/workflow/` 是审批流编辑器当前唯一的浏览器回归基线。后续新增 editor 回归时，先判断它属于哪组 journey family，再决定补 unit 还是 browser；不要重新扩大 `designer-smoke.spec.js`，也不要新开第二套 harness。

浏览器层验证当前 React Flow editor / `workflow-diagram-viewer` 主链。存量 unit 中包含旧 renderer 的源码结构断言；这些只能证明源码模式，不能证明运行行为。按统一测试规范，后续覆盖应验证公开入口和可观察结果，不再扩展已删除实现的负向模式断言。

## Regression Layers

- `unit-contract`
  - `tests/unit/src/*.test.js`
  - 验证 page/adapter 合同、删除规划、属性 schema、手势与视口行为；存量源码匹配断言需要逐步收敛为行为验证。
- `browser-harness`
  - `tests/integration/workflow/*.spec.js`
  - 守真实渲染后的交互行为、状态证据和场景组合。
  - 只覆盖当前 React Flow 主链；不要新增 G6 harness、旧 renderer smoke 或 renderer mode URL。
- `host-companion-tests`
  - `frontends/web/main-app/tests/integration/approval-workflow/approval-workflow-smoke.spec.js`
  - `frontends/web/main-app/tests/unit/config/webpack-runtime.test.js`
  - 守 outer host 的微前端挂载与代理映射，不在 designer package 内复制第三套平行验证。

## Scenario Catalog And Observable Surface

- 场景只能从 `tests/integration/workflow/harness/scenarios.js` 登记与复用；不要在 spec 内联匿名 definition fixture、fetcher response 或 condition field source。
- `harness/fixtures.js` 里的分支类夹具已分层：
  - `v2BranchDefinitionFixture` 是 stable V2 基线，只使用 `SEQUENCE + condition/order`
  - `legacyBranchEdgeDefinitionFixture` 只用于旧 `BRANCH/CONTINUE` 读入兼容测试
- 浏览器层默认优先通过 `tests/integration/workflow/helpers/workflowHarnessPage.js` 和 `window.__APPROVAL_WORKFLOW_HARNESS__` 取证。
- `WorkflowHarnessPage.gotoScenario()` 会优先调用 harness 暴露的原地切场景能力，再退回整页跳转；新增多场景 spec 时优先复用这条路径，避免把场景切换本身变成不必要的重载噪声。
- 当前正式 evidence signal 包括：
  - `currentDefinition`
  - `currentCanvasData`
  - `editorInputContract`
  - `reactFlowContractSnapshot`
  - `notifications`
  - `fetcherCalls`
  - `lastSavedDefinition`
  - `viewportTransform`
  - `selectionSnapshot`
  - `selectedNodeIds`
  - `selectedEdgeIds`
  - `diagnosticsSnapshot`
  - `rightPanelText`
- 需要 DOM 级断言时，优先把查询收回 `WorkflowHarnessPage`，不要在 spec 里各写一套一次性 `locator()` / `getByTestId()` 取证。

## Journey Coverage Matrix

| Journey family | Browser spec | Unit / companion guards | Primary scenarios | Primary evidence signals |
| --- | --- | --- | --- | --- |
| `host-surface-and-explicit-source-contract` | `host-surface-and-page-contract.spec.js` | `tests/unit/src/workflow-source-contract.test.js`, `tests/unit/src/integration-adapter.test.js`, `tests/unit/src/workflow-editor-surface-contract.test.js`, `frontends/web/main-app/tests/integration/approval-workflow/approval-workflow-smoke.spec.js`, `frontends/web/main-app/tests/unit/config/webpack-runtime.test.js` | `v2-editable`, `new-flow`, `application-definition-management`, `workflow-viewer`, `branch-editable` | `editorInputContract`, `reactFlowContractSnapshot`, host toolbar / base-info surface |
| `definition-load-save-and-format` | `definition-load-save-and-format.spec.js` | `tests/unit/src/definition-format.test.js`, `tests/unit/src/editor-session.test.js`, `tests/unit/src/save-load-parity.test.js`, `tests/unit/src/integration-adapter.test.js` | `v2-editable`, `new-flow`, `v1-editable`, `remote-v2-source`, `branch-editable` | `currentDefinition`, `currentCanvasData`, `notifications`, `fetcherCalls`, `lastSavedDefinition` |
| `selection-and-diagnostics` | `selection-and-diagnostics.spec.js` | `tests/unit/src/editor-core-contract.test.js`, `tests/unit/src/workflow-diagnostics-contract.test.js`, `tests/unit/src/workflow-inspector-stability.test.js`, `tests/unit/src/react-flow-canvas-contract.test.js` | `new-flow`, `v2-edge-diagnostic`, `branch-missing-condition-source` | `selectionSnapshot`, `selectedNodeIds`, `selectedEdgeIds`, `diagnosticsSnapshot`, `rightPanelText` |
| `delete-and-graph-guardrail` | `delete-and-graph-guardrail.spec.js` | `tests/unit/src/graph-delete-planner.test.js`, `tests/unit/src/react-flow-canvas-contract.test.js`, `tests/unit/src/editor-core-contract.test.js` | `v2-editable`, `branch-editable` | `currentDefinition`, `diagnosticsSnapshot`, delete command surface |
| `property-inspector-stability` | `property-inspector-stability.spec.js` | `tests/unit/src/workflow-inspector-stability.test.js`, `tests/unit/src/reactflow-property-editor-contracts.test.js`, `tests/unit/src/workflow-editor-surface-contract.test.js` | `v2-editable`, `branch-editable` | `rightPanelText`, `fetcherCalls`, `lastDrawerRequest` |
| `gesture-and-viewport` | `gesture-and-viewport.spec.js` | `tests/unit/src/canvas-gesture-contract.test.js`, `tests/unit/src/editor-core-contract.test.js`, `tests/unit/src/react-flow-canvas-contract.test.js`, `tests/unit/src/read-only-flow-canvas.test.js` | `v2-editable`, `workflow-viewer` | `viewportTransform`, `selectedNodeIds`, wheel / drag outcome |
| `drag-drop-and-edge-insert` | `drag-drop-and-edge-insert.spec.js` | `tests/unit/src/react-flow-canvas-contract.test.js`, `tests/unit/src/editor-session.test.js`, `tests/unit/src/definition-format.test.js` | `v2-editable` | `currentDefinition`, `currentCanvasData` |

## Commands

- `npm run test:unit`
  - 模块单测；部分存量源码断言的局限见上文
- `npm run test:integration`
  - browser regression baseline；Playwright 会通过 `playwright.config.js` 自动起 `PLAYWRIGHT_HARNESS=true npm run serve`
- `npm run test:all`
  - 顺序跑完 unit + integration；不要另加平行的 editor test 入口
